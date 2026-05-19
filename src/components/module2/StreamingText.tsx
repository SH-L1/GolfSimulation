import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props {
  text:      string;
  streaming: boolean;
  style?:    object;
}

export const StreamingText: React.FC<Props> = ({ text, streaming, style }) => (
  <Text style={[s.text, style]}>
    {text}
    {streaming ? <Text style={s.cursor}>▌</Text> : null}
  </Text>
);

const s = StyleSheet.create({
  text:   { fontSize: 14, color: '#191c1b', lineHeight: 21 },
  cursor: { color: '#006e1c', opacity: 0.8 },
});
