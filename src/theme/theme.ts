// src/theme/theme.ts
export const theme = {
  colors: {
    background: '#FAF6F0',
    cardBackground: '#FFFFFF',
    border: '#E8DDD0',
    textPrimary: '#3A2E22',
    textSecondary: '#8A7A68',
    accent: '#C9A27A',
    accentStrong: '#A8895F',
    danger: '#A83246',
  },
  radii: {
    small: 12,
    medium: 16,
    large: 18,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  fonts: {
    heading: 'Georgia',
    body: undefined, // system default sans-serif
  },
} as const;

export type Theme = typeof theme;
