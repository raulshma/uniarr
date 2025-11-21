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
  // Jellyfin player configuration
  jellyfinPlayerAutoPlay: boolean;
  jellyfinPlayerDefaultSubtitleLanguage?: string;
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
  // Experimental: animated weather background effects on dashboard
  experimentalWeatherEffectsEnabled: boolean;
  // API Logger configuration
  apiLoggerEnabled: boolean; // Error logging toggle (legacy behavior)
  apiLoggerActivePreset: string; // "CRITICAL", "SERVER", "RATE_LIMIT", "CLIENT_ERRORS", "STRICT", "CUSTOM"
  apiLoggerCustomCodes: (number | string)[]; // Used when preset is CUSTOM
  apiLoggerRetentionDays: number; // How many days to keep error logs (default: 7)
  apiLoggerCaptureRequestBody: boolean; // Capture request body in error logs (default: false)
  apiLoggerCaptureResponseBody: boolean; // Capture response body in error logs (default: false)
  apiLoggerCaptureRequestHeaders: boolean; // Capture request headers in error logs (default: false)
  apiLoggerAiLoggingEnabled: boolean; // Capture AI API calls
  apiLoggerAiCapturePrompt: boolean; // Capture prompts for AI logs
  apiLoggerAiCaptureResponse: boolean; // Capture AI responses
  apiLoggerAiCaptureMetadata: boolean; // Capture token usage / metadata
  apiLoggerAiRetentionDays: number; // How many days to keep AI logs (default: 14)
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
  // S3 Backup Configuration
  s3BackupEnabled: boolean;
  s3BucketName?: string;
  s3Region?: string;
  s3CustomEndpoint?: string; // Custom S3-compatible endpoint (e.g., MinIO, Wasabi)
  s3ForcePathStyle?: boolean; // Use path-style URLs for S3-compatible services
  s3AutoBackupEnabled: boolean;
  s3AutoBackupFrequency?: "daily" | "weekly" | "monthly";
  s3LastAutoBackupTimestamp?: string; // ISO timestamp of last automatic backup
  s3DeleteLocalAfterUpload: boolean;
  // AI Features toggles
  enableAISearch: boolean;
  enableAIRecommendations: boolean;
  // Recommendation preferences
  recommendationIncludeHiddenGems: boolean;
  recommendationLimit: number; // 3-10
  recommendationExcludedGenres: string[];
  recommendationContentRatingLimit?: string;
  recommendationCacheDurationHours: number; // 1-168 (1 week)
  recommendationBackgroundUpdatesEnabled: boolean;
  // Recommendation engine provider/model selection
  recommendationProvider?: string; // AIProviderType
  recommendationModel?: string;
  recommendationKeyId?: string;
  // Default dashboard preference
  defaultDashboard: "main" | "widgets";
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
  setJellyfinPlayerAutoPlay: (enabled: boolean) => void;
  setJellyfinPlayerDefaultSubtitleLanguage: (
    language: string | undefined,
  ) => void;
  setPreferredJellyseerrServiceId: (serviceId: string | undefined) => void;
  setRecentActivitySourceServiceIds: (ids: string[] | undefined) => void;
  setPreferredRecentActivityServiceId: (serviceId: string | undefined) => void;
  setLastReleaseNotesCheckedAt: (timestamp: string | undefined) => void;
  setFrostedWidgetsEnabled: (enabled: boolean) => void;
  setGradientBackgroundEnabled: (enabled: boolean) => void;
  setExperimentalWeatherEffectsEnabled: (enabled: boolean) => void;
  setApiLoggerEnabled: (enabled: boolean) => void;
  setApiLoggerActivePreset: (preset: string) => void;
  setApiLoggerCustomCodes: (codes: (number | string)[]) => void;
  setApiLoggerRetentionDays: (days: number) => void;
  setApiLoggerCaptureRequestBody: (capture: boolean) => void;
  setApiLoggerCaptureResponseBody: (capture: boolean) => void;
  setApiLoggerCaptureRequestHeaders: (capture: boolean) => void;
  setApiLoggerAiLoggingEnabled: (enabled: boolean) => void;
  setApiLoggerAiCapturePrompt: (capture: boolean) => void;
  setApiLoggerAiCaptureResponse: (capture: boolean) => void;
  setApiLoggerAiCaptureMetadata: (capture: boolean) => void;
  setApiLoggerAiRetentionDays: (days: number) => void;
  setLoaderConfig: (config: LoaderConfig) => void;
  // (thumbnail setters removed)
  // Backdrop with blur experimental feature
  setBackdropWithBlurEnabled: (enabled: boolean) => void;
  setTrailerFeatureEnabled: (enabled: boolean) => void;
  setDiscoverBannerDismissed: (dismissed: boolean) => void;
  setAnimeHubBannerDismissed: (dismissed: boolean) => void;
  setByokGeocodeMapsCoApiKey: (apiKey: string | undefined) => void;
  setS3BackupEnabled: (enabled: boolean) => void;
  setS3BucketName: (bucketName: string | undefined) => void;
  setS3Region: (region: string | undefined) => void;
  setS3CustomEndpoint: (endpoint: string | undefined) => void;
  setS3ForcePathStyle: (enabled: boolean) => void;
  setS3AutoBackupEnabled: (enabled: boolean) => void;
  setS3AutoBackupFrequency: (
    frequency: "daily" | "weekly" | "monthly" | undefined,
  ) => void;
  setS3LastAutoBackupTimestamp: (timestamp: string | undefined) => void;
  setS3DeleteLocalAfterUpload: (enabled: boolean) => void;
  setEnableAISearch: (enabled: boolean) => void;
  setEnableAIRecommendations: (enabled: boolean) => void;
  setRecommendationIncludeHiddenGems: (enabled: boolean) => void;
  setRecommendationLimit: (limit: number) => void;
  setRecommendationExcludedGenres: (genres: string[]) => void;
  setRecommendationContentRatingLimit: (limit: string | undefined) => void;
  setRecommendationCacheDurationHours: (hours: number) => void;
  setRecommendationBackgroundUpdatesEnabled: (enabled: boolean) => void;
  setRecommendationProvider: (provider: string | undefined) => void;
  setRecommendationModel: (model: string | undefined) => void;
  setRecommendationKeyId: (keyId: string | undefined) => void;
  setDefaultDashboard: (dashboard: "main" | "widgets") => void;
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

