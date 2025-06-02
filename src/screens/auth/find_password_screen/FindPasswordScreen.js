// FindPasswordScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { styles } from './find_password_screen_style';
import BeforeNavigator from '../../../navigations/BeforeNavigator';
import { useNavigation } from '@react-navigation/native';
import { FIREBASE_API_KEY } from '../../../firebase/firebaseConfig';

const FindPasswordScreen = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handlePasswordChange = async () => {
    if (!email || !name || !phone) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요');
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('이메일 오류', '올바른 이메일 주소를 입력해주세요');
      return;
    }

    // 휴대폰 번호 숫자만 검사
    const phoneRegex = /^\d+$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert('전화번호 오류', '숫자만 입력해주세요');
      return;
    }

    try {
      const response = await fetch(
        'https://firestore.googleapis.com/v1/projects/tonpick-7e5d2/databases/(default)/documents/users'
      );
      const data = await response.json();

      if (!data.documents) {
        Alert.alert('오류', '사용자 정보를 불러올 수 없습니다');
        return;
      }

      const matchedUser = data.documents.find((doc) => {
        const fields = doc.fields;
        return (
          fields.email?.stringValue === email &&
          fields.name?.stringValue === name &&
          fields.phone?.stringValue === phone
        );
      });

      if (!matchedUser) {
        Alert.alert('일치하는 사용자 없음', '입력한 정보와 일치하는 사용자가 없습니다');
        return;
      }

      const resetRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: email,
          }),
        }
      );

      const resetData = await resetRes.json();

      if (resetData.error) {
        Alert.alert('실패', '비밀번호 재설정 이메일 전송에 실패했습니다');
      } else {
        Alert.alert('성공', '비밀번호 재설정 이메일을 전송했습니다');
      }
    } catch (error) {
      Alert.alert('오류', '비밀번호 찾기 처리 중 문제가 발생했습니다');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ position: 'relative', top: 50, left: 10, zIndex: 10 }}>
        <BeforeNavigator onPress={() => navigation.goBack()} />
      </View>

      <View
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <View style={[styles.container, { flex: 1, justifyContent: 'flex-start', paddingBottom: 50 }]}>
          <Text style={styles.title}>비밀번호 변경하기</Text>
          <View style={styles.separator} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예) 홍길동"
              placeholderTextColor="#C6C6C6"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이메일 주소</Text>
            <TextInput
              style={styles.input}
              placeholder="예) sunmoon@ac.kr"
              placeholderTextColor="#C6C6C6"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>휴대폰 번호</Text>
            <TextInput
              style={styles.input}
              placeholder="숫자만 입력"
              placeholderTextColor="#C6C6C6"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handlePasswordChange}>
            <Text style={styles.submitButtonText}>변경하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default FindPasswordScreen;
// 로그인 화면에서 비밀번호 찾기