import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 탭바 위에 떠 있는 FAB의 bottom 값 계산
// tabBar=true: 탭 화면 (탭바 + 시스템 네비 바 모두 회피)
// tabBar=false: 스택 화면 (시스템 네비 바만 회피)
export const useFabBottom = (tabBar = true): number => {
  const { bottom } = useSafeAreaInsets();
  return tabBar ? Math.max(90, bottom + 82) : Math.max(20, bottom + 16);
};