// Recommendation settings constants
const DEFAULT_RECOMMENDATION_LIMIT = 5;
const MIN_RECOMMENDATION_LIMIT = 3;
const MAX_RECOMMENDATION_LIMIT = 10;
const DEFAULT_RECOMMENDATION_CACHE_DURATION_HOURS = 24;
const MIN_RECOMMENDATION_CACHE_DURATION_HOURS = 1;
const MAX_RECOMMENDATION_CACHE_DURATION_HOURS = 168; // 1 week

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

const clampRecommendationLimit = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_RECOMMENDATION_LIMIT;
  return Math.min(
    Math.max(Math.round(value), MIN_RECOMMENDATION_LIMIT),
    MAX_RECOMMENDATION_LIMIT,
  );
};

const clampRecommendationCacheDuration = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_RECOMMENDATION_CACHE_DURATION_HOURS;
  return Math.min(
    Math.max(Math.round(value), MIN_RECOMMENDATION_CACHE_DURATION_HOURS),
    MAX_RECOMMENDATION_CACHE_DURATION_HOURS,
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
  jellyfinPlayerAutoPlay: false,
  jellyfinPlayerDefaultSubtitleLanguage: undefined,
  preferredJellyseerrServiceId: undefined,
  recentActivitySourceServiceIds: undefined,
  preferredRecentActivityServiceId: undefined,
  lastReleaseNotesCheckedAt: undefined,
  frostedWidgetsEnabled: false,
  gradientBackgroundEnabled: false,
  experimentalWeatherEffectsEnabled: false,
  apiLoggerEnabled: false,
  apiLoggerActivePreset: "CRITICAL",
  apiLoggerCustomCodes: [],
  apiLoggerRetentionDays: 7,
  apiLoggerCaptureRequestBody: false,
  apiLoggerCaptureResponseBody: false,
  apiLoggerCaptureRequestHeaders: false,
  apiLoggerAiLoggingEnabled: false,
  apiLoggerAiCapturePrompt: false,
  apiLoggerAiCaptureResponse: false,
  apiLoggerAiCaptureMetadata: true,
  apiLoggerAiRetentionDays: 14,
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
  s3BackupEnabled: false,
  s3BucketName: undefined,
  s3Region: undefined,
  s3CustomEndpoint: undefined,
  s3ForcePathStyle: false,
  s3AutoBackupEnabled: false,
  s3AutoBackupFrequency: undefined,
  s3LastAutoBackupTimestamp: undefined,
  s3DeleteLocalAfterUpload: false,
  enableAISearch: false,
  enableAIRecommendations: false,
  recommendationIncludeHiddenGems: true,
  recommendationLimit: DEFAULT_RECOMMENDATION_LIMIT,
  recommendationExcludedGenres: [],
  recommendationContentRatingLimit: undefined,
  recommendationCacheDurationHours: DEFAULT_RECOMMENDATION_CACHE_DURATION_HOURS,
  recommendationBackgroundUpdatesEnabled: false,
  recommendationProvider: undefined,
  recommendationModel: undefined,
  recommendationKeyId: undefined,
  defaultDashboard: "main",
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
      setJellyfinPlayerAutoPlay: (enabled: boolean) =>
        set({ jellyfinPlayerAutoPlay: enabled }),
      setJellyfinPlayerDefaultSubtitleLanguage: (
        language: string | undefined,
      ) => set({ jellyfinPlayerDefaultSubtitleLanguage: language }),
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
      setExperimentalWeatherEffectsEnabled: (enabled: boolean) =>
        set({ experimentalWeatherEffectsEnabled: enabled }),
      setApiLoggerEnabled: (enabled: boolean) =>
        set({ apiLoggerEnabled: enabled }),
      setApiLoggerActivePreset: (preset: string) =>
        set({ apiLoggerActivePreset: preset }),
      setApiLoggerCustomCodes: (codes: (number | string)[]) =>
        set({ apiLoggerCustomCodes: codes }),
      setApiLoggerRetentionDays: (days: number) =>
        set({ apiLoggerRetentionDays: Math.max(1, Math.min(365, days)) }),
      setApiLoggerCaptureRequestBody: (capture: boolean) =>
        set({ apiLoggerCaptureRequestBody: capture }),
      setApiLoggerCaptureResponseBody: (capture: boolean) =>
        set({ apiLoggerCaptureResponseBody: capture }),
      setApiLoggerCaptureRequestHeaders: (capture: boolean) =>
        set({ apiLoggerCaptureRequestHeaders: capture }),
      setApiLoggerAiLoggingEnabled: (enabled: boolean) =>
        set({ apiLoggerAiLoggingEnabled: enabled }),
      setApiLoggerAiCapturePrompt: (capture: boolean) =>
        set({ apiLoggerAiCapturePrompt: capture }),
      setApiLoggerAiCaptureResponse: (capture: boolean) =>
        set({ apiLoggerAiCaptureResponse: capture }),
      setApiLoggerAiCaptureMetadata: (capture: boolean) =>
        set({ apiLoggerAiCaptureMetadata: capture }),
      setApiLoggerAiRetentionDays: (days: number) =>
        set({ apiLoggerAiRetentionDays: Math.max(1, Math.min(365, days)) }),
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
      setS3BackupEnabled: (enabled: boolean) =>
        set({ s3BackupEnabled: enabled }),
      setS3BucketName: (bucketName: string | undefined) =>
        set({ s3BucketName: bucketName }),
      setS3Region: (region: string | undefined) => set({ s3Region: region }),
      setS3CustomEndpoint: (endpoint: string | undefined) =>
        set({ s3CustomEndpoint: endpoint }),
      setS3ForcePathStyle: (enabled: boolean) =>
        set({ s3ForcePathStyle: enabled }),
      setS3AutoBackupEnabled: (enabled: boolean) =>
        set({ s3AutoBackupEnabled: enabled }),
      setS3AutoBackupFrequency: (
        frequency: "daily" | "weekly" | "monthly" | undefined,
      ) => set({ s3AutoBackupFrequency: frequency }),
      setS3LastAutoBackupTimestamp: (timestamp: string | undefined) =>
        set({ s3LastAutoBackupTimestamp: timestamp }),
      setS3DeleteLocalAfterUpload: (enabled: boolean) =>
        set({ s3DeleteLocalAfterUpload: enabled }),
      setEnableAISearch: (enabled: boolean) => set({ enableAISearch: enabled }),
      setEnableAIRecommendations: (enabled: boolean) =>
        set({ enableAIRecommendations: enabled }),
      setRecommendationIncludeHiddenGems: (enabled: boolean) =>
        set({ recommendationIncludeHiddenGems: enabled }),
      setRecommendationLimit: (limit: number) =>
        set({ recommendationLimit: clampRecommendationLimit(limit) }),
      setRecommendationExcludedGenres: (genres: string[]) =>
        set({ recommendationExcludedGenres: genres }),
      setRecommendationContentRatingLimit: (limit: string | undefined) =>
        set({ recommendationContentRatingLimit: limit }),
      setRecommendationCacheDurationHours: (hours: number) =>
        set({
          recommendationCacheDurationHours:
            clampRecommendationCacheDuration(hours),
        }),
      setRecommendationBackgroundUpdatesEnabled: (enabled: boolean) =>
        set({ recommendationBackgroundUpdatesEnabled: enabled }),
      setRecommendationProvider: (provider: string | undefined) =>
        set({ recommendationProvider: provider }),
      setRecommendationModel: (model: string | undefined) =>
        set({ recommendationModel: model }),
      setRecommendationKeyId: (keyId: string | undefined) =>
        set({ recommendationKeyId: keyId }),
      setDefaultDashboard: (dashboard: "main" | "widgets") =>
        set({ defaultDashboard: dashboard }),
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
        jellyfinPlayerAutoPlay: state.jellyfinPlayerAutoPlay,
        jellyfinPlayerDefaultSubtitleLanguage:
          state.jellyfinPlayerDefaultSubtitleLanguage,
        preferredJellyseerrServiceId: state.preferredJellyseerrServiceId,
        recentActivitySourceServiceIds: state.recentActivitySourceServiceIds,
        preferredRecentActivityServiceId:
          state.preferredRecentActivityServiceId,
        lastReleaseNotesCheckedAt: state.lastReleaseNotesCheckedAt,
        frostedWidgetsEnabled: state.frostedWidgetsEnabled,
        gradientBackgroundEnabled: state.gradientBackgroundEnabled,
        experimentalWeatherEffectsEnabled:
          state.experimentalWeatherEffectsEnabled,
        apiLoggerEnabled: state.apiLoggerEnabled,
        apiLoggerActivePreset: state.apiLoggerActivePreset,
        apiLoggerCustomCodes: state.apiLoggerCustomCodes,
        apiLoggerRetentionDays: state.apiLoggerRetentionDays,
        apiLoggerCaptureRequestBody: state.apiLoggerCaptureRequestBody,
        apiLoggerCaptureResponseBody: state.apiLoggerCaptureResponseBody,
        apiLoggerCaptureRequestHeaders: state.apiLoggerCaptureRequestHeaders,
        apiLoggerAiLoggingEnabled: state.apiLoggerAiLoggingEnabled,
        apiLoggerAiCapturePrompt: state.apiLoggerAiCapturePrompt,
        apiLoggerAiCaptureResponse: state.apiLoggerAiCaptureResponse,
        apiLoggerAiCaptureMetadata: state.apiLoggerAiCaptureMetadata,
        apiLoggerAiRetentionDays: state.apiLoggerAiRetentionDays,
        loaderConfig: state.loaderConfig,
        // thumbnail fields removed
        enableBackdropWithBlur: state.enableBackdropWithBlur,
        trailerFeatureEnabled: state.trailerFeatureEnabled,
        discoverBannerDismissed: state.discoverBannerDismissed,
        animeHubBannerDismissed: state.animeHubBannerDismissed,
        byokGeocodeMapsCoApiKey: state.byokGeocodeMapsCoApiKey,
        s3BackupEnabled: state.s3BackupEnabled,
        s3BucketName: state.s3BucketName,
        s3Region: state.s3Region,
        s3CustomEndpoint: state.s3CustomEndpoint,
        s3ForcePathStyle: state.s3ForcePathStyle,
        s3AutoBackupEnabled: state.s3AutoBackupEnabled,
        s3AutoBackupFrequency: state.s3AutoBackupFrequency,
        s3LastAutoBackupTimestamp: state.s3LastAutoBackupTimestamp,
        s3DeleteLocalAfterUpload: state.s3DeleteLocalAfterUpload,
        enableAISearch: state.enableAISearch,
        enableAIRecommendations: state.enableAIRecommendations,
        recommendationIncludeHiddenGems: state.recommendationIncludeHiddenGems,
        recommendationLimit: state.recommendationLimit,
        recommendationExcludedGenres: state.recommendationExcludedGenres,
        recommendationContentRatingLimit:
          state.recommendationContentRatingLimit,
        recommendationCacheDurationHours:
          state.recommendationCacheDurationHours,
        recommendationBackgroundUpdatesEnabled:
          state.recommendationBackgroundUpdatesEnabled,
        recommendationProvider: state.recommendationProvider,
        recommendationModel: state.recommendationModel,
        recommendationKeyId: state.recommendationKeyId,
        defaultDashboard: state.defaultDashboard,
      }),
      // Bump version since we're adding new persisted fields
      version: 21,
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

        // Ensure experimentalWeatherEffectsEnabled is properly initialized
        if (typeof state.experimentalWeatherEffectsEnabled !== "boolean") {
          state.experimentalWeatherEffectsEnabled = false;
        }

        // Ensure trailerFeatureEnabled is properly initialized
        if (typeof state.trailerFeatureEnabled !== "boolean") {
          state.trailerFeatureEnabled = false;
        }

        // Ensure recommendation preferences are properly initialized
        if (typeof state.recommendationIncludeHiddenGems !== "boolean") {
          state.recommendationIncludeHiddenGems = true;
        }
        if (typeof state.recommendationLimit !== "number") {
          state.recommendationLimit = DEFAULT_RECOMMENDATION_LIMIT;
        } else {
          const normalizedLimit = clampRecommendationLimit(
            state.recommendationLimit,
          );
          if (normalizedLimit !== state.recommendationLimit) {
            state.recommendationLimit = normalizedLimit;
          }
        }
        if (!Array.isArray(state.recommendationExcludedGenres)) {
          state.recommendationExcludedGenres = [];
        }
        if (typeof state.recommendationCacheDurationHours !== "number") {
          state.recommendationCacheDurationHours =
            DEFAULT_RECOMMENDATION_CACHE_DURATION_HOURS;
        } else {
          const normalizedDuration = clampRecommendationCacheDuration(
            state.recommendationCacheDurationHours,
          );
          if (normalizedDuration !== state.recommendationCacheDurationHours) {
            state.recommendationCacheDurationHours = normalizedDuration;
          }
        }
        if (typeof state.recommendationBackgroundUpdatesEnabled !== "boolean") {
          state.recommendationBackgroundUpdatesEnabled = false;
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
        const legacy = persistedState as Record<string, unknown>;
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
          experimentalWeatherEffectsEnabled:
            partial.experimentalWeatherEffectsEnabled ??
            baseDefaults.experimentalWeatherEffectsEnabled,
          loaderConfig: partial.loaderConfig ?? baseDefaults.loaderConfig,
          trailerFeatureEnabled:
            partial.trailerFeatureEnabled ?? baseDefaults.trailerFeatureEnabled,
          apiLoggerEnabled:
            (partial as Partial<SettingsData>).apiLoggerEnabled ??
            (legacy.apiErrorLoggerEnabled as boolean | undefined) ??
            baseDefaults.apiLoggerEnabled,
          apiLoggerActivePreset:
            (partial as Partial<SettingsData>).apiLoggerActivePreset ??
            (legacy.apiErrorLoggerActivePreset as string | undefined) ??
            baseDefaults.apiLoggerActivePreset,
          apiLoggerCustomCodes: Array.isArray(partial.apiLoggerCustomCodes)
            ? partial.apiLoggerCustomCodes
            : Array.isArray(legacy.apiErrorLoggerCustomCodes as unknown[])
              ? (legacy.apiErrorLoggerCustomCodes as (number | string)[])
              : baseDefaults.apiLoggerCustomCodes,
          apiLoggerRetentionDays: Math.max(
            1,
            Math.min(
              365,
              typeof partial.apiLoggerRetentionDays === "number"
                ? partial.apiLoggerRetentionDays
                : typeof legacy.apiErrorLoggerRetentionDays === "number"
                  ? (legacy.apiErrorLoggerRetentionDays as number)
                  : baseDefaults.apiLoggerRetentionDays,
            ),
          ),
          apiLoggerCaptureRequestBody:
            typeof partial.apiLoggerCaptureRequestBody === "boolean"
              ? partial.apiLoggerCaptureRequestBody
              : typeof legacy.apiErrorLoggerCaptureRequestBody === "boolean"
                ? (legacy.apiErrorLoggerCaptureRequestBody as boolean)
                : baseDefaults.apiLoggerCaptureRequestBody,
          apiLoggerCaptureResponseBody:
            typeof partial.apiLoggerCaptureResponseBody === "boolean"
              ? partial.apiLoggerCaptureResponseBody
              : typeof legacy.apiErrorLoggerCaptureResponseBody === "boolean"
                ? (legacy.apiErrorLoggerCaptureResponseBody as boolean)
                : baseDefaults.apiLoggerCaptureResponseBody,
          apiLoggerCaptureRequestHeaders:
            typeof partial.apiLoggerCaptureRequestHeaders === "boolean"
              ? partial.apiLoggerCaptureRequestHeaders
              : typeof legacy.apiErrorLoggerCaptureRequestHeaders === "boolean"
                ? (legacy.apiErrorLoggerCaptureRequestHeaders as boolean)
                : baseDefaults.apiLoggerCaptureRequestHeaders,
          apiLoggerAiLoggingEnabled:
            typeof partial.apiLoggerAiLoggingEnabled === "boolean"
              ? partial.apiLoggerAiLoggingEnabled
              : baseDefaults.apiLoggerAiLoggingEnabled,
          apiLoggerAiCapturePrompt:
            typeof partial.apiLoggerAiCapturePrompt === "boolean"
              ? partial.apiLoggerAiCapturePrompt
              : baseDefaults.apiLoggerAiCapturePrompt,
          apiLoggerAiCaptureResponse:
            typeof partial.apiLoggerAiCaptureResponse === "boolean"
              ? partial.apiLoggerAiCaptureResponse
              : baseDefaults.apiLoggerAiCaptureResponse,
          apiLoggerAiCaptureMetadata:
            typeof partial.apiLoggerAiCaptureMetadata === "boolean"
              ? partial.apiLoggerAiCaptureMetadata
              : baseDefaults.apiLoggerAiCaptureMetadata,
          apiLoggerAiRetentionDays: Math.max(
            1,
            Math.min(
              365,
              typeof partial.apiLoggerAiRetentionDays === "number"
                ? partial.apiLoggerAiRetentionDays
                : baseDefaults.apiLoggerAiRetentionDays,
            ),
          ),
          byokGeocodeMapsCoApiKey: partial.byokGeocodeMapsCoApiKey ?? undefined,
          s3BackupEnabled:
            partial.s3BackupEnabled ?? baseDefaults.s3BackupEnabled,
          s3BucketName: partial.s3BucketName ?? undefined,
          s3Region: partial.s3Region ?? undefined,
          s3AutoBackupEnabled:
            partial.s3AutoBackupEnabled ?? baseDefaults.s3AutoBackupEnabled,
          s3AutoBackupFrequency: partial.s3AutoBackupFrequency ?? undefined,
          s3LastAutoBackupTimestamp:
            partial.s3LastAutoBackupTimestamp ?? undefined,
          s3DeleteLocalAfterUpload:
            partial.s3DeleteLocalAfterUpload ??
            baseDefaults.s3DeleteLocalAfterUpload,
          recommendationIncludeHiddenGems:
            typeof partial.recommendationIncludeHiddenGems === "boolean"
              ? partial.recommendationIncludeHiddenGems
              : baseDefaults.recommendationIncludeHiddenGems,
          recommendationLimit: clampRecommendationLimit(
            typeof partial.recommendationLimit === "number"
              ? partial.recommendationLimit
              : baseDefaults.recommendationLimit,
          ),
          recommendationExcludedGenres: Array.isArray(
            partial.recommendationExcludedGenres,
          )
            ? partial.recommendationExcludedGenres
            : baseDefaults.recommendationExcludedGenres,
          recommendationContentRatingLimit:
            partial.recommendationContentRatingLimit ?? undefined,
          recommendationCacheDurationHours: clampRecommendationCacheDuration(
            typeof partial.recommendationCacheDurationHours === "number"
              ? partial.recommendationCacheDurationHours
              : baseDefaults.recommendationCacheDurationHours,
          ),
          recommendationBackgroundUpdatesEnabled:
            typeof partial.recommendationBackgroundUpdatesEnabled === "boolean"
              ? partial.recommendationBackgroundUpdatesEnabled
              : baseDefaults.recommendationBackgroundUpdatesEnabled,
          recommendationProvider: partial.recommendationProvider ?? undefined,
          recommendationModel: partial.recommendationModel ?? undefined,
          recommendationKeyId: partial.recommendationKeyId ?? undefined,
          defaultDashboard:
            partial.defaultDashboard ?? baseDefaults.defaultDashboard,
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
export const selectJellyfinPlayerAutoPlay = (state: SettingsState): boolean =>
  state.jellyfinPlayerAutoPlay;
export const selectJellyfinPlayerDefaultSubtitleLanguage = (
  state: SettingsState,
): string | undefined => state.jellyfinPlayerDefaultSubtitleLanguage;
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
export const selectExperimentalWeatherEffectsEnabled = (
  state: SettingsState,
): boolean => state.experimentalWeatherEffectsEnabled;
export const selectTrailerFeatureEnabled = (state: SettingsState): boolean =>
  state.trailerFeatureEnabled;
export const selectLoaderConfig = (state: SettingsState) => state.loaderConfig;
export const selectRecommendationIncludeHiddenGems = (
  state: SettingsState,
): boolean => state.recommendationIncludeHiddenGems;
export const selectRecommendationLimit = (state: SettingsState): number =>
  state.recommendationLimit;
export const selectRecommendationExcludedGenres = (
  state: SettingsState,
): string[] => state.recommendationExcludedGenres;
export const selectRecommendationContentRatingLimit = (
  state: SettingsState,
): string | undefined => state.recommendationContentRatingLimit;
export const selectRecommendationCacheDurationHours = (
  state: SettingsState,
): number => state.recommendationCacheDurationHours;
export const selectRecommendationBackgroundUpdatesEnabled = (
  state: SettingsState,
): boolean => state.recommendationBackgroundUpdatesEnabled;
export const selectRecommendationProvider = (
  state: SettingsState,
): string | undefined => state.recommendationProvider;
export const selectRecommendationModel = (
  state: SettingsState,
): string | undefined => state.recommendationModel;
export const selectRecommendationKeyId = (
  state: SettingsState,
): string | undefined => state.recommendationKeyId;
export const selectDefaultDashboard = (
  state: SettingsState,
): "main" | "widgets" => state.defaultDashboard;
