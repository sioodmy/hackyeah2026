import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { colors, radius, space, type } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  accent?: string;
  disabled?: boolean;
  tone?: "solid" | "ghost";
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  accent,
  disabled,
  tone = "solid",
  style,
}: Props) {
  const tint = accent ?? colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.root,
        tone === "solid"
          ? { backgroundColor: tint }
          : {
              backgroundColor: "transparent",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: tint,
            },
        pressed && { opacity: 0.7, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          tone === "solid" ? styles.onSolid : { color: tint },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  text: { ...type.label, fontSize: 15 },
  onSolid: { color: colors.void },
});
