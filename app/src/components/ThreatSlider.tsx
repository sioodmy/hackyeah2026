import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

import { colorForLevel, floatingShadow, palette, radii, spacing } from '@/theme';
import {
  detentFor,
  MAX_LEVEL,
  OVERDRAG,
  STOP_LEVELS,
  THREAT_SAFE,
  levelForProgress,
  type ThreatLevel,
} from '@/theme/levels';

const TRACK_HEIGHT = 56;
const KNOB_SIZE = 44;
const KNOB_INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2;

const TICK_WIDTH = 2;
const TICK_HEIGHT = 6;
/** Wide enough for the widest stop label, so labels can centre on their stop. */
const STOP_WIDTH = 44;

/** Spring used while the finger is driving the knob. */
const KNOB_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;
/** Firmer spring for snapping onto a stop after release. */
const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.9 } as const;
/** How long the knob takes to slide home once the action has fired. */
const RESET_DURATION_MS = 420;
/** Cross-fade between two level colours. */
const ZONE_BLEND_MS = 140;
/** Half-period of the breathing ring while the top level is live. */
const LIVE_PULSE_MS = 900;

const LEVEL_COLORS = [palette.level0, palette.level1, palette.level2, palette.level3];

/** What each stop is called, left to right. */
const STOP_LABELS = ['—', '1', '2', 'SOS'];

export type ThreatSliderProps = {
  /** Fires the moment the knob is released on a stop. */
  onCommit: (level: ThreatLevel) => void;
  /** Level currently live, used for the resting highlight. */
  activeLevel: ThreatLevel;
  /** Live zone feedback while the finger is actively sliding. */
  onDragLevelChange?: (level: ThreatLevel | null) => void;
  disabled?: boolean;
};

/**
 * The threat slider: one track, one knob, four labelled stops.
 *
 * Nothing happens while the thumb is down. The knob follows the finger, the
 * stop it is over lights up, and letting go commits that level — so brushing
 * across the screen can never start a call or page anyone.
 */
