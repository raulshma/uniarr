import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { logger, LogLevel } from "@/services/logger/LoggerService";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import type {
  NotificationCategory,
  QuietHoursConfig,
} from "@/models/notification.types";
import type { CalendarView } from "@/models/calendar.types";
import {
  createDefaultQuietHoursConfig,
  normalizeQuietHoursConfig,
} from "@/utils/quietHours.utils";
import {
  defaultCustomThemeConfig,
  type CustomThemeConfig,
} from "@/constants/theme";
// Exportable shallow equality helper for components to use when selecting
// small slices of state to avoid unnecessary re-renders.
export { shallow } from "zustand/shallow";

export type ThemePreference = "system" | "light" | "dark";

export type LoaderConfig = {
  size: number;
  strokeWidth: number;
  duration: number;
  colors: string[];
  useThemeColors: boolean;
};

type SettingsData = {
  theme: ThemePreference;
  customThemeConfig: CustomThemeConfig;
  oledEnabled: boolean;
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
  // Persist the last custom calendar range for the hybrid calendar
  lastCalendarRange?: {
    start: string;
    end: string;
  };
  tmdbEnabled: boolean;
  // Number of retry attempts to perform for Jellyseerr requests when the server
  // returns 5xx errors. This value represents the number of retry attempts
  // after the initial request. Default: 3
  jellyseerrRetryAttempts: number;
  // Maximum image cache size in bytes. Default: 100MB
  maxImageCacheSize: number;
  // Minimum log level for the application's logger
  logLevel: LogLevel;
  // Haptic feedback setting
  hapticFeedback: boolean;
  // Jellyfin server addresses for deep linking
  jellyfinLocalAddress?: string;
  jellyfinPublicAddress?: string;
  // Preferred Jellyseerr service for TMDB -> Sonarr mappings
  preferredJellyseerrServiceId?: string;
  // Service IDs to include in Recent Activity (if undefined, include all enabled services)
  recentActivitySourceServiceIds?: string[];
  // Preferred service to navigate to when recent activity item has multiple origins
  preferredRecentActivityServiceId?: string;
  // Last time app update was checked (ISO string)
  lastReleaseNotesCheckedAt?: string;
  // Use frosted glass effect for widgets on homepage
  frostedWidgetsEnabled: boolean;
  // Show animated gradient background on dashboard
  gradientBackgroundEnabled: boolean;
  // API Error Logger configuration
  apiErrorLoggerEnabled: boolean;
  apiErrorLoggerActivePreset: string; // "CRITICAL", "SERVER", "RATE_LIMIT", "CLIENT_ERRORS", "STRICT", "CUSTOM"
  apiErrorLoggerCustomCodes: (number | string)[]; // Used when preset is CUSTOM
  apiErrorLoggerRetentionDays: number; // How many days to keep error logs (default: 7)
  apiErrorLoggerCaptureRequestBody: boolean; // Capture request body in error logs (default: false)
  apiErrorLoggerCaptureResponseBody: boolean; // Capture response body in error logs (default: false)
  apiErrorLoggerCaptureRequestHeaders: boolean; // Capture request headers in error logs (default: false)
  // Hydration tracking
  _hasHydrated: boolean;
  // Loader configuration for SVG spinner
  loaderConfig: LoaderConfig;
  // (thumbnail generation removed)
  // Backdrop with blur experimental feature
  enableBackdropWithBlur: boolean;
  // Show video trailers in detail pages
  trailerFeatureEnabled: boolean;
  discoverBannerDismissed: boolean;
  animeHubBannerDismissed: boolean;
  // BYOK (Bring Your Own Keys) - API key configurations
  byokGeocodeMapsCoApiKey?: string;
};

