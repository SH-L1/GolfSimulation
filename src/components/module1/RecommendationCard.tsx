import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Recommendation } from '../../types/module1';

interface Props { recommendation: Recommendation }

export const RecommendationCard: React.FC<Props> = ({ recommendation: r }) => (
  <View style={s.card}>
    <View style={s.header}>
      <View style={s.badge}>
        <Text style={s.badgeText}>개선 필요</Text>
      </View>
      <Text style={s.title}>{r.title}</Text>
    </View>
    <Text style={s.body}>{r.body}</Text>
    {r.drillTitle ? (
      <View style={s.drill}>
        <Text style={s.drillIcon}>🏌️</Text>
        <Text style={s.drillTitle}>{r.drillTitle}</Text>
      </View>
    ) : null}
  </View>
);

const s = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#e6e9e7' },
  header:     { gap: 6 },
  badge:      { alignSelf: 'flex-start', backgroundColor: '#ffd9e2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:  { fontSize: 10, fontWeight: '700', color: '#a63360' },
  title:      { fontSize: 15, fontWeight: '700', color: '#191c1b' },
  body:       { fontSize: 13, color: '#3f4a3c', lineHeight: 20 },
  drill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f2f4f2', borderRadius: 10, padding: 10 },
  drillIcon:  { fontSize: 16 },
  drillTitle: { fontSize: 13, fontWeight: '600', color: '#006e1c' },
});
