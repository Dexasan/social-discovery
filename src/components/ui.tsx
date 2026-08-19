import { PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme/tokens';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );

  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Heading({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  return <Text style={[styles.heading, compact && styles.headingCompact]}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = 'default' }: { label: string; tone?: 'default' | 'live' | 'accent' }) {
  return (
    <View style={[styles.pill, tone === 'live' && styles.pillLive, tone === 'accent' && styles.pillAccent]}>
      <Text style={[styles.pillText, tone === 'live' && styles.pillLiveText]}>{label}</Text>
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
  return (
    <View style={[styles.avatar, { height: size, width: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.2, lineHeight: 39, marginTop: spacing.sm },
  headingCompact: { fontSize: 26, lineHeight: 31 },
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  pill: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  pillLive: { backgroundColor: '#35151B' },
  pillAccent: { backgroundColor: '#27213D' },
  pillText: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  pillLiveText: { color: colors.danger },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 56, paddingHorizontal: spacing.xl },
  primaryButtonPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.99 }] },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.primaryInk, fontSize: 16, fontWeight: '800' },
  avatar: { alignItems: 'center', backgroundColor: colors.accent, justifyContent: 'center' },
  avatarText: { color: '#171028', fontWeight: '900' },
});

