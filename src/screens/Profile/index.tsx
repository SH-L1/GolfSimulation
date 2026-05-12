import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/ui/AppHeader';
import { useAuth } from '../../hooks/useAuth';
import { getSessions } from '../../api/module1';
import { PLACEHOLDER_URI } from '../../assets';

const C = {
  bg:        '#f8faf8',
  green:     '#006e1c',
  greenMid:  '#4caf50',
  surface:   '#ffffff',
  textPri:   '#191c1b',
  textSub:   '#3f4a3c',
  textMuted: '#6f7a6b',
  border:    'rgba(225,227,225,0.25)',
  blue:      '#0061a4',
  redText:   '#ba1a1a',
  iconBlue:  '#d1e4ff',
  iconPink:  '#ffd9e2',
  iconGreen: '#94f990',
  iconGray:  '#e1e3e1',
  iconRed:   '#ffdad6',
  redBg:     'rgba(255,218,214,0.1)',
  redBorder: 'rgba(186,26,26,0.1)',
};

const LEVEL_LABEL: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

const SETTINGS = [
  { key: 'account',  label: '계정 정보',  sub: 'Personal info and preferences', iconBg: C.iconBlue,  icon: '👤' },
  { key: 'plan',     label: '구독 플랜',  sub: 'Handy Pro+ Monthly Plan',       iconBg: C.iconPink,  icon: '🏷' },
  { key: 'level',    label: '레벨 설정',  sub: '현재 실력 레벨 변경',               iconBg: C.iconGreen, icon: '🏌️' },
  { key: 'settings', label: '앱 설정',   sub: 'Notifications and behavior',    iconBg: C.iconGray,  icon: '⚙️' },
];

type Props = { navigation?: any };

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [totalSessions, setTotalSessions] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      getSessions(1, 1)
        .then(res => setTotalSessions(res.total))
        .catch(() => {});
    }, []),
  );

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation?.navigate('Login');
        },
      },
    ]);
  };

  const levelLabel = LEVEL_LABEL[user?.experience_level ?? 'beginner'] ?? 'Beginner';

  return (
    <View style={s.root}>
      <AppHeader navigation={navigation} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 히어로 프로필 섹션 */}
        <View style={s.hero}>
          <View style={s.profileImgWrap}>
            <Image
              source={{ uri: user?.avatarUrl ?? PLACEHOLDER_URI }}
              style={s.profileImg}
            />
          </View>
          <View style={s.levelBadge}>
            <Text style={s.levelText}>{levelLabel.toUpperCase()}</Text>
          </View>

          <Text style={s.userName}>{user?.name ?? '...'}</Text>
          <Text style={s.userEmail}>{user?.email ?? ''}</Text>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValueBlue}>{user?.handicap ?? '—'}</Text>
              <Text style={s.statLabel}>핸디캡</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValueGreen}>{totalSessions}</Text>
              <Text style={s.statLabel}>총 세션</Text>
            </View>
          </View>
        </View>

        {/* 설정 메뉴 */}
        <View style={s.list}>
          {SETTINGS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={s.listRow}
              activeOpacity={0.7}
              onPress={() =>
                item.key === 'level'
                  ? navigation?.navigate('LevelSetting')
                  : Alert.alert(item.label, '준비 중인 기능입니다.')
              }>
              <View style={s.listLeft}>
                <View style={[s.iconCircle, { backgroundColor: item.iconBg }]}>
                  <Text style={s.iconEmoji}>{item.icon}</Text>
                </View>
                <View>
                  <Text style={s.listLabel}>{item.label}</Text>
                  <Text style={s.listSub}>{item.sub}</Text>
                </View>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          {/* 로그아웃 */}
          <TouchableOpacity
            style={s.logoutRow}
            activeOpacity={0.7}
            onPress={handleLogout}>
            <View style={s.listLeft}>
              <View style={[s.iconCircle, { backgroundColor: C.iconRed }]}>
                <Text style={s.iconEmoji}>↪</Text>
              </View>
              <Text style={s.logoutLabel}>로그아웃</Text>
            </View>
            <Text style={[s.chevron, { color: C.redText }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.versionWrap}>
          <Text style={s.versionText}>HANDY V2.4.0 (BUILD 992)</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation?.navigate('SwingChat')}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, gap: 40 },

  hero: { alignItems: 'center' },
  profileImgWrap: {
    width: 128, height: 128, borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 4, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 10,
  },
  profileImg: { width: '100%', height: '100%' },
  levelBadge: {
    marginTop: -10, marginBottom: 24,
    paddingHorizontal: 16, paddingVertical: 4,
    borderRadius: 999, backgroundColor: C.green,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  levelText:  { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.6 },
  userName:   { fontSize: 30, fontWeight: '700', color: C.textPri, textAlign: 'center', marginBottom: 4 },
  userEmail:  { fontSize: 16, color: C.textSub, textAlign: 'center', marginBottom: 32 },

  statsRow: { flexDirection: 'row', gap: 16, width: '100%' },
  statCard: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 32, padding: 24,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statValueBlue:  { fontSize: 24, fontWeight: '700', color: C.blue,  marginBottom: 4 },
  statValueGreen: { fontSize: 24, fontWeight: '700', color: C.green, marginBottom: 4 },
  statLabel:      { fontSize: 14, color: C.textSub },

  list: { gap: 12 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, borderRadius: 32, padding: 17,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  listLeft:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconCircle: { width: 48, height: 48, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  iconEmoji:  { fontSize: 20 },
  listLabel:  { fontSize: 16, color: C.textPri },
  listSub:    { fontSize: 12, color: C.textSub, marginTop: 2 },
  chevron:    { fontSize: 22, color: C.textSub },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.redBg, borderRadius: 32, padding: 17,
    borderWidth: 1, borderColor: C.redBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  logoutLabel: { fontSize: 16, color: C.redText },

  versionWrap: { alignItems: 'center', paddingTop: 8, opacity: 0.8 },
  versionText: {
    fontSize: 11, fontWeight: '400', color: C.textMuted,
    letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center',
  },

  fab: {
    position: 'absolute', right: 24, bottom: 112,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, zIndex: 20,
  },
  fabIcon: { fontSize: 22 },
});
