//uploadVoiceClone.js
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ELEVENLABS_API_KEY = 'sk_ce094edb48ebcd9c6cd7e8d3e532ef5229033587e104cecc';

export const uploadVoiceClone = async (recordedUris, voiceName, onSuccess) => {
  if (recordedUris.length !== 7) {
    Alert.alert('알림', '녹음이 7개 모두 완료되어야 합니다.');
    return;
  }

  try {
    const formData = new FormData();
    recordedUris.forEach((uri, idx) => {
      formData.append('files', {
        uri,
        name: `recording_${idx + 1}.m4a`,
        type: 'audio/m4a',
      });
    });

    // ⬇️ 사용자 입력값 voiceName을 서버에 전달
    formData.append('name', voiceName);

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const data = await response.json();
    if (!data?.voice_id) {
      Alert.alert('실패', 'Voice ID 생성에 실패했습니다.');
      return;
    }

    const voiceId = data.voice_id;
    console.log('✅ 생성된 Voice ID:', voiceId);

    // ⬇️ 사용자 이름 반영된 문장
    const text = `안녕하세요. 저는 ${voiceName}를 기반으로 만들어진 인공지능 음성입니다.`;

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    });

    const ttsBlob = await ttsRes.blob();

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result.split(',')[1];
      const uniqueFileName = `my_voice_output_${Date.now()}.mp3`;
      const filePath = FileSystem.documentDirectory + uniqueFileName;

      await FileSystem.writeAsStringAsync(filePath, base64data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('🎧 저장 완료:', filePath);

      // ⬇️ Firestore 저장에 voiceName 추가
      const uid = await AsyncStorage.getItem('userUid');
      if (!uid) {
        Alert.alert('오류', '로그인 정보가 없습니다.');
        return;
      }

      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/voice_id`;

      await fetch(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            uid: { stringValue: uid },
            voiceId: { stringValue: voiceId },
            voiceName: { stringValue: voiceName },
            audioPath: { stringValue: filePath },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      console.log('📥 Firestore 저장 완료');

      Alert.alert(
        'TTS 생성 완료',
        '들어보시겠습니까?',
        [
          { text: '취소', style: 'cancel', onPress: () => onSuccess?.() },
          {
            text: '확인',
            onPress: async () => {
              const { sound } = await Audio.Sound.createAsync({ uri: filePath });
              await sound.setVolumeAsync(1.0); 
              await sound.playAsync();
              onSuccess?.();
            },
          },
        ],
        { cancelable: false }
      );
    };

    reader.readAsDataURL(ttsBlob);
  } catch (err) {
    console.error('❌ 전체 에러:', err);
    Alert.alert('에러', 'Voice 업로드 중 문제가 발생했습니다.');
  }
};
