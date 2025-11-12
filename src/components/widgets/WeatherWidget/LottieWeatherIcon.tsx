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
  // Thunderstorm variations
  "thunderstorms-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-rain.json"),
  "thunderstorms-day-extreme-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-extreme-rain.json"),
  "thunderstorms-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-snow.json"),
  "thunderstorms-day-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-snow.json"),
  "thunderstorms-day-extreme-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-extreme-snow.json"),
  "thunderstorms.json": require("../../../../assets/icons/weather-lottie/thunderstorms.json"),
  "thunderstorms-overcast-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-overcast-snow.json"),
  "thunderstorms-night-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-night-snow.json"),
  "thunderstorms-overcast-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-overcast-rain.json"),
  "thunderstorms-day-extreme.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-extreme.json"),
  "thunderstorms-night-extreme-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-night-extreme-rain.json"),
  "thunderstorms-night-extreme-snow.json": require("../../../../assets/icons/weather-lottie/thunderstorms-night-extreme-snow.json"),
  "thunderstorms-day-rain.json": require("../../../../assets/icons/weather-lottie/thunderstorms-day-rain.json"),

  // Tornado
  "tornado.json": require("../../../../assets/icons/weather-lottie/tornado.json"),

  // Umbrella and rain
  "umbrella.json": require("../../../../assets/icons/weather-lottie/umbrella.json"),
  "umbrella-wind.json": require("../../../../assets/icons/weather-lottie/umbrella-wind.json"),
  "umbrella-wind-alt.json": require("../../../../assets/icons/weather-lottie/umbrella-wind-alt.json"),

  // Time of day
  "time-afternoon.json": require("../../../../assets/icons/weather-lottie/time-afternoon.json"),
  "time-night.json": require("../../../../assets/icons/weather-lottie/time-night.json"),
  "time-late-evening.json": require("../../../../assets/icons/weather-lottie/time-late-evening.json"),
  "time-morning.json": require("../../../../assets/icons/weather-lottie/time-morning.json"),
  "time-evening.json": require("../../../../assets/icons/weather-lottie/time-evening.json"),
  "time-late-morning.json": require("../../../../assets/icons/weather-lottie/time-late-morning.json"),
  "time-late-night.json": require("../../../../assets/icons/weather-lottie/time-late-night.json"),

  // Wind
  "wind.json": require("../../../../assets/icons/weather-lottie/wind.json"),
  "wind-snow.json": require("../../../../assets/icons/weather-lottie/wind-snow.json"),
  "wind-alert.json": require("../../../../assets/icons/weather-lottie/wind-alert.json"),
  "wind-beaufort-0.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-0.json"),
  "wind-beaufort-1.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-1.json"),
  "wind-beaufort-2.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-2.json"),
  "wind-beaufort-3.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-3.json"),
  "wind-beaufort-4.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-4.json"),
  "wind-beaufort-5.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-5.json"),
  "wind-beaufort-6.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-6.json"),
  "wind-beaufort-7.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-7.json"),
  "wind-beaufort-8.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-8.json"),
  "wind-beaufort-9.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-9.json"),
  "wind-beaufort-10.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-10.json"),
  "wind-beaufort-11.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-11.json"),
  "wind-beaufort-12.json": require("../../../../assets/icons/weather-lottie/wind-beaufort-12.json"),

  // UV Index
  "uv-index.json": require("../../../../assets/icons/weather-lottie/uv-index.json"),
  "uv-index-1.json": require("../../../../assets/icons/weather-lottie/uv-index-1.json"),
  "uv-index-2.json": require("../../../../assets/icons/weather-lottie/uv-index-2.json"),
  "uv-index-3.json": require("../../../../assets/icons/weather-lottie/uv-index-3.json"),
  "uv-index-4.json": require("../../../../assets/icons/weather-lottie/uv-index-4.json"),
  "uv-index-5.json": require("../../../../assets/icons/weather-lottie/uv-index-5.json"),
  "uv-index-6.json": require("../../../../assets/icons/weather-lottie/uv-index-6.json"),
  "uv-index-7.json": require("../../../../assets/icons/weather-lottie/uv-index-7.json"),
  "uv-index-8.json": require("../../../../assets/icons/weather-lottie/uv-index-8.json"),
  "uv-index-9.json": require("../../../../assets/icons/weather-lottie/uv-index-9.json"),
  "uv-index-10.json": require("../../../../assets/icons/weather-lottie/uv-index-10.json"),
  "uv-index-11.json": require("../../../../assets/icons/weather-lottie/uv-index-11.json"),

  // Tide
  "tide-high.json": require("../../../../assets/icons/weather-lottie/tide-high.json"),
  "tide-low.json": require("../../../../assets/icons/weather-lottie/tide-low.json"),
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
