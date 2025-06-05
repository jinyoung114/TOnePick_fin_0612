import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { styles } from './deleted_voice_page_style';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const profileImages = [
  require('../../../../assets/profiles/프로필1.png'),
  require('../../../../assets/profiles/프로필2.png'),
  require('../../../../assets/profiles/프로필3.png'),
  require('../../../../assets/profiles/프로필4.png'),
  require('../../../../assets/profiles/프로필5.png'),
  require('../../../../assets/profiles/프로필6.png'),
  require('../../../../assets/profiles/프로필7.png'),
];

export default function DeletedVoicePage() {
  const navigation = useNavigation();
  const [voiceList, setVoiceList] = useState([]);
  const [sound, setSound] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    const fetchDeletedVoices = async () => {
      try {
        const userUid = await AsyncStorage.getItem('userUid');
        if (!userUid) return;

        const res = await fetch(
          'https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/deletedVoiceFiles'
        );
        const data = await res.json();
        if (!data.documents) return;

        const now = new Date();
        const validVoices = data.documents.filter(doc => {
          const uid = doc.fields.uid?.stringValue;
          const deletedAt = new Date(doc.fields.deletedAt.timestampValue);
          const daysDiff = (now - deletedAt) / (1000 * 60 * 60 * 24);
          return uid === userUid && daysDiff <= 30;
        }).map(doc => ({
          name: `${(doc.fields.voiceName?.stringValue || '삭제된 보이스').replace(/\(.*?\)/g, '').trim()}`,
          file: { uri: doc.fields.audioPath.stringValue },
          firestoreName: doc.name,
          image: profileImages[Math.floor(Math.random() * profileImages.length)],
        }));

        setVoiceList(validVoices);
      } catch (err) {
        console.error('삭제된 보이스 불러오기 실패:', err);
      }
    };
    fetchDeletedVoices();
  }, []);

  useEffect(() => {
    let interval;
    if (sound) {
      interval = setInterval(async () => {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          setProgress(prev => ({
            ...prev,
            [playingIndex]: status.positionMillis / status.durationMillis,
          }));
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [sound, playingIndex]);

  const playVoice = async (file, index) => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    const { sound: newSound } = await Audio.Sound.createAsync(file);
    setSound(newSound);
    setPlayingIndex(index);
    await newSound.playAsync();
  };

  const handleDelete = async (index) => {
    Alert.alert(
      '삭제 확인',
      `'${voiceList[index].name}' 보이스를 영원히 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`https://firestore.googleapis.com/v1/${voiceList[index].firestoreName}`, {
                method: 'DELETE',
              });
              const updatedList = [...voiceList];
              updatedList.splice(index, 1);
              setVoiceList(updatedList);
            } catch (e) {
              Alert.alert('삭제 실패', '완전 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleRestore = async (index) => {
    Alert.alert(
      '복구 확인',
      `'${voiceList[index].name}' 보이스를 복구하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복구',
          onPress: async () => {
            try {
              const doc = voiceList[index];
              await fetch('https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/voice_id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: {
                    voiceName: { stringValue: doc.name },
                    audioPath: { stringValue: doc.file.uri },
                    uid: { stringValue: (await AsyncStorage.getItem('userUid')) || '' },
                    isFavorite: { booleanValue: false },
                    createdAt: { timestampValue: new Date().toISOString() },
                  }
                })
              });

              await fetch(`https://firestore.googleapis.com/v1/${doc.firestoreName}`, {
                method: 'DELETE'
              });

              const updatedList = [...voiceList];
              updatedList.splice(index, 1);
              setVoiceList(updatedList);
            } catch (err) {
              Alert.alert('복구 실패', '복구 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-ios" size={18} color="#473B3B" />
        </TouchableOpacity>
        <Text style={styles.title}>TOnePick</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>삭제된 보이스</Text>
        <Text style={styles.sectionDesc}>당신이 삭제한 목소리를 모아놨어요.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.cardList}>
        {voiceList.map((voice, index) => (
          <View key={index} style={styles.card}>
            <Image source={voice.image} style={styles.cardImage} />
            <Text style={styles.cardName}>{voice.name}</Text>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${(progress[index] || 0) * 100}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.cardIcons}>
              <TouchableOpacity onPress={() => handleRestore(index)}>
                <Icon name="cached" size={20} color="#473B3B" top={2}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => playVoice(voice.file, index)}>
                <Icon name="play-arrow" size={24} color="#1D1B20" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(index)}>
                <Icon name="delete" size={20} color="#AEAEAE" top={1} />
              </TouchableOpacity>
            </View>

          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
