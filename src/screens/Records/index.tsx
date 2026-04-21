import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/ui/AppHeader';
import { loadChatSessions, SavedChatSession } from '../../hooks/useChatHistory';

const C = {
  bg:          '#f8faf8',
  surface:     '#ffffff',
  green:       '#006e1c',
  greenMid:    '#4caf50',
  blue:        '#0061a4',
  textPri:     '#191c1b',
  textSub:     '#3f4a3c',
  textMuted:   '#6f7a6b',
  chipBg:      '#f2f4f2',
  chipBgFaint: 'rgba(242,244,242,0.5)',
  inputBg:     '#e1e3e1',
  segBg:       '#f2f4f2',
  border:      'rgba(0,110,28,0.1)',
};

// ─── 목업 데이터 ───────────────────────────────────────────────
type Metric = { label: string; value: string; color?: string };
type Session = {
  id: string;
  sessionId: string;  // Module1 분석 세션 식별자
  featured?: boolean;
  title: string;
  score: number;
  date: string;
  metrics: Metric[];
};

const SESSIONS: Session[] = [
  {
    id: '1', sessionId: 'session-mock-001', featured: true,
    title: 'Driver Power Optimization', score: 92, date: 'Oct 24 • 09:15',
    metrics: [
      { label: 'Club',    value: 'Driver' },
      { label: 'X-Factor', value: '48.2°', color: C.green },
      { label: 'Tempo',   value: '3.1:1',  color: C.blue },
      { label: 'Speed',   value: '105mph' },
    ],
  },
  {
    id: '2', sessionId: 'session-mock-002',
    title: 'Iron 7 Consistency Check', score: 84, date: 'Oct 22 • 14:30',
    metrics: [
      { label: 'Club',    value: 'Iron 7' },
      { label: 'X-Factor', value: '42.5°', color: C.green },
      { label: 'Tempo',   value: '3.0:1',  color: C.blue },
      { label: 'Launch',  value: '18.2°' },
    ],
  },
  {
    id: '3', sessionId: 'session-mock-003',
    title: 'Morning Putting Lab', score: 78, date: 'Oct 20 • 08:20',
    metrics: [
      { label: 'Club',     value: 'Putter' },
      { label: 'Tempo',    value: '2.1:1', color: C.blue },
      { label: 'Face Ang', value: '0.8°',  color: C.green },
      { label: 'Smash',    value: '1.48' },
    ],
  },
  {
    id: '4', sessionId: 'session-mock-004',
    title: 'Hybrid Mid-Range Focus', score: 81, date: 'Oct 18 • 16:45',
    metrics: [
      { label: 'Club',    value: 'Hybrid' },
      { label: 'X-Factor', value: '44.1°', color: C.green },
      { label: 'Tempo',   value: '3.0:1',  color: C.blue },
      { label: 'Spin',    value: '3200' },
    ],
  },
  {
    id: '5', sessionId: 'session-mock-005',
    title: 'Iron 9 Pitching Session', score: 88, date: 'Oct 15 • 11:00',
    metrics: [
      { label: 'Club',     value: 'Iron 9' },
      { label: 'X-Factor', value: '40.5°', color: C.green },
      { label: 'Tempo',    value: '2.8:1', color: C.blue },
      { label: 'Accuracy', value: '94%' },
    ],
  },
];

// ─── AI 채팅 탭 목업 데이터 ────────────────────────────────────
type AiCard = {
  id: string;
  chatSessionId: string;  // Module2 채팅 세션 식별자
  title: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  desc: string;
  date: string;
};

const AI_PINNED = {
  title: '슬라이스 교정 방법',
  preview: '회원님의 최근 드라이버 스윙 데이터를 바탕으로 아웃-인 궤도를 수정하는 3…',
  date: '2026.03.04',
  time: '14:30',
};

