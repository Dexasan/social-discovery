import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

const yappieLogo = require('../../assets/brand/yappie-logo-transparent.png');

export function BrandMark({ size = 48 }: { size?: number }) {
  return <Image accessibilityLabel="Yappie" resizeMode="contain" source={yappieLogo} style={{ height: size, width: size }} />;
}

export function BrandLockup({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <View style={[styles.lockup, compact && styles.lockupCompact]}>
      <BrandMark size={compact ? 42 : 72} />
      <View style={styles.wordmarkCopy}>
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact, inverted && styles.inverted]}>YAPPIE</Text>
        <Text style={[styles.tagline, inverted && styles.invertedMuted]}>TALK TO STRANGERS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  lockupCompact: { gap: spacing.sm },
  wordmarkCopy: { gap: 1 },
  wordmark: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1.4 },
  wordmarkCompact: { fontSize: 21, letterSpacing: -0.8 },
  tagline: { color: colors.primaryPressed, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.7 },
  inverted: { color: colors.white },
  invertedMuted: { color: '#FFD8F6' },
});