interface SettingsState extends SettingsData {
  setTheme: (theme: ThemePreference) => void;
  updateCustomThemeConfig: (config: Partial<CustomThemeConfig>) => void;
  setCustomThemeConfig: (config: CustomThemeConfig) => void;
  resetCustomThemeConfig: () => void;
  setOledEnabled: (enabled: boolean) => void;
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
  setLastCalendarRange: (
    range: { start: string; end: string } | undefined,
  ) => void;
  setTmdbEnabled: (enabled: boolean) => void;
  setJellyseerrRetryAttempts: (attempts: number) => void;
  setMaxImageCacheSize: (size: number) => void;
  setLogLevel: (level: LogLevel) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setJellyfinLocalAddress: (address: string | undefined) => void;
  setJellyfinPublicAddress: (address: string | undefined) => void;
  setPreferredJellyseerrServiceId: (serviceId: string | undefined) => void;
  setRecentActivitySourceServiceIds: (ids: string[] | undefined) => void;
  setPreferredRecentActivityServiceId: (serviceId: string | undefined) => void;
  setLastReleaseNotesCheckedAt: (timestamp: string | undefined) => void;
  setFrostedWidgetsEnabled: (enabled: boolean) => void;
  setGradientBackgroundEnabled: (enabled: boolean) => void;
  setApiErrorLoggerEnabled: (enabled: boolean) => void;
  setApiErrorLoggerActivePreset: (preset: string) => void;
  setApiErrorLoggerCustomCodes: (codes: (number | string)[]) => void;
  setApiErrorLoggerRetentionDays: (days: number) => void;
  setApiErrorLoggerCaptureRequestBody: (capture: boolean) => void;
  setApiErrorLoggerCaptureResponseBody: (capture: boolean) => void;
  setApiErrorLoggerCaptureRequestHeaders: (capture: boolean) => void;
  setLoaderConfig: (config: LoaderConfig) => void;
  // (thumbnail setters removed)
  // Backdrop with blur experimental feature
  setBackdropWithBlurEnabled: (enabled: boolean) => void;
  setTrailerFeatureEnabled: (enabled: boolean) => void;
  setDiscoverBannerDismissed: (dismissed: boolean) => void;
  setAnimeHubBannerDismissed: (dismissed: boolean) => void;
  setByokGeocodeMapsCoApiKey: (apiKey: string | undefined) => void;
}
const STORAGE_KEY = "SettingsStore:v1";
const MIN_REFRESH_INTERVAL = 5;
const MAX_REFRESH_INTERVAL = 120;
const DEFAULT_REFRESH_INTERVAL = 15;
const DEFAULT_JELLYSEERR_RETRY_ATTEMPTS = 3;
const MIN_JELLYSEERR_RETRY_ATTEMPTS = 0;
const MAX_JELLYSEERR_RETRY_ATTEMPTS = 10;
const DEFAULT_MAX_IMAGE_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const MIN_MAX_IMAGE_CACHE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MAX_IMAGE_CACHE_SIZE = 1024 * 1024 * 1024; // 1GB
// thumbnail generation removed

const clampRetryAttempts = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_JELLYSEERR_RETRY_ATTEMPTS;
  return Math.min(
    Math.max(Math.round(value), MIN_JELLYSEERR_RETRY_ATTEMPTS),
    MAX_JELLYSEERR_RETRY_ATTEMPTS,
  );
};

const clampMaxImageCacheSize = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_MAX_IMAGE_CACHE_SIZE;
  return Math.min(
    Math.max(Math.round(value), MIN_MAX_IMAGE_CACHE_SIZE),
    MAX_MAX_IMAGE_CACHE_SIZE,
  );
};

const clampRefreshInterval = (minutes: number): number => {
  if (Number.isNaN(minutes)) {
    return DEFAULT_REFRESH_INTERVAL;
  }

  return Math.min(
    Math.max(Math.round(minutes), MIN_REFRESH_INTERVAL),
    MAX_REFRESH_INTERVAL,
  );
};

const createDefaultQuietHoursState = (): Record<
  NotificationCategory,
  QuietHoursConfig
