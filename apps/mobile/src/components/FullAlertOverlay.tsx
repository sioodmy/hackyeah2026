import { useEffect } from "react";
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
  contactName: string;
  level: number;
  dispatched: boolean;
  callMe: boolean;
  locationLabel: string;
  dispatchedReference?: string | null;
  onAcknowledge: () => void;
  onCall: () => void;
}

/**
 * What a friend sees when somebody hits level 3: it takes over the whole screen
 * and keeps buzzing until it is acknowledged.
 */
export function FullAlertOverlay({
  visible,
  contactName,
  level,
  dispatched,
  callMe,
  locationLabel,
  dispatchedReference,
  onAcknowledge,
  onCall,
}: Props) {
  const flash = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      flash.value = 0;
      return;
    }
    flash.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    const buzz = setInterval(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 1600);

    return () => clearInterval(buzz);
  }, [flash, visible]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + flash.value * 0.55,
    transform: [{ scale: 1 + flash.value * 0.04 }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

      <View style={styles.inner}>
        <Text style={styles.kicker}>PEŁNY ALARM · POZIOM {level}</Text>

        <Text style={styles.name}>{contactName}</Text>
        <Text style={styles.blurb}>
          potrzebuje pomocy. Zadzwoń do niej teraz.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>LOKALIZACJA</Text>
          <Text style={styles.cardValue}>{locationLabel}</Text>
          {dispatched ? (
            <Text style={styles.cardNote}>
              służby powiadomione{numberedRef(dispatchedReference)}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {callMe ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zadzwoń"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onCall();
              }}
              style={({ pressed }) => [
                styles.call,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.callText}>ZADZWOŃ</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Potwierdź odbiór alarmu"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAcknowledge();
            }}
            style={({ pressed }) => [styles.ack, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.ackText}>Widzę alarm</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function numberedRef(reference?: string | null): string {
  return reference ? ` · nr ${reference}` : "";
}

const FILL = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

const styles = StyleSheet.create({
  root: {
    ...FILL,
    backgroundColor: "#170307",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    zIndex: 60,
  },
  glow: {
    position: "absolute",
    top: "12%",
    left: "8%",
    right: "8%",
    bottom: "12%",
    borderRadius: 40,
    backgroundColor: colors.l3,
  },
  inner: { width: "100%", alignItems: "center" },
  kicker: { ...type.micro, color: "#FFB3BE" },
  name: {
    fontSize: 38,
    fontWeight: "700",
    color: colors.text,
    marginTop: space.md,
    textAlign: "center",
  },
  blurb: {
    ...type.body,
    color: "#FFD9DE",
    textAlign: "center",
    marginTop: space.sm,
  },
  card: {
    alignSelf: "stretch",
    marginTop: space.xxl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(11,13,16,0.6)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  cardLabel: { ...type.micro, color: colors.textFaint },
  cardValue: {
    ...type.body,
    fontSize: 17,
    color: colors.text,
    marginTop: space.xs,
  },
  cardNote: {
    ...type.micro,
    fontSize: 9,
    color: "#FFB3BE",
    marginTop: space.sm,
  },
  actions: { alignSelf: "stretch", marginTop: space.xl, gap: space.md },
  call: {
    height: 66,
    borderRadius: radius.pill,
    backgroundColor: colors.l3,
    alignItems: "center",
    justifyContent: "center",
  },
  callText: {
    ...type.label,
    fontSize: 19,
    color: colors.text,
    letterSpacing: 1.2,
  },
  ack: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  ackText: { ...type.label, color: colors.textDim },
});
