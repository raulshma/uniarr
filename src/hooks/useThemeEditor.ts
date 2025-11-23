import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import {
  createCustomTheme,
  defaultCustomThemeConfig,
  type AppTheme,
  type CustomThemeConfig,
} from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import type { CustomColorScheme } from "@/theme/colors";

const hasColorOverrides = (
  colors?: Partial<CustomColorScheme>,
): colors is Partial<CustomColorScheme> =>
  !!colors &&
  Object.values(colors).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

const mergeThemeConfig = (
  base: CustomThemeConfig,
  updates: Partial<CustomThemeConfig>,
): CustomThemeConfig => {
  const hasCustomColorsUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "customColors",
  );
  const hasPosterStyleUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "posterStyle",
  );

  let nextCustomColors = base.customColors;
  if (hasCustomColorsUpdate) {
    const updateColors = updates.customColors;
    if (hasColorOverrides(updateColors)) {
      const baseColors = base.customColors ?? {};
      nextCustomColors = { ...baseColors, ...updateColors };
    } else {
      nextCustomColors = undefined;
    }
  }

  const nextPosterStyle = hasPosterStyleUpdate
    ? { ...base.posterStyle, ...updates.posterStyle }
    : base.posterStyle;

  return {
    ...base,
    ...updates,
    customColors: nextCustomColors,
    posterStyle: nextPosterStyle,
  } satisfies CustomThemeConfig;
};

export const useThemeEditor = () => {
  // Compute hydration status directly (derived state)
  const [isHydrated, setIsHydrated] = useState(
    useSettingsStore.persist.hasHydrated(),
  );

  const customThemeConfig = useSettingsStore(
    (state) => state.customThemeConfig,
  );
  const resetCustomThemeConfig = useSettingsStore(
    (state) => state.resetCustomThemeConfig,
  );
  const themePreference = useSettingsStore((state) => state.theme);
  const systemColorScheme = useColorScheme();

  // Only use effect for external subscription (legitimate)
  useEffect(() => {
    // If already hydrated, no need to subscribe
    if (useSettingsStore.persist.hasHydrated()) {
      setIsHydrated(true);
      return;
    }

    // Subscribe to hydration completion
    const unsubscribe = useSettingsStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    return unsubscribe;
  }, []); // Empty deps - only subscribe once

  const updateConfig = useCallback((updates: Partial<CustomThemeConfig>) => {
    useSettingsStore.setState((state) => ({
      customThemeConfig: mergeThemeConfig(
        state.customThemeConfig ?? defaultCustomThemeConfig,
        updates,
      ),
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    resetCustomThemeConfig();
  }, [resetCustomThemeConfig]);

  const saveTheme = useCallback(async () => {
    // Theme updates are persisted via the settings store, so saving succeeds immediately.
    return true;
  }, []);

  const config = isHydrated ? customThemeConfig : defaultCustomThemeConfig;

  // React Compiler handles simple conditional logic
  const isDarkMode =
    themePreference === "dark"
      ? true
      : themePreference === "light"
        ? false
        : systemColorScheme !== "light";

  const previewTheme = useMemo<AppTheme>(() => {
    return createCustomTheme(config, isDarkMode);
  }, [config, isDarkMode]);

  return {
    config,
    updateConfig,
    resetToDefaults,
    previewTheme,
    saveTheme,
    isLoading: !isHydrated,
  };
};
