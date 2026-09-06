import { colors } from '@/theme/tokens';

export type GiftPresentation = {
  accent: string;
  background: string;
  emoji: string;
  label: string;
  sparkle: string;
  tagline: string;
};

const presentations: Record<string, GiftPresentation> = {
  rose: { accent: '#FF577D', background: '#3C1521', emoji: '🌹', label: 'A CLASSIC', sparkle: '✦', tagline: 'A rose that blooms across the whole screen.' },
  coffee: { accent: '#F4B75B', background: '#382715', emoji: '☕', label: 'WARM & EASY', sparkle: '≈', tagline: 'A warm cup with rising animated steam.' },
  heart: { accent: '#FF5FA0', background: '#41152C', emoji: '💖', label: 'BIG FEELING', sparkle: '♥', tagline: 'A full-screen heart burst for someone special.' },
  fire: { accent: '#FF7448', background: '#3C1B13', emoji: '🎆', label: 'LOUD LOVE', sparkle: '✷', tagline: 'Fireworks, sparks, and a room-stopping entrance.' },
  crown: { accent: '#FFD45E', background: '#3B3013', emoji: '👑', label: 'ROYAL', sparkle: '◆', tagline: 'A gold crown with a bright sweeping shine.' },
  bumper: { accent: colors.signal, background: '#20300E', emoji: '🚀', label: 'THE BIG ONE', sparkle: '★', tagline: 'Every animation, a huge entrance, and 30 days of Premium for them.' },
  halloween_pumpkin: { accent: '#FF7A32', background: '#34160B', emoji: '🎃', label: 'OCTOBER DROP', sparkle: '✦', tagline: 'A glowing pumpkin pop for Halloween.' },
  halloween_ghost: { accent: '#C9B8FF', background: '#211936', emoji: '👻', label: 'OCTOBER DROP', sparkle: '◌', tagline: 'A playful ghost that floats through the chat.' },
  christmas_card: { accent: '#FF5D68', background: '#35151A', emoji: '💌', label: 'HOLIDAY DROP', sparkle: '❄', tagline: 'An animated card that opens just for them.' },
  santa_surprise: { accent: '#F15C5C', background: '#321416', emoji: '🎅', label: 'HOLIDAY DROP', sparkle: '❄', tagline: 'Santa lands with snow, bells, and confetti.' },
  winter_jacket: { accent: '#75C9FF', background: '#122C3C', emoji: '🧥', label: 'WINTER DROP', sparkle: '❄', tagline: 'A cozy winter flex wrapped in falling snow.' },
  summer_beach_ball: { accent: '#62DFFF', background: '#0D3440', emoji: '🏖️', label: 'SUMMER DROP', sparkle: '☀', tagline: 'A bouncing beach moment with sun and waves.' },
  summer_sunglasses: { accent: '#FFE456', background: '#3C3410', emoji: '😎', label: 'SUMMER DROP', sparkle: '☀', tagline: 'Bright shades, lens flare, instant summer.' },
};

const fallback: GiftPresentation = {
  accent: colors.warning,
  background: colors.warningSoft,
  emoji: '🎁',
  label: 'YAPPIE GIFT',
  sparkle: '✦',
  tagline: 'A little something that feels big.',
};

export function giftPresentation(slug: string): GiftPresentation {
  return presentations[slug] ?? fallback;
}
