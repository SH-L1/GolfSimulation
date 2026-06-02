import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, BackHandler, ToastAndroid } from 'react-native';
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
import { CameraScreen } from '../screens/Camera';
import { navigationRef } from './navigationRef';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';

export type { RootStackParamList };

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { loading, isLoggedIn } = useAuth();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const lastBackPressed = useRef<number>(0);

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      setInitialRoute('Onboarding');
      return;
    }
    AsyncStorage.getItem(STORAGE_KEY_SETUP_DONE).then(value => {
      setInitialRoute(value === 'true' ? 'Main' : 'LevelSetting');
    });
  }, [loading, isLoggedIn]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }
      const now = Date.now();
      if (now - lastBackPressed.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressed.current = now;
      ToastAndroid.show('한 번 더 누르면 앱이 종료됩니다', ToastAndroid.SHORT);
      return true;
    });
    return () => subscription.remove();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf8' }}>
        <ActivityIndicator color="#006e1c" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
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
        <Stack.Screen name="Camera" component={CameraScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
