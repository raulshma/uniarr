import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logger } from '@/services/logger/LoggerService';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsData = {
  theme: ThemePreference;
  notificationsEnabled: boolean;
  releaseNotificationsEnabled: boolean;
  refreshIntervalMinutes: number;
};

interface SettingsState extends SettingsData {
  setTheme: (theme: ThemePreference) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReleaseNotificationsEnabled: (enabled: boolean) => void;
  setRefreshIntervalMinutes: (minutes: number) => void;
  reset: () => void;
}

const STORAGE_KEY = 'SettingsStore:v1';
const MIN_REFRESH_INTERVAL = 5;
const MAX_REFRESH_INTERVAL = 120;
const DEFAULT_REFRESH_INTERVAL = 15;

const clampRefreshInterval = (minutes: number): number => {
  if (Number.isNaN(minutes)) {
    return DEFAULT_REFRESH_INTERVAL;
  }

  return Math.min(Math.max(Math.round(minutes), MIN_REFRESH_INTERVAL), MAX_REFRESH_INTERVAL);
};

const defaultSettings: SettingsData = {
  theme: 'system',
  notificationsEnabled: true,
  releaseNotificationsEnabled: false,
  refreshIntervalMinutes: DEFAULT_REFRESH_INTERVAL,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setTheme: (theme) => set({ theme }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setReleaseNotificationsEnabled: (enabled) => set({ releaseNotificationsEnabled: enabled }),
      setRefreshIntervalMinutes: (minutes) =>
        set({ refreshIntervalMinutes: clampRefreshInterval(minutes) }),
      reset: () => set({ ...defaultSettings }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          void logger.error('Failed to rehydrate settings store.', {
            location: 'settingsStore.onRehydrateStorage',
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        if (!state) {
          return;
        }

        const normalizedInterval = clampRefreshInterval(state.refreshIntervalMinutes);
        if (normalizedInterval !== state.refreshIntervalMinutes) {
          state.refreshIntervalMinutes = normalizedInterval;
        }
      },
      migrate: (persistedState) => {
        if (!persistedState) {
          return defaultSettings;
        }

        const partial = persistedState as Partial<SettingsData>;

        return {
          ...defaultSettings,
          ...partial,
          refreshIntervalMinutes: clampRefreshInterval(
            partial.refreshIntervalMinutes ?? defaultSettings.refreshIntervalMinutes,
          ),
        } satisfies SettingsData;
      },
    },
  ),
);

export const selectThemePreference = (state: SettingsState): ThemePreference => state.theme;
export const selectNotificationsEnabled = (state: SettingsState): boolean => state.notificationsEnabled;
export const selectReleaseNotificationsEnabled = (state: SettingsState): boolean =>
  state.releaseNotificationsEnabled;
export const selectRefreshIntervalMinutes = (state: SettingsState): number =>
  state.refreshIntervalMinutes;
