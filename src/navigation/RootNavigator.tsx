import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TabNavigator } from './TabNavigator';
import { SwingFeedbackScreen } from '../screens/SwingFeedback';
import { SwingChatScreen } from '../screens/SwingChat';
import { Viewer3DScreen } from '../screens/Viewer3D';
import { ProfileScreen } from '../screens/Profile';

export type RootStackParamList = {
  Main: undefined;
  SwingFeedback: undefined;
  SwingChat: { title?: string } | undefined;
  Viewer3D: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="SwingFeedback" component={SwingFeedbackScreen} />
        <Stack.Screen name="SwingChat" component={SwingChatScreen} />
        <Stack.Screen name="Viewer3D" component={Viewer3DScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
