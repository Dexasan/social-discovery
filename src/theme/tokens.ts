export const colors = {
  background: '#090A0F',
  backgroundRaised: '#0D0F16',
  surface: '#141720',
  surfaceRaised: '#1B1F2B',
  surfaceSoft: '#10131A',
  border: '#262B39',
  borderStrong: '#363D50',
  primary: '#7D9BFF',
  primaryPressed: '#6685EE',
  primarySoft: '#1C2749',
  primaryInk: '#090D1A',
  accent: '#FF7188',
  accentSoft: '#351C27',
  warning: '#F5B95B',
  warningSoft: '#302515',
  text: '#F6F4F1',
  textMuted: '#9DA3B2',
  textSubtle: '#717887',
  danger: '#FF6F7D',
  dangerSoft: '#341B22',
  success: '#5ED6A4',
  successSoft: '#173329',
  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(4, 5, 9, 0.72)',
  primaryGlow: 'rgba(79, 110, 216, 0.20)',
  accentGlow: 'rgba(192, 66, 92, 0.12)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 48,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const shadows = {
  card: {
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  floating: {
    elevation: 14,
    shadowColor: colors.black,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
  },
} as const;
