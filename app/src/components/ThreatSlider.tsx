import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import {
  colorForLevel,
  floatingShadow,
  palette,
  radii,
  sliderTokens,
  spacing,
  textOnLevel,
  type,
} from '@/theme';
import {
  detentFor,
  label,
  MAX_LEVEL,
  OVERDRAG,
  STOP_LEVELS,
  THREAT_SAFE,
  type ThreatLevel,
} from '@/theme/levels';

const KNOB_SIZE = sliderTokens.knob;
const CONTAINER_HEIGHT = sliderTokens.track;
/** Bar ma tę samą wysokość co średnica gałki, więc jego końce są tym samym
 *  kształtem co gałka — inaczej widać, że są dwiema różnymi rzeczami. */
const BAR_HEIGHT = sliderTokens.bar;
const BAR_TOP = (CONTAINER_HEIGHT - BAR_HEIGHT) / 2;
const KNOB_TOP = (CONTAINER_HEIGHT - KNOB_SIZE) / 2;

const TICK_WIDTH = sliderTokens.tickWidth;
/** Wysokość ticka per poziom — rośnie z poziomem, więc skala się czyta
 *  wzrokiem, zanim palec w ogóle dotrze do stopa. */
const TICK_HEIGHT = sliderTokens.tickHeight;
const STOP_WIDTH = sliderTokens.stopWidth;
const STOP_LABELS = ['—', '1', '2', 'SOS'];

/**
 * Promień magnesu wyrażony jako ułamek travelu: w tej odległości od detentu
 * przyciąganie jeszcze nie działa, w samym detencie jest najsilniejsze.
 */
const MAGNET_RANGE = sliderTokens.magnetRange;
/** Ile z odległości zjada magnes w swoim centrum. */
const MAGNET_STRENGTH = sliderTokens.magnetStrength;

/** Dynamiczny, sprężysty spring podczas prowadzenia gałki. */
const KNOB_SPRING = { damping: 20, stiffness: 240, mass: 0.7 } as const;
/** Sprężyste, miękkie odskoczenie na start po anulowaniu. */
const SNAP_SPRING = { damping: 24, stiffness: 320, mass: 0.8 } as const;
/** Ile trwa dojazd gałki do końca i wypełnienie baru — obie animacje naraz. */
const COMMIT_DURATION_MS = sliderTokens.commitMs;
/** Ile wypełniony bar czeka, zanim wróci do pustego. */
const HOLD_DURATION_MS = sliderTokens.holdMs;
/** Powrót do pustego slidera po commicie — celowo wolny, bez wrażenia skoku. */
const RESET_DURATION_MS = sliderTokens.resetMs;
/** Przejście koloru wypełnienia między strefami. */
const ZONE_BLEND_MS = sliderTokens.zoneBlendMs;
/** Półokres oddychającego pierścienia podczas aktywnego poziomu SOS. */
const LIVE_PULSE_MS = 900;
/** Czas odblasku (shine) po commicie. */
const SHINE_MS = sliderTokens.shineMs;
/** Opóźnienie startu odblasku względem commita. */
const SHINE_DELAY_MS = Math.round(COMMIT_DURATION_MS * 0.7);

const LEVEL_COLORS = [palette.level0, palette.level1, palette.level2, palette.level3];

function previewTextFor(level: ThreatLevel): string {
  switch (level) {
    case 0:
      return 'Puść, aby anulować';
    case 1:
      return 'Poziom 1 · Telefon zadzwoni za 10 s';
    case 2:
      return 'Poziom 2 · Znajomi dostaną lokalizację';
    case 3:
      return 'Poziom 3 · Pełny alarm SOS + nagrywanie';
  }
}

export type ThreatSliderProps = {
  /** Fires the moment the knob is released on a stop. */
  onCommit: (level: ThreatLevel) => void;
  /** Level currently live, used for the resting highlight. */
  activeLevel: ThreatLevel;
  /** Live zone feedback while the finger is actively sliding. */
  onDragLevelChange?: (level: ThreatLevel | null) => void;
  disabled?: boolean;
  /** Tekst w środku wypełnionego slidera (ekran mapy). */
  caption?: string;
};

