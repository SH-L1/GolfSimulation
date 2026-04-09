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
const imgSwingFrame   = PLACEHOLDER_URI;
const imgDrillPreview = PLACEHOLDER_URI;

const C = {
  bg:          '#f8faf8',
  surface:     '#ffffff',
  green:       '#006e1c',
  greenMid:    '#4caf50',
  greenLight:  'rgba(0,110,28,0.10)',
  greenPill:   '#94f990',
  red:         '#ba1a1a',
  textPrimary: '#191c1b',
  textSub:     '#3f4a3c',
  textMuted:   '#78716c',
  blue:        '#0061a4',
  bluePill:    '#d1e4ff',
  pinkPill:    '#ffd9e2',
  pinkText:    '#a63360',
  gray:        '#f2f4f2',
  grayDark:    '#e1e3e1',
  navInactive: '#9ca3af',
};

// 목업 데이터
const PHASES = [
  { label: '어드레스', score: 78, color: C.green,  pct: 0.78 },
  { label: '백스윙',   score: 62, color: C.textPrimary, pct: 0.62 },
  { label: '임팩트',   score: 55, color: C.red,    pct: 0.55 },
  { label: '피니시',   score: 65, color: C.textPrimary, pct: 0.65 },
];

const METRICS = [
  {
    icon: '🦴',
    iconBg: C.bluePill,
    title: 'Impact Hip Rotation',
    subtitle: 'Pelvic angle vs Target line',
    myValue: '29.1°',
    myColor: C.red,
    proValue: '40°',
  },
  {
    icon: '↕',
    iconBg: C.greenPill,
    title: 'Top X-Factor',
    subtitle: 'Shoulder/Hip separation',
    myValue: '38.2°',
    myColor: C.textPrimary,
    proValue: '45°',
  },
];

// 원형 게이지 (SVG 없이 View로 근사)
function CircleGauge({ score, color, pct }: { score: number; color: string; pct: number }) {
  const SIZE = 72;
  const STROKE = 6;
  const r = (SIZE - STROKE * 2) / 2;
  const circ = 2 * Math.PI * r;
  void circ;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* 배경 트랙 */}
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: STROKE, borderColor: C.grayDark,
      }} />
      {/* 진행 오버레이 — 단순 호 근사: 색 border top+right */}
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: STROKE,
        borderTopColor: color,
        borderRightColor: pct > 0.75 ? color : 'transparent',
        borderBottomColor: pct > 0.5 ? color : 'transparent',
        borderLeftColor: pct > 0.25 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 16, fontWeight: '700', color }}>{score}</Text>
    </View>
  );
}

type Props = { navigation?: any };

