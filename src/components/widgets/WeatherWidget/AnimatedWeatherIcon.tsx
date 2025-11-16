import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTheme } from "react-native-paper";
import { useBreathingAnimation } from "@/utils/color.utils";
import type { AppTheme } from "@/constants/theme";
import { mapConditionToIcon } from "./weatherIcons";
import LottieWeatherIcon from "./LottieWeatherIcon";

interface AnimatedWeatherIconProps {
  condition?: string;
  size?: number;
  useLottie?: boolean;
}

/**
 * Animated weather icon with breathing effect
 * Icon scales continuously (0.95 - 1.0) for subtle visual feedback
 *
 * @param condition Weather condition text
 * @param size Icon size in pixels
 * @param useLottie Use Lottie animations instead of Material Community Icons (default: true)
 */
const AnimatedWeatherIcon: React.FC<AnimatedWeatherIconProps> = ({
  condition,
  size = 100,
  useLottie = true,
}) => {
  const theme = useTheme<AppTheme>();
  const breathingAnimation = useBreathingAnimation(0.95, 1.0, 2500);

  const iconName = useMemo(() => mapConditionToIcon(condition), [condition]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathingAnimation.value }],
  }));

  // Use Lottie animation if enabled, otherwise fall back to Material Community Icons
  if (useLottie) {
    return (
      <Animated.View style={[styles.container, animatedStyle]}>
        <LottieWeatherIcon condition={condition} size={size} />
      </Animated.View>
    );
  }

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