export function ThreatSlider({
  onCommit,
  activeLevel,
  onDragLevelChange,
  disabled = false,
  caption,
}: ThreatSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  /** The level under the finger, or null while nothing is being dragged. */
  const [preview, setPreview] = useState<ThreatLevel | null>(null);
  /** Poziom wypełniający bar po commicie; null = brak wypełnienia. */
  const [filledLevel, setFilledLevel] = useState<ThreatLevel | null>(null);

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
  const shineProgress = useSharedValue(-1);
  const chevronGlance = useSharedValue(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isDraggingRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    travelSV.value = travel;
  }, [travel, travelSV]);

  // Subtelna zaczepka strzałek » w spoczynku — co ~3 s delikatnie drgną w prawo
  useEffect(() => {
    chevronGlance.value = withRepeat(
      withSequence(
        withDelay(
          2800,
          withSequence(
            withTiming(3, { duration: 180, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 240, easing: Easing.inOut(Easing.quad) }),
          ),
        ),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(chevronGlance);
  }, [chevronGlance]);

  // Reset z zewnątrz (np. rozwiązanie alertu w API)
  useEffect(() => {
    if (activeLevel === THREAT_SAFE && !isDraggingRef.current) {
      clearTimers();
      setFilledLevel(null);
      progress.value = withSpring(0, SNAP_SPRING);
      zone.value = THREAT_SAFE;
      zoneMix.value = withTiming(THREAT_SAFE, { duration: ZONE_BLEND_MS });
    }
  }, [activeLevel, clearTimers, progress, zone, zoneMix]);

  const handleDragBegin = useCallback(() => {
    clearTimers();
    isDraggingRef.current = true;
    setFilledLevel(null);
    setPreview(THREAT_SAFE);
    onDragLevelChange?.(THREAT_SAFE);
  }, [clearTimers, onDragLevelChange]);

  const handleZoneCrossed = useCallback(
    (level: ThreatLevel) => {
      setPreview(level);
      onDragLevelChange?.(level);
      Haptics.selectionAsync().catch(() => {});
    },
    [onDragLevelChange],
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
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

  /** Wpada w JS-owym stanie na czas dojazdu, żeby pokazać label w środku. */
  const showFilled = useCallback(
    (level: ThreatLevel) => {
      clearTimers();
      setFilledLevel(level);

      // Odblask po commicie
      shineProgress.value = -1;
      const tShine = setTimeout(() => {
        shineProgress.value = withTiming(1, {
          duration: SHINE_MS,
          easing: Easing.inOut(Easing.quad),
        });
      }, SHINE_DELAY_MS);
      timersRef.current.push(tShine);

      const t1 = setTimeout(() => {
        progress.value = withTiming(0, {
          duration: RESET_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        });
        zone.value = THREAT_SAFE;
        zoneMix.value = withTiming(THREAT_SAFE, {
          duration: ZONE_BLEND_MS,
        });
      }, COMMIT_DURATION_MS + HOLD_DURATION_MS);
      timersRef.current.push(t1);

      const t2 = setTimeout(
        () => {
          setFilledLevel(null);
        },
        COMMIT_DURATION_MS + HOLD_DURATION_MS + RESET_DURATION_MS,
      );
      timersRef.current.push(t2);
    },
    [clearTimers, progress, shineProgress, zone, zoneMix],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .maxPointers(1)
        .minDistance(0)
        .onBegin(() => {
          'worklet';
          pressed.value = withSpring(1, KNOB_SPRING);
          zone.value = THREAT_SAFE;
          zoneMix.value = THREAT_SAFE;
          cancelAnimation(progress);
          cancelAnimation(zoneMix);
          runOnJS(handleDragBegin)();
        })
        .onUpdate((event) => {
          'worklet';
          const maxTravel = travelSV.value;
          if (maxTravel <= 0) return;

          const raw = (event.x - KNOB_SIZE / 2) / maxTravel;

          // Rubber-band past the far end instead of hard-stopping.
          const rubber =
            raw > 1 ? 1 + (raw - 1) * (OVERDRAG / (OVERDRAG + (raw - 1))) : Math.max(0, raw);

          // Inline magnetize calculation inside worklet
          const detents = [0, 0.34, 0.66, 1];
          let nearest = 0;
          let bestDistance = 2;
          for (let i = 0; i < 4; i++) {
            const d = detents[i] ?? 0;
            const distance = Math.abs(rubber - d);
            if (distance < bestDistance) {
              bestDistance = distance;
              nearest = d;
            }
          }
          let next = rubber;
          if (bestDistance < MAGNET_RANGE) {
            const falloff = 1 - bestDistance / MAGNET_RANGE;
            const pull = falloff * falloff * MAGNET_STRENGTH;
            next = nearest + (rubber - nearest) * (1 - pull);
          }

          progress.value = Math.min(1 + OVERDRAG, next);

          // Inline level calculation inside worklet
          const clamped = Math.min(1, Math.max(0, next));
          let crossed = 0;
          if (clamped < 0.18) {
            crossed = 0;
          } else if (clamped < 0.5) {
            crossed = 1;
          } else if (clamped < 0.85) {
            crossed = 2;
          } else {
            crossed = 3;
          }

          if (crossed !== zone.value) {
            zone.value = crossed;
            zoneMix.value = withTiming(crossed, { duration: ZONE_BLEND_MS });
            runOnJS(handleZoneCrossed)(crossed as ThreatLevel);
          }
        })
        .onFinalize((_event, success) => {
          'worklet';
          pressed.value = withSpring(0, KNOB_SPRING);
          runOnJS(handleDragEnd)();

          if (travelSV.value <= 0) return;

          const rawLevel = Math.round(zone.value);
          const level = (rawLevel < 0 ? 0 : rawLevel > 3 ? 3 : rawLevel) as ThreatLevel;

          if (!success || level === THREAT_SAFE) {
            zone.value = THREAT_SAFE;
            zoneMix.value = withTiming(THREAT_SAFE, { duration: ZONE_BLEND_MS });
            progress.value = withSpring(0, SNAP_SPRING);
            return;
          }

          runOnJS(commit)(level);
          runOnJS(showFilled)(level);

          zone.value = level;
          zoneMix.value = withTiming(level, { duration: ZONE_BLEND_MS });
          progress.value = withTiming(1, {
            duration: COMMIT_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          });
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
      showFilled,
    ],
  );

  const fillStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, progress.value));
    const fillWidth = p <= 0 ? 0 : p * travelSV.value + KNOB_SIZE;
    return {
      width: fillWidth,
      backgroundColor: interpolateColor(zoneMix.value, [0, 1, 2, 3], LEVEL_COLORS),
    };
  });

  const shineStyle = useAnimatedStyle(() => {
    const s = shineProgress.value;
    const maxT = travelSV.value + KNOB_SIZE;
    return {
      transform: [{ translateX: interpolate(s, [-1, 1], [-120, maxT + 120]) }],
      opacity: interpolate(s, [-1, -0.6, 0.6, 1], [0, 1, 1, 0]),
    };
  });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.max(0, Math.min(1, progress.value)) * travelSV.value },
      { scale: interpolate(pressed.value, [0, 1], [1, sliderTokens.knobPressedScale]) },
    ],
    opacity: interpolate(progress.value, [0.94, 1], [1, 0]),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: chevronGlance.value }],
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(pressed.value, [0, 1], [6, 0]) }],
  }));

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
  const currentZoneLevel = preview ?? activeLevel;
  const currentContrastText = textOnLevel(shownLevel);

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Poziom zagrożenia"
      accessibilityHint="Przesuń w prawo i puść na wybranym poziomie"
      accessibilityValue={{
        min: THREAT_SAFE,
        max: MAX_LEVEL,
        now: activeLevel,
        text: label(activeLevel) || 'Bezpiecznie',
      }}
      accessibilityActions={[
        { name: 'increment', label: 'Wyższy poziom' },
        { name: 'decrement', label: 'Niższy poziom' },
      ]}
      onAccessibilityAction={onAccessibilityAction}
    >
      {/* Dymek nad sliderem — widoczny podczas przeciągania */}
      <Animated.View style={[styles.bubble, bubbleStyle]} pointerEvents="none">
        <View
          style={[
            styles.bubbleDot,
            {
              backgroundColor:
                currentZoneLevel === THREAT_SAFE
                  ? palette.textMuted
                  : colorForLevel(currentZoneLevel),
            },
          ]}
        />
        <Text style={styles.bubbleText} numberOfLines={1}>
          {previewTextFor(currentZoneLevel)}
        </Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <View>
          <View style={styles.hitArea} onLayout={onLayout}>
            {/* Płytki bar: fill + stopy w środku. */}
            <View style={styles.bar} pointerEvents="none">
              <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none">
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
                  ]}
                />
              </Animated.View>

              {/* Błysk / odblask przejeżdżający raz po commicie */}
              {filledLevel !== null && (
                <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none">
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                    ]}
                  />
                </Animated.View>
              )}

              {/* Stopy w środku bara, pod gałką. */}
              {travel > 0 && filledLevel === null ? (
                <View style={styles.stopsOverlay} pointerEvents="none">
                  {STOP_LEVELS.map((level) => {
                    const highlighted = level === shownLevel;
                    const d = detentFor(level);
                    const covered = preview !== null && preview >= level && level > 0;
                    const stopColor = covered
                      ? currentContrastText
                      : highlighted
                        ? level === THREAT_SAFE
                          ? palette.text
                          : colorForLevel(level)
                        : sliderTokens.stopLabelIdle;

                    return (
                      <View key={level} style={[styles.stop, { left: KNOB_SIZE / 2 + d * travel }]}>
                        <View
                          style={[
                            styles.tick,
                            {
                              height: TICK_HEIGHT[level],
                              backgroundColor: covered ? currentContrastText : palette.text,
                              opacity: covered ? 0.6 : highlighted ? 0.65 : 0.22,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.stopLabel,
                            {
                              color: stopColor,
                              opacity: covered ? 0.85 : highlighted ? 1 : 0.55,
                            },
                          ]}
                        >
                          {STOP_LABELS[level]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Label w środku wypełnionego bara. */}
              {filledLevel !== null && caption ? (
                <View style={styles.captionBox} pointerEvents="none">
                  <Text
                    style={[styles.captionText, { color: textOnLevel(filledLevel) }]}
                    numberOfLines={1}
                  >
                    {caption}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Szklana gałka okalająca bar */}
            <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    borderRadius: KNOB_SIZE / 2,
                  },
                ]}
              />

              {/* Dwie strzałki iOS 6 » subtelnie drgające */}
              <Animated.View style={chevronStyle}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 5L12 12L6 19"
                    stroke={sliderTokens.knobGrip}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M12 5L18 12L12 19"
                    stroke={sliderTokens.knobGrip}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Animated.View>

              {/* Pierścień pulsujący na poziomie SOS */}
              <Animated.View style={[styles.liveRing, liveRingStyle]} />
            </Animated.View>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: -(36 + spacing.xs),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(26, 29, 35, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...floatingShadow(6),
    zIndex: 10,
  },
  bubbleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bubbleText: {
    ...type.caption,
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.text,
  },
  hitArea: {
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BAR_TOP,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: sliderTokens.barFill,
    borderWidth: 1,
    borderColor: sliderTokens.barBorder,
    overflow: 'hidden',
    ...floatingShadow(6),
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BAR_HEIGHT / 2,
  },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
  knob: {
    position: 'absolute',
    left: 0,
    top: KNOB_TOP,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: 'rgba(38, 42, 50, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...floatingShadow(8),
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
  stopsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  captionBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  captionText: {
    ...type.caption,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  stop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: STOP_WIDTH,
    marginLeft: -STOP_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: TICK_WIDTH,
    borderRadius: TICK_WIDTH / 2,
    marginBottom: 4,
  },
  stopLabel: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '600',
  },
});
