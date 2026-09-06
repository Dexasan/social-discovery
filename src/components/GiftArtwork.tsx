import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { giftPresentation } from '@/features/gifts/presentation';

export function GiftArtwork({ animated = false, slug, size = 72 }: { animated?: boolean; slug: string; size?: number }) {
  const gift = giftPresentation(slug);
  const motion = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const unit = size / 72;

  useEffect(() => {
    if (!animated) {
      motion.setValue(0);
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(motion, { duration: 850, easing: Easing.inOut(Easing.quad), toValue: 1, useNativeDriver: true }),
        Animated.timing(motion, { duration: 850, easing: Easing.inOut(Easing.quad), toValue: 0, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(pulse, { duration: 550, easing: Easing.out(Easing.back(1.6)), toValue: 1, useNativeDriver: true }),
        Animated.timing(pulse, { duration: 900, easing: Easing.inOut(Easing.quad), toValue: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animated, motion, pulse]);

  const floatY = motion.interpolate({ inputRange: [0, 1], outputRange: [2 * unit, -4 * unit] });
  const rotate = motion.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '5deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const sparkleOpacity = motion.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.2, 1, 0.2] });

  return (
    <View accessibilityLabel={`${gift.label.toLowerCase()} ${gift.emoji} gift`} style={[styles.frame, { backgroundColor: gift.background, borderColor: gift.accent, borderRadius: 18 * unit, height: size, shadowColor: gift.accent, width: size }]}>
      <View style={[styles.halo, { backgroundColor: gift.accent, borderRadius: 24 * unit, height: 48 * unit, width: 48 * unit }]} />
      <Animated.Text style={[styles.emoji, { fontSize: 35 * unit, lineHeight: 43 * unit, transform: [{ translateY: floatY }, { rotate }, { scale }] }]}>{gift.emoji}</Animated.Text>
      <Animated.Text style={[styles.sparkle, styles.sparkleOne, { color: gift.accent, fontSize: 11 * unit, opacity: sparkleOpacity }]}>{gift.sparkle}</Animated.Text>
      <Animated.Text style={[styles.sparkle, styles.sparkleTwo, { color: gift.accent, fontSize: 8 * unit, opacity: sparkleOpacity }]}>{gift.sparkle}</Animated.Text>
      {slug === 'coffee' ? <Animated.View style={[styles.steam, { opacity: sparkleOpacity, transform: [{ translateY: floatY }] }]}><Text style={[styles.steamText, { color: gift.accent, fontSize: 14 * unit }]}>≈</Text></Animated.View> : null}
      <View style={[styles.corner, { backgroundColor: gift.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', borderWidth: 2, justifyContent: 'center', overflow: 'hidden', position: 'relative', shadowOffset: { height: 4, width: 4 }, shadowOpacity: 0.32, shadowRadius: 0 },
  halo: { opacity: 0.12, position: 'absolute' },
  emoji: { textAlign: 'center' },
  sparkle: { fontWeight: '900', position: 'absolute' },
  sparkleOne: { right: '10%', top: '9%' },
  sparkleTwo: { bottom: '13%', left: '12%' },
  steam: { left: '21%', position: 'absolute', top: '3%' },
  steamText: { fontWeight: '900' },
  corner: { height: 5, left: 0, position: 'absolute', top: 0, width: 18 },
});
