import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  onSend:    (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<Props> = ({
  onSend,
  disabled = false,
  placeholder = '메시지를 입력하세요...',
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) { return; }
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={s.wrap}>
      <TextInput
        style={s.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline
        maxLength={500}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[s.sendBtn, (!text.trim() || disabled) && s.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        activeOpacity={0.8}>
        <Text style={s.sendIcon}>↑</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  wrap:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(190,202,185,0.3)' },
  input:           { flex: 1, backgroundColor: '#f2f4f2', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#191c1b', maxHeight: 100 },
  sendBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: '#006e1c', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#e1e3e1' },
  sendIcon:        { fontSize: 18, color: '#fff', fontWeight: '700' },
});
