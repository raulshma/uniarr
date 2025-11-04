import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTheme } from "react-native-paper";
import { useBreathingAnimation } from "@/utils/color.utils";
import type { AppTheme } from "@/constants/theme";
import { mapConditionToIcon } from "./weatherIcons";

interface AnimatedWeatherIconProps {
  condition?: string;
  size?: number;
}

/**
 * Animated weather icon with breathing effect
 * Icon scales continuously (0.95 - 1.0) for subtle visual feedback
 */
const AnimatedWeatherIcon: React.FC<AnimatedWeatherIconProps> = ({
  condition,
  size = 100,
}) => {
  const theme = useTheme<AppTheme>();
  const breathingAnimation = useBreathingAnimation(0.95, 1.0, 2500);

  const iconName = useMemo(() => mapConditionToIcon(condition), [condition]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathingAnimation.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <MaterialCommunityIcons
        name={iconName}
        size={size}
        color={theme.colors.primary}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default AnimatedWeatherIcon;
