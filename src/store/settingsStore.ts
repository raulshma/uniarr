import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logger } from '@/services/logger/LoggerService';
import type { NotificationCategory, QuietHoursConfig } from '@/models/notification.types';
import type { CalendarView } from '@/models/calendar.types';
import {
  createDefaultQuietHoursConfig,
  normalizeQuietHoursConfig,
} from '@/utils/quietHours.utils';
import { defaultCustomThemeConfig, type CustomThemeConfig } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsData = {
  theme: ThemePreference;
  customThemeConfig: CustomThemeConfig;
  notificationsEnabled: boolean;
  releaseNotificationsEnabled: boolean;
  downloadNotificationsEnabled: boolean;
  failedDownloadNotificationsEnabled: boolean;
  requestNotificationsEnabled: boolean;
  serviceHealthNotificationsEnabled: boolean;
  refreshIntervalMinutes: number;
  quietHours: Record<NotificationCategory, QuietHoursConfig>;
  criticalHealthAlertsBypassQuietHours: boolean;
  // Remember last selected calendar view (week/day/month/list)
  lastCalendarView: CalendarView;
  useNativeTabs: boolean;
  // Number of retry attempts to perform for Jellyseerr requests when the server
  // returns 5xx errors. This value represents the number of retry attempts
  // after the initial request. Default: 3
  jellyseerrRetryAttempts: number;
};

interface SettingsState extends SettingsData {
  setTheme: (theme: ThemePreference) => void;
  updateCustomThemeConfig: (config: Partial<CustomThemeConfig>) => void;
  setCustomThemeConfig: (config: CustomThemeConfig) => void;
  resetCustomThemeConfig: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReleaseNotificationsEnabled: (enabled: boolean) => void;
  setDownloadNotificationsEnabled: (enabled: boolean) => void;
  setFailedDownloadNotificationsEnabled: (enabled: boolean) => void;
  setRequestNotificationsEnabled: (enabled: boolean) => void;
  setServiceHealthNotificationsEnabled: (enabled: boolean) => void;
  setRefreshIntervalMinutes: (minutes: number) => void;
  updateQuietHoursConfig: (
    category: NotificationCategory,
    partial: Partial<QuietHoursConfig>,
  ) => void;
  setCriticalHealthAlertsBypassQuietHours: (enabled: boolean) => void;
  reset: () => void;
  setLastCalendarView: (view: CalendarView) => void;
  setUseNativeTabs: (enabled: boolean) => void;
  setJellyseerrRetryAttempts: (attempts: number) => void;
}

const STORAGE_KEY = 'SettingsStore:v1';
const MIN_REFRESH_INTERVAL = 5;
const MAX_REFRESH_INTERVAL = 120;
const DEFAULT_REFRESH_INTERVAL = 15;
const DEFAULT_JELLYSEERR_RETRY_ATTEMPTS = 3;
const MIN_JELLYSEERR_RETRY_ATTEMPTS = 0;
const MAX_JELLYSEERR_RETRY_ATTEMPTS = 10;

const clampRetryAttempts = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_JELLYSEERR_RETRY_ATTEMPTS;
  return Math.min(Math.max(Math.round(value), MIN_JELLYSEERR_RETRY_ATTEMPTS), MAX_JELLYSEERR_RETRY_ATTEMPTS);
};

const clampRefreshInterval = (minutes: number): number => {
  if (Number.isNaN(minutes)) {
    return DEFAULT_REFRESH_INTERVAL;
  }

  return Math.min(Math.max(Math.round(minutes), MIN_REFRESH_INTERVAL), MAX_REFRESH_INTERVAL);
};

const createDefaultQuietHoursState = (): Record<NotificationCategory, QuietHoursConfig> => ({
  downloads: createDefaultQuietHoursConfig('weeknights'),
  failures: createDefaultQuietHoursConfig('weeknights'),
  requests: createDefaultQuietHoursConfig('weeknights'),
  serviceHealth: createDefaultQuietHoursConfig('everyday'),
});

