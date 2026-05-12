import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  role:    'user' | 'assistant';
  content: string;
  time?:   string;
}

export const ChatBubble: React.FC<Props> = ({ role, content, time }) => {
  const isUser = role === 'user';
  return (
    <View style={[s.row, isUser && s.rowUser]}>
      {!isUser && <View style={s.avatar}><Text style={s.avatarText}>AI</Text></View>}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        <Text style={[s.text, isUser && s.textUser]}>{content}</Text>
        {time ? <Text style={[s.time, isUser && s.timeUser]}>{time}</Text> : null}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 4 },
  rowUser:    { justifyContent: 'flex-end' },
  avatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: '#006e1c', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  bubble:     { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleAI:   { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(190,202,185,0.3)', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: '#006e1c', borderBottomRightRadius: 4 },
  text:       { fontSize: 14, color: '#191c1b', lineHeight: 21 },
  textUser:   { color: '#fff' },
  time:       { fontSize: 10, color: '#9ca3af', alignSelf: 'flex-end' },
  timeUser:   { color: 'rgba(255,255,255,0.65)' },
});