> => ({
  downloads: createDefaultQuietHoursConfig("weeknights"),
  failures: createDefaultQuietHoursConfig("weeknights"),
  requests: createDefaultQuietHoursConfig("weeknights"),
  serviceHealth: createDefaultQuietHoursConfig("everyday"),
});

const createDefaultSettings = (): SettingsData => ({
  theme: "system",
  customThemeConfig: defaultCustomThemeConfig,
  oledEnabled: false,
  notificationsEnabled: true,
  releaseNotificationsEnabled: false,
  downloadNotificationsEnabled: true,
  failedDownloadNotificationsEnabled: true,
  requestNotificationsEnabled: true,
  serviceHealthNotificationsEnabled: true,
  refreshIntervalMinutes: DEFAULT_REFRESH_INTERVAL,
  quietHours: createDefaultQuietHoursState(),
  criticalHealthAlertsBypassQuietHours: true,
  lastCalendarView: "week",
  lastCalendarRange: undefined,
  tmdbEnabled: false,
  jellyseerrRetryAttempts: DEFAULT_JELLYSEERR_RETRY_ATTEMPTS,
  maxImageCacheSize: DEFAULT_MAX_IMAGE_CACHE_SIZE,
  logLevel: LogLevel.DEBUG,
  hapticFeedback: true,
  jellyfinLocalAddress: undefined,
  jellyfinPublicAddress: undefined,
  preferredJellyseerrServiceId: undefined,
  recentActivitySourceServiceIds: undefined,
  preferredRecentActivityServiceId: undefined,
  lastReleaseNotesCheckedAt: undefined,
  frostedWidgetsEnabled: false,
  gradientBackgroundEnabled: false,
  apiErrorLoggerEnabled: false,
  apiErrorLoggerActivePreset: "CRITICAL",
  apiErrorLoggerCustomCodes: [],
  apiErrorLoggerRetentionDays: 7,
  apiErrorLoggerCaptureRequestBody: false,
  apiErrorLoggerCaptureResponseBody: false,
  apiErrorLoggerCaptureRequestHeaders: false,
  _hasHydrated: false,
  loaderConfig: {
    size: 50,
    strokeWidth: 4,
    duration: 1000,
    colors: ["#FF0080", "#00FFFF"],
    useThemeColors: false,
  },
  // (thumbnail defaults removed)
  // Backdrop with blur defaults
  enableBackdropWithBlur: false, // Opt-in feature
  trailerFeatureEnabled: false, // Opt-in feature
  discoverBannerDismissed: false,
  animeHubBannerDismissed: false,
  byokGeocodeMapsCoApiKey: undefined,
});

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...createDefaultSettings(),
      setLogLevel: (level: LogLevel) => set({ logLevel: level }),
      setTheme: (theme) => set({ theme }),
      updateCustomThemeConfig: (config) =>
        set((state) => ({
          customThemeConfig: { ...state.customThemeConfig, ...config },
        })),
      setCustomThemeConfig: (config) => set({ customThemeConfig: config }),
      resetCustomThemeConfig: () =>
        set({ customThemeConfig: defaultCustomThemeConfig }),
      setOledEnabled: (enabled: boolean) => set({ oledEnabled: enabled }),
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
      setReleaseNotificationsEnabled: (enabled) =>
        set({ releaseNotificationsEnabled: enabled }),
      setDownloadNotificationsEnabled: (enabled) =>
        set({ downloadNotificationsEnabled: enabled }),
      setFailedDownloadNotificationsEnabled: (enabled) =>
        set({ failedDownloadNotificationsEnabled: enabled }),
      setRequestNotificationsEnabled: (enabled) =>
        set({ requestNotificationsEnabled: enabled }),
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
      setLastCalendarView: (view: CalendarView) =>
        set({ lastCalendarView: view }),
      setLastCalendarRange: (range) => set({ lastCalendarRange: range }),
      setTmdbEnabled: (enabled: boolean) => set({ tmdbEnabled: enabled }),
      setJellyseerrRetryAttempts: (attempts: number) =>
        set({ jellyseerrRetryAttempts: clampRetryAttempts(attempts) }),
      setMaxImageCacheSize: (size: number) =>
        set({ maxImageCacheSize: clampMaxImageCacheSize(size) }),
      setHapticFeedback: (enabled: boolean) => set({ hapticFeedback: enabled }),
      setJellyfinLocalAddress: (address: string | undefined) =>
        set({ jellyfinLocalAddress: address }),
      setJellyfinPublicAddress: (address: string | undefined) =>
        set({ jellyfinPublicAddress: address }),
      setPreferredJellyseerrServiceId: (serviceId: string | undefined) =>
        set({ preferredJellyseerrServiceId: serviceId }),
      setRecentActivitySourceServiceIds: (ids: string[] | undefined) =>
        set({ recentActivitySourceServiceIds: ids }),
      setPreferredRecentActivityServiceId: (serviceId: string | undefined) =>
        set({ preferredRecentActivityServiceId: serviceId }),
      setLastReleaseNotesCheckedAt: (timestamp: string | undefined) =>
        set({ lastReleaseNotesCheckedAt: timestamp }),
      setFrostedWidgetsEnabled: (enabled: boolean) =>
        set({ frostedWidgetsEnabled: enabled }),
      setGradientBackgroundEnabled: (enabled: boolean) =>
        set({ gradientBackgroundEnabled: enabled }),
      setApiErrorLoggerEnabled: (enabled: boolean) =>
        set({ apiErrorLoggerEnabled: enabled }),
      setApiErrorLoggerActivePreset: (preset: string) =>
        set({ apiErrorLoggerActivePreset: preset }),
      setApiErrorLoggerCustomCodes: (codes: (number | string)[]) =>
        set({ apiErrorLoggerCustomCodes: codes }),
      setApiErrorLoggerRetentionDays: (days: number) =>
        set({ apiErrorLoggerRetentionDays: Math.max(1, Math.min(365, days)) }),
      setApiErrorLoggerCaptureRequestBody: (capture: boolean) =>
        set({ apiErrorLoggerCaptureRequestBody: capture }),
      setApiErrorLoggerCaptureResponseBody: (capture: boolean) =>
        set({ apiErrorLoggerCaptureResponseBody: capture }),
      setApiErrorLoggerCaptureRequestHeaders: (capture: boolean) =>
        set({ apiErrorLoggerCaptureRequestHeaders: capture }),
      setLoaderConfig: (config: LoaderConfig) => set({ loaderConfig: config }),
      setBackdropWithBlurEnabled: (enabled: boolean) =>
        set({ enableBackdropWithBlur: enabled }),
      setTrailerFeatureEnabled: (enabled: boolean) =>
        set({ trailerFeatureEnabled: enabled }),
      setDiscoverBannerDismissed: (dismissed: boolean) =>
        set({ discoverBannerDismissed: dismissed }),
      setAnimeHubBannerDismissed: (dismissed: boolean) =>
        set({ animeHubBannerDismissed: dismissed }),
      setByokGeocodeMapsCoApiKey: (apiKey: string | undefined) =>
        set({ byokGeocodeMapsCoApiKey: apiKey }),
      reset: () => set(createDefaultSettings()),
    }),
    {
      name: STORAGE_KEY,
      // Only persist a focused subset of the settings state. Persisting the
      // entire state (including derived values or large objects) can cause
      // unnecessary rehydration work and extra memory usage. Keep the
      // persisted slice intentionally small.
      partialize: (state) => ({
        theme: state.theme,
        customThemeConfig: state.customThemeConfig,
        oledEnabled: state.oledEnabled,
        notificationsEnabled: state.notificationsEnabled,
        releaseNotificationsEnabled: state.releaseNotificationsEnabled,
        downloadNotificationsEnabled: state.downloadNotificationsEnabled,
        failedDownloadNotificationsEnabled:
          state.failedDownloadNotificationsEnabled,
        requestNotificationsEnabled: state.requestNotificationsEnabled,
        serviceHealthNotificationsEnabled:
          state.serviceHealthNotificationsEnabled,
        refreshIntervalMinutes: state.refreshIntervalMinutes,
        quietHours: state.quietHours,
        criticalHealthAlertsBypassQuietHours:
          state.criticalHealthAlertsBypassQuietHours,
        lastCalendarView: state.lastCalendarView,
        lastCalendarRange: state.lastCalendarRange,
        tmdbEnabled: state.tmdbEnabled,
        jellyseerrRetryAttempts: state.jellyseerrRetryAttempts,
        maxImageCacheSize: state.maxImageCacheSize,
        logLevel: state.logLevel,
        hapticFeedback: state.hapticFeedback,
        jellyfinLocalAddress: state.jellyfinLocalAddress,
        jellyfinPublicAddress: state.jellyfinPublicAddress,
        preferredJellyseerrServiceId: state.preferredJellyseerrServiceId,
        recentActivitySourceServiceIds: state.recentActivitySourceServiceIds,
        preferredRecentActivityServiceId:
          state.preferredRecentActivityServiceId,
        lastReleaseNotesCheckedAt: state.lastReleaseNotesCheckedAt,
        frostedWidgetsEnabled: state.frostedWidgetsEnabled,
        gradientBackgroundEnabled: state.gradientBackgroundEnabled,
        apiErrorLoggerEnabled: state.apiErrorLoggerEnabled,
        apiErrorLoggerActivePreset: state.apiErrorLoggerActivePreset,
        apiErrorLoggerCustomCodes: state.apiErrorLoggerCustomCodes,
        apiErrorLoggerRetentionDays: state.apiErrorLoggerRetentionDays,
        apiErrorLoggerCaptureRequestBody:
          state.apiErrorLoggerCaptureRequestBody,
        apiErrorLoggerCaptureResponseBody:
          state.apiErrorLoggerCaptureResponseBody,
        apiErrorLoggerCaptureRequestHeaders:
          state.apiErrorLoggerCaptureRequestHeaders,
        loaderConfig: state.loaderConfig,
        // thumbnail fields removed
        enableBackdropWithBlur: state.enableBackdropWithBlur,
        trailerFeatureEnabled: state.trailerFeatureEnabled,
        discoverBannerDismissed: state.discoverBannerDismissed,
        animeHubBannerDismissed: state.animeHubBannerDismissed,
        byokGeocodeMapsCoApiKey: state.byokGeocodeMapsCoApiKey,
      }),
      // Bump version since we're adding new persisted fields
      version: 13,
      storage: createJSONStorage(() => storageAdapter),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          void logger.error("Failed to rehydrate settings store.", {
            location: "settingsStore.onRehydrateStorage",
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        if (!state) {
          return;
        }

        const normalizedInterval = clampRefreshInterval(
          state.refreshIntervalMinutes,
        );
        if (normalizedInterval !== state.refreshIntervalMinutes) {
          state.refreshIntervalMinutes = normalizedInterval;
        }

        // Ensure oledEnabled is properly initialized
        if (typeof state.oledEnabled !== "boolean") {
          state.oledEnabled = false;
        }

        // Normalize jellyseerr retry attempts
        if (typeof state.jellyseerrRetryAttempts === "undefined") {
          state.jellyseerrRetryAttempts = DEFAULT_JELLYSEERR_RETRY_ATTEMPTS;
        } else {
          const normalizedRetries = clampRetryAttempts(
            state.jellyseerrRetryAttempts,
          );
          if (normalizedRetries !== state.jellyseerrRetryAttempts) {
            state.jellyseerrRetryAttempts = normalizedRetries;
          }
        }

        // thumbnail rehydration removed

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
        (
          Object.keys(baseDefaults.quietHours) as NotificationCategory[]
        ).forEach((category) => {
          if (!state.quietHours[category]) {
            state.quietHours[category] = baseDefaults.quietHours[category];
          }
        });

        if (typeof state.tmdbEnabled !== "boolean") {
          state.tmdbEnabled = baseDefaults.tmdbEnabled;
        }

        // Normalize max image cache size
        if (typeof state.maxImageCacheSize !== "number") {
          state.maxImageCacheSize = baseDefaults.maxImageCacheSize;
        } else {
          const normalizedSize = clampMaxImageCacheSize(
            state.maxImageCacheSize,
          );
          if (normalizedSize !== state.maxImageCacheSize) {
            state.maxImageCacheSize = normalizedSize;
          }
        }

        // Ensure we have a valid log level and apply it to the logger
        if (typeof state.logLevel === "undefined") {
          state.logLevel = baseDefaults.logLevel;
        }
        try {
          logger.setMinimumLevel(state.logLevel);
        } catch {
          // don't crash on logger wiring
        }

        // Ensure frostedWidgetsEnabled is properly initialized
        if (typeof state.frostedWidgetsEnabled !== "boolean") {
          state.frostedWidgetsEnabled = false;
        }

        // Ensure gradientBackgroundEnabled is properly initialized
        if (typeof state.gradientBackgroundEnabled !== "boolean") {
          state.gradientBackgroundEnabled = true;
        }

        // Ensure trailerFeatureEnabled is properly initialized
        if (typeof state.trailerFeatureEnabled !== "boolean") {
          state.trailerFeatureEnabled = false;
        }

        if (state.lastCalendarRange) {
          const { start, end } = state.lastCalendarRange;
          const startDate = start ? new Date(start) : undefined;
          const endDate = end ? new Date(end) : undefined;

          const isValidDate = (date?: Date) =>
            Boolean(date) && !Number.isNaN(date!.getTime());

          if (!isValidDate(startDate) || !isValidDate(endDate)) {
            state.lastCalendarRange = undefined;
          } else if (startDate!.getTime() > endDate!.getTime()) {
            state.lastCalendarRange = {
              start: end,
              end: start,
            };
          }
        }

        // Mark as hydrated
        state._hasHydrated = true;
      },
      migrate: (persistedState) => {
        if (!persistedState) {
          return createDefaultSettings();
        }

        const partial = persistedState as Partial<SettingsData>;
        const baseDefaults = createDefaultSettings();

        const quietHours = (
          Object.keys(baseDefaults.quietHours) as NotificationCategory[]
        ).reduce(
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
            partial.refreshIntervalMinutes ??
              baseDefaults.refreshIntervalMinutes,
          ),
          oledEnabled: partial.oledEnabled ?? baseDefaults.oledEnabled,
          jellyseerrRetryAttempts: clampRetryAttempts(
            partial.jellyseerrRetryAttempts ??
              baseDefaults.jellyseerrRetryAttempts,
          ),
          tmdbEnabled: partial.tmdbEnabled ?? baseDefaults.tmdbEnabled,
          maxImageCacheSize: clampMaxImageCacheSize(
            partial.maxImageCacheSize ?? baseDefaults.maxImageCacheSize,
          ),
          logLevel: (partial.logLevel as LogLevel) ?? baseDefaults.logLevel,
          // thumbnail migration removed
          quietHours,
          criticalHealthAlertsBypassQuietHours:
            partial.criticalHealthAlertsBypassQuietHours ??
            baseDefaults.criticalHealthAlertsBypassQuietHours,
          preferredJellyseerrServiceId:
            partial.preferredJellyseerrServiceId ?? undefined,
          recentActivitySourceServiceIds:
            partial.recentActivitySourceServiceIds ?? undefined,
          preferredRecentActivityServiceId:
            partial.preferredRecentActivityServiceId ?? undefined,
          lastReleaseNotesCheckedAt:
            partial.lastReleaseNotesCheckedAt ?? undefined,
          lastCalendarRange:
            partial.lastCalendarRange ?? baseDefaults.lastCalendarRange,
          frostedWidgetsEnabled:
            partial.frostedWidgetsEnabled ?? baseDefaults.frostedWidgetsEnabled,
          gradientBackgroundEnabled:
            partial.gradientBackgroundEnabled ??
            baseDefaults.gradientBackgroundEnabled,
          loaderConfig: partial.loaderConfig ?? baseDefaults.loaderConfig,
          trailerFeatureEnabled:
            partial.trailerFeatureEnabled ?? baseDefaults.trailerFeatureEnabled,
          byokGeocodeMapsCoApiKey: partial.byokGeocodeMapsCoApiKey ?? undefined,
          _hasHydrated: true,
        } satisfies SettingsData;
      },
    },
  ),
);
export const selectThemePreference = (state: SettingsState): ThemePreference =>
  state.theme;