const AI_CARDS: AiCard[] = [
  {
    id: '1', chatSessionId: 'chat-mock-001', title: 'X-Factor 개선 드릴', badge: 'TECHNICAL',
    badgeBg: '#eceeec', badgeText: '#6f7a6b',
    desc: '상하체 분리 회전을 위한 트레이닝 루틴 제안',
    date: '2026.03.02 09:15',
  },
  {
    id: '2', chatSessionId: 'chat-mock-002', title: '퍼팅 라인 읽기 전략', badge: 'STRATEGY',
    badgeBg: '#d1e4ff', badgeText: 'rgba(51,160,253,0.8)',
    desc: '그린 경사도 파악 및 에임 포인트 설정 가이드',
    date: '2026.02.28 17:45',
  },
  {
    id: '3', chatSessionId: 'chat-mock-003', title: '비거리 향상을 위한 지면 반력', badge: 'POWER',
    badgeBg: '#ffd9e2', badgeText: '#690034',
    desc: '수직항력을 활용한 헤드 스피드 증강 비결',
    date: '2026.02.25 11:20',
  },
];

// ─── 서브 컴포넌트 ──────────────────────────────────────────────

/** 스윙 세션 카드 */
const SessionCard: React.FC<{ item: Session; onPress: (sessionId: string) => void }> = ({ item, onPress }) => (
  <TouchableOpacity
    style={[s.card, item.featured && s.cardFeatured]}
    activeOpacity={0.75}
    onPress={() => onPress(item.sessionId)}>
    {/* 상단: 타이틀 + 점수 */}
    <View style={s.cardTop}>
      <View style={s.cardTitleRow}>
        {item.featured ? (
          <View style={s.featuredBadge}>
            <Text style={s.featuredBadgeText}>FEATURED</Text>
          </View>
        ) : (
          <View style={s.dot} />
        )}
        <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
      </View>
      <View style={s.scoreWrap}>
        <Text style={s.scoreNum}>{item.score}</Text>
        <Text style={s.scoreDenom}>/100</Text>
      </View>
    </View>
    <Text style={s.cardDate}>{item.date.toUpperCase()}</Text>

    {/* 하단: 메트릭 4개 */}
    <View style={s.metricsRow}>
      {item.metrics.map(m => (
        <View key={m.label} style={[s.metricChip, item.featured && s.metricChipFeatured]}>
          <Text style={s.metricLabel}>{m.label.toUpperCase()}</Text>
          <Text style={[s.metricValue, m.color ? { color: m.color } : null]}>
            {m.value}
          </Text>
        </View>
      ))}
    </View>
  </TouchableOpacity>
);

// ─── 메인 화면 ──────────────────────────────────────────────────
type Props = { navigation?: any };

