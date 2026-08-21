export const colors = {
  background: '#F3F0E7',
  backgroundRaised: '#EAE5D7',
  surface: '#FFFEF9',
  surfaceRaised: '#E9E5DC',
  surfaceSoft: '#FAF8F1',
  border: '#D8D2C4',
  borderStrong: '#ADA697',
  primary: '#1C1D20',
  primaryPressed: '#000000',
  primarySoft: '#E4E1D8',
  primaryInk: '#FFFEF9',
  accent: '#FF5A36',
  accentSoft: '#FFE0D6',
  signal: '#C8F55A',
  signalSoft: '#ECF9C7',
  cobalt: '#4B68FF',
  cobaltSoft: '#E2E7FF',
  warning: '#C78000',
  warningSoft: '#FFF0BD',
  text: '#17181B',
  textMuted: '#5E5D58',
  textSubtle: '#858178',
  danger: '#C53247',
  dangerSoft: '#FFE0E5',
  success: '#127452',
  successSoft: '#DDF3E8',
  white: '#FFFEF9',
  black: '#000000',
  scrim: 'rgba(23, 24, 27, 0.62)',
  primaryGlow: 'rgba(75, 104, 255, 0.13)',
  accentGlow: 'rgba(200, 245, 90, 0.24)',
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
    elevation: 1,
    shadowColor: '#17181B',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  floating: {
    elevation: 12,
    shadowColor: '#17181B',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
} as const;
