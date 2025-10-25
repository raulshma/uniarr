import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";

export type SkeletonPlaceholderProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Whether to show pulse animation
   * @default true
   */
  animated?: boolean;
  /**
   * Animation duration in milliseconds
   * @default 1000
   */
  animationDuration?: number;
};

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
  testID,
  animated = true,
  animationDuration = 1000,
}) => {
  const theme = useTheme<AppTheme>();
  const baseColor = theme.colors.surfaceVariant;

  // Animation value for pulse effect
  const opacityAnim = useSharedValue(1);

  // Start pulse animation
  React.useEffect(() => {
    if (!animated) return;

    opacityAnim.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: animationDuration / 2 }),
        withTiming(1, { duration: animationDuration / 2 }),
      ),
      -1,
      true,
    );
  }, [animated, animationDuration, opacityAnim]);

  // Animated style for pulse
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animated ? opacityAnim.value : 1,
      backgroundColor: baseColor,
    };
  }, [opacityAnim, baseColor, animated]);

  const dimensionStyle = useMemo(
    () => ({ width, height, borderRadius }),
    [borderRadius, height, width],
  );

  const ContainerComponent = animated ? Animated.View : View;
  const animationProps = animated ? { entering: FadeIn.duration(200) } : {};

  return (
    <ContainerComponent
      pointerEvents="none"
      style={[
        styles.base,
        dimensionStyle,
        animated ? animatedStyle : { backgroundColor: baseColor },
        style,
      ]}
      accessibilityRole="progressbar"
      testID={testID}
      {...animationProps}
    />
  );
};

export default SkeletonPlaceholder;

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#ccc",
  },
});
