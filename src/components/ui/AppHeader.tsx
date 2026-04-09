import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLACEHOLDER_URI } from '../../assets';

// TODO: 실제 에셋으로 교체 필요 (src/assets/index.ts 참고)
const imgUserProfile = PLACEHOLDER_URI;

const C = {
  bg:        '#f8faf8',
  green:     '#006e1c',
  greenMid:  '#4caf50',
  textMuted: '#78716c',
  backBg:    'rgba(0,110,28,0.08)',
};

export type AppHeaderProps = {
  /** react-navigation navigation object */
  navigation?: any;
  /** 타이틀 텍스트 (기본값: 'CaddyMaster') */
  title?: string;
  /** 우측에 커스텀 엘리먼트를 렌더링할 경우 사용 */
  rightElement?: React.ReactNode;
  /** 배경 투명 여부 */
  transparent?: boolean;
};

/**
 * 앱 전체 공통 상단 앱바.
 * - canGoBack() == true  → 좌측에 뒤로가기 버튼 + 타이틀
 * - canGoBack() == false → 좌측에 아바타(탭 → Profile) + 타이틀
 * - 우측: 설정 버튼 또는 rightElement
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  navigation,
  title = 'CaddyMaster',
  rightElement,
  transparent = false,
}) => {
  const isTabScreen = navigation?.getState?.()?.type === 'tab';
  const canGoBack = !isTabScreen && (navigation?.canGoBack?.() ?? false);

  return (
    <SafeAreaView
      edges={['top']}
      style={[s.safeArea, transparent && s.transparent]}>
      <View style={s.bar}>

        {/* 좌측 */}
        <View style={s.left}>
          {canGoBack ? (
            /* 뒤로가기 버튼 */
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>
          ) : (
            /* 아바타 → 프로필 이동 */
            <TouchableOpacity
              style={s.avatarWrap}
              onPress={() => navigation?.navigate('Profile')}
              activeOpacity={0.8}>
              <Image source={{ uri: imgUserProfile }} style={s.avatarImg} />
            </TouchableOpacity>
          )}
          <Text style={s.title}>{title}</Text>
        </View>

        {/* 우측 */}
        {rightElement !== undefined ? (
          rightElement
        ) : (
          <TouchableOpacity style={s.settingsBtn}>
            <Text style={s.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea:    { backgroundColor: C.bg, zIndex: 10 },
  transparent: { backgroundColor: 'transparent' },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // 뒤로가기 버튼
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.backBg,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: {
    fontSize: 26, lineHeight: 30,
    color: C.green, fontWeight: '600',
    marginLeft: -1,
  },

  // 아바타 버튼
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: C.greenMid,
    overflow: 'hidden', backgroundColor: '#e1e3e1',
  },
  avatarImg: { width: '100%', height: '100%' },

  title: {
    fontSize: 20, fontWeight: '800',
    color: C.green, letterSpacing: -0.5,
  },

  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 18, color: C.textMuted },
});
