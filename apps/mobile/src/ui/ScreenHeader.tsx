import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";

import { colors, radius, space, type } from "@/theme";

interface Props {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onBack?: () => void;
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  trailing,
  onBack,
  style,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    Haptics.selectionAsync();
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }, style]}>
      <View style={styles.backHit}>
        <MaterialCommunityIcons
          name="chevron-left"
          size={22}
          color={colors.textDim}
          onPress={goBack}
        />
      </View>

      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  backHit: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHigh,
  },
  titles: { flex: 1, minWidth: 0 },
  title: { ...type.label, fontSize: 17, color: colors.text },
  subtitle: { ...type.micro, color: colors.textFaint, marginTop: 2 },
  trailing: { minWidth: 36, alignItems: "flex-end" },
});
