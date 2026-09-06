import { PropsWithChildren, ReactElement, ReactNode, useEffect, useState } from 'react';
import {
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { avatarPublicUrl } from '@/features/profile/avatar';

export function Screen({
  children,
  contentStyle,
  refreshControl,
  scroll = true,
}: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle>; refreshControl?: ReactElement<RefreshControlProps>; scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoider}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function RetroGlyph({
  glyph,
  size = 'md',
  tone = 'signal',
}: {
  glyph: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'signal' | 'accent' | 'cobalt' | 'warning' | 'neutral';
}) {
  return (
    <View style={[
      styles.retroGlyph,
      size === 'sm' && styles.retroGlyphSmall,
      size === 'lg' && styles.retroGlyphLarge,
      tone === 'accent' && styles.retroGlyphAccent,
      tone === 'cobalt' && styles.retroGlyphCobalt,
      tone === 'warning' && styles.retroGlyphWarning,
      tone === 'neutral' && styles.retroGlyphNeutral,
    ]}>
      <Text style={[
        styles.retroGlyphText,
        size === 'sm' && styles.retroGlyphTextSmall,
        size === 'lg' && styles.retroGlyphTextLarge,
        tone === 'neutral' && { color: colors.textMuted },
      ]}>{glyph}</Text>
    </View>
  );
}

export function RetroHeader({
  action,
  eyebrow,
  glyph,
  icon,
  title,
  tone = 'signal',
}: {
  action?: ReactNode;
  eyebrow: string;
  glyph?: string;
  icon?: ReactNode;
  title: string;
  tone?: 'signal' | 'accent' | 'cobalt' | 'warning' | 'neutral';
}) {
  return (
    <View style={styles.retroHeader}>
      <View style={styles.retroHeaderLead}>
        {icon ?? (glyph ? <RetroGlyph glyph={glyph} tone={tone} /> : null)}
        <View>
          <Text style={styles.retroHeaderEyebrow}>{eyebrow}</Text>
          <Text style={styles.retroHeaderTitle}>{title}</Text>
        </View>
      </View>
      {action}
    </View>
  );
}

export function PixelRule({ label }: { label?: string }) {
  return (
    <View style={styles.pixelRule}>
      <View style={styles.pixelRuleLine} />
      {label ? <Text style={styles.pixelRuleLabel}>{label}</Text> : null}
    </View>
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

export function Avatar({ imageUrl, label, path, size = 48 }: { imageUrl?: string | null; label: string; path?: string | null; size?: number }) {
  const source = imageUrl || avatarPublicUrl(path);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [source]);
  const palettes = [
    { backgroundColor: colors.signal, color: colors.primary },
    { backgroundColor: colors.cobaltSoft, color: colors.cobalt },
    { backgroundColor: colors.accentSoft, color: '#FF9A82' },
    { backgroundColor: colors.warningSoft, color: '#FFD27C' },
  ];
  const palette = palettes[(label.charCodeAt(0) || 0) % palettes.length] ?? palettes[0]!;
  return (
    <View style={[styles.avatarRing, { height: size, width: size, borderRadius: size / 2 }]}>
      {source && !imageFailed ? (
        <Image
          accessibilityLabel={`${label} profile picture`}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: source }}
          style={[styles.avatarImage, { borderRadius: (size - 4) / 2 }]}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: palette.backgroundColor, borderRadius: (size - 4) / 2 }]}>
          <Text style={[styles.avatarText, { color: palette.color, fontSize: size * 0.31 }]}>{label.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
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

export function EmptyState({ action, description, glyph, title }: { action?: ReactNode; description: string; glyph: string; title: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>{glyph}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Muted style={styles.emptyDescription}>{description}</Muted>
      {action}
    </View>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading content" accessibilityRole="progressbar" style={{ gap: 12, marginTop: 20 }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={{ flex: 1, gap: 12 }}>
            <View style={[styles.skeletonLine, { width: '42%' }]} />
            <View style={[styles.skeletonLine, { width: '92%' }]} />
            <View style={[styles.skeletonLine, { width: '66%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonRow: { flexDirection: 'row', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceRaised },
  screen: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  keyboardAvoider: { flex: 1 },
  screenContent: { alignSelf: 'center', flexGrow: 1, maxWidth: 640, paddingBottom: 120, paddingHorizontal: 22, paddingTop: spacing.lg, width: '100%' },
  retroGlyph: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  retroGlyphSmall: { borderRadius: 10, height: 32, width: 32 },
  retroGlyphLarge: { borderRadius: 20, height: 58, width: 58 },
  retroGlyphAccent: { backgroundColor: colors.accent },
  retroGlyphCobalt: { backgroundColor: colors.cobalt },
  retroGlyphWarning: { backgroundColor: colors.warning },
  retroGlyphNeutral: { backgroundColor: colors.surfaceRaised },
  retroGlyphText: { color: colors.primary, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  retroGlyphTextSmall: { fontSize: 14, lineHeight: 16 },
  retroGlyphTextLarge: { fontSize: 27, lineHeight: 30 },
  retroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, gap: 12 },
  retroHeaderLead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, flexShrink: 1 },
  retroHeaderEyebrow: { color: colors.textSubtle, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  retroHeaderTitle: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 39, marginTop: 3 },
  pixelRule: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  pixelRuleLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  pixelRuleLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '500' },
  eyebrow: { color: colors.textMuted, fontSize: 12.5, fontWeight: '900', letterSpacing: 1.55, lineHeight: 17, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -2.15, lineHeight: 47, marginTop: spacing.sm },
  headingCompact: { fontSize: 35, letterSpacing: -1.35, lineHeight: 39 },
  muted: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  card: { ...shadows.card, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, padding: 20 },
  pill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 13, paddingVertical: 7 },
  pillLive: { backgroundColor: colors.accentSoft, borderColor: '#603128' },
  pillAccent: { backgroundColor: colors.cobaltSoft, borderColor: '#34458F' },
  pillSuccess: { backgroundColor: colors.signalSoft, borderColor: '#3B5421' },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  pillText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  pillLiveText: { color: colors.danger },
  pillAccentText: { color: colors.cobalt },
  pillSuccessText: { color: colors.success },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 18, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 56, paddingHorizontal: spacing.xl },
  primaryButtonPressed: { backgroundColor: '#ED846A', transform: [{ scale: 0.98 }] },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  avatarRing: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, justifyContent: 'center', padding: 2 },
  avatar: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  avatarImage: { height: '100%', width: '100%' },
  avatarText: { fontWeight: '900', letterSpacing: -0.6 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 52, justifyContent: 'center', width: 52 },
  iconButtonDanger: { backgroundColor: colors.dangerSoft, borderColor: '#603128' },
  iconGlyph: { color: colors.text, fontSize: 22, fontWeight: '800' },
  iconGlyphDanger: { color: colors.danger },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  emptyState: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: 12, marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.cobaltSoft, borderRadius: 22, height: 64, justifyContent: 'center', marginBottom: spacing.xs, width: 64 },
  emptyGlyph: { color: colors.cobalt, fontSize: 28, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  emptyDescription: { fontSize: 14, lineHeight: 22, maxWidth: 300, textAlign: 'center' },
  signalBars: { alignItems: 'center', flexDirection: 'row', gap: 4, height: 34 },
  signalBar: { backgroundColor: colors.signal, borderRadius: 4, width: 5 },
  signalBarDark: { backgroundColor: colors.primary },
});
