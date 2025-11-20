import React, { useMemo } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "react-native-paper";
import { temperatureToColor, parseColor } from "@/utils/color.utils";
import type { AppTheme } from "@/constants/theme";

interface WeatherGradientBackgroundProps {
  temperature: number;
  style?: StyleProp<ViewStyle>;
}

const adjustColor = (color: string, factor: number): string => {
  const { r, g, b } = parseColor(color);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
};

const lightenColor = (color: string, factor: number): string => {
  const { r, g, b } = parseColor(color);
  const newR = Math.min(255, r + (255 - r) * factor);
  const newG = Math.min(255, g + (255 - g) * factor);
  const newB = Math.min(255, b + (255 - b) * factor);
  return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
};

/**
 * Animated gradient background that changes based on temperature
 * Runs entirely on native thread for performance
 */
const WeatherGradientBackground: React.FC<WeatherGradientBackgroundProps> = ({
  temperature,
  style,
}) => {
  const theme = useTheme<AppTheme>();
  const isDark = theme.dark;

  const { startColor, endColor } = useMemo(() => {
    const baseColor = temperatureToColor(temperature);

    let start: string;
    let end: string;

    if (isDark) {
      // Dark Mode: Deep, rich colors
      // Darken the base color significantly
      start = adjustColor(baseColor, 0.4);

      if (temperature < 15) {
        end = "rgb(20, 30, 50)"; // Deep blue night
      } else if (temperature < 25) {
        end = "rgb(20, 40, 35)"; // Deep teal night
      } else {
        end = "rgb(50, 30, 20)"; // Deep warm night
      }
    } else {
      // Light Mode: Pastel, airy colors
      // Lighten the base color to be pastel
      start = lightenColor(baseColor, 0.7);

      if (temperature < 15) {
        end = "rgb(235, 245, 255)"; // Very light blue
      } else if (temperature < 25) {
        end = "rgb(235, 255, 245)"; // Very light teal
      } else {
        end = "rgb(255, 245, 235)"; // Very light orange
      }
    }

    return { startColor: start, endColor: end };
  }, [temperature, isDark]);

  return (
    <LinearGradient
      style={[StyleSheet.absoluteFill, style]}
      colors={[startColor, endColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    />
  );
};

export default WeatherGradientBackground;
