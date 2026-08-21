export const colors = {
  background: '#FFF8F6',
  backgroundRaised: '#FFF0EB',
  surface: '#FFFFFF',
  surfaceRaised: '#F8F1EF',
  surfaceSoft: '#FFFCFB',
  border: '#EEDFDA',
  borderStrong: '#D7C1BA',
  primary: '#F05BD6',
  primaryPressed: '#D83CBA',
  primarySoft: '#FFE2F8',
  primaryInk: '#171116',
  accent: '#FF725E',
  accentSoft: '#FFE3DD',
  warning: '#D98A00',
  warningSoft: '#FFF0CF',
  text: '#171316',
  textMuted: '#6E6269',
  textSubtle: '#9B8C94',
  danger: '#D63D5C',
  dangerSoft: '#FFE5EB',
  success: '#16836A',
  successSoft: '#DDF4EC',
  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(23, 17, 22, 0.54)',
  primaryGlow: 'rgba(240, 91, 214, 0.16)',
  accentGlow: 'rgba(255, 114, 94, 0.13)',
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
    elevation: 2,
    shadowColor: '#6B4A5F',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
  },
  floating: {
    elevation: 12,
    shadowColor: '#5B344D',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
} as const;
