import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MetricValue } from '../../types/module1';

interface Props {
  label:  string;
  metric: MetricValue;
}

function scoreColor(score: number): string {
  if (score >= 80) { return '#006e1c'; }
  if (score >= 60) { return '#C8922A'; }
  return '#ba1a1a';
}

export const MetricRow: React.FC<Props> = ({ label, metric }) => {
  const color = scoreColor(metric.score);
  return (
    <View style={s.row}>
      <View style={s.info}>
        <Text style={s.label}>{label}</Text>
        <View style={s.values}>
          <Text style={[s.userVal, { color }]}>
            {metric.userValue}{metric.unit}
          </Text>
          <Text style={s.proVal}>/ 프로 {metric.proMean}{metric.unit}</Text>
        </View>
      </View>
      <View style={s.barWrap}>
        <View style={[s.bar, { width: `${metric.score}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.scoreText, { color }]}>{metric.score}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  info:     { flex: 1, gap: 2 },
  label:    { fontSize: 12, fontWeight: '700', color: '#3f4a3c' },
  values:   { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  userVal:  { fontSize: 15, fontWeight: '700' },
  proVal:   { fontSize: 11, color: '#78716c' },
  barWrap:  { width: 80, height: 4, backgroundColor: '#e1e3e1', borderRadius: 2, overflow: 'hidden' },
  bar:      { height: '100%', borderRadius: 2 },
  scoreText:{ fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },
});
