import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
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

  // Animation value for shimmer effect
  const shimmerAnim = useSharedValue(0);

  // Start shimmer animation
  React.useEffect(() => {
    if (!shimmer) return;

    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: shimmerDuration }),
      -1,
      true,
    );
  }, [shimmer, shimmerDuration, shimmerAnim]);

  // Animated style for shimmer
  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmerAnim.value, [0, 1], [-200, 200]);

    return {
      transform: [{ translateX }],
    };
  }, [shimmerAnim]);

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

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: colors.shimmer,
            opacity: 0.1,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
  },
});

export default SkeletonLoader;
