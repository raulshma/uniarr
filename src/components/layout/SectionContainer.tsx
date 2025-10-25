import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useTheme } from "react-native-paper";

import { spacing } from "@/theme/spacing";
import { COMPONENT_ANIMATIONS } from "@/utils/animations.utils";

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
  /**
   * Whether to animate entrance
   * @default false
   */
  animated?: boolean;
  /**
   * Animation delay in milliseconds
   * @default 0
   */
  animationDelay?: number;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
  children,
  variant = "standard",
  horizontalPadding,
  verticalPadding,
  style,
  marginBottom = false,
  animated = false,
  animationDelay = 0,
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

  const ContainerComponent = animated ? Animated.View : View;
  const animationProps = animated
    ? { entering: COMPONENT_ANIMATIONS.SECTION_ENTRANCE(animationDelay) }
    : {};

  return (
    <ContainerComponent
      style={[styles.container, containerStyle, style]}
      {...animationProps}
    >
      {children}
    </ContainerComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});
