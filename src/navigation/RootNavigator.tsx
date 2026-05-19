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
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

export type { RootStackParamList };

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    if (__DEV__) {
      setInitialRoute('Onboarding');
      return;
    }
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};
