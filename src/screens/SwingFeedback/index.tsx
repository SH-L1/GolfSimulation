import React, { useEffect } from 'react';
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
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useAnalysisResult } from '../../hooks/useSwingAnalysis';
import { setAnalysisResult } from '../../store/analysisStore';
import type { MetricId, MetricValue, SwingPhase } from '../../types/module1';
import { PLACEHOLDER_URI } from '../../assets';

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
};

// ── 메타데이터 (아이콘·라벨 등 API에 없는 표시용 정보) ────────────
const PHASE_LABEL: Record<SwingPhase, string> = {
  address: '어드레스',
  top:     '백스윙',
  impact:  '임팩트',
  finish:  '피니시',
};

const METRIC_META: Record<MetricId, { icon: string; iconBg: string; title: string; subtitle: string }> = {
  STANCE_RATIO:  { icon: '📐', iconBg: C.bluePill,  title: 'Stance Ratio',        subtitle: 'Foot width vs shoulder width' },
  SHOULDER_ROT:  { icon: '🔄', iconBg: C.greenPill, title: 'Shoulder Rotation',   subtitle: 'Rotation angle at backswing top' },
  X_FACTOR:      { icon: '↕',  iconBg: C.greenPill, title: 'Top X-Factor',        subtitle: 'Shoulder/Hip separation' },
  BACKSWING_MAX: { icon: '⬆', iconBg: C.bluePill,  title: 'Backswing Max',       subtitle: 'Club shaft angle at top' },
  HIP_ROTATION:  { icon: '🦴', iconBg: C.bluePill,  title: 'Impact Hip Rotation', subtitle: 'Pelvic angle vs Target line' },
  WRIST_ANGLE:   { icon: '✋', iconBg: C.greenPill, title: 'Wrist Angle',         subtitle: 'Wrist hinge at impact' },
  SPINE_TILT:    { icon: '📏', iconBg: C.bluePill,  title: 'Spine Tilt',          subtitle: 'Lateral tilt at impact' },
};

function scoreColor(score: number) {
  if (score >= 80) { return C.green; }
  if (score >= 60) { return C.textPrimary; }
  return C.red;
}

// ── CircleGauge ───────────────────────────────────────────────────
function CircleGauge({ score }: { score: number }) {
  const SIZE   = 72;
  const STROKE = 6;
  const color  = scoreColor(score);
  const pct    = score / 100;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: STROKE, borderColor: C.grayDark,
      }} />
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: STROKE,
        borderTopColor:    color,
        borderRightColor:  pct > 0.75 ? color : 'transparent',
        borderBottomColor: pct > 0.5  ? color : 'transparent',
        borderLeftColor:   pct > 0.25 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 16, fontWeight: '700', color }}>{score}</Text>
    </View>
  );
}

// ── 화면 ─────────────────────────────────────────────────────────
type Props = {
  navigation?: any;
  route?: { params?: { sessionId?: string } };
};

