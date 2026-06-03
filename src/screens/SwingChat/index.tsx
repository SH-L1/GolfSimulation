import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveChatSession } from '../../hooks/useChatHistory';
import { useChatStream } from '../../hooks/useChatStream';
import { getChatHistory } from '../../api/module2';
import { STORAGE_KEY_EXPERIENCE_LEVEL } from '../../hooks/useAuth';
import { toApiLevel } from '../../utils/experienceMapper';
import type { ExperienceLevel } from '../../utils/experienceMapper';


const C = {
  bg:        '#f8faf8',
  green:     '#006e1c',
  surface:   '#ffffff',
  textPri:   '#191c1b',
  textMuted: '#a8a29e',
  textSub:   '#3f4a3c',
  border:    'rgba(190,202,185,0.3)',
  glass:     'rgba(255,255,255,0.7)',
  chipBg:    '#d1e4ff',
  chipText:  '#001d36',
};

const CHIPS_WITH_SESSION  = ['내 스윙의 가장 큰 문제점이 뭐야?', '개선 드릴 추천해줘', '프로와 비교해줘'];
const CHIPS_NO_SESSION    = ['스트레칭 드릴 알려줘', '초보자 골프 팁 알려줘', '레슨 예약 방법'];

type Message = {
  id:         string;
  role:       'ai' | 'user';
  text:       string;
  time:       string;
  streaming?: boolean;
  hasDrill?:  boolean;
};

const now = () => {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
};

const WELCOME_MESSAGE: Message = {
  id:   'welcome',
  role: 'ai',
  text: 'Handy AI 코치입니다. 스윙 분석 결과를 바탕으로 무엇이든 물어보세요! 💪',
  time: now(),
};

type Props = {
  route?: { params?: { chatSessionId?: string; sessionId?: string; title?: string } };
  navigation?: any;
};

