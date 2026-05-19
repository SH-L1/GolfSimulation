import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

interface SwingScoreRingProps {
  score: number; // 0–100
  size?: number;
}

// 추후 SVG/Animated 로 교체 예정 — 현재는 단순 텍스트 표시
export const SwingScoreRing: React.FC<SwingScoreRingProps> = ({ score, size = 120 }) => {
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.score}>{score}</Text>
      <Text style={styles.label}>점</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    borderWidth: 6,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  score: { ...typography.h1, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.xs },
});
