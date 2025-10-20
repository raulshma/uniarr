import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

import { spacing } from "@/theme/spacing";

/**
 * Simple content container for consistent padding without safe area handling
 * Perfect for nested content, modals, and cards
 */
export interface ContentContainerProps {
  children: React.ReactNode;
  /**
   * Padding level for all sides
   * @default "lg" (24px)
   */
  padding?: keyof typeof spacing;
  /**
   * Override horizontal padding only
   */
  horizontalPadding?: keyof typeof spacing;
  /**
   * Override vertical padding only
   */
  verticalPadding?: keyof typeof spacing;
  /**
   * Additional styles to apply
   */
  style?: ViewStyle;
  /**
   * Whether to use flex layout
   * @default false
   */
  flex?: boolean;
  /**
   * Border radius for card-like appearance
   */
  borderRadius?: keyof typeof spacing;
}

export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  padding = "lg",
  horizontalPadding,
  verticalPadding,
  style,
  flex = false,
  borderRadius,
}) => {
  const theme = useTheme();

  const containerStyle: ViewStyle = {
    backgroundColor: theme.colors.background,
    ...(horizontalPadding && { paddingHorizontal: spacing[horizontalPadding] }),
    ...(verticalPadding && { paddingVertical: spacing[verticalPadding] }),
    ...(!horizontalPadding &&
      !verticalPadding && { padding: spacing[padding] }),
    ...(flex && { flex: 1 }),
    ...(borderRadius && { borderRadius: spacing[borderRadius] }),
  };

  return (
    <View style={[styles.container, containerStyle, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});
