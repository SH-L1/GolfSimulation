import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label:    string;
  score:    number;
  size?:    'sm' | 'md' | 'lg';
}

function scoreColor(score: number): string {
  if (score >= 80) { return '#006e1c'; }
  if (score >= 60) { return '#C8922A'; }
  return '#ba1a1a';
}

export const ScoreCard: React.FC<Props> = ({ label, score, size = 'md' }) => {
  const fontSize  = size === 'lg' ? 40 : size === 'md' ? 28 : 20;
  const labelSize = size === 'lg' ? 13 : 11;
  const color     = scoreColor(score);

  return (
    <View style={s.card}>
      <Text style={[s.score, { fontSize, color }]}>{score}</Text>
      <Text style={[s.label, { fontSize: labelSize }]}>{label}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  card:  { alignItems: 'center', gap: 4 },
  score: { fontWeight: '700', letterSpacing: -1 },
  label: { color: '#78716c', fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
});