export const SwingFeedbackScreen: React.FC<Props> = ({ navigation, route }) => {
  const sessionId = route?.params?.sessionId;
  const { result, loading, error, fetch } = useAnalysisResult();

  useEffect(() => {
    if (sessionId) {
      void fetch(sessionId);
    }
  }, [sessionId]);

  // 전역 store에 결과 저장 (SwingChat에서 current_session_id로 활용)
  useEffect(() => {
    if (result) { setAnalysisResult(result); }
  }, [result]);

  // 점수 색상이 적용된 페이즈 배열
  const phases = result
    ? (Object.entries(result.phaseScores) as [SwingPhase, number][]).map(([phase, score]) => ({
        label: PHASE_LABEL[phase],
        score,
        color: scoreColor(score),
        pct:   score / 100,
      }))
    : [];

  // 하위 2개 지표 (점수 낮은 순)
  const worstMetrics: { id: MetricId; metric: MetricValue }[] = result
    ? Object.entries(result.metrics)
        .sort(([, a], [, b]) => a.score - b.score)
        .slice(0, 2)
        .map(([id, metric]) => ({ id: id as MetricId, metric }))
    : [];

  const firstRec = result?.recommendations[0];
  const overallScore = result?.overallScore ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LoadingOverlay visible={loading} message="분석 결과 불러오는 중..." />
      <AppHeader navigation={navigation} />

      {error ? (
        <View style={s.errorWrap}>
          <Text style={s.errorText}>결과를 불러올 수 없습니다.</Text>
          <Text style={s.errorSub}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => sessionId && void fetch(sessionId)}>
            <Text style={s.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── 히어로: 스윙 이미지 + 종합 점수 ── */}
          <View style={s.heroCard}>
            <Image source={{ uri: PLACEHOLDER_URI }} style={s.heroImg} />

            <View style={s.heroBadgeLeft}>
              <Text style={s.heroBadgeSub}>PHASE</Text>
              <Text style={s.heroBadgeMain}>Impact</Text>
            </View>

            <View style={s.heroBadgeRight}>
              <View style={s.recordDot} />
              <Text style={s.heroBadgeTrack}>Pro Tracking Active</Text>
            </View>

            <View style={s.scoreFloat}>
              <View style={s.scoreRow}>
                <View>
                  <Text style={s.scoreLabel}>종합 스윙 점수</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                    <Text style={[s.scoreValue, { color: scoreColor(overallScore) }]}>
                      {overallScore}
                    </Text>
                    <Text style={[s.scoreMax, { color: scoreColor(overallScore) }]}>/100</Text>
                  </View>
                </View>
              </View>
              {firstRec && (
                <Text style={s.scoreSummary} numberOfLines={2}>{firstRec.body}</Text>
              )}
            </View>
          </View>

          {/* ── 3D 리플레이 CTA ── */}
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
              onPress={() => navigation?.navigate('Viewer3D', { sessionId })}>
              <Text style={s.ctaBtnText}>View in 3D</Text>
            </TouchableOpacity>
          </View>

          {/* ── 페이즈별 성과 ── */}
          {phases.length > 0 && (
            <View style={s.phaseCard}>
              <View style={s.phaseHeader}>
                <Text style={s.phaseTitle}>페이즈별 성과</Text>
                <View style={s.detailsBadge}>
                  <Text style={s.detailsText}>DETAILS</Text>
                </View>
              </View>
              <View style={s.phaseGrid}>
                {phases.map(p => (
                  <View key={p.label} style={s.phaseItem}>
                    <CircleGauge score={p.score} />
                    <Text style={[s.phaseLabel, { color: p.color }]}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Kinematic Sequence (디자인 요소 유지) ── */}
          <View style={s.kinemCard}>
            <Text style={s.kinemTitle}>KINEMATIC SEQUENCE</Text>
            <View style={s.kinemChart}>
              <View style={s.kinemPolygon} />
              <Text style={s.kinemInner}>📊</Text>
            </View>
            <Text style={s.kinemNote}>
              Transition timing <Text style={{ color: C.pinkText, fontWeight: '700' }}>slightly off-tempo</Text>.
            </Text>
          </View>

          {/* ── 핵심 스윙 지표 (하위 2개) ── */}
          {worstMetrics.length > 0 && (
            <View style={s.metricsCard}>
              <View style={s.metricsHeader}>
                <Text style={s.metricsTitle}>핵심 스윙 지표</Text>
              </View>
              {worstMetrics.map(({ id, metric }, i) => {
                const meta     = METRIC_META[id];
                const myColor  = scoreColor(metric.score);
                return (
                  <View key={id} style={[s.metricRow, i < worstMetrics.length - 1 && s.metricRowBorder]}>
                    <View style={s.metricTop}>
                      <View style={[s.metricIconCircle, { backgroundColor: meta.iconBg }]}>
                        <Text style={s.metricIcon}>{meta.icon}</Text>
                      </View>
                      <View>
                        <Text style={s.metricName}>{meta.title}</Text>
                        <Text style={s.metricSub}>{meta.subtitle}</Text>
                      </View>
                    </View>
                    <View style={s.metricBottom}>
                      <View>
                        <Text style={[s.metricVal, { color: myColor }]}>
                          {metric.userValue}{metric.unit}
                        </Text>
                        <Text style={s.metricValLabel}>MY MEASUREMENT</Text>
                      </View>
                      <View style={s.metricDivider} />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.metricVal, { opacity: 0.3, fontStyle: 'italic' }]}>
                          {metric.proMean}{metric.unit}
                        </Text>
                        <Text style={s.metricValLabel}>PRO AVERAGE</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── 개선 추천 카드 (첫 번째 recommendation) ── */}
          {firstRec && (
            <View style={s.recCard}>
              <View style={s.recInner}>
                <View style={s.recFocusBadge}>
                  <Text style={s.recFocusText}>집중 영역</Text>
                </View>
                <Text style={s.recTitle}>{firstRec.title}</Text>
                <Text style={s.recBody}>{firstRec.body}</Text>
                <TouchableOpacity
                  style={s.recBtn}
                  onPress={() => navigation?.navigate('Viewer3D', { sessionId })}>
                  <Text style={s.recBtnText}>{firstRec.drillTitle}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB — AI 챗봇으로 이동 */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation?.navigate('SwingChat', { sessionId })}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ── 스타일 (기존 유지) ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },

  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorText: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  errorSub:  { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  retryBtn:  { backgroundColor: C.green, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  heroCard: {
    borderRadius: 28, overflow: 'hidden', height: 420,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  heroImg:        { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute' },
  heroBadgeLeft:  { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  heroBadgeSub:   { fontSize: 11, fontWeight: '700', color: C.textPrimary, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.9 },
  heroBadgeMain:  { fontSize: 16, fontWeight: '700', color: C.green },
  heroBadgeRight: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  recordDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  heroBadgeTrack: { fontSize: 10, fontWeight: '700', color: C.textPrimary },
  scoreFloat:     { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: 'rgba(255,255,255,0.80)', borderRadius: 24, padding: 18, gap: 10 },
  scoreRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  scoreLabel:     { fontSize: 11, fontWeight: '700', color: C.textPrimary, opacity: 0.7, textTransform: 'uppercase' },
  scoreValue:     { fontSize: 36, fontWeight: '700', letterSpacing: -1.8 },
  scoreMax:       { fontSize: 18, opacity: 0.5, marginBottom: 4 },
  scoreSummary:   { fontSize: 12, color: C.textSub, lineHeight: 20 },

  ctaCard:    { backgroundColor: C.grayDark, borderRadius: 28, padding: 18, gap: 12 },
  ctaLeft:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaIcon:    { width: 48, height: 48, borderRadius: 14, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  ctaIconText:{ fontSize: 22 },
  ctaTitle:   { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  ctaSub:     { fontSize: 12, color: C.textSub },
  ctaBtn:     { backgroundColor: '#2e3130', borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  ctaBtnText: { fontSize: 12, fontWeight: '700', color: '#eff1ef' },

  phaseCard:    { backgroundColor: C.gray, borderRadius: 28, padding: 22, gap: 20 },
  phaseHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseTitle:   { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  detailsBadge: { backgroundColor: C.grayDark, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  detailsText:  { fontSize: 10, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.5 },
  phaseGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  phaseItem:    { alignItems: 'center', gap: 8, width: '44%' },
  phaseLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  kinemCard:    { backgroundColor: C.surface, borderRadius: 28, padding: 22, alignItems: 'center', gap: 12 },
  kinemTitle:   { fontSize: 10, fontWeight: '700', color: C.textPrimary, opacity: 0.4, letterSpacing: 1 },
  kinemChart:   { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  kinemPolygon: { position: 'absolute', width: 100, height: 100, borderWidth: 1.5, borderColor: C.pinkText, transform: [{ rotate: '15deg' }], opacity: 0.5 },
  kinemInner:   { fontSize: 36 },
  kinemNote:    { fontSize: 10, color: C.textSub, textAlign: 'center' },

  metricsCard:     { backgroundColor: C.gray, borderRadius: 28, overflow: 'hidden' },
  metricsHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 18 },
  metricsTitle:    { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  metricRow:       { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 24, padding: 16, gap: 12 },
  metricRowBorder: {},
  metricTop:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  metricIconCircle:{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  metricIcon:      { fontSize: 16 },
  metricName:      { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  metricSub:       { fontSize: 10, color: C.textPrimary, opacity: 0.6 },
  metricBottom:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.grayDark, paddingTop: 12 },
  metricVal:       { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  metricValLabel:  { fontSize: 11, fontWeight: '700', color: C.textPrimary, opacity: 0.4, letterSpacing: -0.45, textTransform: 'uppercase' },
  metricDivider:   { width: 1, height: 32, backgroundColor: C.grayDark },

  recCard:      { borderRadius: 28, padding: 2, backgroundColor: C.green },
  recInner:     { backgroundColor: C.surface, borderRadius: 26, padding: 22, gap: 14 },
  recFocusBadge:{ alignSelf: 'flex-start', backgroundColor: C.pinkPill, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  recFocusText: { fontSize: 10, fontWeight: '700', color: C.pinkText, letterSpacing: 0.5, textTransform: 'uppercase' },
  recTitle:     { fontSize: 19, fontWeight: '700', color: C.textPrimary },
  recBody:      { fontSize: 14, color: C.textSub, lineHeight: 23 },
  recBtn:       { backgroundColor: C.green, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  recBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },

  fab:     { position: 'absolute', right: 16, bottom: 90, width: 48, height: 48, borderRadius: 24, backgroundColor: C.greenMid, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  fabIcon: { fontSize: 20 },
});
