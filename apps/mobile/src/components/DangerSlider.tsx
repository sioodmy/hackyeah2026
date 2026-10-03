import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { MAX_THREAT_LEVEL, type ThreatLevel } from "@safecall/shared";

import { config } from "@/lib/env";
import { colors, radius, shadow, space, TRACK_STOPS, type } from "@/theme";

const TRACK_HEIGHT = 72;
const THUMB = 60;
const TRACK_INSET = (TRACK_HEIGHT - THUMB) / 2;
const TRACK_RADIUS = TRACK_HEIGHT / 2;
const OVERSCROLL_FACTOR = 0.18;

/** Releasing this far short of a detent still counts as intent to commit. */
const COMMIT_BIAS = 0.14;

const SPRING_SNAP = { damping: 20, stiffness: 260, mass: 0.7 } as const;
const SPRING_COMMIT = { damping: 13, stiffness: 430, mass: 0.55 } as const;

const GRADIENT_COLORS = TRACK_STOPS.map(([, c]) => c) as unknown as readonly [
  string,
  string,
  ...string[],
];
const GRADIENT_LOCATIONS = TRACK_STOPS.map(
  ([stop]) => stop,
) as unknown as readonly [number, number, ...number[]];

const HOLD_MS = config.holdToStandDownMs;

interface Props {
  level: ThreatLevel;
  /** The thumb was dragged past a detent and released. */
  onCommit: (level: ThreatLevel) => void;
  /** Fired live while dragging, for map tinting and hints. */
  onPreview?: (level: ThreatLevel) => void;
  /** Sustained press in the middle of the rail. */
  onStandDown: () => void;
  disabled?: boolean;
}

