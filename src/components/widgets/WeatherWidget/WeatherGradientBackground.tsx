import React, { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { temperatureToColor } from "@/utils/color.utils";

interface WeatherGradientBackgroundProps {
  temperature: number;
  width: number;
  height: number;
}

/**
 * Animated gradient background that changes based on temperature
 * Runs entirely on native thread for performance
 */
const WeatherGradientBackground: React.FC<WeatherGradientBackgroundProps> = ({
  temperature,
  width,
  height,
}) => {
  const { startColor, endColor } = useMemo(() => {
    const primary = temperatureToColor(temperature);

    // Create a lighter/darker variant for gradient effect
    let endColor: string;
    if (temperature < 15) {
      endColor = "rgb(200, 220, 255)"; // Light blue gradient
    } else if (temperature < 25) {
      endColor = "rgb(150, 200, 180)"; // Light teal gradient
    } else {
      endColor = "rgb(255, 200, 100)"; // Light orange gradient
    }

    return { startColor: primary, endColor };
  }, [temperature]);

  if (!width || !height) {
    return null;
  }

  return (
    <LinearGradient
      style={{ width, height, position: "absolute" }}
      colors={[startColor, endColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: width, y: height }}
    />
  );
};

export default WeatherGradientBackground;
