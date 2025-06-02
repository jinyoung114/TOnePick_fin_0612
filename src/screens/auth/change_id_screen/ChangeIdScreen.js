// ChangeIdScreen.js (아이디 찾기 화면)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { styles } from './Change_id_screen_style';
import BeforeNavigator from '../../../navigations/BeforeNavigator';
import { useNavigation } from '@react-navigation/native';

//  Firestore 관련 모듈 import
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig'; // 🔥 Firestore 인스턴스

const ChangeIdScreen = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  //  아이디 찾기 함수
  const handleFindId = async () => {
    if (!email || !phone) {
      Alert.alert('입력 오류', '이메일과 전화번호를 모두 입력해주세요.');
      return;
    }

    try {
      const usersRef = collection(db, 'users'); //  컬렉션 참조 정확히 작성
      const q = query(usersRef, where('email', '==', email), where('phone', '==', phone));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        Alert.alert('아이디 확인', `회원님의 아이디는 "${userData.userId}" 입니다.`);
      } else {
        Alert.alert('일치하는 정보 없음', '입력하신 정보와 일치하는 아이디가 없습니다.');
      }
    } catch (error) {
      console.error('아이디 조회 오류:', error);
      Alert.alert('오류 발생', '아이디 조회 중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <TouchableOpacity
        style={{
          position: "relative",
          top: 50,
          left: 10,
          zIndex: 10,
        }}
      >
        <BeforeNavigator onPress={() => navigation.goBack()} />
      </TouchableOpacity>

      <View style={styles.container}>
        <Text style={styles.title}>아이디 찾기</Text>
        <View style={styles.separator} />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>이메일 주소를 입력해주세요.</Text>
          <TextInput
            style={styles.input}
            placeholder="예)sunmoon123@sunmoon.kr"
            placeholderTextColor="#C6C6C6"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>휴대폰 번호를 입력해주세요.</Text>
          <TextInput
            style={styles.input}
            placeholder="숫자를 입력해주세요."
            placeholderTextColor="#C6C6C6"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleFindId}>
          <Text style={styles.submitButtonText}>찾기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ChangeIdScreen;
