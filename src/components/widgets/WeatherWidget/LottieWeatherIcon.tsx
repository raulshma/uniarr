import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import { mapConditionToLottie } from "./weatherLottieMapping";

interface LottieWeatherIconProps {
  condition?: string;
  size?: number;
  autoPlay?: boolean;
  loop?: boolean;
}

/**
 * Static mapping of lottie animation filenames to require() statements
 * This allows Metro bundler to properly handle the imports
 */
const lottieAssets: Record<string, any> = {
  "thunderstorms-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-rain.json"),
  "thunderstorms-day-extreme-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-extreme-rain.json"),
  "thunderstorms-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-snow.json"),
  "thunderstorms-day-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-snow.json"),
  "thunderstorms-day-extreme-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-extreme-snow.json"),
  "thunderstorms.json": require("../../../../assets/icons/weather-lottie/thunderstorms.json"),
  "tornado.json": require("../../../../assets/icons/weather-lottie/tornado.json"),
  "thunderstorms-overcast-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-overcast-snow.json"),
  "thunderstorms-night-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-night-snow.json"),
  "umbrella.json": require("../../../../assets/icons/weather-lottie/umbrella.json"),
  "thunderstorms-overcast-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-overcast-rain.json"),
  "umbrella-wind.json": require("../../../../assets/icons/weather-lottie/umbrella-wind.json"),
  "time-afternoon.json": require("../../../../assets/icons/weather-lottie/time-afternoon.json"),
  "time-night.json": require("../../../../assets/icons/weather-lottie/time-night.json"),
  "wind-snow.json": require("../../../../assets/icons/weather-lottie/wind-snow.json"),
  "wind.json": require("../../../../assets/icons/weather-lottie/wind.json"),
  "time-late-evening.json": require("../../../../assets/icons/weather-lottie/time-late-evening.json"),
};

/**
 * Weather icon component using Lottie animations
 * Displays animated weather conditions from the weather-lottie asset pack
 */
const LottieWeatherIcon: React.FC<LottieWeatherIconProps> = ({
  condition,
  size = 100,
  autoPlay = true,
  loop = true,
}) => {
  const lottieSource = useMemo(() => {
    const animationFile = mapConditionToLottie(condition);
    return lottieAssets[animationFile] || lottieAssets["time-afternoon.json"];
  }, [condition]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <LottieView
        source={lottieSource}
        autoPlay={autoPlay}
        loop={loop}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
});

export default LottieWeatherIcon;
