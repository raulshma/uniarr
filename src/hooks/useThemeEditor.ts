import React, { useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createCustomTheme,
  defaultCustomThemeConfig,
  type CustomThemeConfig,
  type AppTheme,
} from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/services/logger/LoggerService';

const THEME_CONFIG_STORAGE_KEY = 'CustomThemeConfig:v1';

export const useThemeEditor = () => {
  const [config, setConfig] = useState<CustomThemeConfig>(defaultCustomThemeConfig);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme configuration from storage
  const loadThemeConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(THEME_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsedConfig = JSON.parse(stored) as CustomThemeConfig;
        setConfig(parsedConfig);
      } else {
        setConfig(defaultCustomThemeConfig);
      }
    } catch (error) {
      await logger.error('Failed to load theme configuration', {
        location: 'useThemeEditor.loadThemeConfig',
        error: error instanceof Error ? error.message : String(error),
      });
      setConfig(defaultCustomThemeConfig);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save theme configuration to storage
  const saveThemeConfig = useCallback(async (newConfig: CustomThemeConfig): Promise<boolean> => {
    try {
      await AsyncStorage.setItem(THEME_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
      return true;
    } catch (error) {
      await logger.error('Failed to save theme configuration', {
        location: 'useThemeEditor.saveThemeConfig',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback((updates: Partial<CustomThemeConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Reset to default configuration
  const resetToDefaults = useCallback(() => {
    setConfig(defaultCustomThemeConfig);
  }, []);

  // Generate preview theme
  const previewTheme = useMemo((): AppTheme => {
    return createCustomTheme(config, false); // Light theme for preview
  }, [config]);

  // Save theme (this would typically trigger a theme change in the app)
  const saveTheme = useCallback(async (): Promise<boolean> => {
    return await saveThemeConfig(config);
  }, [config, saveThemeConfig]);

  // Load configuration on mount
  React.useEffect(() => {
    loadThemeConfig();
  }, [loadThemeConfig]);

  return {
    config,
    updateConfig,
    resetToDefaults,
    previewTheme,
    saveTheme,
    isLoading,
  };
};
