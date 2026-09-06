import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** Decorative brand artwork, drawn natively so it stays crisp at every density. */
export function ConversationArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.art, compact && styles.compact]}>
      <View style={styles.orbit} />
      <View style={styles.orbitInner} />
      <Text style={styles.spark}>✦</Text>
      <View style={styles.smallStar} />
      <View style={styles.backBubble}>
        <View style={styles.eyes}><View style={styles.eye} /><View style={styles.eye} /></View>
        <View style={styles.smile} />
        <View style={styles.backTail} />
      </View>
      <View style={styles.frontBubble}>
        <Text style={styles.hello}>hey!</Text>
        <View style={styles.frontTail} />
      </View>
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'center', height: 170, width: 260 },
  compact: { height: 150, transform: [{ scale: 0.9 }] },
  orbit: { borderColor: '#41404F', borderRadius: 150, borderWidth: 1, height: 142, left: 13, position: 'absolute', top: 15, transform: [{ rotate: '-20deg' }], width: 234 },
  orbitInner: { borderColor: '#353440', borderRadius: 120, borderWidth: 1, height: 108, left: 35, position: 'absolute', top: 32, transform: [{ rotate: '-20deg' }], width: 190 },
  backBubble: { alignItems: 'center', backgroundColor: colors.cobalt, borderRadius: 31, height: 91, justifyContent: 'center', left: 39, position: 'absolute', top: 13, transform: [{ rotate: '-13deg' }], width: 112 },
  backTail: { backgroundColor: colors.cobalt, borderBottomLeftRadius: 4, bottom: -9, height: 24, left: 14, position: 'absolute', transform: [{ skewY: '-30deg' }], width: 24 },
  eyes: { flexDirection: 'row', gap: 21, marginTop: 4 },
  eye: { backgroundColor: colors.primary, borderRadius: 4, height: 12, width: 7 },
  smile: { borderBottomWidth: 3, borderColor: colors.primary, borderRadius: 14, height: 12, marginTop: 5, width: 21 },
  frontBubble: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 29, height: 83, justifyContent: 'center', position: 'absolute', right: 24, top: 71, transform: [{ rotate: '10deg' }], width: 121 },
  frontTail: { backgroundColor: colors.accent, borderBottomRightRadius: 4, bottom: -7, height: 20, position: 'absolute', right: 17, transform: [{ skewY: '25deg' }], width: 23 },
  hello: { color: colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: -2, marginTop: -4 },
  spark: { color: colors.signal, fontSize: 31, position: 'absolute', right: 30, top: 13 },
  smallStar: { backgroundColor: colors.accent, borderRadius: 2, height: 7, left: 15, position: 'absolute', top: 116, transform: [{ rotate: '45deg' }], width: 7 },
  dot: { backgroundColor: colors.cobalt, borderRadius: 3, bottom: 2, height: 5, left: 101, position: 'absolute', width: 5 },
});
