import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import * as Haptics from 'expo-haptics';

import { LEVEL_GRADIENT, floatingShadow, palette, radii, spacing } from '@/theme';
import {
  detentFor,
  MAX_LEVEL,
  OVERDRAG,
  THREAT_SAFE,
  levelForProgress,
  type ThreatLevel,
} from '@/theme/levels';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const TRACK_HEIGHT = 64;
const KNOB_SIZE = 56;
const KNOB_INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2;

/** Spring used while the finger is driving the knob. */
const KNOB_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;
/** Firmer spring for snapping onto a detent after release. */
const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.9 } as const;
/** How long the knob takes to slide home once the action has fired. */
const RESET_DURATION_MS = 420;

const LEVEL_COLORS = [palette.level0, palette.level1, palette.level2, palette.level3];

type AnimatedRectProps = {
  width: number;
  height: number;
  rx: number;
  fill: string;
};

export type ThreatSliderProps = {
  /** Fires the moment the knob is released past a threshold. */
  onCommit: (level: ThreatLevel) => void;
  /** Level currently live, used for the resting tint and the top-level pulse. */
  activeLevel: ThreatLevel;
  /** Live zone feedback while the finger is actively sliding. */
  onDragLevelChange?: (level: ThreatLevel | null) => void;
  disabled?: boolean;
};

/**
 * Minimalist, tactile, non-transparent threat slider.
 *
 * Solid dark-mode track with precision micro-notches, understated affordance text,
 * and a tactile physical knob. Pure, clean product design with zero visual clutter.
 */