export const SwingFeedbackScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader navigation={navigation} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 히어로 — 스윙 이미지 + 점수 */}
        <View style={s.heroCard}>
          <Image source={{ uri: imgSwingFrame }} style={s.heroImg} />

          {/* 상단 좌 — 페이즈 */}
          <View style={s.heroBadgeLeft}>
            <Text style={s.heroBadgeSub}>PHASE</Text>
            <Text style={s.heroBadgeMain}>Impact</Text>
          </View>

          {/* 상단 우 — Pro Tracking */}
          <View style={s.heroBadgeRight}>
            <View style={s.recordDot} />
            <Text style={s.heroBadgeTrack}>Pro Tracking Active</Text>
          </View>

          {/* 하단 — 점수 카드 */}
          <View style={s.scoreFloat}>
            <View style={s.scoreRow}>
              <View>
                <Text style={s.scoreLabel}>종합 스윙 점수</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  <Text style={s.scoreValue}>65</Text>
                  <Text style={s.scoreMax}>/100</Text>
                </View>
              </View>
              <View style={s.deltaBadge}>
                <Text style={s.deltaText}>▲ +4.2</Text>
              </View>
            </View>
            <Text style={s.scoreSummary}>
              Impact alignment is improving, though hip rotation remains slightly limited compared to pro standards.
            </Text>
          </View>
        </View>

        {/* 3D 리플레이 CTA */}
        <View style={s.ctaCard}>
          <View style={s.ctaLeft}>
            <View style={s.ctaIcon}>
              <Text style={s.ctaIconText}>🎮</Text>
            </View>
            <View>
              <Text style={s.ctaTitle}>Immersive 3D Replay</Text>
              <Text style={s.ctaSub}>Analyze every angle in the simulator.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => navigation?.navigate('Viewer3D')}>
            <Text style={s.ctaBtnText}>View in 3D</Text>
          </TouchableOpacity>
        </View>

        {/* 페이즈별 성과 */}
        <View style={s.phaseCard}>
          <View style={s.phaseHeader}>
            <Text style={s.phaseTitle}>페이즈별 성과</Text>
            <View style={s.detailsBadge}>
              <Text style={s.detailsText}>DETAILS</Text>
            </View>
          </View>
          <View style={s.phaseGrid}>
            {PHASES.map(p => (
              <View key={p.label} style={s.phaseItem}>
                <CircleGauge score={p.score} color={p.color} pct={p.pct} />
                <Text style={[s.phaseLabel, { color: p.color }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Kinematic Sequence */}
        <View style={s.kinemCard}>
          <Text style={s.kinemTitle}>KINEMATIC SEQUENCE</Text>
          {/* 간략 다각형 차트 대체 */}
          <View style={s.kinemChart}>
            <View style={s.kinemPolygon} />
            <Text style={s.kinemInner}>📊</Text>
          </View>
          <Text style={s.kinemNote}>
            Transition timing <Text style={{ color: C.pinkText, fontWeight: '600' }}>slightly off-tempo</Text>.
          </Text>
        </View>

        {/* 핵심 스윙 지표 */}
        <View style={s.metricsCard}>
          <View style={s.metricsHeader}>
            <Text style={s.metricsTitle}>핵심 스윙 지표</Text>
          </View>
          {METRICS.map((m, i) => (
            <View key={m.title} style={[s.metricRow, i < METRICS.length - 1 && s.metricRowBorder]}>
              <View style={s.metricTop}>
                <View style={[s.metricIconCircle, { backgroundColor: m.iconBg }]}>
                  <Text style={s.metricIcon}>{m.icon}</Text>
                </View>
                <View>
                  <Text style={s.metricName}>{m.title}</Text>
                  <Text style={s.metricSub}>{m.subtitle}</Text>
                </View>
              </View>
              <View style={s.metricBottom}>
                <View>
                  <Text style={[s.metricVal, { color: m.myColor }]}>{m.myValue}</Text>
                  <Text style={s.metricValLabel}>MY MEASUREMENT</Text>
                </View>
                <View style={s.metricDivider} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.metricVal, { opacity: 0.3, fontStyle: 'italic' }]}>{m.proValue}</Text>
                  <Text style={s.metricValLabel}>PRO AVERAGE</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* 개선 추천 카드 */}
        <View style={s.recCard}>
          <View style={s.recInner}>
            <View style={s.recFocusBadge}>
              <Text style={s.recFocusText}>집중 영역</Text>
            </View>
            <Text style={s.recTitle}>Increase Lead Hip Rotation</Text>
            <Text style={s.recBody}>
              Focus on stabilizing your lead foot during downswing. This creates the resistance needed for powerful pelvic rotation through the impact zone.
            </Text>
            <TouchableOpacity
              style={s.recBtn}
              onPress={() => navigation?.navigate('Viewer3D')}>
              <Text style={s.recBtnText}>힙 스피드 드릴 보기</Text>
            </TouchableOpacity>

            {/* 드릴 프리뷰 */}
            <View style={s.drillThumb}>
              <Image source={{ uri: imgDrillPreview }} style={s.drillImg} />
              <View style={s.drillOverlay}>
                <View style={s.drillPlay}>
                  <Text style={s.drillPlayIcon}>▶</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation?.navigate('SwingChat')}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },


  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },

  // 히어로
  heroCard: {
    borderRadius: 28, overflow: 'hidden', height: 420,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute' },
  heroBadgeLeft: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
  },
  heroBadgeSub: { fontSize: 9, fontWeight: '700', color: C.textPrimary, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.9 },
  heroBadgeMain: { fontSize: 16, fontWeight: '700', color: C.green },
  heroBadgeRight: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  heroBadgeTrack: { fontSize: 10, fontWeight: '700', color: C.textPrimary },
  scoreFloat: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 24, padding: 18, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 6,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  scoreLabel: { fontSize: 10, fontWeight: '600', color: C.textPrimary, opacity: 0.7, textTransform: 'uppercase', letterSpacing: -0.25 },
  scoreValue: { fontSize: 36, fontWeight: '700', color: C.green, letterSpacing: -1.8 },
  scoreMax: { fontSize: 18, color: C.green, opacity: 0.5, marginBottom: 4 },
  deltaBadge: {
    backgroundColor: C.greenLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  deltaText: { fontSize: 10, fontWeight: '700', color: C.green },
  scoreSummary: { fontSize: 12, color: C.textSub, lineHeight: 20 },

  // 3D CTA
  ctaCard: {
    backgroundColor: C.grayDark, borderRadius: 28, padding: 18,
    gap: 12,
  },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.green, justifyContent: 'center', alignItems: 'center',
  },
  ctaIconText: { fontSize: 22 },
  ctaTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  ctaSub: { fontSize: 12, color: C.textSub },
  ctaBtn: {
    backgroundColor: '#2e3130', borderRadius: 999,
    paddingVertical: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  ctaBtnText: { fontSize: 12, fontWeight: '700', color: '#eff1ef' },

  // 페이즈
  phaseCard: { backgroundColor: C.gray, borderRadius: 28, padding: 22, gap: 20 },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  detailsBadge: {
    backgroundColor: C.grayDark, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  detailsText: { fontSize: 10, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.5 },
  phaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  phaseItem: { alignItems: 'center', gap: 8, width: '44%' },
  phaseLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Kinematic
  kinemCard: {
    backgroundColor: C.surface, borderRadius: 28, padding: 22,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  kinemTitle: { fontSize: 10, fontWeight: '700', color: C.textPrimary, opacity: 0.4, letterSpacing: 1 },
  kinemChart: {
    width: 128, height: 128, alignItems: 'center', justifyContent: 'center',
  },
  kinemPolygon: {
    position: 'absolute',
    width: 100, height: 100,
    borderWidth: 1.5, borderColor: C.pinkText,
    transform: [{ rotate: '15deg' }],
    opacity: 0.5,
  },
  kinemInner: { fontSize: 36 },
  kinemNote: { fontSize: 10, color: C.textSub, textAlign: 'center' },

  // 지표
  metricsCard: {
    backgroundColor: C.gray, borderRadius: 28, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  metricsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingVertical: 18,
  },
  metricsTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  metricRow: {
    backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 24, padding: 16, gap: 12,
  },
  metricRowBorder: {},
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  metricIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  metricIcon: { fontSize: 16 },
  metricName: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  metricSub: { fontSize: 10, color: C.textPrimary, opacity: 0.6 },
  metricBottom: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.grayDark, paddingTop: 12,
  },
  metricVal: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  metricValLabel: { fontSize: 9, fontWeight: '700', color: C.textPrimary, opacity: 0.4, letterSpacing: -0.45, textTransform: 'uppercase' },
  metricDivider: { width: 1, height: 32, backgroundColor: C.grayDark },

  // 개선 추천
  recCard: {
    borderRadius: 28, padding: 2,
    backgroundColor: C.green,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  recInner: {
    backgroundColor: C.surface, borderRadius: 26,
    padding: 22, gap: 14,
  },
  recFocusBadge: {
    alignSelf: 'flex-start', backgroundColor: C.pinkPill,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  recFocusText: { fontSize: 10, fontWeight: '700', color: C.pinkText, letterSpacing: 0.5, textTransform: 'uppercase' },
  recTitle: { fontSize: 19, fontWeight: '800', color: C.textPrimary },
  recBody: { fontSize: 14, color: C.textSub, lineHeight: 23 },
  recBtn: {
    backgroundColor: C.green, borderRadius: 999,
    paddingVertical: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  recBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  drillThumb: {
    height: 160, borderRadius: 24, overflow: 'hidden',
    backgroundColor: C.gray,
  },
  drillImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  drillOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  drillPlay: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  drillPlayIcon: { fontSize: 14, color: C.textPrimary, marginLeft: 3 },

  // FAB
  fab: {
    position: 'absolute', right: 16, bottom: 90,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.greenMid,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
  },
  fabIcon: { fontSize: 20 },
});
