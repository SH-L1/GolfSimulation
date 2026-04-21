import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'handy_chat_history';

export type ChatBadge = 'TECHNICAL' | 'STRATEGY' | 'POWER' | 'GENERAL';

const BADGE_STYLES: Record<ChatBadge, { badgeBg: string; badgeText: string }> = {
  TECHNICAL: { badgeBg: '#eceeec', badgeText: '#6f7a6b' },
  STRATEGY:  { badgeBg: '#d1e4ff', badgeText: 'rgba(51,160,253,0.8)' },
  POWER:     { badgeBg: '#ffd9e2', badgeText: '#690034' },
  GENERAL:   { badgeBg: '#f2f4f2', badgeText: '#78716c' },
};

export interface SavedChatSession {
  chatSessionId: string;
  sessionId?: string;
  title: string;
  preview: string;
  date: string;
  badge: ChatBadge;
  badgeBg: string;
  badgeText: string;
}

// 메시지 내용으로 배지 자동 분류
function inferBadge(messages: { role: string; text: string }[]): ChatBadge {
  const allText = messages.map(m => m.text).join(' ');
  if (/비거리|헤드스피드|지면반력|파워|스피드|distance|power/i.test(allText)) return 'POWER';
  if (/퍼팅|전략|라인|코스|putting|strategy/i.test(allText)) return 'STRATEGY';
  if (/X-Factor|스윙|궤도|각도|템포|힙|어깨|swing|rotation|angle/i.test(allText)) return 'TECHNICAL';
  return 'GENERAL';
}

// 채팅 세션 저장 (최신순 prepend)
export async function saveChatSession(
  session: Omit<SavedChatSession, 'badge' | 'badgeBg' | 'badgeText'> & {
    messages: { role: string; text: string }[];
  },
): Promise<void> {
  const badge = inferBadge(session.messages);
  const { badgeBg, badgeText } = BADGE_STYLES[badge];

  const saved: SavedChatSession = {
    chatSessionId: session.chatSessionId,
    sessionId:     session.sessionId,
    title:         session.title,
    preview:       session.preview,
    date:          session.date,
    badge,
    badgeBg,
    badgeText,
  };

  const existing = await loadChatSessions();
  // 같은 chatSessionId가 이미 있으면 교체, 없으면 맨 앞에 추가
  const updated = [
    saved,
    ...existing.filter(s => s.chatSessionId !== saved.chatSessionId),
  ];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// 저장된 채팅 세션 전체 로드
export async function loadChatSessions(): Promise<SavedChatSession[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedChatSession[];
  } catch {
    return [];
  }
}
