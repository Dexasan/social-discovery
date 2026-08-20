import { PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing } from '@/theme/tokens';

export function Screen({
  children,
  contentStyle,
  scroll = true,
}: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle>; scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={styles.ambientTop} />
      <View pointerEvents="none" style={styles.ambientSide} />
      {content}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Heading({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  return <Text style={[styles.heading, compact && styles.headingCompact]}>{children}</Text>;
}

export function Muted({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = 'default' }: { label: string; tone?: 'default' | 'live' | 'accent' | 'success' }) {
  return (
    <View style={[
      styles.pill,
      tone === 'live' && styles.pillLive,
      tone === 'accent' && styles.pillAccent,
      tone === 'success' && styles.pillSuccess,
    ]}>
      {tone === 'live' ? <View style={styles.liveDot} /> : null}
      <Text style={[
        styles.pillText,
        tone === 'live' && styles.pillLiveText,
        tone === 'accent' && styles.pillAccentText,
        tone === 'success' && styles.pillSuccessText,
      ]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
        disabled && styles.primaryButtonDisabled,
      ]}
    >
      {icon}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ label, size = 48 }: { label: string; size?: number }) {
  const palettes = [
    { backgroundColor: '#293965', color: '#C8D5FF' },
    { backgroundColor: '#4A2633', color: '#FFD0D9' },
    { backgroundColor: '#263E3A', color: '#B9EBDD' },
    { backgroundColor: '#46351F', color: '#FFE0A9' },
  ];
  const palette = palettes[(label.charCodeAt(0) || 0) % palettes.length] ?? palettes[0]!;
  return (
    <View style={[styles.avatarRing, { height: size, width: size, borderRadius: size / 2 }]}>
      <View style={[styles.avatar, { backgroundColor: palette.backgroundColor, borderRadius: (size - 4) / 2 }]}>
        <Text style={[styles.avatarText, { color: palette.color, fontSize: size * 0.31 }]}>{label.slice(0, 2).toUpperCase()}</Text>
      </View>
    </View>
  );
}

export function SectionHeader({ action, title }: { action?: ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function IconButton({
  accessibilityLabel,
  glyph,
  onPress,
  tone = 'default',
}: {
  accessibilityLabel: string;
  glyph: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, tone === 'danger' && styles.iconButtonDanger, pressed && styles.pressed]}
    >
      <Text style={[styles.iconGlyph, tone === 'danger' && styles.iconGlyphDanger]}>{glyph}</Text>
    </Pressable>
  );
}

export function EmptyState({ description, glyph, title }: { description: string; glyph: string; title: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>{glyph}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Muted style={styles.emptyDescription}>{description}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  ambientTop: { backgroundColor: colors.primaryGlow, borderRadius: 180, height: 260, position: 'absolute', right: -115, top: -145, width: 260 },
  ambientSide: { backgroundColor: colors.accentGlow, borderRadius: 140, height: 220, left: -150, position: 'absolute', top: 310, width: 220 },
  screenContent: { flexGrow: 1, paddingBottom: 124, paddingHorizontal: 20, paddingTop: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.9, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.45, lineHeight: 41, marginTop: spacing.sm },
  headingCompact: { fontSize: 28, letterSpacing: -0.9, lineHeight: 33 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  card: { ...shadows.card, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg },
  pill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 6, paddingHorizontal: 11, paddingVertical: 6 },
  pillLive: { backgroundColor: colors.accentSoft, borderColor: '#592635' },
  pillAccent: { backgroundColor: colors.primarySoft, borderColor: '#2D4074' },
  pillSuccess: { backgroundColor: colors.successSoft, borderColor: '#285241' },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  pillText: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.65, textTransform: 'uppercase' },
  pillLiveText: { color: colors.danger },
  pillAccentText: { color: '#C9D4FF' },
  pillSuccessText: { color: colors.success },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, elevation: 4, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 54, paddingHorizontal: spacing.xl, shadowColor: colors.primary, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.18, shadowRadius: 14 },
  primaryButtonPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.985 }] },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.primaryInk, fontSize: 15, fontWeight: '900', letterSpacing: -0.1 },
  avatarRing: { alignItems: 'center', backgroundColor: colors.borderStrong, justifyContent: 'center', padding: 2 },
  avatar: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  avatarText: { fontWeight: '900', letterSpacing: -0.6 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.35 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 40, justifyContent: 'center', width: 40 },
  iconButtonDanger: { backgroundColor: colors.dangerSoft, borderColor: '#54242D' },
  iconGlyph: { color: colors.text, fontSize: 18, fontWeight: '800' },
  iconGlyphDanger: { color: colors.danger },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  emptyState: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radius.lg, borderStyle: 'dashed', borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 54, justifyContent: 'center', marginBottom: spacing.xs, width: 54 },
  emptyGlyph: { color: colors.primary, fontSize: 24, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyDescription: { maxWidth: 260, textAlign: 'center' },
});
