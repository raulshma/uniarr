import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type WeatherIconName = ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

const DEFAULT_ICON: WeatherIconName = "weather-partly-cloudy";

export const mapConditionToIcon = (conditionText?: string): WeatherIconName => {
  if (!conditionText) return DEFAULT_ICON;

  const text = conditionText.toLowerCase();

  if (text.includes("thunder") || text.includes("storm")) {
    return "weather-lightning";
  }
  if (text.includes("snow") || text.includes("sleet")) {
    return "weather-snowy";
  }
  if (text.includes("rain") || text.includes("drizzle")) {
    return "weather-rainy";
  }
  if (text.includes("fog") || text.includes("mist") || text.includes("haze")) {
    return "weather-fog";
  }
  if (text.includes("clear") || text.includes("sunny")) {
    return "weather-sunny";
  }
  if (text.includes("cloud")) {
    return "weather-cloudy";
  }

  return DEFAULT_ICON;
};
