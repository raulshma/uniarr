import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";

export type SkeletonLoaderProps = {
  /**
   * Width of the skeleton
   * @default '100%'
   */
  width?: number | string;
  /**
   * Height of the skeleton
   * @default 20
   */
  height?: number;
  /**
   * Border radius of the skeleton
   * @default 4
   */
  borderRadius?: number;
  /**
   * Style to apply to the skeleton container
   */
  style?: ViewStyle;
  /**
   * Whether to show the shimmer animation
   * @default true
   */
  shimmer?: boolean;
  /**
   * Duration of shimmer animation in ms
   * @default 1000
   */
  shimmerDuration?: number;
  /**
   * Whether the skeleton should be circular
   * @default false
   */
  circular?: boolean;
  /**
   * Color variant for the skeleton
   * @default 'default'
   */
  variant?: "default" | "surface" | "primary";
};

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
  shimmer = true,
  shimmerDuration = 1000,
  circular = false,
  variant = "default",
}) => {
  const theme = useTheme<AppTheme>();

  // Animation value for pulse effect
  const pulseAnim = useSharedValue(1);

  // Start pulse animation
  React.useEffect(() => {
    if (!shimmer) return;

    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: shimmerDuration / 2 }),
        withTiming(1, { duration: shimmerDuration / 2 }),
      ),
      -1,
      true,
    );
  }, [shimmer, shimmerDuration, pulseAnim]);

  // Animated style for pulse
  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseAnim.value,
    };
  }, [pulseAnim]);

  // Get colors based on variant
  const getColors = () => {
    switch (variant) {
      case "surface":
        return {
          background: theme.colors.surfaceVariant,
          shimmer: theme.colors.onSurfaceVariant,
        };
      case "primary":
        return {
          background: theme.colors.primaryContainer,
          shimmer: theme.colors.onPrimaryContainer,
        };
      default:
        return {
          background: theme.colors.surfaceVariant,
          shimmer: theme.colors.onSurface,
        };
    }
  };

  const colors = getColors();

  const containerStyle: ViewStyle = {
    ...styles.container,
    width: width as ViewStyle["width"],
    height,
    backgroundColor: colors.background,
    borderRadius: circular
      ? typeof height === "number"
        ? height / 2
        : 4
      : borderRadius,
    overflow: "hidden" as const,
    ...style,
  };

  if (!shimmer) {
    return <View style={containerStyle} />;
  }

  return <Animated.View style={[containerStyle, pulseStyle]} />;
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
});

export default SkeletonLoader;
