import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: '#E8F5E9', text: colors.success },
  warning: { bg: '#FFF3E0', text: colors.warning },
  error: { bg: '#FFEBEE', text: colors.error },
  info: { bg: '#E3F2FD', text: colors.info },
  neutral: { bg: colors.border, text: colors.textSecondary },
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', style }) => {
  const { bg, text } = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.label,
  },
});
