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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { colorForLevel, floatingShadow, palette, sliderTokens, spacing, type } from '@/theme';
import {
  detentFor,
  label,
  MAX_LEVEL,
  OVERDRAG,
  STOP_LEVELS,
  THREAT_SAFE,
  levelForProgress,
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

/**
 * Przyciąga wartość do najbliższego detentu.
 *
 * Worklet (stąd `'worklet'`), bo liczy się na UI thread w trakcie gestu —
 * dlatego punkty detentów są w środku a nie w importowanym `DETENTS`: worklet
 * nie domyka z importów. Wartości muszą trzymać się `DETENTS` w
 * `theme/levels.ts`; web ma identyczną funkcję obok.
 */
function magnetize(progress: number): number {
  'worklet';
  const detents = [0, 0.34, 0.66, 1];
  let nearest = 0;
  let bestDistance = 2;
  for (let i = 0; i < 4; i++) {
    const distance = Math.abs(progress - detents[i]!);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = detents[i]!;
    }
  }
  if (bestDistance >= MAGNET_RANGE) return progress;

  // Kwadratowy ramp: magnes włącza się ostro przy detencie, a nie na całym
  // zakresie, więc nie ma efektu „przyklejonej gąbki".
  const falloff = 1 - bestDistance / MAGNET_RANGE;
  const pull = falloff * falloff * MAGNET_STRENGTH;
  return nearest + (progress - nearest) * (1 - pull);
}

/** Spring used while the finger is driving the knob. */
const KNOB_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;
/** Firmer spring for snapping onto a stop after release. */
const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.9 } as const;
/** Ile trwa dojazd gałki do końca i wypełnienie baru — obie animacje naraz. */
const COMMIT_DURATION_MS = sliderTokens.commitMs;
/** Ile wypełniony bar czeka, zanim wróci do pustego. */
const HOLD_DURATION_MS = sliderTokens.holdMs;
/** Powrót do pustego slidera po commicie — celowo wolny, bez wrażenia skoku. */
const RESET_DURATION_MS = sliderTokens.resetMs;
/** Cross-fade between two level colours. */
const ZONE_BLEND_MS = 140;
/** Half-period of the breathing ring while the top level is live. */
const LIVE_PULSE_MS = 900;

const LEVEL_COLORS = [palette.level0, palette.level1, palette.level2, palette.level3];

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

