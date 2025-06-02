import React, { useState, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  Alert,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { styles } from './main_page_style';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native'; // 즐겨찾기 동기화용 코드
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const profileImages = [
  require('../../../../assets/profiles/프로필1.png'),
  require('../../../../assets/profiles/프로필2.png'),
  require('../../../../assets/profiles/프로필3.png'),
  require('../../../../assets/profiles/프로필4.png'),
  require('../../../../assets/profiles/프로필5.png'),
  require('../../../../assets/profiles/프로필6.png'),
  require('../../../../assets/profiles/프로필7.png'),
];

export default function MainPage() {
  const navigation = useNavigation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [visibleNotes, setVisibleNotes] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [voiceList, setVoiceList] = useState([]);

  const fetchNotes = async () => {
    try {
      const userUid = await AsyncStorage.getItem('userUid');
      if (!userUid) return;

      const url = `https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/pdfFiles`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.documents) return;

      const filtered = data.documents
        .map((doc) => {
          const fields = doc.fields;
          return {
            title: fields.title.stringValue,
            date: fields.createdAt.timestampValue,
            uri: fields.uri.stringValue,
            uri2: fields.uri2?.stringValue || '',
            name: doc.name,
            uid: fields.uid?.stringValue || null,
            default: fields.default?.booleanValue || false,
            isFavorite: fields.isFavorite?.booleanValue || false,
          };
        })
        .filter((doc) => doc.uid === userUid)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setVisibleNotes(filtered);
      setFavorites(filtered.map((doc) => doc.isFavorite));
    } catch (error) {
      console.error('북노트 불러오기 실패:', error);
    }
  };

  useEffect(() => {
    const fetchVoiceNotes = async () => {
      try {
        const userUid = await AsyncStorage.getItem('userUid');
        if (!userUid) return;

        const res = await fetch(
          'https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/voice_id'
        );
        const data = await res.json();
        if (!data.documents) return;

        const result = data.documents
          .filter((doc) => doc.fields.uid?.stringValue === userUid)
          .map((doc) => ({
            uri: doc.fields.audioPath.stringValue,
            name: `${doc.fields.voiceName?.stringValue || '이름 없는 보이스'}`,
            image: profileImages[Math.floor(Math.random() * profileImages.length)],
          }));

        setVoiceList(result);
      } catch (err) {
        console.error('음성 노트 불러오기 실패:', err);
      }
    };

    fetchVoiceNotes();
  }, []);

  useEffect(() => {
    fetchNotes();
  }, []);

  useFocusEffect( // 즐겨찾기 동기화용 코드
    React.useCallback(() => {
      fetchNotes();
    }, [])
  );

  const toggleFavorite = async (index) => {
    const updated = [...favorites];
    updated[index] = !updated[index];
    setFavorites(updated);

    const userUid = await AsyncStorage.getItem('userUid');
    const targetNote = visibleNotes[index];

    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/pdfFiles`
      );
      const data = await res.json();
      const match = data.documents.find(
        (doc) =>
          doc.fields?.uri?.stringValue === targetNote.uri &&
          doc.fields?.uid?.stringValue === userUid
      );

      if (match) {
        await fetch(
          `https://firestore.googleapis.com/v1/${match.name}?updateMask.fieldPaths=isFavorite`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                isFavorite: { booleanValue: updated[index] },
              },
            }),
          }
        );
      }
    } catch (error) {
      console.error('즐겨찾기 업데이트 실패:', error);
    }
  };

  const playVoice = async (uri) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (err) {
      Alert.alert('재생 실패', '음성 파일을 재생할 수 없습니다.');
    }
  };

  const handlePdfPickAndNavigate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const { uri } = result.assets[0];
      setShowAddModal(false);
      navigation.navigate('PdfPage', { uri });
    } catch (error) {
      Alert.alert('PDF 선택 실패', error.message);
    }
  };

  const handleDelete = (index) => {
    Alert.alert(
      '삭제 확인',
      `'${visibleNotes[index].title}' 파일을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const toDelete = visibleNotes[index];
              const userUid = await AsyncStorage.getItem('userUid');

              const res = await fetch(
                `https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/pdfFiles`
              );
              const data = await res.json();
              const match = data.documents.find(
                (doc) =>
                  doc.fields?.uri?.stringValue === toDelete.uri &&
                  doc.fields?.uid?.stringValue === userUid
              );

              if (match) {
                await fetch(
                  `https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/deletedPdfFiles`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      fields: {
                        title: { stringValue: toDelete.title },
                        uri: { stringValue: toDelete.uri },
                        uri2: { stringValue: toDelete.uri2 },
                        uid: { stringValue: toDelete.uid },
                        isFavorite: { booleanValue: toDelete.isFavorite },
                        deletedAt: { timestampValue: new Date().toISOString() },
                      },
                    }),
                  }
                );

                await fetch(`https://firestore.googleapis.com/v1/${match.name}`, {
                  method: 'DELETE',
                });

                const deleted = [...visibleNotes];
                deleted.splice(index, 1);
                setVisibleNotes(deleted);

                const updatedFav = [...favorites];
                updatedFav.splice(index, 1);
                setFavorites(updatedFav);
              }
            } catch (e) {
              Alert.alert('삭제 실패', '오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safearea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8F9" />

      <View contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>TOnePick</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.navigate('ListPage')}
          >
            <Image style={styles.menuIcon} source={require('../../../../assets/Icon Button.png')} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>보이스 노트</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VoicePage')}>
            <Text style={styles.seeMore}>더보기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceScroll}>
          {voiceList.map((item, index) => (
            <TouchableOpacity key={index} onPress={() => playVoice(item.uri)}>
              <View style={styles.voiceCard}>
                <Image source={item.image} style={styles.voiceImage} />
                <Text style={styles.voiceName}>{item.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>북노트</Text>
          <TouchableOpacity onPress={() => navigation.navigate('FilePage')}>
            <Text style={styles.seeMore}>더보기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.bookcontainer}>
          {visibleNotes.map((book, index) => (
            <TouchableOpacity
              key={index}
              onPress={() =>
                navigation.navigate('FileDetailPage', {
                  pdfUri: book.uri,
                  pdfName: book.title,
                  pdfUri2: book.uri2,
                  date: book.date,
                  uid: book.uid,
                  name: book.name,
                  default: book.default,
                })
              }
            >
              <View style={styles.bookCard}>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookLabel}>PDF</Text>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  <Text style={styles.bookDate}>
                    {new Date(book.date).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }).replace(/\. /g, '.').replace('.', '.')}
                  </Text>
                </View>
                <View
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    bottom: 12,
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  <TouchableOpacity onPress={() => handleDelete(index)} style={{ marginBottom: 13 }}>
                    <Icon name="more-vert" size={20} color="#A9A9A9" top = {9}/>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleFavorite(index)}>
                    <Icon
                      name={favorites[index] ? 'favorite' : 'favorite-border'}
                      size={20}
                      color={favorites[index] ? '#FF6B6B' : '#A9A9A9'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="home" size={26} color="#473B3B" />
          <Text style={styles.navLabelActive}>홈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ProfilePage')}>
          <Icon name="person" size={24} color="#A9A9A9" />
          <Text style={styles.navLabel}>내 정보</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Icon name="add" size={25} color="#ffffff" />
      </TouchableOpacity>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새로 만들기</Text>
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowAddModal(false);
                  navigation.navigate('RecordPage');
                }}
              >
                <Image source={require('../../../../assets/mic.png')} style={styles.modalIcon} />
                <Text style={styles.modalLabel}>녹음</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalButton} onPress={handlePdfPickAndNavigate}>
                <Image source={require('../../../../assets/pdf.png')} style={styles.modalIcon} />
                <Text style={styles.modalLabel}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}