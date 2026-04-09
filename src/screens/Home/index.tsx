import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/ui/AppHeader';

import { PLACEHOLDER_URI } from '../../assets';

// TODO: 실제 에셋으로 교체 필요 (src/assets/index.ts 참고)
const imgCaddyCharacter = PLACEHOLDER_URI;
const imgSwingThumbnail = PLACEHOLDER_URI;

const C = {
  bg:            '#f8faf8',
  surface:       '#ffffff',
  green:         '#006e1c',
  greenMid:      '#4caf50',
  greenLight:    'rgba(76,175,80,0.10)',
  greenPill:     '#94f990',
  blue:          '#0061a4',
  blueLight:     'rgba(51,160,253,0.10)',
  bluePill:      '#d1e4ff',
  textPrimary:   '#191c1b',
  textSecondary: '#3f4a3c',
  textMuted:     '#78716c',
  textFaint:     '#a8a29e',
  navInactive:   '#9ca3af',
  shadow:        'rgba(0,0,0,0.05)',
};

// 목업 데이터
const MOCK_USER = { name: '알…', level: '초보' };
const MOCK_SWING = {
  date: '2026-03-04',
  score: 65,
  power: 72,
  tempo: 58,
  summary: 'Good overall, but focus on the X-Factor at the top phase.',
};
const MOCK_STATS = [
  { label: 'Consistency', value: '82%', delta: '+5%', deltaColor: C.green, progress: 0.82, barColor: C.green },
  { label: 'Avg Speed',   value: '94',  unit: 'mph',  delta: undefined, deltaColor: undefined, progress: 0.65, barColor: C.blue },
];

