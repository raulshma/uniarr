import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

import { spacing } from "@/theme/spacing";

type SpacingValue = keyof typeof spacing;

/**
 * Standardized section container with consistent padding
 * Uses spacing.lg (24px) for main sections, spacing.sm (12px) for compact sections
 */
export interface SectionContainerProps {
  children: React.ReactNode;
  /**
   * Layout variant with predefined spacing
   * @default "standard"
   */
  variant?: "standard" | "compact" | "spacious" | "list";
  /**
   * Override horizontal padding
   */
  horizontalPadding?: SpacingValue;
  /**
   * Override vertical padding
   */
  verticalPadding?: SpacingValue;
  /**
   * Additional styles to apply
   */
  style?: ViewStyle;
  /**
   * Whether to add bottom margin
   * @default false
   */
  marginBottom?: boolean;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
  children,
  variant = "standard",
  horizontalPadding,
  verticalPadding,
  style,
  marginBottom = false,
}) => {
  const theme = useTheme();

  // Define spacing presets for different variants
  const variantSpacing = {
    standard: { horizontal: spacing.lg, vertical: spacing.md },
    compact: { horizontal: spacing.sm, vertical: spacing.sm },
    spacious: { horizontal: spacing.xl, vertical: spacing.lg },
    list: { horizontal: spacing.sm, vertical: spacing.xs },
  };

  const variantSpacingValues = variantSpacing[variant];

  const containerStyle: ViewStyle = {
    paddingHorizontal: horizontalPadding
      ? spacing[horizontalPadding]
      : variantSpacingValues.horizontal,
    paddingVertical: verticalPadding
      ? spacing[verticalPadding]
      : variantSpacingValues.vertical,
    backgroundColor: theme.colors.background,
    marginBottom: marginBottom ? spacing.lg : 0,
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