/**
 * The threat slider: one track, one knob, four labelled stops.
 *
 * Nothing happens while the thumb is down. The knob follows the finger, the
 * stop it is over lights up, and letting go commits that level — so brushing
 * across the screen can never start a call or page anyone.
 *
 * Po commicie gałka dojeżdża do końca i znika, a bar wypełnia się w całości
 * kolorem poziomu; w środku pojawia się wtedy `caption`.
 */
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

  /** Wpada w JS-owym stanie na czas dojazdu, żeby pokazać label w środku. */
  const showFilled = useCallback(
    (level: ThreatLevel) => {
      setFilledLevel(level);
      // Bar wraca do pustego, ale label zostaje do samego końca — kolorowy
      // pasek nigdy nie jest bez wyjaśnienia.
      setTimeout(() => {
        progress.value = withTiming(0, {
          duration: RESET_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        });
        zone.value = THREAT_SAFE;
        zoneMix.value = withTiming(THREAT_SAFE, {
          duration: ZONE_BLEND_MS,
        });
      }, COMMIT_DURATION_MS + HOLD_DURATION_MS);
      setTimeout(
        () => {
          setFilledLevel(null);
        },
        COMMIT_DURATION_MS + HOLD_DURATION_MS + RESET_DURATION_MS,
      );
    },
    [progress, zone, zoneMix],
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
          const rubber =
            raw > 1 ? 1 + (raw - 1) * (OVERDRAG / (OVERDRAG + (raw - 1))) : Math.max(0, raw);

          // Magnes: wciąga knobę w najbliższy detent, więc animacja jest
          // etapowa zamiast płynnej, a przy puszczeniu jesteśmy już blisko
          // stopa. Ta sama funkcja co `magnetize` w web/src/components.
          const next = magnetize(rubber);

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
          runOnJS(showFilled)(level);

          // Gałka dojeżdża do końca i znika, a bar wypełnia się w całości
          // kolorem poziomu (label w środku wstawia ekran).
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

  const fillStyle = useAnimatedStyle(() => ({
    // Dojazd do 1.0 = bar wypełniony w całości (travel + KNOB_SIZE), bo przy
    // commicie gałka dojeżdża do prawego końca i znika.
    width: Math.max(0, Math.min(1, progress.value)) * (travelSV.value + KNOB_SIZE),
    backgroundColor: interpolateColor(zoneMix.value, [0, 1, 2, 3], LEVEL_COLORS),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      // Gałka nigdy nie wystaje poza track: gumowy overdrag dotyczy fill,
      // nie gałki.
      { translateX: Math.max(0, Math.min(1, progress.value)) * travelSV.value },
      { scale: interpolate(pressed.value, [0, 1], [1, 1.06]) },
    ],
    // Podczas dojazdu na kommit gałka znika, zostaje sam kolorowy bar.
    opacity: interpolate(progress.value, [0.98, 1], [1, 0]),
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
      accessibilityValue={{
        min: THREAT_SAFE,
        max: MAX_LEVEL,
        now: activeLevel,
        // Etykiety zniknęły z ekranu, ale nie z dostępności — czytnik nadal
        // wymienia poziomy po polsku.
        text: label(activeLevel) || 'Bezpiecznie',
      }}
      accessibilityActions={[
        { name: 'increment', label: 'Wyższy poziom' },
        { name: 'decrement', label: 'Niższy poziom' },
      ]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <GestureDetector gesture={panGesture}>
        <View>
          <View style={styles.hitArea} onLayout={onLayout}>
            {/* Płytki bar: fill + stopy w środku. */}
            <View style={styles.bar} pointerEvents="none">
              <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none">
                {/* Ten sam rozświetlony wierzch, co ma gałka — dlatego pasek
                    wygląda, jakby był z tego samego tworzywa. Web składa to
                    w jedno `linear-gradient` z kolorem poziomu. */}
                <LinearGradient
                  colors={[
                    sliderTokens.fillSheenTop,
                    sliderTokens.fillSheenMid,
                    sliderTokens.fillSheenBottom,
                  ]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Stopy w środku bara, pod gałką. Zero tekstu — sama skala z ticków
                  o rosnącej wysokości. Etykiety wyglądały jak UI i psuły
                  iluzję, że to tylko mapa. */}
              {travel > 0 && filledLevel === null ? (
                <View style={styles.stopsOverlay} pointerEvents="none">
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
                            { height: TICK_HEIGHT[level], opacity: highlighted ? 0.5 : 0.22 },
                          ]}
                        />
                        <Text
                          style={[styles.stopLabel, highlighted && { color: tint, opacity: 0.9 }]}
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
                    style={[
                      styles.captionText,
                      { color: filledLevel === 1 ? '#1A1405' : '#FFFFFF' },
                    ]}
                    numberOfLines={1}
                  >
                    {caption}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Gruba gałka okalająca bar — nigdy poza obrys tracka.

                Materiał jest identyczny z webowym podglądem: półprzezroczysta
                biel z rozświetleniem u góry + rozmycie tego, co jest pod spodem
                (tu `expo-blur`, w webie `backdrop-filter`). Gradient bierze
                kolory z `sliderTokens`, więc nie rozjadą się. */}
            <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
              <BlurView
                intensity={sliderTokens.knobBlur * 10}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={sliderTokens.knobGradient}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
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
    backgroundColor: '#191C23',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BAR_HEIGHT / 2,
  },
  knob: {
    position: 'absolute',
    left: 0,
    top: KNOB_TOP,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    // Półprzezroczysta biel — odpowiednik gradientu `#ffffff80 → #d7dae080`
    // i `backdrop-filter` z webowego podglądu. React Native nie ma gradientu
    // ani blura tła bez expo-linear-gradient / expo-blur, więc zostaje sam
    // kolor; geometria (promień = połowa wysokości) jest identyczna.
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: palette.text,
  },
  stopLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 12,
    color: 'rgba(255, 255, 255, 0.34)',
  },
});
