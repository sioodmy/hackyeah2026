import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { colors, radius, shadow, space, type } from "@/theme";

interface Props {
  badge?: string | number;
  alertAccent?: string;
}

export function SettingsPill({ badge, alertAccent }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ustawienia"
      onPress={() => {
        void Haptics.selectionAsync();
        router.push("/settings");
      }}
      style={({ pressed }) => [
        styles.shell,
        { top: insets.top + space.sm },
        pressed && { opacity: 0.75 },
      ]}
    >
      <BlurView
        intensity={40}
        tint="dark"
        style={styles.blur}
        experimentalBlurMethod="dimezisBlurView"
      >
        {badge ? (
          <View
            style={[
              styles.badge,
              alertAccent ? { backgroundColor: alertAccent } : null,
            ]}
          >
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <MaterialCommunityIcons
          name="cog-outline"
          size={19}
          color={colors.text}
        />
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    right: space.lg,
    zIndex: 20,
  },
  blur: {
    height: 46,
    minWidth: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: "rgba(16,19,24,0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    ...shadow.soft,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHigh,
  },
  badgeText: { ...type.micro, fontSize: 9, color: colors.void },
});
