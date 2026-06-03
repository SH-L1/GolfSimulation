import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSpacer } from '../../components/ui/BottomSpacer';
import { useFabBottom } from '../../hooks/useFabBottom';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/ui/AppHeader';
import { useAuth } from '../../hooks/useAuth';
import { getSessions, getAnalysisResult } from '../../api/module1';
import type { SessionSummary, AnalysisResult } from '../../api/module1';
import { VIEW_LABEL, CLUB_LABEL } from '../../constants/swing';

const C = {
  bg:            '#f8faf8',
  surface:       '#ffffff',
  green:         '#006e1c',
  greenMid:      '#4caf50',
  greenLight:    'rgba(76,175,80,0.10)',
  blue:          '#0061a4',
  blueLight:     'rgba(51,160,253,0.10)',
  bluePill:      '#d1e4ff',
  textPrimary:   '#191c1b',
  textSecondary: '#3f4a3c',
  textMuted:     '#78716c',
  textFaint:     '#a8a29e',
};

const LEVEL_LABEL: Record<string, string> = {
  beginner:     '초보',
  intermediate: '중급',
  advanced:     '고급',
};

const LEVEL_TIPS: Record<string, string[]> = {
  beginner: [
    '그립을 너무 꽉 쥐면 손목이 굳어 스윙이 막힙니다. 엄지와 검지 사이에 여유를 두고 가볍게 잡아보세요.',
    '공을 맞추려 하지 말고 스윙 궤도를 따라가세요. 공은 자연스럽게 맞습니다.',
    '백스윙 시 왼 어깨가 턱 아래까지 오도록 충분히 회전해보세요.',
    '발 너비를 어깨 넓이로 맞추면 균형 잡힌 스윙의 기초가 됩니다.',
    '임팩트 후 팔로스루까지 클럽헤드가 목표 방향을 향하도록 해보세요.',
  ],
  intermediate: [
    '다운스윙 시 오른쪽 팔꿈치를 몸 옆에 붙이면 인사이드-아웃 궤도가 자연스럽게 만들어집니다.',
    '임팩트 순간 하체가 먼저 회전해야 합니다. 하체-몸통-팔 순서를 의식하며 스윙해보세요.',
    '백스윙 탑에서 잠깐 멈추는 느낌을 가져보세요. 서두르면 타이밍이 흐트러집니다.',
    '체중 이동을 의식하세요. 백스윙 시 오른발, 임팩트 후 왼발에 체중이 실려야 합니다.',
    '피니시 자세를 3초간 유지하는 연습을 해보세요. 밸런스가 좋아집니다.',
  ],
  advanced: [
    '그린 주변 어프로치에서 볼 위치를 오른발 쪽으로 한 볼 이동하면 뒤땅 없이 칩샷을 칠 수 있습니다.',
    '볼 포지션과 스탠스 폭을 클럽별로 조정하세요. 드라이버는 왼발 뒤꿈치 안쪽, 아이언은 중앙입니다.',
    '바람이 강할 때는 스윙을 75% 강도로 줄이고 공을 낮게 치는 펀치샷을 활용해보세요.',
    '그린에서 퍼팅 라인 읽기 전 홀 뒤편에서도 경사를 확인하세요. 고점에서 더 잘 보입니다.',
    '페어웨이우드 대신 하이브리드를 활용하면 러프에서의 탈출이 훨씬 수월해집니다.',
  ],
};

function getStaticTip(level: string): string {
  const tips = LEVEL_TIPS[level] ?? LEVEL_TIPS.beginner;
  return tips[new Date().getDay() % tips.length];
}


