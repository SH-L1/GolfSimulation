import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/ui/AppHeader';
import { useAuth } from '../../hooks/useAuth';
import { getSessions } from '../../api/module1';
import type { SessionSummary } from '../../api/module1';
import { PLACEHOLDER_URI } from '../../assets';

const imgCaddyCharacter = PLACEHOLDER_URI;

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
  shadow:        'rgba(0,0,0,0.05)',
};

const LEVEL_LABEL: Record<string, string> = {
  beginner:     '초보',
  intermediate: '중급',
  advanced:     '고급',
};

const VIEW_LABEL: Record<string, string> = {
  dtl:     'DTL',
  face_on: 'Face On',
  other:   '기타',
};

const CLUB_LABEL: Record<string, string> = {
  driver: 'Driver',
  iron:   'Iron',
};

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

  useFocusEffect(
    useCallback(() => {
      setSessionLoading(true);
      getSessions(1, 1)
        .then(res => {
          setLatestSession(res.sessions[0] ?? null);
          setTotalSessions(res.total);
        })
        .catch(() => {})
        .finally(() => setSessionLoading(false));
    }, []),
  );

  const levelLabel  = LEVEL_LABEL[user?.experience_level ?? 'beginner'] ?? '초보';
  const scoreProgress = ((latestSession?.overallScore ?? 0) / 100);

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
            <Text style={s.heroGreeting}>안녕하세요, {user?.name ?? '...'}</Text>
            <Text style={s.heroSub}>오늘 더 멋진 스윙을 할 준비가{'\n'}되셨나요?</Text>
            <View style={s.levelBadge}>
              <Text style={s.levelText} maxFontSizeMultiplier={1.2}>{levelLabel}</Text>
            </View>
          </View>
          <View style={s.heroCharacterWrap}>
            <View style={s.heroCharacterBg} />
            <Image source={{ uri: imgCaddyCharacter }} style={s.heroCharacter} />
          </View>
        </View>

        {/* 퀵 액션 그리드 */}
        <View style={s.quickGrid}>
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
            {latestSession && (
              <Text style={s.sectionDate}>{formatDate(latestSession.analyzedAt)}</Text>
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
              <View style={s.swingThumb}>
                <Image
                  source={{ uri: latestSession.thumbnailUrl ?? PLACEHOLDER_URI }}
                  style={s.swingThumbImg}
                />
                <View style={s.scoreBadge}>
                  <Text style={s.scoreBadgeLabel} maxFontSizeMultiplier={1.2}>SCORE</Text>
                  <Text style={s.scoreBadgeValue} maxFontSizeMultiplier={1.2}>{latestSession.overallScore}</Text>
                </View>
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
              </View>
              <View style={s.swingAnalysis}>
                <View style={s.analysisBullet} />
                <View style={{ flex: 1 }}>
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
            <Text style={s.tipTitle}>Today's Pro Tip</Text>
          </View>
          <Text style={s.tipBody}>
            <Text style={{ fontWeight: '700' }}>{levelLabel}:</Text>
            {" 정확한 어드레스 자세가 좋은 스윙의 시작입니다.\n리드 암을 곧게 유지하며 백스윙을 해보세요."}
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
          <View style={s.statCard}>
            <Text style={s.statLabel} maxFontSizeMultiplier={1.2}>BEST SCORE</Text>
            <View style={s.statValueRow}>
              <Text style={s.statValue} maxFontSizeMultiplier={1.2}>
                {latestSession?.overallScore ?? '—'}
              </Text>
              {latestSession && <Text style={s.statUnit} maxFontSizeMultiplier={1.2}>pts</Text>}
            </View>
            <View style={s.statBarBg}>
              <View style={[s.statBarFill, { width: `${scoreProgress * 100}%`, backgroundColor: C.green }]} />
            </View>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel} maxFontSizeMultiplier={1.2}>SESSIONS</Text>
            <View style={s.statValueRow}>
              <Text style={s.statValue} maxFontSizeMultiplier={1.2}>{totalSessions}</Text>
              <Text style={s.statUnit} maxFontSizeMultiplier={1.2}>회</Text>
            </View>
            <View style={s.statBarBg}>
              <View style={[s.statBarFill, { width: `${Math.min(totalSessions / 50, 1) * 100}%`, backgroundColor: C.blue }]} />
            </View>
          </View>
        </ScrollView>

        <View style={{ height: 100 }} />
      </ScrollView>

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

  swingThumb: { height: 192, position: 'relative' },
  swingThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  scoreBadge: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  scoreBadgeLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  scoreBadgeValue: { fontSize: 20, fontWeight: '700', color: C.green },
  thumbTags: { position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', gap: 6 },
  thumbTag: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  thumbTagText: { fontSize: 11, color: '#fff', fontWeight: '400' },
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