export function ThreatSlider({
  onCommit,
  activeLevel,
  onDragLevelChange,
  disabled = false,
}: ThreatSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  /** The level under the finger, or null while nothing is being dragged. */
  const [preview, setPreview] = useState<ThreatLevel | null>(null);

  const travel = Math.max(0, trackWidth - KNOB_SIZE);

  // Shared values only: worklets cannot read React state.
  const progress = useSharedValue(0);
  const travelSV = useSharedValue(0);
  const pressed = useSharedValue(0);
  /** Whole levels only, and never animated — this is what gets committed. */
  const zone = useSharedValue<number>(THREAT_SAFE);
  /** The same value, animated, so the fill colour cross-fades between stops. */
  const zoneMix = useSharedValue<number>(THREAT_SAFE);
  const live = useSharedValue(0);

  useEffect(() => {
    travelSV.value = travel;
  }, [travel, travelSV]);

  const handleDragBegin = useCallback(() => {
    setPreview(THREAT_SAFE);
    onDragLevelChange?.(THREAT_SAFE);
  }, [onDragLevelChange]);

  const handleZoneCrossed = useCallback(
    (level: ThreatLevel) => {
      setPreview(level);
      onDragLevelChange?.(level);
      Haptics.selectionAsync().catch(() => {});
    },
    [onDragLevelChange],
  );

  const handleDragEnd = useCallback(() => {
    setPreview(null);
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
        .maxPointers(1)
        .minDistance(0)
        .onBegin(() => {
          pressed.value = withSpring(1, KNOB_SPRING);
          // Start from a known zone, so the first update always reports where
          // the finger actually is, even if it lands on last gesture's stop.
          zone.value = THREAT_SAFE;
          zoneMix.value = THREAT_SAFE;
          cancelAnimation(progress);
          cancelAnimation(zoneMix);
          runOnJS(handleDragBegin)();
        })
        .onUpdate((event) => {
          const maxTravel = travelSV.value;
          if (maxTravel <= 0) return;

          const raw = (event.x - KNOB_SIZE / 2) / maxTravel;

          // Rubber-band past the far end instead of hard-stopping.
          const next =
            raw > 1 ? 1 + (raw - 1) * (OVERDRAG / (OVERDRAG + (raw - 1))) : Math.max(0, raw);

          progress.value = Math.min(1 + OVERDRAG, next);

          const crossed = levelForProgress(next);
          if (crossed !== zone.value) {
            zone.value = crossed;
            zoneMix.value = withTiming(crossed, { duration: ZONE_BLEND_MS });
            runOnJS(handleZoneCrossed)(crossed);
          }
        })
        .onFinalize((_event, success) => {
          pressed.value = withSpring(0, KNOB_SPRING);
          runOnJS(handleDragEnd)();

          if (travelSV.value <= 0) return;

          // `zone` only ever holds whole levels, so the level that escapes here
          // is always one the state machine and the API understand.
          const level = Math.min(
            MAX_LEVEL,
            Math.max(THREAT_SAFE, Math.round(zone.value)),
          ) as ThreatLevel;

          // A gesture another pointer took over is not a decision: spring home
          // and commit nothing.
          if (!success || level === THREAT_SAFE) {
            zone.value = THREAT_SAFE;
            zoneMix.value = withTiming(THREAT_SAFE, { duration: ZONE_BLEND_MS });
            progress.value = withSpring(0, SNAP_SPRING);
            return;
          }

          runOnJS(commit)(level);

          progress.value = withSequence(
            withSpring(detentFor(level), SNAP_SPRING),
            withTiming(0, { duration: RESET_DURATION_MS, easing: Easing.out(Easing.cubic) }),
          );
        }),
    [
      commit,
      disabled,
      handleDragBegin,
      handleDragEnd,
      handleZoneCrossed,
      pressed,
      progress,
      travelSV,
      zone,
      zoneMix,
    ],
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, Math.min(1, progress.value) * travelSV.value),
    backgroundColor: interpolateColor(zoneMix.value, [0, 1, 2, 3], LEVEL_COLORS),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.max(0, progress.value) * travelSV.value },
      { scale: interpolate(pressed.value, [0, 1], [1, 1.06]) },
    ],
  }));

  // Slow breathing ring while the top level is live.
  useEffect(() => {
    if (activeLevel !== MAX_LEVEL) {
      live.value = withTiming(0, { duration: 200 });
      return undefined;
    }
    live.value = withRepeat(
      withTiming(1, { duration: LIVE_PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(live);
  }, [activeLevel, live]);

  const liveRingStyle = useAnimatedStyle(
    () => ({
      opacity: activeLevel === MAX_LEVEL ? 0.3 + live.value * 0.55 : 0,
      transform: [{ scale: interpolate(live.value, [0, 1], [0.92, 1.08]) }],
    }),
    [activeLevel],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const onAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      commit(Math.min(MAX_LEVEL, Math.max(THREAT_SAFE, activeLevel + step)) as ThreatLevel);
    },
    [activeLevel, commit],
  );

  const shownLevel = preview ?? activeLevel;

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Poziom zagrożenia"
      accessibilityHint="Przesuń w prawo i puść na wybranym poziomie"
      accessibilityValue={{ min: THREAT_SAFE, max: MAX_LEVEL, now: activeLevel }}
      accessibilityActions={[
        { name: 'increment', label: 'Wyższy poziom' },
        { name: 'decrement', label: 'Niższy poziom' },
      ]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <GestureDetector gesture={panGesture}>
        <View>
          <View style={styles.hitArea} onLayout={onLayout}>
            <View style={styles.track} pointerEvents="none" />
            <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />

            <Animated.View style={[styles.knob, knobStyle, floatingShadow(6)]} pointerEvents="none">
              <Animated.View style={[styles.liveRing, liveRingStyle]} />
            </Animated.View>
          </View>

          {travel > 0 ? (
            <View style={styles.stops} pointerEvents="none">
              {STOP_LEVELS.map((level) => {
                const highlighted = level === shownLevel;
                const tint = level === THREAT_SAFE ? palette.text : colorForLevel(level);
                return (
                  <View
                    key={level}
                    style={[styles.stop, { left: KNOB_SIZE / 2 + detentFor(level) * travel }]}
                  >
                    <View
                      style={[
                        styles.tick,
                        highlighted && { backgroundColor: tint, height: TICK_HEIGHT + 4 },
                      ]}
                    />
                    <Text style={[styles.stopLabel, highlighted && { color: tint }]}>
                      {STOP_LABELS[level]}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
  },
  hitArea: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.track,
    backgroundColor: '#191C23',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.track,
  },
  knob: {
    position: 'absolute',
    left: 0,
    top: KNOB_INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: palette.text,
  },
  liveRing: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: 2,
    borderColor: palette.level3,
  },
  stops: {
    height: TICK_HEIGHT + 5 + 16,
    marginTop: spacing.xs,
  },
  stop: {
    position: 'absolute',
    top: 0,
    width: STOP_WIDTH,
    marginLeft: -STOP_WIDTH / 2,
    alignItems: 'center',
  },
  tick: {
    width: TICK_WIDTH,
    height: TICK_HEIGHT,
    borderRadius: TICK_WIDTH / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
  },
  stopLabel: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: palette.textFaint,
  },
});