export function DangerSlider({
  level,
  onCommit,
  onPreview,
  onStandDown,
  disabled,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [previewLevel, setPreviewLevel] = useState<ThreatLevel>(level);
  const [armed, setArmed] = useState<ThreatLevel>(0);
  const [holding, setHolding] = useState(false);

  const pos = useSharedValue(0);
  const gestureStart = useSharedValue(0);
  const width = useSharedValue(0);
  const armedLevel = useSharedValue(0);
  const isDragging = useSharedValue(0);
  const holdActive = useSharedValue(0);
  const holdProgress = useSharedValue(0);
  const pulse = useSharedValue(1);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    width.value = trackWidth;
  }, [trackWidth, width]);

  useEffect(() => {
    setPreviewLevel(level);
  }, [level]);

  // Keep the thumb parked on the authoritative level unless the user is
  // actively dragging it.
  useEffect(() => {
    if (width.value <= 0 || isDragging.value) return;
    pos.value = withSpring(
      level * (width.value / MAX_THREAT_LEVEL),
      SPRING_SNAP,
    );
  }, [level, pos, width, isDragging]);

  useEffect(() => {
    pulse.value =
      armed > 0
        ? withRepeat(
            withSequence(
              withTiming(1.07, { duration: 380 }),
              withTiming(1, { duration: 380 }),
            ),
            -1,
            false,
          )
        : withTiming(1, { duration: 180 });
  }, [armed, pulse]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  const selectHaptic = useCallback(() => void Haptics.selectionAsync(), []);
  const tickHaptic = useCallback(
    () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    [],
  );
  const commitHaptic = useCallback(
    (next: ThreatLevel) =>
      void Haptics.notificationAsync(
        next === 3
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning,
      ),
    [],
  );
  const nudgeHaptic = useCallback(
    () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
    [],
  );

  const levelFromPos = useDerivedValue(() => {
    if (width.value <= 0) return 0;
    return Math.min(
      MAX_THREAT_LEVEL,
      Math.max(0, Math.round(pos.value / (width.value / MAX_THREAT_LEVEL))),
    );
  });

  const litFraction = useDerivedValue(() =>
    width.value <= 0
      ? 0
      : Math.min(1, Math.max(0, (pos.value + THUMB / 2) / width.value)),
  );

  const litColor = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      litFraction.value,
      GRADIENT_LOCATIONS,
      GRADIENT_COLORS,
    ),
  }));

  const holdTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      litFraction.value,
      GRADIENT_LOCATIONS,
      GRADIENT_COLORS,
    ),
  }));

  useAnimatedReaction(
    () => (isDragging.value ? levelFromPos.value : -1),
    (current, previous) => {
      if (current === previous || current < 0) return;

      if (current !== armedLevel.value) {
        armedLevel.value = current;
        if (current > 0) scheduleOnRN(tickHaptic);
        scheduleOnRN(setArmed, current as ThreatLevel);
      }
      scheduleOnRN(setPreviewLevel, current as ThreatLevel);
      if (onPreview) scheduleOnRN(onPreview, current as ThreatLevel);
    },
  );

  const beginHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHolding(true);
    holdActive.value = 1;
    holdProgress.value = withTiming(1, { duration: HOLD_MS });
    scheduleOnRN(selectHaptic);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      holdActive.value = 0;
      holdProgress.value = 0;
      setHolding(false);
      onStandDown();
    }, HOLD_MS);
  }, [holdActive, holdProgress, onStandDown, selectHaptic]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
    holdActive.value = 0;
    holdProgress.value = withTiming(0, { duration: 240 });
  }, [holdActive, holdProgress]);

  const commit = useCallback(
    (next: ThreatLevel) => {
      commitHaptic(next);
      setPreviewLevel(next);
      onCommit(next);
    },
    [commitHaptic, onCommit],
  );

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const measured = event.nativeEvent.layout.width;
      setTrackWidth(measured);
      width.value = measured;
      if (!isDragging.value) {
        pos.value = withSpring(
          level * (measured / MAX_THREAT_LEVEL),
          SPRING_SNAP,
        );
      }
    },
    [isDragging, level, pos, width],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .minDistance(3)
        .onBegin(() => {
          isDragging.value = 1;
          gestureStart.value = pos.value;
        })
        .onUpdate((event) => {
          const unitNow = width.value / MAX_THREAT_LEVEL;
          if (unitNow <= 0) return;
          const raw = gestureStart.value + event.translationX;
          const max = unitNow * MAX_THREAT_LEVEL;
          pos.value =
            raw > max
              ? max + (raw - max) * OVERSCROLL_FACTOR
              : Math.max(0, raw);
        })
        .onFinalize((event) => {
          isDragging.value = 0;
          const unitNow = width.value / MAX_THREAT_LEVEL;
          if (unitNow <= 0) return;

          const max = unitNow * MAX_THREAT_LEVEL;
          const overshoot = Math.max(0, pos.value - max);
          pos.value = Math.min(pos.value, max);
          armedLevel.value = 0;

          const reached = pos.value / unitNow;
          // A short flick counts as intent, so release position is projected
          // forward by the release velocity before rounding to a detent.
          const projected =
            (pos.value + Math.max(0, event.velocityX)) / unitNow;
          const target = Math.max(
            0,
            Math.min(MAX_THREAT_LEVEL, Math.round(projected)),
          );

          if (overshoot > 4) scheduleOnRN(nudgeHaptic);

          if (reached < COMMIT_BIAS) {
            pos.value = withSpring(0, SPRING_SNAP);
            if (level > 0) scheduleOnRN(commit, 0);
            else scheduleOnRN(selectHaptic);
            return;
          }

          if (target > level && reached >= target * (1 - COMMIT_BIAS)) {
            pos.value = withSpring(unitNow * target, SPRING_COMMIT);
            scheduleOnRN(commit, target as ThreatLevel);
            return;
          }

          // Sliding back while an alert is live steps the level down.
          const steppedDown = Math.min(level, Math.max(0, Math.round(reached)));
          if (steppedDown < level) {
            pos.value = withSpring(unitNow * steppedDown, SPRING_SNAP);
            scheduleOnRN(commit, steppedDown as ThreatLevel);
            return;
          }

          pos.value = withSpring(unitNow * level, SPRING_SNAP);
          if (overshoot > 0) scheduleOnRN(nudgeHaptic);
        }),
    [
      armedLevel,
      commit,
      disabled,
      gestureStart,
      isDragging,
      level,
      nudgeHaptic,
      pos,
      selectHaptic,
      width,
    ],
  );

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!disabled && level > 0)
        .minDuration(HOLD_MS)
        .maxDistance(12)
        .onStart(() => scheduleOnRN(beginHold))
        .onFinalize((_event, success) => {
          if (!success) scheduleOnRN(cancelHold);
        }),
    [beginHold, cancelHold, disabled, level],
  );

  const gesture = useMemo(() => Gesture.Race(pan, longPress), [longPress, pan]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value }, { scale: pulse.value }],
  }));

  const veilStyle = useAnimatedStyle(() => ({
    left: `${litFraction.value * 100}%`,
  }));

  const holdRingStyle = useAnimatedStyle(() => ({
    opacity: holdActive.value,
    transform: [{ rotate: `${holdProgress.value * 360}deg` }],
  }));

  const shown = previewLevel;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView
        intensity={46}
        tint="dark"
        style={styles.shell}
        experimentalBlurMethod="dimezisBlurView"
      >
        <View style={styles.headerRow} pointerEvents="none">
          <Text style={styles.kicker}>POZIOM ZAGROŻENIA</Text>
          <Text style={styles.hint}>
            {armed > 0 ? `puść, aby wysłać poziom ${armed}` : "przesuń i puść"}
          </Text>
        </View>

        <GestureDetector gesture={gesture}>
          <View style={styles.railOuter}>
            <View onLayout={onLayout} style={styles.rail}>
              <LinearGradient
                colors={GRADIENT_COLORS}
                locations={GRADIENT_LOCATIONS}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                style={[styles.veil, veilStyle]}
                pointerEvents="none"
              />
              <LevelTicks travel={Math.max(trackWidth - THUMB, 0)} />

              <View style={styles.centerHold} pointerEvents="none">
                {holding ? (
                  <Animated.Text style={[styles.holdLabel, holdTextStyle]}>
                    TRZYMAJ…
                  </Animated.Text>
                ) : (
                  <Text style={styles.restLabel} numberOfLines={1}>
                    {RESTING_COPY[shown]}
                  </Text>
                )}
              </View>

              <Animated.View
                style={[styles.holdRing, holdRingStyle]}
                pointerEvents="none"
              />

              <Animated.View
                style={[styles.thumb, shadow.lift, thumbStyle]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={["#FFFFFF", "#D5DAE1"]}
                  start={{ x: 0.25, y: 0 }}
                  end={{ x: 0.75, y: 1 }}
                  style={styles.thumbFace}
                >
                  <View style={styles.thumbGlyph}>
                    <Text style={styles.thumbGlyphText}>›</Text>
                  </View>
                </LinearGradient>
              </Animated.View>
            </View>

            <Animated.View
              style={[styles.underGlow, litColor]}
              pointerEvents="none"
            />
          </View>
        </GestureDetector>

        <View style={styles.legend}>
          {([0, 1, 2, 3] as const).map((lvl) => (
            <Text
              key={lvl}
              style={[
                styles.legendItem,
                shown === lvl && styles.legendItemActive,
              ]}
            >
              {lvl}
            </Text>
          ))}
        </View>

        <Text style={styles.footnote}>
          {level > 0
            ? "przytrzymaj środek szyny przez chwilę, aby wyłączyć alarm"
            : "suwak wygląda jak zwykły pasek — dopiero po puszczeniu coś się dzieje"}
        </Text>
      </BlurView>
    </View>
  );
}

