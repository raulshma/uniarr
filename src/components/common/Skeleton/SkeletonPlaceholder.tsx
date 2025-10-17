import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";

export type SkeletonPlaceholderProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();
  const baseColor = theme.colors.surfaceVariant;
  const animatedStyle = useMemo(
    () => ({ backgroundColor: baseColor }),
    [baseColor],
  );

  const dimensionStyle = useMemo(
    () => ({ width, height, borderRadius }),
    [borderRadius, height, width],
  );

  return (
    <View
      pointerEvents="none"
      style={[styles.base, dimensionStyle, animatedStyle, style]}
      accessibilityRole="progressbar"
      testID={testID}
    />
  );
};

export default SkeletonPlaceholder;

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#ccc",
  },
});
