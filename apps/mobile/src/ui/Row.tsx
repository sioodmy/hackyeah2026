import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, radius, space, type } from "@/theme";

interface Props {
  label: string;
  value?: string;
  detail?: string;
  accent?: string;
  style?: ViewStyle;
}

export function Row({ label, value, detail, accent, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.left}>
        <View
          style={[styles.dot, { backgroundColor: accent ?? colors.textFaint }]}
        />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.right}>
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flex: 1,
    minWidth: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...type.label, color: colors.text, flexShrink: 1 },
  right: { alignItems: "flex-end", maxWidth: "55%" },
  value: { ...type.label, color: colors.textDim },
  detail: { ...type.micro, color: colors.textFaint, marginTop: 2 },
});
