import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "react-native-paper";

import { spacing } from "@/theme/spacing";

/**
 * Standardized screen container with consistent horizontal padding
 * Uses spacing.lg (24px) for main content areas by default
 */
export interface ScreenContainerProps {
  children: React.ReactNode;
  /**
   * Override default horizontal padding
   * @default "lg" (24px)
   */
  horizontalPadding?: keyof typeof spacing;
  /**
   * Override default vertical padding
   * @default "none"
   */
  verticalPadding?: keyof typeof spacing;
  /**
   * Whether to respect safe area insets
   * @default true
   */
  useSafeArea?: boolean;
  /**
   * Additional styles to apply
   */
  style?: ViewStyle;
  /**
   * Whether to apply bottom padding for scrollable content
   * @default false
   */
  bottomPadding?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  horizontalPadding = "lg",
  verticalPadding = "none",
  useSafeArea = true,
  style,
  bottomPadding = false,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing[horizontalPadding],
    paddingTop:
      verticalPadding !== "none"
        ? spacing[verticalPadding]
        : useSafeArea
          ? insets.top
          : 0,
    paddingBottom: bottomPadding
      ? spacing[verticalPadding !== "none" ? verticalPadding : "lg"]
      : useSafeArea
        ? insets.bottom
        : 0,
  };

  return (
    <View style={[styles.container, containerStyle, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