export const SwingChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets             = useSafeAreaInsets();
  const sessionId         = route?.params?.sessionId;

  const chatSessionIdRef  = useRef<string | null>(null);
  const streamingIdRef    = useRef<string | null>(null);
  const expLevelRef       = useRef<'beginner' | 'experienced'>('beginner');

  // 앱 로컬 저장소에서 경험 수준 로드 (API 전송용)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_EXPERIENCE_LEVEL)
      .then(v => { expLevelRef.current = toApiLevel((v as ExperienceLevel) ?? 'beginner'); })
      .catch(() => {});
  }, []);

  const [inputText, setInputText]       = useState('');
  const [messages, setMessages]         = useState<Message[]>([WELCOME_MESSAGE]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kbHeight, setKbHeight]         = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── SSE 스트리밍 ─────────────────────────────────────────────────
  const handleToken = useCallback((token: string) => {
    const id = streamingIdRef.current;
    if (!id) { return; }
    setMessages(prev => prev.map(m =>
      m.id === id
        ? { ...m, text: m.text + token }
        : m,
    ));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 20);
  }, []);

  const handleDone = useCallback((newChatSessionId: string) => {
    chatSessionIdRef.current = newChatSessionId;
    streamingIdRef.current   = null;
    setMessages(prev => prev.map(m =>
      m.streaming ? { ...m, streaming: false } : m,
    ));
  }, []);

  const { status, error: streamError, send, cancel } = useChatStream(handleToken, handleDone);
  const isBusy = status === 'connecting' || status === 'streaming';

  // 탭으로 돌아올 때 chatSessionId 없으면 상태 초기화
  const cancelRef = useRef(cancel);
  useEffect(() => { cancelRef.current = cancel; }, [cancel]);

  useFocusEffect(
    useCallback(() => {
      if (!route?.params?.chatSessionId) {
        cancelRef.current();
        streamingIdRef.current   = null;
        chatSessionIdRef.current = null;
        setMessages([WELCOME_MESSAGE]);
      }
    }, [route?.params?.chatSessionId]),
  );

  // ── 히스토리 로드 (Records에서 chatSessionId 파라미터가 바뀔 때마다 재실행) ──
  useEffect(() => {
    const chatId = route?.params?.chatSessionId;
    const sid    = route?.params?.sessionId;
    if (!chatId || !sid) { return; }

    // 기존 스트림 취소 + 상태 초기화
    cancel();
    streamingIdRef.current    = null;
    chatSessionIdRef.current  = chatId;
    setMessages([WELCOME_MESSAGE]);

    setHistoryLoading(true);
    getChatHistory(sid)
      .then(res => {
        chatSessionIdRef.current = res.chat_session_id;
        if (res.messages.length === 0) { return; }
        const mapped: Message[] = res.messages.map(m => ({
          id:   m.message_id,
          role: m.role === 'user' ? 'user' : 'ai',
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString('ko-KR', {
            hour:   '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
        }));
        setMessages(mapped);
      })
      .catch(() => { /* 히스토리 없으면 환영 메시지 유지 */ })
      .finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.chatSessionId]);

  // SSE 오류 발생 시 스트리밍 메시지에 오류 텍스트 표시
  useEffect(() => {
    if (status !== 'error') { return; }
    const errMsg = streamError ?? '응답 중 오류가 발생했습니다. 다시 시도해 주세요.';
    streamingIdRef.current = null;
    setMessages(prev => prev.map(m =>
      m.streaming ? { ...m, text: errMsg, streaming: false } : m,
    ));
  }, [status, streamError]);

  // ── 메시지 전송 ──────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) { return; }

    const userMsg: Message = {
      id:   String(Date.now()),
      role: 'user',
      text: trimmed,
      time: now(),
    };
    const streamingId = String(Date.now() + 1);
    streamingIdRef.current = streamingId;
    const streamingMsg: Message = {
      id:        streamingId,
      role:      'ai',
      text:      '',
      time:      now(),
      streaming: true,
    };

    setMessages(prev => [...prev, userMsg, streamingMsg]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    send({
      message:          trimmed,
      swingSessionId:   sessionId ?? null,
      chatSessionId:    chatSessionIdRef.current,
      experience_level: expLevelRef.current,
    });
  }, [isBusy, send]);

  // ── 채팅 종료 + 저장 ─────────────────────────────────────────────
  const endChat = useCallback(() => {
    Alert.alert('채팅 종료', '채팅을 종료하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text:  '종료',
        style: 'destructive',
        onPress: async () => {
          cancel();
          // sessionId(스윙 기록)와 백엔드 chatSessionId가 모두 있을 때만 로컬 저장
          // 그 외(기록 없는 채팅, 메시지 없는 채팅)는 저장 스킵
          const backendChatId = chatSessionIdRef.current;
          if (sessionId && backendChatId) {
            const title = route?.params?.title ?? '스윙 분석 채팅';
            const last  = messages.filter(m => !m.streaming).at(-1)?.text ?? '';
            const date  = new Date().toLocaleDateString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit',
            });
            await saveChatSession({
              chatSessionId: backendChatId,
              sessionId,
              title,
              preview:  last.slice(0, 60),
              date,
              messages: messages
                .filter(m => !m.streaming)
                .map(m => ({ role: m.role, text: m.text })),
            });
          }
          chatSessionIdRef.current = null;
          setMessages([WELCOME_MESSAGE]);
          navigation?.goBack();
        },
      },
    ]);
  }, [messages, sessionId, route, navigation, cancel]);

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* 헤더 */}
      <SafeAreaView edges={['top']} style={s.headerWrap}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {navigation?.canGoBack() && (
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => navigation.goBack()}>
                <Text style={s.backBtnText}>‹</Text>
              </TouchableOpacity>
            )}
            <View style={s.coachBorder}>
              <Text style={s.coachEmoji}>🤖</Text>
            </View>
            <View>
              <Text style={s.headerTitle}>Handy AI</Text>
              {isBusy && (
                <Text style={s.statusText}>응답 중...</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={s.endBtn} onPress={endChat}>
            <Text style={s.endBtnText}>종료</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* 히스토리 로딩 */}
      {historyLoading && (
        <View style={s.histLoading}>
          <ActivityIndicator color={C.green} size="small" />
          <Text style={s.histLoadingText}>대화 기록 불러오는 중...</Text>
        </View>
      )}

      {/* 채팅 스크롤 영역 */}
      <ScrollView
        ref={scrollRef}
        style={s.chatScroll}
        contentContainerStyle={s.chatContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>

        {messages.map(msg =>
          msg.role === 'ai' ? (
            <View key={msg.id} style={s.aiRow}>
              <View style={s.aiMsgWrap}>
                <Text style={s.aiLabel}>Handy AI</Text>
                <View style={s.aiBubble}>
                  {msg.streaming && msg.text === '' ? (
                    /* 첫 토큰 전 점 애니메이션 */
                    <View style={s.typingRow}>
                      <View style={[s.dot, { opacity: 0.4 }]} />
                      <View style={[s.dot, { opacity: 0.65 }]} />
                      <View style={s.dot} />
                    </View>
                  ) : (
                    <Text style={s.aiText}>
                      {msg.text}{msg.streaming ? '▌' : ''}
                    </Text>
                  )}
                  {msg.hasDrill && (
                    <TouchableOpacity
                      style={s.drillCard}
                      activeOpacity={0.8}
                      onPress={() => navigation?.navigate('Viewer3D', { sessionId })}>
                      <View style={s.drillThumbWrap} />
                      <View style={s.drillInfo}>
                        <Text style={s.drillLabel}>추천 드릴</Text>
                        <Text style={s.drillTitle} numberOfLines={1}>힙 파킹 드릴 (Hip Par…</Text>
                      </View>
                      <View style={s.drillPlay}>
                        <Text style={s.drillPlayIcon}>▶</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={s.timestamp}>{msg.time}</Text>
              </View>
            </View>
          ) : (
            <View key={msg.id} style={s.userRow}>
              <View style={s.userMsgWrap}>
                <View style={s.userBubble}>
                  <Text style={s.userText}>{msg.text}</Text>
                </View>
                <Text style={[s.timestamp, s.timestampRight]}>{msg.time}</Text>
              </View>
            </View>
          )
        )}

        {/* 퀵 액션 칩 (스트리밍 중 아닐 때) */}
        {!isBusy && messages.length <= 2 && (
          <View style={s.chipsRow}>
            {(sessionId ? CHIPS_WITH_SESSION : CHIPS_NO_SESSION).map((chip: string) => (
              <TouchableOpacity
                key={chip}
                style={s.chip}
                onPress={() => sendMessage(chip)}>
                <Text style={s.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 입력창 — 탭바(최대 96px) + 여백을 고려한 위치 */}
      <View style={[s.inputFloating, { bottom: kbHeight > 0 ? kbHeight + 8 : Math.max(insets.bottom + 16, 106) }]}>
        <View style={s.inputBar}>
          {isBusy ? (
            /* 취소 버튼 */
            <TouchableOpacity style={s.iconBtn} onPress={cancel}>
              <Text style={s.cancelIcon}>◼</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.iconBtn} />
          )}
          <TextInput
            style={s.textInput}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage(inputText)}
            placeholder="Handy에게 무엇이든 물어보세요..."
            placeholderTextColor={C.textMuted}
            multiline
            returnKeyType="send"
            editable={!isBusy}
          />
          <TouchableOpacity
            style={[s.sendBtn, (isBusy || !inputText.trim()) && s.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={isBusy || !inputText.trim()}>
            <Text style={s.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const BR = 24;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  headerWrap: { backgroundColor: 'rgba(248,250,248,0.95)', zIndex: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 32, color: C.green, lineHeight: 34, marginTop: -4 },
  coachBorder: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  coachEmoji:  { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.green, letterSpacing: -0.5 },
  statusText:  { fontSize: 11, color: C.textMuted },

  endBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#ef4444',
  },
  endBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  histLoading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 8, backgroundColor: 'rgba(0,110,28,0.05)',
  },
  histLoadingText: { fontSize: 12, color: C.textMuted },

  chatScroll:  { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 160, gap: 20 },

  aiRow:    { alignItems: 'flex-start' },
  aiMsgWrap: { maxWidth: '85%', gap: 6 },
  aiLabel: {
    fontSize: 10, fontWeight: '700', color: C.green,
    letterSpacing: 1, textTransform: 'uppercase', marginLeft: 4,
  },
  aiBubble: {
    backgroundColor: C.surface,
    borderRadius: BR, borderTopLeftRadius: 0,
    padding: 20,
    borderWidth: 1, borderColor: 'rgba(190,202,185,0.15)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  aiText: { fontSize: 14, color: C.textPri, lineHeight: 22 },

  drillCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f2f4f2',
    borderRadius: 16, padding: 12, marginTop: 14,
    borderWidth: 1, borderColor: 'rgba(190,202,185,0.15)',
  },
  drillThumbWrap: {
    width: 56, height: 56, borderRadius: 48,
    backgroundColor: 'rgba(76,175,80,0.2)', overflow: 'hidden',
  },
  drillInfo:    { flex: 1, gap: 2 },
  drillLabel:   { fontSize: 10, color: C.green },
  drillTitle:   { fontSize: 14, fontWeight: '700', color: C.textPri },
  drillPlay: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.green, justifyContent: 'center', alignItems: 'center',
  },
  drillPlayIcon: { fontSize: 14, color: '#fff', marginLeft: 2 },

  typingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },

  userRow:    { alignItems: 'flex-end' },
  userMsgWrap: { maxWidth: '75%', alignItems: 'flex-end', gap: 6 },
  userBubble: {
    backgroundColor: C.green,
    borderRadius: BR, borderTopRightRadius: 0,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  userText: { fontSize: 14, color: '#fff', lineHeight: 22 },

  timestamp:      { fontSize: 10, color: C.textMuted, marginLeft: 4 },
  timestampRight: { marginLeft: 0, marginRight: 4 },

  chipsRow: {
    flexDirection: 'row', gap: 8, flexWrap: 'wrap',
    justifyContent: 'center', paddingHorizontal: 8, paddingTop: 4,
  },
  chip: {
    backgroundColor: C.chipBg, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 9,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: C.chipText },

  inputFloating: { position: 'absolute', bottom: 106, left: 16, right: 16 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.glass,
    borderRadius: 999, padding: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  cancelIcon:  { fontSize: 14, color: '#ef4444' },
  textInput: {
    flex: 1, fontSize: 14, color: C.textPri,
    paddingHorizontal: 8, paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  sendBtnDisabled: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  sendIcon: { fontSize: 13, color: '#fff' },
});
