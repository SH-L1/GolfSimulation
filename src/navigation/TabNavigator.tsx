import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Dimensions, PixelRatio } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/Home';
import { SwingUploadScreen } from '../screens/SwingUpload';
import { SwingChatScreen } from '../screens/SwingChat';
import { RecordsScreen } from '../screens/Records';

export type TabParamList = {
  Home: undefined;
  SwingUpload: undefined;
  SwingChat: undefined;
  Records: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_BG   = '#ffffff';
const ACTIVE   = '#006e1c';
const INACTIVE = '#9ca3af';

const BASE_WIDTH = 375;
const { width: SW } = Dimensions.get('window');
const scale = (size: number) =>
  PixelRatio.roundToNearestPixel((SW / BASE_WIDTH) * size);

const BAR_HEIGHT = Math.min(Math.max(scale(76), 64), 96);
const PILL_W     = scale(52);
const PILL_H     = scale(28);
const EMOJI_SIZE = scale(18);
const LABEL_SIZE = Math.min(Math.max(scale(9), 10), 12);

/** 아이콘만 담당 — 레이블은 Navigator가 별도로 처리 */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[tab.pill, focused && tab.pillActive]}>
      <Text style={tab.emoji}>{emoji}</Text>
    </View>
  );
}

export const TabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const barHeight = BAR_HEIGHT + insets.bottom;

  return (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: [tab.bar, { height: barHeight, paddingBottom: insets.bottom }],
      tabBarActiveTintColor: ACTIVE,
      tabBarInactiveTintColor: INACTIVE,
      tabBarLabelStyle: tab.label,
      tabBarItemStyle: { paddingTop: scale(8) },
    }}>
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarLabel: '홈',
        tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="SwingUpload"
      component={SwingUploadScreen}
      options={{
        tabBarLabel: '분석',
        tabBarIcon: ({ focused }) => <TabIcon emoji="🏌️" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="SwingChat"
      component={SwingChatScreen}
      options={{
        tabBarLabel: '채팅',
        tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,

      }}
    />
    <Tab.Screen
      name="Records"
      component={RecordsScreen}
      options={{
        tabBarLabel: '타임라인',
        tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
      }}
    />
  </Tab.Navigator>
  );
};

const tab = StyleSheet.create({
  bar: {
    position: 'absolute',
    backgroundColor: TAB_BG,
    borderTopWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: BAR_HEIGHT,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
  pill: {
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: 'rgba(0,110,28,0.08)',
  },
  emoji: { fontSize: EMOJI_SIZE },
  label: {
    fontSize: LABEL_SIZE,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
