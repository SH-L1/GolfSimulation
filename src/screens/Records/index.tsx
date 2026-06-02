import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSpacer } from '../../components/ui/BottomSpacer';
import { useFabBottom } from '../../hooks/useFabBottom';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/ui/AppHeader';
import { loadChatSessions, SavedChatSession } from '../../hooks/useChatHistory';
import { getSessions } from '../../api/module1';
import type { SessionSummary } from '../../types/module1';
import { VIEW_LABEL, CLUB_LABEL } from '../../constants/swing';

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

// ─── 헬퍼 ──────────────────────────────────────────────────────────

function sessionTitle(s: SessionSummary): string {
  const club = CLUB_LABEL[s.clubType] ?? s.clubType;
  const view = VIEW_LABEL[s.viewType] ?? s.viewType;
  return `${club} ${view} 분석`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

// ─── 서브 컴포넌트 ──────────────────────────────────────────────────

interface SessionCardProps {
  item:     SessionSummary;
  featured: boolean;
  onPress:  (sessionId: string) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ item, featured, onPress }) => {
  const chips = [
    { label: '클럽', value: CLUB_LABEL[item.clubType] ?? item.clubType, color: undefined },
    { label: '뷰',   value: VIEW_LABEL[item.viewType] ?? item.viewType,  color: C.blue },
  ];

  return (
    <TouchableOpacity
      style={[s.card, featured && s.cardFeatured]}
      activeOpacity={0.75}
      onPress={() => onPress(item.sessionId)}>
      <View style={s.cardTop}>
        <View style={s.cardTitleRow}>
          {featured ? (
            <View style={s.featuredBadge}>
              <Text style={s.featuredBadgeText}>LATEST</Text>
            </View>
          ) : (
            <View style={s.dot} />
          )}
          <Text style={s.cardTitle} numberOfLines={1}>{sessionTitle(item)}</Text>
        </View>
      </View>
      <Text style={s.cardDate}>{item.analyzedAt ? formatDate(item.analyzedAt).toUpperCase() : '-'}</Text>

      <View style={s.metricsRow}>
        {chips.map(chip => (
          <View key={chip.label} style={[s.metricChip, featured && s.metricChipFeatured]}>
            <Text style={s.metricLabel}>{chip.label.toUpperCase()}</Text>
            <Text style={[s.metricValue, chip.color ? { color: chip.color } : null]}>
              {chip.value}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

// ─── 메인 화면 ──────────────────────────────────────────────────────
type Props = { navigation?: any };

const PAGE_SIZE = 20;

export const RecordsScreen: React.FC<Props> = ({ navigation }) => {
  const fabBottom = useFabBottom(true);
  const [activeTab, setActiveTab]     = useState<'swing' | 'ai'>('swing');
  const [searchText, setSearchText]   = useState('');
  const [aiSearchText, setAiSearchText] = useState('');
  const [aiSortAsc, setAiSortAsc]     = useState(false);

  // ── Swing sessions state ──────────────────────────────────────────
  const [sessions, setSessions]       = useState<SessionSummary[]>([]);
  const [swingLoading, setSwingLoading] = useState(false);
  const [swingError, setSwingError]   = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount]   = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── AI chat state ─────────────────────────────────────────────────
  const [savedChats, setSavedChats]   = useState<SavedChatSession[]>([]);

  const fetchSessions = useCallback(async (page: number, append = false) => {
    if (page === 1) { setSwingLoading(true); setSwingError(null); }
    else { setLoadingMore(true); }
    try {
      const res = await getSessions(page, PAGE_SIZE);
      setSessions(prev => append ? [...prev, ...res.sessions] : res.sessions);
      setTotalCount(res.total);
      setCurrentPage(res.page);
    } catch (e: any) {
      setSwingError(e?.message ?? '세션을 불러오지 못했습니다.');
    } finally {
      setSwingLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions(1);
      loadChatSessions().then(setSavedChats);
    }, [fetchSessions]),
  );

  const handleLoadMore = () => {
    if (loadingMore || sessions.length >= totalCount) { return; }
    fetchSessions(currentPage + 1, true);
  };

  // ── Swing 필터링 ──────────────────────────────────────────────────
  const filtered = searchText
    ? sessions.filter(s =>
        sessionTitle(s).toLowerCase().includes(searchText.toLowerCase()) ||
        (CLUB_LABEL[s.clubType] ?? s.clubType).toLowerCase().includes(searchText.toLowerCase()),
      )
    : sessions;

  // ── AI 채팅 필터링 + 정렬 ─────────────────────────────────────────
  const filteredAi = React.useMemo(() => {
    let list = aiSearchText
      ? savedChats.filter(c =>
          c.title.toLowerCase().includes(aiSearchText.toLowerCase()) ||
          c.preview.toLowerCase().includes(aiSearchText.toLowerCase()),
        )
      : [...savedChats];
    list.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return aiSortAsc ? cmp : -cmp;
    });
    return list;
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
              <TouchableOpacity style={s.filterBtn} onPress={() => fetchSessions(1)}>
                <Text style={s.filterIcon}>↺</Text>
              </TouchableOpacity>
            </View>

            {/* ─── 로딩 / 에러 / 세션 카드 ─── */}
            {swingLoading ? (
              <View style={s.centerState}>
                <ActivityIndicator color={C.green} size="large" />
              </View>
            ) : swingError ? (
              <View style={s.centerState}>
                <Text style={s.errorText}>{swingError}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={() => fetchSessions(1)}>
                  <Text style={s.retryBtnText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={s.centerState}>
                <Text style={s.emptyText}>스윙 기록이 없습니다.</Text>
                <Text style={s.emptySubText}>영상을 업로드하면 분석 결과가 여기 나타납니다.</Text>
              </View>
            ) : (
              <View style={s.feed}>
                {filtered.map((item, i) => (
                  <SessionCard
                    key={item.sessionId}
                    item={item}
                    featured={i === 0}
                    onPress={(sessionId) => navigation?.navigate('SwingFeedback', { sessionId })}
                  />
                ))}

                {/* Load More */}
                {sessions.length < totalCount && !searchText && (
                  <TouchableOpacity
                    style={s.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loadingMore}>
                    {loadingMore
                      ? <ActivityIndicator color={C.green} size="small" />
                      : <Text style={s.loadMoreText}>더 보기 ({totalCount - sessions.length}개 남음)</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            )}
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
            </View>

            {/* 새 채팅 CTA (채팅 없을 때) */}
            {filteredAi.length === 0 && (
              <View style={s.centerState}>
                <Text style={s.emptyText}>AI 채팅 기록이 없습니다.</Text>
                <Text style={s.emptySubText}>스윙 분석 후 AI 코치와 대화해보세요.</Text>
                <TouchableOpacity
                  style={s.retryBtn}
                  onPress={() => navigation?.navigate('SwingChat', {})}>
                  <Text style={s.retryBtnText}>새 채팅 시작</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* AI 히스토리 카드 리스트 */}
            {filteredAi.map(card => (
              <TouchableOpacity
                key={card.chatSessionId}
                style={s.aiHistCard}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate('SwingChat', { chatSessionId: card.chatSessionId, sessionId: card.sessionId })}>
                <View style={s.aiHistTop}>
                  <Text style={s.aiHistTitle}>{card.title}</Text>
                  <View style={[s.catBadge, { backgroundColor: card.badgeBg }]}>
                    <Text style={[s.catBadgeText, { color: card.badgeText }]}>{card.badge}</Text>
                  </View>
                </View>
                <Text style={s.aiHistDesc}>{card.preview}</Text>
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

            {filteredAi.length > 0 && (
              <View style={s.endState}>
                <Text style={s.endStateText}>End of recent history</Text>
              </View>
            )}
          </View>
        )}

        <BottomSpacer tabBar />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: fabBottom }]}
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

  heroSection: { gap: 16, paddingBottom: 8 },
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
  filterIcon: { fontSize: 16, color: C.textSub },

  feed: { gap: 12, marginBottom: 24 },

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

  featuredBadge: {
    backgroundColor: C.green, borderRadius: 16,
    paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  metricsRow: { flexDirection: 'row', gap: 8 },
  metricChip: {
    flex: 1, backgroundColor: C.chipBgFaint,
    borderRadius: 0, padding: 8, alignItems: 'center', gap: 2,
  },
  metricChipFeatured: { backgroundColor: C.chipBg },
  metricLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase' },
  metricValue: { fontSize: 12, fontWeight: '700', color: C.textPri },

  // 로딩/에러/빈 상태
  centerState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  errorText:   { fontSize: 14, color: '#ba1a1a', textAlign: 'center' },
  emptyText:   { fontSize: 15, fontWeight: '700', color: C.textPri },
  emptySubText: { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:    { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Load More
  loadMoreBtn: {
    alignItems: 'center', paddingVertical: 14,
    backgroundColor: C.surface, borderRadius: 24,
    borderWidth: 1, borderColor: C.border,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: C.green },

  // AI 채팅 탭 피드
  aiFeed: { gap: 12, marginBottom: 8 },

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

  endState: { alignItems: 'center', paddingVertical: 24, opacity: 0.4 },
  endStateText: { fontSize: 13, color: C.textMuted },

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
