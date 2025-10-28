/**
 * Skia Animation Utilities for UniArr
 *
 * Provides reusable Skia-based animations for subtle UI interactions.
 * All animations run on native thread for maximum performance.
 */

import {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Create a breathing animation value (continuous pulse)
 * Oscillates between minValue and maxValue
 *
 * @param minValue - Minimum value (e.g., 0.95 for scale)
 * @param maxValue - Maximum value (e.g., 1.0 for scale)
 * @param duration - Duration in milliseconds for one cycle
 */
export const useBreathingAnimation = (
  minValue: number = 0.95,
  maxValue: number = 1.0,
  duration: number = 2000,
) => {
  const value = useSharedValue(minValue);

  // Start animation immediately
  value.value = withRepeat(
    withSequence(
      withTiming(maxValue, { duration: duration / 2 }),
      withTiming(minValue, { duration: duration / 2 }),
    ),
    -1, // infinite loop
    false, // no reset
  );

  return value;
};

/**
 * Map temperature to color for gradient background
 * Cold (blue) → Warm (orange/red) → Hot (deep red)
 *
 * @param temperature - Temperature in current units
 * @returns RGB color string (e.g., "rgb(66, 133, 244)")
 */
export const temperatureToColor = (temperature: number): string => {
  let r = 0,
    g = 0,
    b = 0;

  if (temperature < 0) {
    // Very cold: deep blue
    r = 66;
    g = 133;
    b = 244;
  } else if (temperature < 10) {
    // Cold: light blue
    r = 100;
    g = 150;
    b = 255;
  } else if (temperature < 20) {
    // Cool: cyan
    r = 0;
    g = 150;
    b = 200;
  } else if (temperature < 25) {
    // Mild: teal
    r = 50;
    g = 180;
    b = 150;
  } else if (temperature < 30) {
    // Warm: orange
    r = 255;
    g = 152;
    b = 0;
  } else {
    // Hot: red
    r = 244;
    g = 67;
    b = 54;
  }

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Parse color string to RGB components
 * @param colorString - RGB color string or hex
 * @returns { r, g, b } object
 */
export const parseColor = (
  colorString: string,
): { r: number; g: number; b: number } => {
  const match = colorString.match(/\d+/g);
  if (match && match.length >= 3) {
    return {
      r: parseInt(match[0] || "100", 10),
      g: parseInt(match[1] || "150", 10),
      b: parseInt(match[2] || "255", 10),
    };
  }
  // Default to cool color
  return { r: 100, g: 150, b: 255 };
};

/**
 * Interpolate between two colors
 * @param color1 - Start color (RGB string)
 * @param color2 - End color (RGB string)
 * @param progress - Progress value from 0 to 1
 * @returns Interpolated RGB string
 */
export const interpolateColor = (
  color1: string,
  color2: string,
  progress: number,
): string => {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * progress);
  const g = Math.round(c1.g + (c2.g - c1.g) * progress);
  const b = Math.round(c1.b + (c2.b - c1.b) * progress);

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Create a divider opacity animation (breathing effect for accents)
 * Oscillates between 0.3 and 0.6 opacity
 *
 * @param duration - Duration in milliseconds for one cycle
 */
export const useDividerAnimation = (duration: number = 3000) => {
  return useBreathingAnimation(0.3, 0.6, duration);
};

/**
 * Calculate animated number transition
 * Useful for smooth temperature/value changes
 *
 * @param fromValue - Start value
 * @param toValue - End value
 * @param progress - Animation progress (0-1)
 * @returns Interpolated value
 */
export const interpolateNumber = (
  fromValue: number,
  toValue: number,
  progress: number,
): number => {
  return fromValue + (toValue - fromValue) * progress;
};