export const selectCustomThemeConfig = (
  state: SettingsState,
): CustomThemeConfig => state.customThemeConfig;
export const selectNotificationsEnabled = (state: SettingsState): boolean =>
  state.notificationsEnabled;
export const selectReleaseNotificationsEnabled = (
  state: SettingsState,
): boolean => state.releaseNotificationsEnabled;
export const selectDownloadNotificationsEnabled = (
  state: SettingsState,
): boolean => state.downloadNotificationsEnabled;
export const selectFailedDownloadNotificationsEnabled = (
  state: SettingsState,
): boolean => state.failedDownloadNotificationsEnabled;
export const selectRequestNotificationsEnabled = (
  state: SettingsState,
): boolean => state.requestNotificationsEnabled;
export const selectServiceHealthNotificationsEnabled = (
  state: SettingsState,
): boolean => state.serviceHealthNotificationsEnabled;
export const selectRefreshIntervalMinutes = (state: SettingsState): number =>
  state.refreshIntervalMinutes;
export const selectJellyseerrRetryAttempts = (state: SettingsState): number =>
  state.jellyseerrRetryAttempts;
export const selectQuietHours = (
  state: SettingsState,
): Record<NotificationCategory, QuietHoursConfig> => state.quietHours;
export const selectQuietHoursForCategory =
  (category: NotificationCategory) =>
  (state: SettingsState): QuietHoursConfig =>
    state.quietHours[category] ?? createDefaultQuietHoursState()[category];