type Props = { navigation?: any };

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader navigation={navigation} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 히어로 인사 카드 */}
        <View style={s.heroCard}>
          <View style={s.heroText}>
            <Text style={s.heroGreeting}>안녕하세요, {MOCK_USER.name}</Text>
            <Text style={s.heroSub}>오늘 더 멋진 스윙을 할 준비가{'\n'}되셨나요?</Text>
            <View style={s.levelBadge}>
              <Text style={s.levelText}>{MOCK_USER.level}</Text>
            </View>
          </View>
          <View style={s.heroCharacterWrap}>
            <View style={s.heroCharacterBg} />
            <Image source={{ uri: imgCaddyCharacter }} style={s.heroCharacter} />
          </View>
        </View>

        {/* 퀵 액션 그리드 */}
        <View style={s.quickGrid}>
          {/* 스윙 기록하기 — 전체 너비 */}
          <TouchableOpacity
            style={s.btnRecord}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SwingUpload')}>
            <View style={s.btnRecordIcon}>
              <Text style={s.btnRecordIconText}>🎥</Text>
            </View>
            <Text style={s.btnRecordLabel}>스윙 기록하기</Text>
            <Text style={s.btnRecordArrow}>→</Text>
          </TouchableOpacity>

          {/* 영상 업로드 + AI 코칭 — 나란히 */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={s.btnSmall}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('SwingUpload')}>
              <View style={[s.btnSmallIcon, { backgroundColor: C.bluePill }]}>
                <Text>⬆️</Text>
              </View>
              <Text style={s.btnSmallLabel}>영상 업로드</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnSmall}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('SwingChat')}>
              <View style={[s.btnSmallIcon, { backgroundColor: '#ffd9e2' }]}>
                <Text>🤖</Text>
              </View>
              <Text style={s.btnSmallLabel}>AI 코칭 시작</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 최근 스윙 */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>최근 스윙</Text>
            <Text style={s.sectionDate}>{MOCK_SWING.date}</Text>
          </View>
          <View style={s.swingCard}>
            {/* 썸네일 */}
            <View style={s.swingThumb}>
              <Image source={{ uri: imgSwingThumbnail }} style={s.swingThumbImg} />
              {/* 점수 뱃지 */}
              <View style={s.scoreBadge}>
                <Text style={s.scoreBadgeLabel}>SCORE</Text>
                <Text style={s.scoreBadgeValue}>{MOCK_SWING.score}</Text>
              </View>
              {/* 하단 태그 */}
              <View style={s.thumbTags}>
                <View style={s.thumbTag}>
                  <Text style={s.thumbTagText}>POWER: {MOCK_SWING.power}</Text>
                </View>
                <View style={s.thumbTag}>
                  <Text style={s.thumbTagText}>TEMPO: {MOCK_SWING.tempo}</Text>
                </View>
              </View>
            </View>
            {/* 분석 요약 */}
            <View style={s.swingAnalysis}>
              <View style={s.analysisBullet} />
              <View style={{ flex: 1 }}>
                <Text style={s.analysisLabel}>분석 요약</Text>
                <Text style={s.analysisSummary}>{MOCK_SWING.summary}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 오늘의 프로 팁 */}
        <View style={s.tipCard}>
          <View style={s.tipHeader}>
            <Text style={s.tipIcon}>🎓</Text>
            <Text style={s.tipTitle}>Today's Pro Tip</Text>
          </View>
          <Text style={s.tipBody}>
            <Text style={{ fontWeight: '700' }}>Beginners:</Text>
            {" Don't worry about distance.\nFocus on keeping your lead arm straight during the backswing."}
          </Text>
          <TouchableOpacity
            style={s.tipBtn}
            onPress={() => navigation?.navigate('Viewer3D')}>
            <Text style={s.tipBtnText}>WATCH DRILLS ›</Text>
          </TouchableOpacity>
        </View>

        {/* 통계 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.statsScroll}>
          {MOCK_STATS.map(stat => (
            <View key={stat.label} style={s.statCard}>
              <Text style={s.statLabel}>{stat.label.toUpperCase()}</Text>
              <View style={s.statValueRow}>
                <Text style={s.statValue}>{stat.value}</Text>
                {stat.unit && <Text style={s.statUnit}>{stat.unit}</Text>}
                {stat.delta && <Text style={[s.statDelta, { color: stat.deltaColor }]}>{stat.delta}</Text>}
              </View>
              <View style={s.statBarBg}>
                <View style={[s.statBarFill, { width: `${stat.progress * 100}%`, backgroundColor: stat.barColor }]} />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB — AI 채팅 */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => navigation?.navigate('SwingChat')}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },

  // 히어로 카드
  heroCard: {
    backgroundColor: C.greenLight,
    borderRadius: 28,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  heroText: { flex: 1, gap: 4 },
  heroGreeting: { fontSize: 22, fontWeight: '700', color: '#005313' },
  heroSub: { fontSize: 13, color: C.textSecondary, lineHeight: 20, marginBottom: 8 },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.bluePill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelText: { fontSize: 10, color: '#001d36', fontWeight: '600', letterSpacing: 0.5 },
  heroCharacterWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  heroCharacterBg: {
    position: 'absolute',
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: C.greenPill,
    opacity: 0.2,
  },
  heroCharacter: { width: 80, height: 80, resizeMode: 'contain' },

  // 퀵 액션
  quickGrid: { gap: 12 },
  btnRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 28,
    padding: 18,
    backgroundColor: C.green,
    // gradient 대체: 단색
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  btnRecordIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  btnRecordIconText: { fontSize: 20 },
  btnRecordLabel: { flex: 1, fontSize: 17, fontWeight: '600', color: '#fff' },
  btnRecordArrow: { fontSize: 18, color: '#fff' },

  btnSmallRow: { flexDirection: 'row', gap: 12 },
  btnSmall: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 28,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  btnSmallIcon: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  btnSmallLabel: { fontSize: 13, fontWeight: '500', color: C.textPrimary },

  // 최근 스윙
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  sectionDate: { fontSize: 12, color: C.textMuted },
  swingCard: {
    backgroundColor: C.surface,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  swingThumb: { height: 192, position: 'relative' },
  swingThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  scoreBadge: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  scoreBadgeLabel: { fontSize: 9, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  scoreBadgeValue: { fontSize: 20, fontWeight: '700', color: C.green },
  thumbTags: { position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', gap: 6 },
  thumbTag: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  thumbTagText: { fontSize: 9, color: '#fff', fontWeight: '500' },
  swingAnalysis: {
    backgroundColor: '#f2f4f2',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    gap: 12,
  },
  analysisBullet: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.greenPill,
    marginTop: 2,
  },
  analysisLabel: { fontSize: 10, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.6, marginBottom: 4, textTransform: 'uppercase' },
  analysisSummary: { fontSize: 13, color: C.textSecondary, lineHeight: 19 },

  // 프로 팁
  tipCard: {
    backgroundColor: C.blueLight,
    borderLeftWidth: 4,
    borderLeftColor: C.blue,
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipIcon: { fontSize: 16 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: C.blue },
  tipBody: { fontSize: 13, color: '#00355c', lineHeight: 22 },
  tipBtn: { marginTop: 4 },
  tipBtnText: { fontSize: 11, fontWeight: '700', color: C.blue, letterSpacing: -0.3 },

  // 통계
  statsScroll: { gap: 14, paddingBottom: 4 },
  statCard: {
    width: 140,
    backgroundColor: C.surface,
    borderRadius: 28,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: { fontSize: 9, color: C.textFaint, fontWeight: '600', letterSpacing: 0.9 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  statUnit: { fontSize: 9, color: C.textMuted, fontWeight: '500' },
  statDelta: { fontSize: 9, fontWeight: '600' },
  statBarBg: { height: 4, backgroundColor: '#f5f5f4', borderRadius: 999, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 999 },

  // FAB
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 90,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: C.greenMid,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: { fontSize: 22 },
});
