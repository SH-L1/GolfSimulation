import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../screens/Onboarding';
import { LoginScreen } from '../screens/Login';
import { SignUpScreen } from '../screens/SignUp';
import { LevelSettingScreen, STORAGE_KEY_SETUP_DONE } from '../screens/LevelSetting';
import { SwingFeedbackScreen } from '../screens/SwingFeedback';
import { SwingChatScreen } from '../screens/SwingChat';
import { Viewer3DScreen } from '../screens/Viewer3D';
import { ProfileScreen } from '../screens/Profile';

export type RootStackParamList = {
  Onboarding: undefined;
  LevelSetting: { nextScreen?: string } | undefined;
  Login: undefined;
  SignUp: undefined;
  Main: undefined;
  // sessionId: Module1 분석 세션 식별자 (POST /module1/analyze 결과)
  SwingFeedback: { sessionId: string } | undefined;
  // chatSessionId: Module2 채팅 세션 (DELETE /module2/history/{id})
  // sessionId: 연결된 스윙 분석 세션 (컨텍스트 제공용)
  SwingChat: { chatSessionId?: string; sessionId?: string; title?: string } | undefined;
  Viewer3D: { sessionId?: string } | undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_SETUP_DONE).then(value => {
      setInitialRoute(value === 'true' ? 'Main' : 'Onboarding');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8' }}>
        <ActivityIndicator color="#006e1c" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="LevelSetting" component={LevelSettingScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="SwingFeedback" component={SwingFeedbackScreen} />
        <Stack.Screen name="SwingChat" component={SwingChatScreen} />
        <Stack.Screen name="Viewer3D" component={Viewer3DScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
