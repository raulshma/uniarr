import { useMemo } from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import { getAppTheme, type AppTheme } from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Custom hook that returns the appropriate app theme based on user preference and system theme.
 * If user selects 'system', it follows the system theme. Otherwise, it uses the selected theme.
 */
export const useTheme = (): AppTheme => {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.theme);

  return useMemo(() => {
    let effectiveScheme: ColorSchemeName;

    switch (themePreference) {
      case 'light':
        effectiveScheme = 'light';
        break;
      case 'dark':
        effectiveScheme = 'dark';
        break;
      case 'system':
      default:
        effectiveScheme = systemColorScheme;
        break;
    }

    return getAppTheme(effectiveScheme);
  }, [themePreference, systemColorScheme]);
};
