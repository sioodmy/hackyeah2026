import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import * as Haptics from 'expo-haptics';

import { LEVEL_GRADIENT, floatingShadow, palette, radii } from '@/theme';
import {
  MAX_LEVEL,
  OVERDRAG,
  THREAT_FULL,
  THREAT_HELP,
  THREAT_HINT,
  THREAT_SAFE,
  type ThreatLevel,
} from '@/theme/levels';

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

function getLevelForProgress(progress: number): ThreatLevel {
  'worklet';
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped < 0.18) return THREAT_SAFE;
  if (clamped < 0.5) return THREAT_HINT;
  if (clamped < 0.85) return THREAT_HELP;
  return THREAT_FULL;
}

function getDetentFor(level: ThreatLevel): number {
  'worklet';
  switch (level) {
    case THREAT_HINT:
      return 0.34;
    case THREAT_HELP:
      return 0.66;
    case THREAT_FULL:
      return 1;
    default:
      return 0;
  }
}

export type ThreatSliderProps = {
  /** Fires the moment the knob is released past a threshold. */
  onCommit: (level: ThreatLevel) => void;
  /** Level currently live, used for the resting tint and the top-level pulse. */
  activeLevel: ThreatLevel;
  disabled?: boolean;
};

/**
 * The control the whole app is built around.
 *
 * Design intent: from across a room this should read as an ordinary slider on a
 * map. The knob has to be pushed past the yellow zone and *released* to do
 * anything, and colour — not a label — carries the meaning. Once an action
 * fires, the knob slides back to grey while the map quietly does the real work.
 */
export function ThreatSlider({ onCommit, activeLevel, disabled = false }: ThreatSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

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

  const onZoneCrossed = useCallback(() => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch {
      // Haptics might be unavailable on some devices/emulators
    }
  }, []);

  const commit = useCallback(
    (level: ThreatLevel) => {
      try {
        if (level === MAX_LEVEL) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
      } catch {
        // ignore haptics error
      }
      try {
        onCommit(level);
      } catch (err) {
        console.error('Slider onCommit failed:', err);
      }
    },
    [onCommit],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        // Track from the first touch: a quick flick must not read as a tap.
        .minDistance(0)
        .onBegin(() => {
          'worklet';
          pressed.value = withSpring(1, KNOB_SPRING);
          cancelAnimation(progress);
        })
        .onUpdate((event) => {
          'worklet';
          const maxTravel = travelSV.value > 0 ? travelSV.value : 1;
          const touchX =
            typeof event?.x === 'number' && Number.isFinite(event.x) ? event.x : KNOB_SIZE / 2;
          const raw = (touchX - KNOB_SIZE / 2) / maxTravel;
          const validRaw = Number.isFinite(raw) ? raw : 0;

          // Rubber-band past the far end instead of hard-stopping.
          const next =
            validRaw > 1
              ? 1 + (validRaw - 1) * (OVERDRAG / (OVERDRAG + (validRaw - 1)))
              : Math.max(0, validRaw);

          progress.value = Math.min(1 + OVERDRAG, Math.max(0, next));

          const zone = getLevelForProgress(progress.value);
          if (zone !== zoneAnim.value) {
            zoneAnim.value = withTiming(zone, { duration: 160 });
            runOnJS(onZoneCrossed)();
          }
        })
        .onFinalize(() => {
          'worklet';
          pressed.value = withSpring(0, KNOB_SPRING);

          const snapped = zoneAnim.value as ThreatLevel;
          const detent = getDetentFor(snapped);

          if (snapped === THREAT_SAFE) {
            // Never even reached yellow: just spring home, no action.
            progress.value = withSpring(detent, SNAP_SPRING);
            zoneAnim.value = withTiming(THREAT_SAFE, { duration: 200 });
            return;
          }

          // The action fires immediately — the visual reset must never be the
          // thing the user is waiting on.
          runOnJS(commit)(snapped);

          // Pop onto the zone's detent, then slide home to grey.
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
        }),
    [commit, disabled, onZoneCrossed, pressed, progress, travelSV, zoneAnim],
  );

  // The gradient is revealed by animating a clipping View's width rather than
  // mutating SVG props, ensuring 100% crash-free rendering across Android Fabric/Paper.
  const fillStyle = useAnimatedStyle(() => {
    const p = Number.isFinite(progress.value) ? Math.max(0, Math.min(1, progress.value)) : 0;
    return {
      width: p * width,
    };
  });

  const knobStyle = useAnimatedStyle(() => {
    const p = Number.isFinite(progress.value) ? Math.max(0, progress.value) : 0;
    const tr = travelSV.value || 0;
    const pr = Number.isFinite(pressed.value) ? pressed.value : 0;
    return {
      transform: [
        { translateX: p * tr },
        { scale: interpolate(pr, [0, 1], [1, 1.12]) },
      ],
    };
  });

  const knobCoreStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(zoneAnim.value, [0, 1, 2, 3], LEVEL_COLORS),
    transform: [{ scale: interpolate(zoneAnim.value, [0, 3], [1, 1.15]) }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const color = interpolateColor(zoneAnim.value, [0, 1, 2, 3], LEVEL_COLORS);
    const opacity = interpolate(zoneAnim.value, [0, 1, 2, 3], [0, 0.22, 0.32, 0.45]);
    return {
      opacity,
      ...(Platform.OS === 'ios' ? { shadowColor: color } : { backgroundColor: color }),
    };
  });

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
        <View style={styles.hitArea} onLayout={onLayout} collapsable={false}>
          <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
          <Animated.View style={[styles.pulse, pulseStyle]} pointerEvents="none" />

          {/* Neutral empty track background */}
          <Svg width={width} height={TRACK_HEIGHT} style={styles.svg} pointerEvents="none">
            <Rect
              x={0}
              y={0}
              width={width}
              height={TRACK_HEIGHT}
              rx={radii.track}
              fill="rgba(255,255,255,0.07)"
            />
            <Rect
              x={0}
              y={0}
              width={width}
              height={TRACK_HEIGHT}
              rx={radii.track}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={1}
            />
          </Svg>

          {/* Filled portion: the gradient revealed by an overflow-clipped Animated.View */}
          <Animated.View style={[styles.fillTrack, fillStyle]} pointerEvents="none">
            <View style={{ width, height: TRACK_HEIGHT }}>
              <Svg width={width} height={TRACK_HEIGHT} style={styles.svg}>
                <Defs>
                  <LinearGradient id="threat" x1="0" y1="0" x2="1" y2="0">
                    {LEVEL_GRADIENT.map(([offset, color]) => (
                      <Stop key={offset} offset={offset} stopColor={color} />
                    ))}
                  </LinearGradient>
                </Defs>
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={TRACK_HEIGHT}
                  rx={radii.track}
                  fill="url(#threat)"
                />
              </Svg>
            </View>
          </Animated.View>

          <Animated.View style={[styles.knob, knobStyle, floatingShadow(10)]} pointerEvents="none">
            <Animated.View style={[styles.knobCore, knobCoreStyle]} />
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
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  fillTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: TRACK_HEIGHT,
    borderRadius: radii.track,
    overflow: 'hidden',
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
  knob: {
    position: 'absolute',
    left: 0,
    top: KNOB_INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: 'rgba(18, 20, 24, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobCore: {
    width: KNOB_SIZE - 22,
    height: KNOB_SIZE - 22,
    borderRadius: (KNOB_SIZE - 22) / 2,
  },
});
