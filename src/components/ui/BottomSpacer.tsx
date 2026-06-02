import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// tabBar: 탭바가 있는 화면 (탭바 높이 + 시스템 네비게이션 바 높이 확보)
// tabBar=false: 스택 화면 (시스템 네비게이션 바 높이만 확보)
export const BottomSpacer: React.FC<{ tabBar?: boolean }> = ({ tabBar = true }) => {
  const { bottom } = useSafeAreaInsets();
  const height = tabBar
    ? Math.max(100, bottom + 80)   // 탭바(~80) + 시스템 네비 바
    : Math.max(24, bottom + 16);   // 시스템 네비 바 + 여유
  return <View style={{ height }} />;
};