export function ThreatSlider({
  onCommit,
  activeLevel,
  onDragLevelChange,
  disabled = false,
}: ThreatSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragZone, setDragZone] = useState<ThreatLevel>(THREAT_SAFE);
  const [isDragging, setIsDragging] = useState(false);

  const width = trackWidth || 1;
  const travel = Math.max(0, width - KNOB_SIZE);

  // Shared values only: worklets cannot read React refs or component state.
  const progress = useSharedValue(0);
  const travelSV = useSharedValue(0);
  const pressed = useSharedValue(0);
  const zoneAnim = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    travelSV.value = travel;
  }, [travel, travelSV]);

  const handleZoneCrossed = useCallback(
    (zone: ThreatLevel) => {
      setDragZone(zone);
      onDragLevelChange?.(zone);
      Haptics.selectionAsync().catch(() => {});
    },
    [onDragLevelChange],
  );

  const handleDragBegin = useCallback(() => {
    setIsDragging(true);
    setDragZone(THREAT_SAFE);
    onDragLevelChange?.(THREAT_SAFE);
  }, [onDragLevelChange]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    onDragLevelChange?.(null);
  }, [onDragLevelChange]);

  const resetDragZone = useCallback(() => {
    setDragZone(THREAT_SAFE);
    onDragLevelChange?.(null);
  }, [onDragLevelChange]);

  const commit = useCallback(
    (level: ThreatLevel) => {
      if (level === MAX_LEVEL) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onCommit(level);
    },
    [onCommit],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .minDistance(0)
        .onBegin(() => {
          pressed.value = withSpring(1, KNOB_SPRING);
          cancelAnimation(progress);
          runOnJS(handleDragBegin)();
        })
        .onUpdate((event) => {
          const maxTravel = travelSV.value || 1;
          const raw = (event.x - KNOB_SIZE / 2) / maxTravel;

          // Rubber-band past the far end instead of hard-stopping.
          const next =
            raw > 1 ? 1 + (raw - 1) * (OVERDRAG / (OVERDRAG + (raw - 1))) : Math.max(0, raw);

          progress.value = Math.min(1 + OVERDRAG, next);

          const zone = levelForProgress(progress.value);
          if (zone !== zoneAnim.value) {
            zoneAnim.value = withTiming(zone, { duration: 160 });
            runOnJS(handleZoneCrossed)(zone);
          }
        })
        .onFinalize(() => {
          pressed.value = withSpring(0, KNOB_SPRING);
          runOnJS(handleDragEnd)();

          const snapped = zoneAnim.value as ThreatLevel;
          const detent = detentFor(snapped);

          if (snapped === THREAT_SAFE) {
            progress.value = withSpring(detent, SNAP_SPRING);
            zoneAnim.value = withTiming(THREAT_SAFE, { duration: 200 });
            runOnJS(resetDragZone)();
            return;
          }

          runOnJS(commit)(snapped);

          progress.value = withSequence(
            withSpring(detent, SNAP_SPRING),
            withTiming(0, { duration: RESET_DURATION_MS, easing: Easing.out(Easing.cubic) }),
          );
          zoneAnim.value = withSequence(
            withTiming(snapped, { duration: 80 }),
            withTiming(THREAT_SAFE, {
              duration: RESET_DURATION_MS,
              easing: Easing.out(Easing.cubic),
            }),
          );
          runOnJS(resetDragZone)();
        }),
    [
      commit,
      disabled,
      handleDragBegin,
      handleDragEnd,
      handleZoneCrossed,
      pressed,
      progress,
      resetDragZone,
      travelSV,
      zoneAnim,
    ],
  );

  // Gradient fill revealed smoothly up to the knob position
  const fillProps = useAnimatedProps<AnimatedRectProps>(() => ({
    width: Math.max(0, Math.min(1, progress.value) * width),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.max(0, progress.value) * travelSV.value },
      { scale: interpolate(pressed.value, [0, 1], [1, 1.08]) },
    ],
  }));

  const knobCoreStyle = useAnimatedStyle(() => {
    const effectiveZone = pressed.value > 0 ? zoneAnim.value : activeLevel;
    return {
      backgroundColor: interpolateColor(effectiveZone, [0, 1, 2, 3], LEVEL_COLORS),
      transform: [{ scale: interpolate(effectiveZone, [0, 3], [1, 1.1]) }],
    };
  });

  const promptStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14], [0.75, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(progress.value, [0, 0.14], [0, 10], Extrapolation.CLAMP) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(zoneAnim.value, [0, 1, 2, 3], [0, 0.25, 0.38, 0.5]),
    shadowColor: interpolateColor(zoneAnim.value, [0, 1, 2, 3], LEVEL_COLORS),
  }));

  // Slow breathing ring while the top level is live.
  useEffect(() => {
    if (activeLevel !== MAX_LEVEL) {
      pulse.value = withTiming(0, { duration: 250 });
      return undefined;
    }
    pulse.value = withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) });
    const id = setInterval(() => {
      pulse.value = withTiming(pulse.value > 0.5 ? 0 : 1, {
        duration: 800,
        easing: Easing.inOut(Easing.quad),
      });
    }, 800);
    return () => clearInterval(id);
  }, [activeLevel, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: activeLevel === MAX_LEVEL ? 0.15 + pulse.value * 0.45 : 0,
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const onAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      commit(Math.min(MAX_LEVEL, Math.max(0, activeLevel + step)) as ThreatLevel);
    },
    [activeLevel, commit],
  );

  const displayedZone = isDragging ? dragZone : activeLevel;
  const glyphText = useMemo(() => {
    switch (displayedZone) {
      case 1:
        return '1';
      case 2:
        return '2';
      case 3:
        return 'SOS';
      default:
        return '››';
    }
  }, [displayedZone]);

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Poziom zagrożenia"
      accessibilityHint="Przesuń w prawo i puść, aby zwiększyć poziom zagrożenia"
      accessibilityValue={{ min: 0, max: MAX_LEVEL, now: activeLevel }}
      accessibilityActions={[
        { name: 'increment', label: 'Wyższy poziom' },
        { name: 'decrement', label: 'Niższy poziom' },
      ]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.hitArea} onLayout={onLayout}>
          <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
          <Animated.View style={[styles.pulse, pulseStyle]} pointerEvents="none" />

          <Svg width={width} height={TRACK_HEIGHT} style={styles.svg} pointerEvents="none">
            <Defs>
              {/* Opaque tactile solid dark gradient for track base */}
              <LinearGradient id="trackBg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#191C23" />
                <Stop offset="1" stopColor="#111317" />
              </LinearGradient>

              {/* Threat level gradient */}
              <LinearGradient id="threat" x1="0" y1="0" x2="1" y2="0">
                {LEVEL_GRADIENT.map(([offset, color]) => (
                  <Stop key={offset} offset={offset} stopColor={color} />
                ))}
              </LinearGradient>
            </Defs>

            {/* Solid, non-transparent track background */}
            <Rect
              x={0}
              y={0}
              width={width}
              height={TRACK_HEIGHT}
              rx={radii.track}
              fill="url(#trackBg)"
            />

            {/* Crisp outer border */}
            <Rect
              x={0.75}
              y={0.75}
              width={width - 1.5}
              height={TRACK_HEIGHT - 1.5}
              rx={radii.track}
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth={1.5}
            />

            {/* Detent micro-notches indicating level detents */}
            {travel > 0 ? (
              <>
                {/* Level 1 detent notch */}
                <Rect
                  x={KNOB_SIZE / 2 + 0.34 * travel - 1}
                  y={TRACK_HEIGHT / 2 - 5}
                  width={2}
                  height={10}
                  rx={1}
                  fill="rgba(255, 255, 255, 0.18)"
                />
                {/* Level 2 detent notch */}
                <Rect
                  x={KNOB_SIZE / 2 + 0.66 * travel - 1}
                  y={TRACK_HEIGHT / 2 - 5}
                  width={2}
                  height={10}
                  rx={1}
                  fill="rgba(255, 255, 255, 0.18)"
                />
                {/* Level 3 detent notch */}
                <Rect
                  x={KNOB_SIZE / 2 + 1.0 * travel - 1.5}
                  y={TRACK_HEIGHT / 2 - 7}
                  width={3}
                  height={14}
                  rx={1.5}
                  fill="rgba(214, 40, 40, 0.4)"
                />
              </>
            ) : null}

            {/* Filled portion: the gradient revealed smoothly up to knob */}
            <AnimatedRect
              animatedProps={fillProps}
              x={0}
              y={0}
              height={TRACK_HEIGHT}
              rx={radii.track}
              fill="url(#threat)"
            />
          </Svg>

          {/* Understated affordance prompt on track when idle */}
          <Animated.View style={[styles.promptRow, promptStyle]} pointerEvents="none">
            <Text style={styles.promptText}>Przesuń w razie zagrożenia</Text>
            <Text style={styles.promptChevrons}>››</Text>
          </Animated.View>

          {/* Tactile knob handle */}
          <Animated.View style={[styles.knob, knobStyle, floatingShadow(8)]} pointerEvents="none">
            <Animated.View style={[styles.knobCore, knobCoreStyle]}>
              <Text style={[styles.knobGlyph, glyphText === 'SOS' ? styles.knobGlyphSOS : null]}>
                {glyphText}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  hitArea: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    borderRadius: radii.track,
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radii.track,
  },
  glow: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: 2,
    bottom: 2,
    borderRadius: radii.track,
    backgroundColor: 'transparent',
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  pulse: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: 0,
    bottom: 0,
    borderRadius: radii.track,
    borderWidth: 2,
    borderColor: palette.level3,
    backgroundColor: 'transparent',
  },
  promptRow: {
    position: 'absolute',
    left: KNOB_SIZE + spacing.md,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.42)',
    letterSpacing: 0.2,
  },
  promptChevrons: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.32)',
    letterSpacing: 1,
  },
  knob: {
    position: 'absolute',
    left: 0,
    top: KNOB_INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#1E222A',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobCore: {
    width: KNOB_SIZE - 18,
    height: KNOB_SIZE - 18,
    borderRadius: (KNOB_SIZE - 18) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobGlyph: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  knobGlyphSOS: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
