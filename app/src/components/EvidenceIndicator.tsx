import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, type } from '@/theme';

export type EvidenceIndicatorProps = {
  active: boolean;
  uploading: boolean;
};

/**
 * The recording indicator.
 *
 * It has one job: tell the *user* their phone is capturing audio, without being
 * anything a person standing nearby would read as a threat. A six-dot that
 * breathes at low opacity, in the corner, with no word attached to it — if it
 * said "REC" it would defeat the entire premise of the app.
 */
export function EvidenceIndicator({ active, uploading }: EvidenceIndicatorProps) {
  const pulse = useSharedValue(0);
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      pulse.value = withTiming(0, { duration: 300 });
      wasActive.current = false;
      return undefined;
    }
    wasActive.current = true;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return undefined;
  }, [active, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.35 + pulse.value * 0.5 : 0,
    transform: [{ scale: active ? 0.85 + pulse.value * 0.25 : 1 }],
  }));

  if (!active) return null;

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel="Nagrywanie audio">
      <Animated.View style={[styles.dot, dotStyle]} />
      {uploading ? <Text style={styles.caption}>↥</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(20,22,26,0.7)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.text,
  },
  caption: {
    ...type.caption,
    fontSize: 11,
    color: palette.textFaint,
  },
});
