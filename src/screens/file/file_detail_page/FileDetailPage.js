// 회색 프로필 이미지 랜덤 적용을 위한 import 및 배열 정의
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from './file_detail_page_style';
import Bookdetail from './Bookdetail';
import { useNavigation, useRoute } from '@react-navigation/native';

const ELEVENLABS_API_KEY = 'sk_ce094edb48ebcd9c6cd7e8d3e532ef5229033587e104cecc';

const profileImages = [
  require('../../../../assets/profiles/프로필1.png'),
  require('../../../../assets/profiles/프로필2.png'),
  require('../../../../assets/profiles/프로필3.png'),
  require('../../../../assets/profiles/프로필4.png'),
  require('../../../../assets/profiles/프로필5.png'),
  require('../../../../assets/profiles/프로필6.png'),
  require('../../../../assets/profiles/프로필7.png'),
];

export default function FileDetailPage() {
  const navigation = useNavigation();
  const [sound, setSound] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [voiceList, setVoiceList] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const route = useRoute();

  const {
    pdfUri,
    pdfName,
    pdfUri2,
    date,
    uid,
    name,
    default: isDefault,
  } = route.params || {};

  const playVoice = async (file, index) => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync(file);
      setSound(newSound);
      setPlayingIndex(index);
      await newSound.playAsync();

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.isPlaying) {
          setProgress(status.positionMillis / status.durationMillis);
        } else if (status.didJustFinish) {
          setPlayingIndex(null);
          setProgress(0);
        }
      });
    } catch (err) {
      Alert.alert('오류', '음성 파일을 재생할 수 없습니다.');
    }
  };

  const stopVoice = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setPlayingIndex(null);
    setProgress(0);
  };

  const handleTTSStop = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setIsTTSPlaying(false);
  };

  const handleTTSPlay = async () => {
    try {
      setIsTTSPlaying(true);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: extractedText,
          model_id: 'eleven_multilingual_v2',
        }),
      });

      const ttsBlob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        const filePath = FileSystem.documentDirectory + `tts_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(filePath, base64data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { sound: ttsSound } = await Audio.Sound.createAsync({ uri: filePath });
        setSound(ttsSound);

        ttsSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsTTSPlaying(false);
          }
        });

        await ttsSound.playAsync();
      };
      reader.readAsDataURL(ttsBlob);
    } catch (err) {
      console.error('TTS 생성 및 재생 오류:', err);
      setIsTTSPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    const fetchVoiceList = async () => {
      try {
        const userUid = await AsyncStorage.getItem('userUid');
        if (!userUid) return;

        const response = await fetch(
          'https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/voice_id'
        );
        const data = await response.json();

        if (!data.documents) return;

        const voices = data.documents
          .filter((doc) => doc.fields.uid?.stringValue === userUid)
          .map((doc) => ({
            name: `${doc.fields.voiceName?.stringValue || '이름 없는 보이스'}`,
            file: { uri: doc.fields.audioPath?.stringValue || '' },
            voiceId: doc.fields.voiceId?.stringValue || '',
            image: profileImages[Math.floor(Math.random() * profileImages.length)],
          }));

        setVoiceList(voices);
      } catch (err) {
        console.error('voice_id 불러오기 실패:', err);
      }
    };

    fetchVoiceList();
  }, []);

  const handleExtractTextAndShowVoices = async () => {
    if (!pdfUri2) return;
    setLoading(true);
    try {
      const res = await fetch('http://192.168.219.103:5000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pdfUri2 }),
      });
      const data = await res.json();
      setExtractedText(data.text || '');
    } catch (err) {
      console.error('텍스트 추출 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-ios" size={16} color="#473B3B" />
        </TouchableOpacity>
        <Text style={styles.title}>BOOKNOTE</Text>
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.sectionTitle}>보이스 선택</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceScroll}>
        {voiceList.map((voice, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.voiceCard,
              selectedVoiceId === voice.voiceId && {
                borderColor: '#007AFF',
                borderWidth: 1.3,
              },
            ]}
            onPress={() => {
              if (!extractedText) {
                Alert.alert('알림', '먼저 텍스트를 추출해주세요.');
                return;
              }
              Alert.alert(
                '보이스 선택',
                `${voice.name}을 사용하시겠습니까?`,
                [
                  { text: '취소', style: 'cancel' },
                  { text: '확인', onPress: () => setSelectedVoiceId(voice.voiceId) },
                ]
              );
            }}
          >
            <Image source={voice.image} style={styles.avatar} />
            <Text style={styles.voiceName}>{voice.name}</Text>

            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: playingIndex === index ? `${progress * 100}%` : '0%' },
                ]}
              />
            </View>

            <TouchableOpacity
              onPress={() =>
                playingIndex === index
                  ? stopVoice()
                  : playVoice(voice.file, index)
              }
              style={{ marginTop: 6 }}
            >
              <Icon
                name={playingIndex === index ? 'stop' : 'play-arrow'}
                size={20}
                color="#1D1B20"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView vertical showsVerticalScrollIndicator={false} style={styles.bookContainer}>
        <Bookdetail pdfUri2={pdfUri2} />
      </ScrollView>

      <View style={{ marginBottom: 0, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={
            !selectedVoiceId || !extractedText
              ? handleExtractTextAndShowVoices
              : isTTSPlaying
              ? handleTTSStop
              : handleTTSPlay
          }
          disabled={loading}
          style={{
            backgroundColor: '#705F5F',
            paddingVertical: 10,
            paddingHorizontal: 145,
            borderRadius: 15,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{ width: 70, height: 18, alignSelf: 'center', alignItems: 'center' }}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'Pretendard-Bold' }}>
                {!selectedVoiceId || !extractedText
                  ? '텍스트 추출'
                  : isTTSPlaying
                  ? '중지하기'
                  : '음성 듣기'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
