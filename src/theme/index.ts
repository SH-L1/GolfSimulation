// 디자인 토큰

export const colors = {
  background:    '#0F1923',
  surface:       '#1E2D3D',
  accent:        '#1A5C38',
  gold:          '#C8922A',
  textPrimary:   '#FFFFFF',
  textSecondary: '#8899AA',

  // 시스템 피드백 (변경 예정)
  success: '#4CAF50',
  warning: '#FF9800',
  error:   '#F44336',
  info:    '#2196F3',

  white:   '#FFFFFF',
  black:   '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  border:  '#2A3D50',
} as const;

export const typography = {
  h1:      { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2:      { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  h3:      { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body1:   { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body2:   { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label:   { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:   4,
  md:   8,
  lg:   16,
  xl:   24,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.24,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
