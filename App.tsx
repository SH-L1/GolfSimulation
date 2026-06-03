import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeKakaoSDK } from '@react-native-kakao/core';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { KAKAO_APP_KEY } from './src/constants/oauth';

export default function App() {
  useEffect(() => {
    initializeKakaoSDK(KAKAO_APP_KEY);
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0F1923" />
        <RootNavigator />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