export const selectCriticalHealthAlertsBypassQuietHours = (
  state: SettingsState,
): boolean => state.criticalHealthAlertsBypassQuietHours;

export const selectLastCalendarView = (state: SettingsState) =>
  state.lastCalendarView;
export const selectLastCalendarRange = (state: SettingsState) =>
  state.lastCalendarRange;
export const selectHasHydrated = (state: SettingsState) => state._hasHydrated;
export const selectJellyfinLocalAddress = (state: SettingsState) =>
  state.jellyfinLocalAddress;
export const selectJellyfinPublicAddress = (state: SettingsState) =>
  state.jellyfinPublicAddress;
export const selectPreferredJellyseerrServiceId = (state: SettingsState) =>
  state.preferredJellyseerrServiceId;
export const selectRecentActivitySourceServiceIds = (state: SettingsState) =>
  state.recentActivitySourceServiceIds;
export const selectPreferredRecentActivityServiceId = (state: SettingsState) =>
  state.preferredRecentActivityServiceId;
export const selectFrostedWidgetsEnabled = (state: SettingsState): boolean =>
  state.frostedWidgetsEnabled;
export const selectGradientBackgroundEnabled = (
  state: SettingsState,
): boolean => state.gradientBackgroundEnabled;
export const selectTrailerFeatureEnabled = (state: SettingsState): boolean =>
  state.trailerFeatureEnabled;
export const selectLoaderConfig = (state: SettingsState) => state.loaderConfig;
