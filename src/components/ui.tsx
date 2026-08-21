import { PropsWithChildren, ReactElement, ReactNode } from 'react';
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
import type { RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing } from '@/theme/tokens';

export function Screen({
  children,
  contentStyle,
  refreshControl,
  scroll = true,
}: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle>; refreshControl?: ReactElement<RefreshControlProps>; scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
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
      <View pointerEvents="none" style={styles.ambientDot} />
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
    { backgroundColor: colors.signal, color: colors.primary },
    { backgroundColor: colors.cobaltSoft, color: colors.cobalt },
    { backgroundColor: colors.accentSoft, color: '#9F321D' },
    { backgroundColor: colors.warningSoft, color: '#785200' },
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

export function SignalBars({ dark = false }: { dark?: boolean }) {
  return (
    <View accessibilityLabel="Live audio signal" style={styles.signalBars}>
      {[12, 24, 17, 31, 20, 27, 13].map((height, index) => (
        <View key={`${height}-${index}`} style={[styles.signalBar, { height }, dark && styles.signalBarDark]} />
      ))}
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
  ambientTop: { backgroundColor: colors.accentGlow, borderRadius: 36, height: 220, position: 'absolute', right: -112, top: -104, transform: [{ rotate: '18deg' }], width: 220 },
  ambientSide: { backgroundColor: colors.primaryGlow, borderRadius: 38, height: 190, left: -145, position: 'absolute', top: 360, transform: [{ rotate: '-12deg' }], width: 190 },
  ambientDot: { backgroundColor: colors.accentSoft, borderRadius: 18, height: 66, position: 'absolute', right: -34, top: 500, transform: [{ rotate: '28deg' }], width: 66 },
  screenContent: { flexGrow: 1, paddingBottom: 132, paddingHorizontal: 18, paddingTop: spacing.lg },
  eyebrow: { color: colors.textMuted, fontSize: 12.5, fontWeight: '900', letterSpacing: 1.55, lineHeight: 17, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -2.15, lineHeight: 47, marginTop: spacing.sm },
  headingCompact: { fontSize: 35, letterSpacing: -1.35, lineHeight: 39 },
  muted: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  card: { ...shadows.card, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, padding: 20 },
  pill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 13, paddingVertical: 7 },
  pillLive: { backgroundColor: colors.accentSoft, borderColor: '#FFB9A7' },
  pillAccent: { backgroundColor: colors.cobaltSoft, borderColor: '#BFC9FF' },
  pillSuccess: { backgroundColor: colors.signalSoft, borderColor: '#CDE987' },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  pillText: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.45, textTransform: 'uppercase' },
  pillLiveText: { color: colors.danger },
  pillAccentText: { color: colors.cobalt },
  pillSuccessText: { color: colors.success },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 20, elevation: 3, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 64, paddingHorizontal: spacing.xl, shadowColor: colors.black, shadowOffset: { height: 7, width: 0 }, shadowOpacity: 0.18, shadowRadius: 12 },
  primaryButtonPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.985 }] },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.primaryInk, fontSize: 17, fontWeight: '900', letterSpacing: -0.25 },
  avatarRing: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, justifyContent: 'center', padding: 3 },
  avatar: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  avatarText: { fontWeight: '900', letterSpacing: -0.6 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.7 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 52, justifyContent: 'center', width: 52 },
  iconButtonDanger: { backgroundColor: colors.dangerSoft, borderColor: '#FFB9A7' },
  iconGlyph: { color: colors.text, fontSize: 22, fontWeight: '800' },
  iconGlyphDanger: { color: colors.danger },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  emptyState: { alignItems: 'center', backgroundColor: colors.signalSoft, borderColor: '#CDE987', borderRadius: radius.xl, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 60, justifyContent: 'center', marginBottom: spacing.xs, transform: [{ rotate: '-5deg' }], width: 60 },
  emptyGlyph: { color: colors.white, fontSize: 27, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  emptyDescription: { maxWidth: 260, textAlign: 'center' },
  signalBars: { alignItems: 'center', flexDirection: 'row', gap: 4, height: 34 },
  signalBar: { backgroundColor: colors.signal, borderRadius: 4, width: 5 },
  signalBarDark: { backgroundColor: colors.primary },
});
