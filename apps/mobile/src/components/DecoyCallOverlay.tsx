import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, radius, space, type } from "@/theme";

interface Props {
  visible: boolean;
  callerName: string;
  callerNumber: string;
  /** "Mam telefon, zaraz" — shown as the decoy rationale. */
  hint: string;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * A fake incoming call, used as the excuse to walk away from an uncomfortable
 * situation. Looks like the system call sheet so nobody watching from a few
 * metres away can tell the difference.
 */
export function DecoyCallOverlay({
  visible,
  callerName,
  callerNumber,
  hint,
  onAccept,
  onDecline,
}: Props) {
  const pulse = useSharedValue(0);
  const slide = useSharedValue(40);
  const ringTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      pulse.value = 0;
      slide.value = 40;
      return;
    }

    slide.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    ringTimer.current = setInterval(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 2600);

    return () => {
      if (ringTimer.current) clearInterval(ringTimer.current);
    };
  }, [pulse, slide, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 180 }),
    transform: [{ translateY: slide.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.28 }],
    opacity: 0.5 - pulse.value * 0.34,
  }));

  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.head}>
          <Animated.View
            style={[styles.halo, haloStyle]}
            pointerEvents="none"
          />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{callerName.trim()[0] ?? "M"}</Text>
          </View>
        </View>

        <Text style={styles.name}>{callerName}</Text>
        <Text style={styles.number}>{callerNumber}</Text>
        <Text style={styles.hint}>{hint}</Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Odbierz"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAccept();
            }}
            style={({ pressed }) => [
              styles.action,
              styles.decline,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.actionText}>Odrzuć</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Odbierz połączenie"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onAccept();
            }}
            style={({ pressed }) => [
              styles.action,
              styles.accept,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.void }]}>
              Odbierz
            </Text>
          </Pressable>
        </View>
      </Animated.View>
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
  backdrop: {
    ...FILL,
    backgroundColor: "rgba(5,7,10,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  sheet: { width: "100%", alignItems: "center" },
  head: {
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xl,
  },
  halo: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.l1,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 34, fontWeight: "600", color: colors.text },
  name: { fontSize: 26, fontWeight: "600", color: colors.text },
  number: { ...type.label, color: colors.textDim, marginTop: space.xs },
  hint: {
    ...type.micro,
    fontSize: 9,
    lineHeight: 14,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: space.md,
    maxWidth: 260,
  },
  actions: {
    flexDirection: "row",
    gap: space.lg,
    marginTop: space.xxl,
    alignSelf: "stretch",
  },
  action: {
    flex: 1,
    height: 58,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  decline: { backgroundColor: colors.surfaceHigh },
  accept: { backgroundColor: colors.l1 },
  actionText: { ...type.label, fontSize: 16, color: colors.text },
});
