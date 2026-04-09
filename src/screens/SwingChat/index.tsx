import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLACEHOLDER_URI } from '../../assets';

// TODO: 실제 에셋으로 교체 필요 (src/assets/index.ts 참고)
const imgCoachPortrait = PLACEHOLDER_URI;
const imgDrillDemo     = PLACEHOLDER_URI;

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

const QUICK_CHIPS = ['Stretching Drill', 'Compare Pro', 'Book Lesson'];

// AI 자동 응답 목업
const AI_REPLIES = [
  '분석 결과를 바탕으로, 상체와 하체의 분리 회전을 늘리는 것이 핵심입니다. 매일 5분씩 흉추 회전 스트레칭을 추천합니다.',
  '좋은 질문입니다! 템포를 3:1 비율로 유지하면서 백스윙 시 왼쪽 어깨가 턱 아래까지 오도록 의식해 보세요.',
  '힙 로테이션이 임팩트 전에 시작되어야 X-Factor 스트레치가 극대화됩니다. 슬로우 모션 드릴로 연습해 보세요.',
  '지면 반력을 활용하면 클럽 헤드 스피드를 15% 이상 향상시킬 수 있습니다. 발바닥으로 지면을 밀어내는 느낌을 연습하세요.',
];

type Message = {
  id: string;
  role: 'ai' | 'user';
  text: string;
  time: string;
  hasDrill?: boolean;
};

const now = () => {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'ai',
    text: '📊 분석 요약: X-Factor가 38.2°로, 프로 평균(45°)보다 6.8° 낮습니다.\n\n🎯 주요 문제: 낮은 X-Factor는 임팩트 시 파워를 감소시킵니다.',
    time: '10:24 AM',
    hasDrill: true,
  },
  {
    id: '2',
    role: 'user',
    text: '짧은 백스윙은 어떻게 고칠 수 있나요?',
    time: '10:25 AM',
  },
  {
    id: '3',
    role: 'ai',
    text: '어깨 회전 데이터를 분석했습니다. 짧은 백스윙은 흉추 가동성 제한이나 코어 회전보다 팔에 의존하는 경향에서 비롯됩니다.',
    time: '10:25 AM',
  },
];

type Props = {
  route?: { params?: { title?: string } };
  navigation?: any;
};

export const SwingChatScreen: React.FC<Props> = ({ navigation }) => {
  const [inputText, setInputText]   = useState('');
  const [messages, setMessages]     = useState<Message[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping]     = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const replyIdx  = useRef(0);

  const appendMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: String(Date.now()) }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    appendMessage({ role: 'user', text: trimmed, time: now() });
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const reply = AI_REPLIES[replyIdx.current % AI_REPLIES.length];
      replyIdx.current += 1;
      appendMessage({ role: 'ai', text: reply, time: now() });
    }, 1200);
  }, [appendMessage]);

  return (
    <View style={s.root}>
      {/* 헤더 */}
      <SafeAreaView edges={['top']} style={s.headerWrap}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.coachBorder}>
              <Image source={{ uri: imgCoachPortrait }} style={s.coachImg} />
            </View>
            <Text style={s.headerTitle}>CaddyMaster AI</Text>
          </View>
          <TouchableOpacity style={s.settingsBtn}>
            <Text style={s.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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
                <Text style={s.aiLabel}>CaddyMaster AI</Text>
                <View style={s.aiBubble}>
                  <Text style={s.aiText}>{msg.text}</Text>
                  {msg.hasDrill && (
                    <TouchableOpacity
                      style={s.drillCard}
                      activeOpacity={0.8}
                      onPress={() => navigation?.navigate('Viewer3D')}>
                      <View style={s.drillThumbWrap}>
                        <Image source={{ uri: imgDrillDemo }} style={s.drillThumb} />
                      </View>
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

        {/* 타이핑 인디케이터 */}
        {isTyping && (
          <View style={s.aiRow}>
            <View style={s.aiMsgWrap}>
              <View style={s.aiBubble}>
                <View style={s.typingRow}>
                  <View style={[s.dot, { opacity: 0.4 }]} />
                  <View style={[s.dot, { opacity: 0.65 }]} />
                  <View style={s.dot} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 퀵 액션 칩 */}
        {!isTyping && (
          <View style={s.chipsRow}>
            {QUICK_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip}
                style={s.chip}
                onPress={() => sendMessage(chip)}>
                <Text style={s.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 72 }} />
      </ScrollView>

      {/* 플로팅 입력창 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.inputFloating}>
        <View style={s.inputBar}>
          <TouchableOpacity style={s.iconBtn}>
            <Text style={s.iconBtnText}>＋</Text>
          </TouchableOpacity>
          <TextInput
            style={s.textInput}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage(inputText)}
            placeholder="캐디에게 무엇이든 물어보세요..."
            placeholderTextColor={C.textMuted}
            multiline
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() && !isTyping}>
            <Text style={s.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachBorder: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  coachImg: { width: '100%', height: '100%' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.green, letterSpacing: -0.5 },
  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 18, color: '#78716c' },

  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 20 },

  aiRow: { alignItems: 'flex-start' },
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
  drillThumb: { width: '100%', height: '100%' },
  drillInfo: { flex: 1, gap: 2 },
  drillLabel: { fontSize: 10, color: C.green },
  drillTitle: { fontSize: 14, fontWeight: '700', color: C.textPri },
  drillPlay: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.green, justifyContent: 'center', alignItems: 'center',
  },
  drillPlayIcon: { fontSize: 10, color: '#fff', marginLeft: 2 },

  typingRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },

  userRow: { alignItems: 'flex-end' },
  userMsgWrap: { maxWidth: '75%', alignItems: 'flex-end', gap: 6 },
  userBubble: {
    backgroundColor: C.green,
    borderRadius: BR, borderTopRightRadius: 0,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  userText: { fontSize: 14, color: '#fff', lineHeight: 22 },

  timestamp: { fontSize: 10, color: C.textMuted, marginLeft: 4 },
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

  inputFloating: { position: 'absolute', bottom: 84, left: 16, right: 16 },
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
  iconBtnText: { fontSize: 22, color: C.textSub },
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