function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Props = { navigation?: any };

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [latestSession, setLatestSession] = useState<SessionSummary | null>(null);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [aiTip, setAiTip] = useState<{ title: string; body: string } | null>(null);

  const expLevel   = user?.experience_level ?? 'beginner';
  const levelLabel = LEVEL_LABEL[expLevel] ?? '초보';
  const fabBottom  = useFabBottom(true);

  useFocusEffect(
    useCallback(() => {
      setSessionLoading(true);
      setAiTip(null);
      getSessions(1, 1)
        .then(res => {
          const session = res.sessions[0] ?? null;
          setLatestSession(session);
          setTotalSessions(res.total);
          if (session) {
            // /module1/result/{id} — 전체 분석 결과(recommendations 포함)
            getAnalysisResult(session.sessionId)
              .then((result: AnalysisResult) => {
                const rec = result.recommendations[0];
                if (rec?.title && rec?.body) {
                  setAiTip({ title: rec.title, body: rec.body });
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setSessionLoading(false));
    }, []),
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader navigation={navigation} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>


        {/* 퀵 액션 그리드 */}
        <View style={s.quickGrid}>
          <TouchableOpacity
            style={s.btnRecord}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SwingUpload', { newSession: Date.now() })}>
            <View style={s.btnRecordIcon}>
              <Text style={s.btnRecordIconText}>🎥</Text>
            </View>
            <Text style={s.btnRecordLabel}>스윙 기록하기</Text>
            <Text style={s.btnRecordArrow}>→</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={s.btnSmall}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('SwingUpload', { newSession: Date.now() })}>
              <View style={[s.btnSmallIcon, { backgroundColor: C.bluePill }]}>
                <Text>⬆️</Text>
              </View>
              <Text style={s.btnSmallLabel}>영상 업로드</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnSmall}
              activeOpacity={0.85}
              onPress={() => {
                if (!latestSession) { Alert.alert('스윙 기록 없음', '먼저 스윙을 기록해 주세요.'); return; }
                navigation?.getParent()?.navigate('SwingChat', { sessionId: latestSession.sessionId });
              }}>
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
            {latestSession && (
              <Text style={s.sectionDate}>{latestSession.analyzedAt ? formatDate(latestSession.analyzedAt) : ''}</Text>
            )}
          </View>

          {sessionLoading ? (
            <View style={s.swingCardEmpty}>
              <ActivityIndicator color={C.green} />
            </View>
          ) : latestSession ? (
            <TouchableOpacity
              style={s.swingCard}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('SwingFeedback', { sessionId: latestSession.sessionId })}>
              <View style={s.swingAnalysis}>
                <View style={s.analysisBullet} />
                <View style={{ flex: 1 }}>
                  <View style={s.thumbTags}>
                    <View style={s.thumbTag}>
                      <Text style={s.thumbTagText} maxFontSizeMultiplier={1.2}>
                        {CLUB_LABEL[latestSession.clubType] ?? latestSession.clubType}
                      </Text>
                    </View>
                    <View style={s.thumbTag}>
                      <Text style={s.thumbTagText} maxFontSizeMultiplier={1.2}>
                        {VIEW_LABEL[latestSession.viewType] ?? latestSession.viewType}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.analysisLabel}>분석 요약</Text>
                  <Text style={s.analysisSummary}>
                    {`${CLUB_LABEL[latestSession.clubType] ?? latestSession.clubType} · ${VIEW_LABEL[latestSession.viewType] ?? latestSession.viewType} 뷰 분석 완료. 상세 피드백을 확인하세요.`}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.swingCardEmpty}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('SwingUpload')}>
              <Text style={s.emptyIcon}>🎥</Text>
              <Text style={s.emptyText}>첫 스윙을 기록해보세요</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 오늘의 프로 팁 */}
        <View style={s.tipCard}>
          <View style={s.tipHeader}>
            <Text style={s.tipIcon}>🎓</Text>
            <Text style={s.tipTitle}>{aiTip ? '내 스윙 기반 팁' : "Today's Pro Tip"}</Text>
          </View>
          <Text style={s.tipBody}>
            {aiTip
              ? `${aiTip.title}\n${aiTip.body}`
              : `${levelLabel}: ${getStaticTip(expLevel)}`}
          </Text>
          <TouchableOpacity
            style={s.tipBtn}
            onPress={() => {
              if (!latestSession) { return; }
              navigation?.navigate('Viewer3D', { sessionId: latestSession.sessionId });
            }}>
            <Text style={s.tipBtnText}>WATCH DRILLS ›</Text>
          </TouchableOpacity>
        </View>

        {/* 통계 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.statsScroll}>
          <View style={s.statCard}>
            <Text style={s.statLabel} maxFontSizeMultiplier={1.2}>SESSIONS</Text>
            <View style={s.statValueRow}>
              <Text style={s.statValue} maxFontSizeMultiplier={1.2}>{totalSessions}</Text>
              <Text style={s.statUnit} maxFontSizeMultiplier={1.2}>회</Text>
            </View>
            <View style={s.statBarBg}>
              <View style={[s.statBarFill, { width: `${Math.min(totalSessions / 50, 1) * 100}%`, backgroundColor: C.green }]} />
            </View>
          </View>
        </ScrollView>

        <BottomSpacer tabBar />
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, { bottom: fabBottom }]}
        activeOpacity={0.85}
        onPress={() => {
          if (!latestSession) { Alert.alert('스윙 기록 없음', '먼저 스윙을 기록해 주세요.'); return; }
          navigation?.getParent()?.navigate('SwingChat', { sessionId: latestSession.sessionId });
        }}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },


  quickGrid: { gap: 12 },
  btnRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 28,
    padding: 18,
    backgroundColor: C.green,
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
  btnSmallLabel: { fontSize: 13, fontWeight: '400', color: C.textPrimary },

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
  swingCardEmpty: {
    backgroundColor: C.surface,
    borderRadius: 28,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyIcon: { fontSize: 28 },
  emptyText: { fontSize: 14, color: C.textMuted },

  thumbTags: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  thumbTag: {
    backgroundColor: C.greenLight,
    borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  thumbTagText: { fontSize: 11, color: C.green, fontWeight: '600' },
  swingAnalysis: {
    backgroundColor: '#f2f4f2',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    gap: 12,
  },
  analysisBullet: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.greenLight,
    marginTop: 2,
  },
  analysisLabel: { fontSize: 10, fontWeight: '700', color: C.textPrimary, letterSpacing: 0.6, marginBottom: 4, textTransform: 'uppercase' },
  analysisSummary: { fontSize: 13, color: C.textSecondary, lineHeight: 19 },

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
  statLabel: { fontSize: 11, color: C.textFaint, fontWeight: '600', letterSpacing: 0.9 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  statUnit: { fontSize: 11, color: C.textMuted, fontWeight: '400' },
  statBarBg: { height: 4, backgroundColor: '#f5f5f4', borderRadius: 999, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 999 },

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
