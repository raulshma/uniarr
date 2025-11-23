/**
 * High Contrast Mode Utilities
 *
 * Provides utilities for detecting and adapting to high contrast mode
 * for improved accessibility in visualizations and UI components.
 */

import { AccessibilityInfo, Platform } from "react-native";
import { useEffect, useState } from "react";
import type { AppTheme } from "@/constants/theme";

/**
 * Check if high contrast mode is enabled
 * Note: This is primarily supported on iOS and web
 */
export async function isHighContrastEnabled(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") {
      // iOS supports high contrast detection
      return await AccessibilityInfo.isReduceTransparencyEnabled();
    } else if (Platform.OS === "web") {
      // Web supports media queries for high contrast
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-contrast: high)").matches;
      }
    }
    // Android doesn't have native high contrast detection
    return false;
  } catch (error) {
    console.warn("Failed to check high contrast mode:", error);
    return false;
  }
}

/**
 * Hook to detect high contrast mode
 */
export function useHighContrast(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check initial state
    isHighContrastEnabled().then(setIsHighContrast);

    // Listen for changes (iOS only)
    if (Platform.OS === "ios") {
      const subscription = AccessibilityInfo.addEventListener(
        "reduceTransparencyChanged",
        setIsHighContrast,
      );

      return () => {
        subscription?.remove();
      };
    }

    // Listen for changes (web only)
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.matchMedia
    ) {
      const mediaQuery = window.matchMedia("(prefers-contrast: high)");
      const handler = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);

      mediaQuery.addEventListener("change", handler);

      return () => {
        mediaQuery.removeEventListener("change", handler);
      };
    }
  }, []);

  return isHighContrast;
}

/**
 * Adjust color for high contrast mode
 * Increases contrast by making colors more saturated and distinct
 */
export function adjustColorForHighContrast(
  color: string,
  isDark: boolean,
  isHighContrast: boolean,
): string {
  if (!isHighContrast) {
    return color;
  }

  // For high contrast mode, use more distinct colors
  // This is a simplified approach - in production, you might want more sophisticated color adjustments

  // Common color mappings for high contrast
  const highContrastColors: Record<string, { light: string; dark: string }> = {
    // Primary/accent colors
    "#3b82f6": { light: "#0000FF", dark: "#00FFFF" }, // blue
    "#10b981": { light: "#00FF00", dark: "#00FF00" }, // green
    "#ef4444": { light: "#FF0000", dark: "#FF0000" }, // red
    "#f59e0b": { light: "#FF8800", dark: "#FFAA00" }, // amber/orange
    "#8b5cf6": { light: "#8800FF", dark: "#AA00FF" }, // purple

    // Grays - increase contrast
    "#6b7280": { light: "#000000", dark: "#FFFFFF" }, // gray
    "#9ca3af": { light: "#333333", dark: "#CCCCCC" }, // light gray
  };

  // Check if we have a high contrast mapping
  const mapping = highContrastColors[color.toLowerCase()];
  if (mapping) {
    return isDark ? mapping.dark : mapping.light;
  }

  // If no mapping, return original color
  return color;
}

/**
 * Get high contrast chart colors
 * Returns a set of highly distinguishable colors for charts
 */
export function getHighContrastChartColors(isDark: boolean): string[] {
  if (isDark) {
    return [
      "#00FFFF", // Cyan
      "#00FF00", // Green
      "#FFFF00", // Yellow
      "#FF00FF", // Magenta
      "#FF8800", // Orange
      "#FFFFFF", // White
    ];
  } else {
    return [
      "#0000FF", // Blue
      "#FF0000", // Red
      "#00AA00", // Green
      "#FF8800", // Orange
      "#8800FF", // Purple
      "#000000", // Black
    ];
  }
}

/**
 * Adjust theme colors for high contrast mode
 */
export function adjustThemeForHighContrast(
  theme: AppTheme,
  isHighContrast: boolean,
): AppTheme {
  if (!isHighContrast) {
    return theme;
  }

  // Create a high contrast version of the theme
  return {
    ...theme,
    colors: {
      ...theme.colors,
      // Increase contrast for primary colors
      primary: theme.dark ? "#00FFFF" : "#0000FF",
      error: "#FF0000",
      tertiary: "#00FF00",

      // Increase contrast for text
      onSurface: theme.dark ? "#FFFFFF" : "#000000",
      onSurfaceVariant: theme.dark ? "#CCCCCC" : "#333333",

      // Increase contrast for backgrounds
      surface: theme.dark ? "#000000" : "#FFFFFF",
      surfaceVariant: theme.dark ? "#1A1A1A" : "#F0F0F0",
    },
  };
}

/**
 * Get accessible color pair (foreground/background) with sufficient contrast
 * Ensures WCAG AA compliance (4.5:1 contrast ratio for normal text)
 */
export function getAccessibleColorPair(
  isDark: boolean,
  isHighContrast: boolean,
): { foreground: string; background: string } {
  if (isHighContrast) {
    return isDark
      ? { foreground: "#FFFFFF", background: "#000000" }
      : { foreground: "#000000", background: "#FFFFFF" };
  }

  return isDark
    ? { foreground: "#E5E7EB", background: "#1F2937" }
    : { foreground: "#1F2937", background: "#FFFFFF" };
}

/**
 * Calculate relative luminance of a color
 * Used for determining contrast ratios
 */
function getRelativeLuminance(color: string): number {
  // Parse hex color
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Apply gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color pair meets WCAG AA standards (4.5:1 for normal text)
 */
export function meetsWCAGAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Check if color pair meets WCAG AAA standards (7:1 for normal text)
 */
export function meetsWCAGAAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 7.0;
}
