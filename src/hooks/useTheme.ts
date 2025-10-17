import { useMemo } from "react";
import { useColorScheme, type ColorSchemeName } from "react-native";

import {
  getAppTheme,
  defaultTheme,
  createCustomTheme,
  defaultCustomThemeConfig,
  type AppTheme,
  type CustomThemeConfig,
} from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";

const hasCustomColors = (
  config?: CustomThemeConfig["customColors"],
): boolean => {
  if (!config) {
    return false;
  }

  return Object.values(config).some(
    (color) => typeof color === "string" && color.trim().length > 0,
  );
};

const hasPosterStyleOverrides = (config: CustomThemeConfig): boolean =>
  config.posterStyle.borderRadius !==
    defaultCustomThemeConfig.posterStyle.borderRadius ||
  config.posterStyle.shadowOpacity !==
    defaultCustomThemeConfig.posterStyle.shadowOpacity ||
  config.posterStyle.shadowRadius !==
    defaultCustomThemeConfig.posterStyle.shadowRadius;

const hasCustomThemeOverrides = (
  config?: CustomThemeConfig,
): config is CustomThemeConfig => {
  if (!config) {
    return false;
  }

  if (config.preset && config.preset !== "uniarr") {
    return true;
  }

  if (hasCustomColors(config.customColors)) {
    return true;
  }

  if (
    config.oledEnabled &&
    config.oledEnabled !== defaultCustomThemeConfig.oledEnabled
  ) {
    return true;
  }

  if (config.fontScale !== defaultCustomThemeConfig.fontScale) {
    return true;
  }

  if (config.densityMode !== defaultCustomThemeConfig.densityMode) {
    return true;
  }

  if (hasPosterStyleOverrides(config)) {
    return true;
  }

  return false;
};

/**
 * Custom hook that returns the appropriate app theme based on user preference and system theme.
 * If user selects 'system', it follows the system theme. Otherwise, it uses the selected theme.
 * Uses defaultTheme during initialization to prevent white flash.
 */
export const useTheme = (): AppTheme => {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.theme);
  const customThemeConfig = useSettingsStore(
    (state) => state.customThemeConfig,
  );
  const oledEnabled = useSettingsStore((state) => state.oledEnabled);

  return useMemo(() => {
    // Use default theme if system color scheme is not available yet
    if (!systemColorScheme) {
      return defaultTheme;
    }

    let effectiveScheme: ColorSchemeName;

    switch (themePreference) {
      case "light":
        effectiveScheme = "light";
        break;
      case "dark":
        effectiveScheme = "dark";
        break;
      case "system":
      default:
        effectiveScheme = systemColorScheme ?? "dark";
        break;
    }

    // Merge OLED setting into custom theme config if OLED is enabled and we're in dark mode
    const enhancedConfig =
      effectiveScheme === "dark" && oledEnabled
        ? { ...customThemeConfig, oledEnabled: true }
        : customThemeConfig;

    // Check if we have a custom theme configuration
    if (hasCustomThemeOverrides(enhancedConfig)) {
      // Use custom theme configuration
      return createCustomTheme(enhancedConfig, effectiveScheme === "dark");
    }

    // Use standard theme
    return getAppTheme(effectiveScheme);
  }, [themePreference, systemColorScheme, customThemeConfig, oledEnabled]);
};
