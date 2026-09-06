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
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact, inverted && styles.inverted]}>yappie<Text style={styles.wordmarkDot}>.</Text></Text>
        {!compact ? <Text style={[styles.tagline, inverted && styles.invertedMuted]}>A little hello. A whole new world.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  lockupCompact: { gap: spacing.sm },
  wordmarkCopy: { gap: 1 },
  wordmark: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: -2 },
  wordmarkCompact: { fontSize: 30, letterSpacing: -1.5 },
  wordmarkDot: { color: colors.accent },
  tagline: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  inverted: { color: colors.white },
  invertedMuted: { color: '#D7D3C9' },
});