const RESTING_COPY: Record<ThreatLevel, string> = {
  0: "PRZESUŃ",
  1: "ODCHODZĘ",
  2: "POTRZEBUJĘ POMOCY",
  3: "PEŁNY ALARM",
};

function LevelTicks({ travel }: { travel: number }) {
  const step = travel / MAX_THREAT_LEVEL;
  return (
    <View style={styles.ticks} pointerEvents="none">
      {[1, 2, 3].map((lvl) => (
        <View
          key={lvl}
          style={[styles.tick, { left: TRACK_INSET + step * lvl - 1 }]}
        />
      ))}
    </View>
  );
}

const FILL = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  shell: {
    borderRadius: radius.xl,
    overflow: "hidden",
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: "rgba(13,16,20,0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    ...shadow.lift,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  kicker: { ...type.micro, color: colors.textFaint },
  hint: { ...type.micro, color: colors.textFaint, opacity: 0.75 },

  railOuter: { paddingHorizontal: space.md },
  rail: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    overflow: "hidden",
    backgroundColor: "#1B2027",
  },
  veil: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(10,12,15,0.72)",
  },

  ticks: { ...FILL },
  tick: {
    position: "absolute",
    top: TRACK_HEIGHT / 2 - 7,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  centerHold: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
  },
  restLabel: {
    ...type.micro,
    fontSize: 9,
    color: "rgba(255,255,255,0.62)",
    letterSpacing: 1.8,
    marginLeft: THUMB * 0.6,
  },
  holdLabel: { ...type.micro, fontSize: 11, letterSpacing: 1.8 },

  holdRing: {
    position: "absolute",
    left: "50%",
    top: TRACK_HEIGHT / 2 - 26,
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.l3,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },

  thumb: {
    position: "absolute",
    left: TRACK_INSET,
    top: TRACK_INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  thumbFace: {
    flex: 1,
    borderRadius: THUMB / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGlyph: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(11,13,16,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGlyphText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "700",
  },

  underGlow: {
    position: "absolute",
    left: space.md,
    right: space.md,
    bottom: -1,
    height: 3,
    borderRadius: 2,
    opacity: 0.85,
  },

  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    marginTop: space.sm + 2,
  },
  legendItem: { ...type.micro, color: colors.textFaint, fontSize: 9 },
  legendItemActive: { color: colors.text },

  footnote: {
    ...type.micro,
    fontSize: 9,
    lineHeight: 13,
    color: colors.textFaint,
    textAlign: "center",
    paddingHorizontal: space.lg,
    marginTop: space.sm,
  },
});
