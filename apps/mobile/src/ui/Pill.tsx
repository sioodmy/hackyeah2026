import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, radius, space, type } from "@/theme";

interface Props {
  children: React.ReactNode;
  accent?: string;
  filled?: boolean;
  style?: ViewStyle;
}

export function Pill({ children, accent, filled, style }: Props) {
  const tint = accent ?? colors.textDim;

  return (
    <View
      style={[
        styles.root,
        filled && { backgroundColor: tint, borderColor: tint },
        style,
      ]}
    >
      <Text style={[styles.text, filled && styles.textFilled]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceHigh,
    alignSelf: "flex-start",
  },
  text: { ...type.micro, fontSize: 9, color: colors.textDim },
  textFilled: { color: colors.void },
});