export const RecordsScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'swing' | 'ai'>('swing');
  const [searchText, setSearchText] = useState('');
  const [aiSearchText, setAiSearchText] = useState('');
  const [aiSortAsc, setAiSortAsc] = useState(false);
  const [savedChats, setSavedChats] = useState<SavedChatSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadChatSessions().then(setSavedChats);
    }, []),
  );

  const filtered = searchText
    ? SESSIONS.filter(s => s.title.toLowerCase().includes(searchText.toLowerCase()))
    : SESSIONS;

  // 저장된 실제 채팅 + 목업 카드 합치기 (실제 기록 우선)
  const mergedAiCards: AiCard[] = [
    ...savedChats.map(s => ({
      id:            `saved-${s.chatSessionId}`,
      chatSessionId: s.chatSessionId,
      title:         s.title,
      badge:         s.badge as string,
      badgeBg:       s.badgeBg,
      badgeText:     s.badgeText,
      desc:          s.preview,
      date:          s.date,
    })),
    ...AI_CARDS.filter(c => !savedChats.some(s => s.chatSessionId === c.chatSessionId)),
  ];

  const filteredAi = React.useMemo(() => {
    let list = aiSearchText
      ? mergedAiCards.filter(c =>
          c.title.toLowerCase().includes(aiSearchText.toLowerCase()) ||
          c.desc.toLowerCase().includes(aiSearchText.toLowerCase()),
        )
      : [...mergedAiCards];
    list.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return aiSortAsc ? cmp : -cmp;
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSearchText, aiSortAsc, savedChats]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader navigation={navigation} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ─── 세그먼트 컨트롤 ─── */}
        <View style={s.heroSection}>
          <View style={s.segControl}>
            <TouchableOpacity
              style={[s.segBtn, activeTab === 'swing' && s.segBtnActive]}
              onPress={() => setActiveTab('swing')}>
              <Text style={[s.segText, activeTab === 'swing' && s.segTextActive]}>
                스윙 기록
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segBtn, activeTab === 'ai' && s.segBtnActive]}
              onPress={() => setActiveTab('ai')}>
              <Text style={[s.segText, activeTab === 'ai' && s.segTextActive]}>
                AI 채팅
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'swing' ? (
          <>
            {/* ─── 검색 + 필터 바 ─── */}
            <View style={s.searchRow}>
              <View style={s.searchWrap}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search sessions..."
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <TouchableOpacity style={s.filterBtn}>
                <Text style={s.filterIcon}>⇅</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filterBtn}>
                <Text style={s.filterIcon}>≡</Text>
              </TouchableOpacity>
            </View>

            {/* ─── 세션 카드 리스트 ─── */}
            <View style={s.feed}>
              {filtered.map(item => (
                <SessionCard
                  key={item.id}
                  item={item}
                  onPress={(sessionId) => navigation?.navigate('SwingFeedback', { sessionId })}
                />
              ))}
            </View>

          </>
        ) : (
          /* ─── AI 채팅 탭 ─── */
          <View style={s.aiFeed}>
            {/* 검색 + 정렬 바 */}
            <View style={s.searchRow}>
              <View style={s.searchWrap}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  value={aiSearchText}
                  onChangeText={setAiSearchText}
                  placeholder="Search conversations..."
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <TouchableOpacity
                style={s.filterBtn}
                onPress={() => setAiSortAsc(v => !v)}>
                <Text style={s.filterIcon}>⇅</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filterBtn}>
                <Text style={s.filterIcon}>≡</Text>
              </TouchableOpacity>
            </View>

            {/* 핀된 세션 카드 */}
            <TouchableOpacity
              style={s.pinnedCard}
              activeOpacity={0.75}
              onPress={() => navigation?.navigate('SwingChat', { chatSessionId: 'chat-pinned-001' })}>
              <View style={s.pinnedTop}>
                <View style={s.pinnedLeft}>
                  <View style={s.pinnedAvatarWrap}>
                    <Text style={s.pinnedAvatarIcon}>🤖</Text>
                  </View>
                  <View style={s.newBadge}>
                    <Text style={s.newBadgeText}>NEW</Text>
                  </View>
                </View>
                <Text style={s.pinnedChevron}>›</Text>
              </View>
              <Text style={s.pinnedTitle}>{AI_PINNED.title}</Text>
              <Text style={s.pinnedPreview} numberOfLines={2}>{AI_PINNED.preview}</Text>
              <Text style={s.pinnedDate}>{AI_PINNED.date} · {AI_PINNED.time}</Text>
            </TouchableOpacity>

            {/* AI 히스토리 카드 리스트 */}
            {filteredAi.map(card => (
              <TouchableOpacity
                key={card.id}
                style={s.aiHistCard}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate('SwingChat', { chatSessionId: card.chatSessionId })}>
                <View style={s.aiHistTop}>
                  <Text style={s.aiHistTitle}>{card.title}</Text>
                  <View style={[s.catBadge, { backgroundColor: card.badgeBg }]}>
                    <Text style={[s.catBadgeText, { color: card.badgeText }]}>{card.badge}</Text>
                  </View>
                </View>
                <Text style={s.aiHistDesc}>{card.desc}</Text>
                <View style={s.aiHistBottom}>
                  <View style={s.aiHistAvatars}>
                    <View style={[s.miniAvatar, s.miniAvatarAi]}>
                      <Text style={s.miniAvatarIcon}>🤖</Text>
                    </View>
                    <View style={[s.miniAvatar, s.miniAvatarUser, s.miniAvatarOverlap]}>
                      <Text style={s.miniAvatarIcon}>👤</Text>
                    </View>
                  </View>
                  <Text style={s.aiHistDate}>{card.date}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* 끝 상태 */}
            <View style={s.endState}>
              <Text style={s.endStateText}>End of recent history</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation?.navigate('SwingChat', {})}>
        <Text style={s.fabIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ─── 스타일 ───────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },

  // 히어로 (타이틀 + 세그먼트)
  heroSection: { gap: 16, paddingBottom: 8 },
  pageTitle: {
    fontSize: 30, fontWeight: '700', color: C.textPri, letterSpacing: -0.75,
  },
  segControl: {
    flexDirection: 'row', gap: 4,
    backgroundColor: C.segBg,
    borderRadius: 999, padding: 6,
  },
  segBtn: {
    flex: 1, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 999, alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  segText:       { fontSize: 16, color: C.textSub },
  segTextActive: { color: C.green, fontWeight: '700' },

  // 검색바
  searchRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 10,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 16, color: C.textPri, padding: 0 },
  filterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.segBg, justifyContent: 'center', alignItems: 'center',
  },
  filterIcon:       { fontSize: 16, color: C.textSub },


  // 피드
  feed: { gap: 12, marginBottom: 24 },

  // 세션 카드
  card: {
    backgroundColor: C.surface, borderRadius: 32, padding: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardFeatured: {
    borderWidth: 1, borderColor: C.border, padding: 17,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.greenMid, flexShrink: 0 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: C.textPri, flex: 1 },
  cardDate: { fontSize: 10, color: C.textMuted, letterSpacing: 0.3, marginTop: -4 },

  // Featured 뱃지
  featuredBadge: {
    backgroundColor: C.green, borderRadius: 16,
    paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  // 점수
  scoreWrap: { flexDirection: 'row', alignItems: 'flex-end', flexShrink: 0 },
  scoreNum:   { fontSize: 18, fontWeight: '700', color: C.green, lineHeight: 20 },
  scoreDenom: { fontSize: 10, color: C.textMuted, lineHeight: 14, marginBottom: 1 },

  // 메트릭 칩 4개
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricChip: {
    flex: 1, backgroundColor: C.chipBgFaint,
    borderRadius: 0, padding: 8, alignItems: 'center', gap: 2,
  },
  metricChipFeatured: { backgroundColor: C.chipBg },
  metricLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase' },
  metricValue: { fontSize: 12, fontWeight: '700', color: C.textPri },

  // AI 채팅 탭 피드
  aiFeed: { gap: 12, marginBottom: 8 },

  // 핀된 카드 (흰 배경, 부각)
  pinnedCard: {
    backgroundColor: C.surface, borderRadius: 32, padding: 20, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  pinnedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinnedLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinnedAvatarWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0061a4', justifyContent: 'center', alignItems: 'center',
  },
  pinnedAvatarIcon: { fontSize: 18 },
  newBadge: {
    backgroundColor: C.green, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  newBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  pinnedChevron: { fontSize: 22, color: C.textMuted },
  pinnedTitle:   { fontSize: 16, fontWeight: '700', color: C.textPri },
  pinnedPreview: { fontSize: 13, color: C.textSub, lineHeight: 18 },
  pinnedDate:    { fontSize: 11, color: C.textMuted },

  // AI 히스토리 카드 (회색 bg)
  aiHistCard: {
    backgroundColor: C.chipBgFaint, borderRadius: 24, padding: 18, gap: 8,
  },
  aiHistTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiHistTitle: { fontSize: 15, fontWeight: '700', color: C.textPri, flex: 1, marginRight: 8 },
  catBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  catBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  aiHistDesc: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  aiHistBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  aiHistAvatars: { flexDirection: 'row' },
  miniAvatar: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  miniAvatarAi:      { backgroundColor: '#0061a4' },
  miniAvatarUser:    { backgroundColor: C.greenMid },
  miniAvatarOverlap: { marginLeft: -8 },
  miniAvatarIcon:    { fontSize: 13 },
  aiHistDate: { fontSize: 11, color: C.textMuted },

  // 끝 상태
  endState: { alignItems: 'center', paddingVertical: 24, opacity: 0.4 },
  endStateText: { fontSize: 13, color: C.textMuted },

  // FAB
  fab: {
    position: 'absolute', right: 24, bottom: 96,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, zIndex: 20,
  },
  fabIcon: { fontSize: 22 },
});