const createDefaultSettings = (): SettingsData => ({
  theme: 'system',
  customThemeConfig: defaultCustomThemeConfig,
  notificationsEnabled: true,
  releaseNotificationsEnabled: false,
  downloadNotificationsEnabled: true,
  failedDownloadNotificationsEnabled: true,
  requestNotificationsEnabled: true,
  serviceHealthNotificationsEnabled: true,
  refreshIntervalMinutes: DEFAULT_REFRESH_INTERVAL,
  quietHours: createDefaultQuietHoursState(),
  criticalHealthAlertsBypassQuietHours: true,
  lastCalendarView: 'week',
  useNativeTabs: false,
  jellyseerrRetryAttempts: DEFAULT_JELLYSEERR_RETRY_ATTEMPTS,
});

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...createDefaultSettings(),
      setTheme: (theme) => set({ theme }),
      updateCustomThemeConfig: (config) =>
        set((state) => ({
          customThemeConfig: { ...state.customThemeConfig, ...config },
        })),
      setCustomThemeConfig: (config) => set({ customThemeConfig: config }),
      resetCustomThemeConfig: () => set({ customThemeConfig: defaultCustomThemeConfig }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setReleaseNotificationsEnabled: (enabled) => set({ releaseNotificationsEnabled: enabled }),
      setDownloadNotificationsEnabled: (enabled) => set({ downloadNotificationsEnabled: enabled }),
      setFailedDownloadNotificationsEnabled: (enabled) =>
        set({ failedDownloadNotificationsEnabled: enabled }),
      setRequestNotificationsEnabled: (enabled) => set({ requestNotificationsEnabled: enabled }),
      setServiceHealthNotificationsEnabled: (enabled) =>
        set({ serviceHealthNotificationsEnabled: enabled }),
      setRefreshIntervalMinutes: (minutes) =>
        set({ refreshIntervalMinutes: clampRefreshInterval(minutes) }),
      updateQuietHoursConfig: (category, partial) =>
        set((state) => ({
          quietHours: {
            ...state.quietHours,
            [category]: normalizeQuietHoursConfig({
              ...state.quietHours[category],
              ...partial,
            }),
          },
        })),
      setCriticalHealthAlertsBypassQuietHours: (enabled) =>
        set({ criticalHealthAlertsBypassQuietHours: enabled }),
  setLastCalendarView: (view: CalendarView) => set({ lastCalendarView: view }),
  setUseNativeTabs: (enabled: boolean) => set({ useNativeTabs: enabled }),
      setJellyseerrRetryAttempts: (attempts: number) =>
        set({ jellyseerrRetryAttempts: clampRetryAttempts(attempts) }),
  reset: () => set(createDefaultSettings()),
    }),
    {
      name: STORAGE_KEY,
      // Bump version since we're adding a new persisted field
      version: 3,
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

        // Normalize jellyseerr retry attempts
        if (typeof state.jellyseerrRetryAttempts === 'undefined') {
          state.jellyseerrRetryAttempts = DEFAULT_JELLYSEERR_RETRY_ATTEMPTS;
        } else {
          const normalizedRetries = clampRetryAttempts(state.jellyseerrRetryAttempts);
          if (normalizedRetries !== state.jellyseerrRetryAttempts) {
            state.jellyseerrRetryAttempts = normalizedRetries;
          }
        }

        const quietHoursEntries = Object.entries(state.quietHours ?? {}) as [
          NotificationCategory,
          QuietHoursConfig,
        ][];

        state.quietHours = quietHoursEntries.reduce(
          (acc, [category, config]) => ({
            ...acc,
            [category]: normalizeQuietHoursConfig(config),
          }),
          {} as Record<NotificationCategory, QuietHoursConfig>,
        );

        const baseDefaults = createDefaultSettings();
        (Object.keys(baseDefaults.quietHours) as NotificationCategory[]).forEach((category) => {
          if (!state.quietHours[category]) {
            state.quietHours[category] = baseDefaults.quietHours[category];
          }
        });
      },
      migrate: (persistedState) => {
        if (!persistedState) {
          return createDefaultSettings();
        }

        const partial = persistedState as Partial<SettingsData>;
        const baseDefaults = createDefaultSettings();

        const quietHours = (Object.keys(baseDefaults.quietHours) as NotificationCategory[]).reduce(
          (acc, category) => {
            const persistedConfig = partial.quietHours?.[category];
            const baseConfig = baseDefaults.quietHours[category];

            acc[category] = persistedConfig
              ? normalizeQuietHoursConfig({ ...baseConfig, ...persistedConfig })
              : baseConfig;

            return acc;
          },
          {} as Record<NotificationCategory, QuietHoursConfig>,
        );

        return {
          ...baseDefaults,
          ...partial,
          refreshIntervalMinutes: clampRefreshInterval(
            partial.refreshIntervalMinutes ?? baseDefaults.refreshIntervalMinutes,
          ),
          jellyseerrRetryAttempts: clampRetryAttempts(
            partial.jellyseerrRetryAttempts ?? baseDefaults.jellyseerrRetryAttempts,
          ),
          quietHours,
          criticalHealthAlertsBypassQuietHours:
            partial.criticalHealthAlertsBypassQuietHours ??
            baseDefaults.criticalHealthAlertsBypassQuietHours,
          useNativeTabs: partial.useNativeTabs ?? baseDefaults.useNativeTabs,
        } satisfies SettingsData;
      },
    },
  ),
);

export const selectThemePreference = (state: SettingsState): ThemePreference => state.theme;
export const selectCustomThemeConfig = (state: SettingsState): CustomThemeConfig => state.customThemeConfig;
export const selectNotificationsEnabled = (state: SettingsState): boolean => state.notificationsEnabled;
export const selectReleaseNotificationsEnabled = (state: SettingsState): boolean =>
  state.releaseNotificationsEnabled;
export const selectDownloadNotificationsEnabled = (state: SettingsState): boolean =>
  state.downloadNotificationsEnabled;
export const selectFailedDownloadNotificationsEnabled = (state: SettingsState): boolean =>
  state.failedDownloadNotificationsEnabled;
export const selectRequestNotificationsEnabled = (state: SettingsState): boolean =>
  state.requestNotificationsEnabled;
export const selectServiceHealthNotificationsEnabled = (state: SettingsState): boolean =>
  state.serviceHealthNotificationsEnabled;
export const selectRefreshIntervalMinutes = (state: SettingsState): number =>
  state.refreshIntervalMinutes;
export const selectJellyseerrRetryAttempts = (state: SettingsState): number =>
  state.jellyseerrRetryAttempts;
export const selectQuietHours = (
  state: SettingsState,
): Record<NotificationCategory, QuietHoursConfig> => state.quietHours;
export const selectQuietHoursForCategory = (
  category: NotificationCategory,
) =>
  (state: SettingsState): QuietHoursConfig =>
    state.quietHours[category] ?? createDefaultQuietHoursState()[category];
export const selectCriticalHealthAlertsBypassQuietHours = (state: SettingsState): boolean =>
  state.criticalHealthAlertsBypassQuietHours;

export const selectLastCalendarView = (state: SettingsState) => state.lastCalendarView;
export const selectUseNativeTabs = (state: SettingsState) => state.useNativeTabs;
