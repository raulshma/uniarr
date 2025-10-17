import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, Dimensions, TouchableOpacity } from "react-native";
import type { ViewStyle } from "react-native";
import { alert } from "@/services/dialogService";
import { Text, useTheme, IconButton, Modal, Portal } from "react-native-paper";

import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedHeader,
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common";

import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { MediaPoster } from "@/components/media/MediaPoster";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
// Unified search has been moved to its own page. Navigate to the search route from the dashboard.
import type { ServiceStatusState } from "@/components/service/ServiceStatus";
import type { ConnectionResult } from "@/connectors/base/IConnector";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { queryKeys } from "@/hooks/queryKeys";
import type { AppTheme } from "@/constants/theme";
import type { ServiceConfig, ServiceType } from "@/models/service.types";
import { secureStorage } from "@/services/storage/SecureStorage";
import { spacing } from "@/theme/spacing";

// Memoize manager initialization to prevent multiple loadSavedServices calls
let managerInitPromise: Promise<ConnectorManager> | null = null;
const getInitializedManager = async (): Promise<ConnectorManager> => {
  if (!managerInitPromise) {
    managerInitPromise = (async () => {
      const manager = ConnectorManager.getInstance();
      await manager.loadSavedServices();
      return manager;
    })();
  }
  return managerInitPromise;
};

type ServiceOverviewItem = {
  config: ServiceConfig;
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date;
  latency?: number;
  version?: string;
};

// SummaryMetrics removed — unused in this file

type StatisticsData = {
  shows: number;
  movies: number;
  episodes: number;
  watched: number;
};

type RecentActivityItem = {
  id: string;
  title: string;
  episode: string;
  show: string;
  date: string;
  image?: string;
};

type ContinueWatchingItem = {
  id: string;
  title: string;
  type: "movie" | "episode";
  show?: string;
  season?: number;
  episode?: number;
  progress: number; // 0-100
  duration: number; // in minutes
  watchedMinutes: number;
  posterUri?: string;
  nextEpisodeAvailable?: boolean;
};

type TrendingTVItem = {
  id: string;
  title: string;
  year?: number;
  rating?: number;
  posterUri?: string;
  tmdbId?: number;
  tvdbId?: number;
  overview?: string;
  popularity?: number;
};

type UpcomingReleaseItem = {
  id: string;
  title: string;
  type: "movie" | "episode";
  releaseDate: string;
  posterUri?: string;
  show?: string;
  season?: number;
  episode?: number;
  monitored?: boolean;
};

type DashboardListItem =
  | { type: "header" }
  | { type: "welcome-section" }
  | { type: "shortcuts" }
  | { type: "services-grid"; data: ServiceOverviewItem[] }
  | { type: "statistics"; data: StatisticsData }
  | { type: "continue-watching"; data: ContinueWatchingItem[] }
  | { type: "continue-watching-loading" }
  | { type: "trending-tv"; data: TrendingTVItem[] }
  | { type: "trending-tv-loading" }
  | { type: "upcoming-releases"; data: UpcomingReleaseItem[] }
  | { type: "upcoming-releases-loading" }
  | { type: "recent-activity-header" }
  | { type: "recent-activity"; data: RecentActivityItem[] }
  | { type: "activity" }
  | { type: "empty" };

const serviceTypeLabels: Record<ServiceType, string> = {
  sonarr: "Sonarr",
  radarr: "Radarr",
  jellyseerr: "Jellyseerr",
  jellyfin: "Jellyfin",
  qbittorrent: "qBittorrent",
  transmission: "Transmission",
  deluge: "Deluge",
  sabnzbd: "SABnzbd",
  nzbget: "NZBGet",
  rtorrent: "rTorrent",
  prowlarr: "Prowlarr",
  bazarr: "Bazarr",
};

const deriveStatus = (
  config: ServiceConfig,
  result: ConnectionResult | undefined,
  checkedAt: Date,
): Pick<
  ServiceOverviewItem,
  "status" | "statusDescription" | "lastCheckedAt" | "latency" | "version"
> => {
  if (!config.enabled) {
    return {
      status: "offline",
      statusDescription: "Service disabled",
    };
  }

  if (!result) {
    return {
      status: "offline",
      statusDescription: "Status unavailable",
      lastCheckedAt: checkedAt,
    };
  }

  const latency = result.latency ?? undefined;
  const version = result.version ?? undefined;
  // For health checks, we don't measure latency, so don't mark as degraded based on latency
  const isHighLatency = typeof latency === "number" && latency > 2000;

  const status: ServiceStatusState = result.success
    ? latency === undefined
      ? "online"
      : isHighLatency
        ? "degraded"
        : "online"
    : "offline";

  const descriptionParts: string[] = [];
  if (result.message) {
    descriptionParts.push(result.message);
  }
  if (typeof latency === "number") {
    descriptionParts.push(`Latency ${latency}ms`);
  }
  if (version) {
    descriptionParts.push(`Version ${version}`);
  }

  const statusDescription =
    descriptionParts.length > 0 ? descriptionParts.join(" • ") : undefined;

  return {
    status,
    statusDescription,
    lastCheckedAt: checkedAt,
    latency,
    version,
  };
};

const fetchServicesOverview = async (
  useFullTest = false,
): Promise<ServiceOverviewItem[]> => {
  const manager = await getInitializedManager();

  const configs = await secureStorage.getServiceConfigs();
  if (configs.length === 0) {
    return [];
  }

  let results: Map<string, ConnectionResult>;
  const checkedAt = new Date();

  if (useFullTest) {
    // Use full connection tests for refresh (provides latency and version info)
    results = await manager.testAllConnections();
  } else {
    // Use health checks for initial dashboard load (faster and lighter)
    const healthResults = await Promise.allSettled(
      configs.map(async (config): Promise<[string, ConnectionResult]> => {
        const connector = manager.getConnector(config.id);
        if (!connector) {
          return [
            config.id,
            { success: false, message: "Connector not found" },
          ];
        }

        try {
          const health = await connector.getHealth();
          return [
            config.id,
            {
              success: health.status === "healthy",
              message: health.message,
              latency: undefined, // Health checks don't measure latency
              version: undefined,
            },
          ];
        } catch (error) {
          return [
            config.id,
            {
              success: false,
              message:
                error instanceof Error ? error.message : "Health check failed",
            },
          ];
        }
      }),
    );

    const fulfilledResults = healthResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<[string, ConnectionResult]> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    results = new Map(fulfilledResults);
  }

  return configs.map((config) => {
    const connectionResult = results.get(config.id);
    const statusFields = deriveStatus(config, connectionResult, checkedAt);

    return {
      config,
      ...statusFields,
    };
  });
};

const formatRelativeTime = (input?: Date): string | undefined => {
  if (!input) {
    return undefined;
  }

  const diffMs = Date.now() - input.getTime();
  if (diffMs < 0) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const fetchStatistics = async (
  filter: "all" | "recent" | "month" = "all",
): Promise<StatisticsData> => {
  try {
    const { secureStorage } = await import("@/services/storage/SecureStorage");

    const manager = await getInitializedManager();
    const configs = await secureStorage.getServiceConfigs();
    const enabledConfigs = configs.filter((config) => config.enabled);

    let shows = 0;
    let movies = 0;
    let episodes = 0;
    let watched = 0;

    // Fetch statistics from Sonarr
    const sonarrConfigs = enabledConfigs.filter(
      (config) => config.type === "sonarr",
    );
    for (const config of sonarrConfigs) {
      try {
        const connector = manager.getConnector(config.id);
        if (connector && connector.config.type === "sonarr") {
          const sonarrConnector = connector as any;
          // Get all series and calculate statistics
          const series = await sonarrConnector.getSeries?.();
          if (series) {
            shows += series.length;
            episodes += series.reduce(
              (sum: number, s: any) => sum + (s.episodeFileCount || 0),
              0,
            );
            watched += series.reduce(
              (sum: number, s: any) => sum + (s.episodeCount || 0),
              0,
            );
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch statistics from Sonarr ${config.name}:`,
          error,
        );
      }
    }

    // Fetch statistics from Radarr
    const radarrConfigs = enabledConfigs.filter(
      (config) => config.type === "radarr",
    );
    for (const config of radarrConfigs) {
      try {
        const connector = manager.getConnector(config.id);
        if (connector && connector.config.type === "radarr") {
          const radarrConnector = connector as any;
          // Get all movies and calculate statistics
          const moviesList = await radarrConnector.getMovies?.();
          if (moviesList) {
            movies += moviesList.filter((m: any) => m.hasFile).length;
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch statistics from Radarr ${config.name}:`,
          error,
        );
      }
    }

    return {
      shows,
      movies,
      episodes,
      watched,
    };
  } catch (error) {
    console.error("Failed to fetch statistics data:", error);
    return {
      shows: 0,
      movies: 0,
      episodes: 0,
      watched: 0,
    };
  }
};

const fetchRecentActivity = async (): Promise<RecentActivityItem[]> => {
  try {
    const { secureStorage } = await import("@/services/storage/SecureStorage");

    const manager = await getInitializedManager();
    const configs = await secureStorage.getServiceConfigs();
    const enabledConfigs = configs.filter((config) => config.enabled);

    const recentActivity: RecentActivityItem[] = [];

    // Fetch recent activity from Sonarr
    const sonarrConfigs = enabledConfigs.filter(
      (config) => config.type === "sonarr",
    );
    for (const config of sonarrConfigs) {
      try {
        const connector = manager.getConnector(config.id);
        if (connector && connector.config.type === "sonarr") {
          const sonarrConnector = connector as any;
          const history = await sonarrConnector.getHistory?.({
            page: 1,
            pageSize: 10,
          });
          if (history?.records) {
            for (const record of history.records.slice(0, 5)) {
              if ((record as any).series) {
                // Build image URL from series data
                const series = (record as any).series;
                let imageUrl: string | undefined;

                if (series.images && series.images.length > 0) {
                  const posterImage = series.images.find(
                    (img: any) => img.coverType === "poster",
                  );
                  if (posterImage) {
                    const connector = manager.getConnector(config.id);
                    imageUrl = `${connector?.config.url}/MediaCover/${series.id}/poster.jpg?apikey=${connector?.config.apiKey}`;
                  }
                }

                recentActivity.push({
                  id: `sonarr-${config.id}-${record.id}`,
                  title: series.title || "Unknown",
                  episode: (record as any).episode
                    ? `S${(record as any).episode.seasonNumber?.toString().padStart(2, "0")}E${(record as any).episode.episodeNumber?.toString().padStart(2, "0")}`
                    : "",
                  show: series.title || "",
                  date:
                    formatRelativeTime(new Date((record as any).date)) ||
                    "Unknown",
                  image: imageUrl,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch recent activity from Sonarr ${config.name}:`,
          error,
        );
      }
    }

    // Fetch recent activity from Radarr
    const radarrConfigs = enabledConfigs.filter(
      (config) => config.type === "radarr",
    );
    for (const config of radarrConfigs) {
      try {
        const connector = manager.getConnector(config.id);
        if (connector && connector.config.type === "radarr") {
          const radarrConnector = connector as any;
          const history = await radarrConnector.getHistory?.({
            page: 1,
            pageSize: 10,
          });
          if (history?.records) {
            for (const record of history.records.slice(0, 5)) {
              if ((record as any).movie) {
                // Build image URL from movie data
                const movie = (record as any).movie;
                let imageUrl: string | undefined;

                if (movie.images && movie.images.length > 0) {
                  const posterImage = movie.images.find(
                    (img: any) => img.coverType === "poster",
                  );
                  if (posterImage) {
                    const connector = manager.getConnector(config.id);
                    imageUrl = `${connector?.config.url}/MediaCover/${movie.id}/poster.jpg?apikey=${connector?.config.apiKey}`;
                  }
                }

                recentActivity.push({
                  id: `radarr-${config.id}-${record.id}`,
                  title: movie.title || "Unknown",
                  episode: "Movie",
                  show: movie.title || "",
                  date:
                    formatRelativeTime(new Date((record as any).date)) ||
                    "Unknown",
                  image: imageUrl,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch recent activity from Radarr ${config.name}:`,
          error,
        );
      }
    }

    // Deduplicate recent activity items
    // We'll deduplicate based on a combination of title, episode/show info to avoid showing the same content multiple times
    const uniqueActivities = recentActivity.reduce(
      (unique: RecentActivityItem[], item) => {
        // Create a unique key based on title and episode/show info
        // For movies: use title + "Movie"
        // For episodes: use title + episode + show
        const uniqueKey =
          item.episode === "Movie"
            ? `${item.title}-Movie`
            : `${item.title}-${item.episode}-${item.show}`;

        // Check if we already have this item
        const existingIndex = unique.findIndex((existing) => {
          const existingKey =
            existing.episode === "Movie"
              ? `${existing.title}-Movie`
              : `${existing.title}-${existing.episode}-${existing.show}`;
          return existingKey === uniqueKey;
        });

        if (existingIndex === -1) {
          // Item doesn't exist, add it
          unique.push(item);
        } else {
          // Item exists, keep the more recent one
          // For simplicity, we'll assume newer items (later in the array) are more recent
          // since the API should return items in reverse chronological order
          unique[existingIndex] = item;
        }

        return unique;
      },
      [],
    );

    // Sort by date (most recent first) and limit to 10 items
    return uniqueActivities.slice(0, 10);
  } catch (error) {
    console.error("Failed to fetch recent activity data:", error);
    return [];
  }
};

const fetchContinueWatching = async (): Promise<ContinueWatchingItem[]> => {
  try {
    const { secureStorage } = await import("@/services/storage/SecureStorage");

    const manager = await getInitializedManager();
    const configs = await secureStorage.getServiceConfigs();
    const jellyfinConfigs = configs.filter(
      (config) => config.type === "jellyfin" && config.enabled,
    );

    if (jellyfinConfigs.length === 0) {
      return [];
    }

    const continueWatchingItems: ContinueWatchingItem[] = [];

    for (const config of jellyfinConfigs) {
      try {
        const connector = manager.getConnector(config.id);
        if (!connector || connector.config.type !== "jellyfin") continue;

        const jellyfinConnector = connector as any;

        // Get resume items and currently playing sessions
        const [resumeItems, sessions] = await Promise.all([
          jellyfinConnector.getResumeItems?.(20, ["Movie", "Episode"]) || [],
          jellyfinConnector.getNowPlayingSessions?.() || [],
        ]);

        // Process resume items
        for (const item of resumeItems.slice(0, 4)) {
          const progress = calculateProgress(
            item.UserData?.PlaybackPositionTicks,
            item.RunTimeTicks,
          );
          if (progress > 0 && progress < 100) {
            continueWatchingItems.push({
              id: item.Id || `jellyfin-${config.id}-${item.Name}`,
              title: item.Name || "Unknown",
              type: item.Type === "Movie" ? "movie" : "episode",
              show: item.Type === "Episode" ? item.SeriesName : undefined,
              season:
                item.Type === "Episode" ? item.ParentIndexNumber : undefined,
              episode: item.Type === "Episode" ? item.IndexNumber : undefined,
              progress,
              duration: Math.floor((item.RunTimeTicks || 0) / 600000000), // Convert ticks to minutes
              watchedMinutes: Math.floor(
                (item.UserData?.PlaybackPositionTicks || 0) / 600000000,
              ),
              posterUri: item.ImageTags?.Primary
                ? `${connector.config.url}/Items/${item.Id}/Images/Primary?api_key=${connector.config.apiKey}&tag=${item.ImageTags.Primary}`
                : undefined,
              nextEpisodeAvailable: false, // This would need additional API call
            });
          }
        }

        // Process currently playing sessions
        for (const session of sessions.slice(0, 4)) {
          const item = session.NowPlayingItem || session.NowViewingItem;
          if (!item) continue;

          const progress = calculateProgress(
            session.PlayState?.PositionTicks,
            item.RunTimeTicks,
          );
          if (progress > 0 && progress < 100) {
            continueWatchingItems.push({
              id: item.Id || `jellyfin-session-${config.id}-${item.Name}`,
              title: item.Name || "Unknown",
              type: item.Type === "Movie" ? "movie" : "episode",
              show: item.Type === "Episode" ? item.SeriesName : undefined,
              season:
                item.Type === "Episode" ? item.ParentIndexNumber : undefined,
              episode: item.Type === "Episode" ? item.IndexNumber : undefined,
              progress,
              duration: Math.floor((item.RunTimeTicks || 0) / 600000000),
              watchedMinutes: Math.floor(
                (session.PlayState?.PositionTicks || 0) / 600000000,
              ),
              posterUri: item.ImageTags?.Primary
                ? `${connector.config.url}/Items/${item.Id}/Images/Primary?api_key=${connector.config.apiKey}&tag=${item.ImageTags.Primary}`
                : undefined,
              nextEpisodeAvailable: false,
            });
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch continue watching from Jellyfin ${config.name}:`,
          error,
        );
      }
    }

    // Return empty array if no data found

    // Sort by last played and limit to 4 items
    return continueWatchingItems.slice(0, 4);
  } catch (error) {
    console.error("Failed to fetch continue watching data:", error);
    return [];
  }
};

// Helper function to calculate progress percentage
const calculateProgress = (
  positionTicks?: number,
  totalTicks?: number,
): number => {
  if (!positionTicks || !totalTicks) return 0;
  const progress = (positionTicks / totalTicks) * 100;
  return Math.round(Math.min(Math.max(progress, 0), 100));
};

const fetchTrendingTV = async (): Promise<TrendingTVItem[]> => {
  try {
    const { secureStorage } = await import("@/services/storage/SecureStorage");

    const manager = await getInitializedManager();
    const configs = await secureStorage.getServiceConfigs();
    const jellyseerrConfigs = configs.filter(
      (config) => config.type === "jellyseerr" && config.enabled,
    );

    if (jellyseerrConfigs.length === 0) {
      return [];
    }

    const trendingTVItems: TrendingTVItem[] = [];

    for (const config of jellyseerrConfigs) {
      try {
        const connector = manager.getConnector(config.id);
        if (!connector || connector.config.type !== "jellyseerr") continue;

        const jellyseerrConnector = connector as any;

        // Fetch trending TV shows from Jellyseerr
        const response = await jellyseerrConnector.getTrending?.({ page: 1 });
        if (!response?.items) continue;

        // Filter only TV shows and map to our format
        for (const item of response.items.slice(0, 8)) {
          if (item.mediaType === "tv") {
            const tvItem: TrendingTVItem = {
              id: item.id || `jellyseerr-tv-${item.title}`,
              title: item.title || item.name || "Unknown",
              year: item.releaseDate
                ? parseInt(item.releaseDate.split("-")[0])
                : undefined,
              rating: item.voteAverage,
              posterUri: item.posterPath
                ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
                : item.mediaInfo?.posterPath
                  ? `https://image.tmdb.org/t/p/w500${item.mediaInfo.posterPath}`
                  : undefined,
              tmdbId: item.tmdbId || item.mediaInfo?.tmdbId,
              tvdbId: item.tvdbId || item.mediaInfo?.tvdbId,
              overview: item.overview || item.mediaInfo?.overview,
              popularity: item.popularity,
            };
            trendingTVItems.push(tvItem);
          }
        }
      } catch (error) {
        console.warn(
          `Failed to fetch trending TV from Jellyseerr ${config.name}:`,
          error,
        );
      }
    }

    // Return empty array if no data found

    // Sort by popularity and limit to 8 items
    return trendingTVItems
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 8);
  } catch (error) {
    console.error("Failed to fetch trending TV data:", error);
    return [];
  }
};

const fetchUpcomingReleases = async (): Promise<UpcomingReleaseItem[]> => {
  try {
    const { CalendarService } = await import(
      "@/services/calendar/CalendarService"
    );

    const calendarService = CalendarService.getInstance();

    // Set filters for upcoming releases (next 30 days)
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);

    const filters = {
      mediaTypes: ["movie", "episode"] as ["movie", "episode"],
      statuses: ["upcoming"] as ["upcoming"],
      services: [],
      serviceTypes: ["sonarr", "radarr"] as ["sonarr", "radarr"],
      monitoredStatus: "monitored" as const,
      dateRange: {
        start: today.toISOString().split("T")[0]!,
        end: endDate.toISOString().split("T")[0]!,
      },
    };

    const releases = await calendarService.getReleases(filters);

    // Map to our format and limit to 4 items
    if (releases && releases.length > 0) {
      return releases.slice(0, 4).map((release) => ({
        id: release.id,
        title:
          release.type === "episode"
            ? release.seriesTitle || release.title
            : release.title,
        type: release.type as "movie" | "episode",
        releaseDate: release.releaseDate,
        posterUri: release.posterUrl,
        show: release.type === "episode" ? release.seriesTitle : undefined,
        season: release.seasonNumber,
        episode: release.episodeNumber,
        monitored: release.monitored,
      }));
    }

    // Return empty array if no real data found
    return [];
  } catch (error) {
    console.error("Failed to fetch upcoming releases data:", error);
    return [];
  }
};

const DashboardScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();
  const [filterVisible, setFilterVisible] = useState(false);
  const [statsFilter, setStatsFilter] = useState<"all" | "recent" | "month">(
    "all",
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.services.overview,
    queryFn: () => fetchServicesOverview(false),
    refetchInterval: false,
    staleTime: 2 * 60 * 1000, // 2 minutes - cache services overview aggressively
  });

  // Custom refetch function that performs full connection tests
  const refetchWithFullTest = useCallback(async () => {
    // Trigger a full connection test by calling the function with useFullTest=true
    const result = await fetchServicesOverview(true);
    // Update the query cache with the new results
    queryClient.setQueryData(queryKeys.services.overview, result);
    return result;
  }, [queryClient]);

  const { data: statisticsData, refetch: refetchStatistics } = useQuery({
    queryKey: ["statistics", statsFilter],
    queryFn: () => fetchStatistics(statsFilter),
    refetchInterval: false,
    staleTime: 10 * 60 * 1000, // 10 minutes - statistics don't need real-time updates
  });

  const { data: recentActivityData } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: fetchRecentActivity,
    refetchInterval: false,
    staleTime: 10 * 60 * 1000, // 10 minutes - activity doesn't need real-time
  });

  const { data: continueWatchingData, isLoading: isLoadingContinueWatching } =
    useQuery({
      queryKey: ["continue-watching"],
      queryFn: fetchContinueWatching,
      refetchInterval: false,
      staleTime: 10 * 60 * 1000, // 10 minutes - cache continue watching
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      enabled: true,
    });

  const { data: trendingTVData, isLoading: isLoadingTrendingTV } = useQuery({
    queryKey: ["trending-tv"],
    queryFn: fetchTrendingTV,
    refetchInterval: false,
    staleTime: 15 * 60 * 1000, // 15 minutes - trending data is not time-sensitive
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: true,
  });

  const { data: upcomingReleasesData, isLoading: isLoadingUpcomingReleases } =
    useQuery({
      queryKey: ["upcoming-releases"],
      queryFn: fetchUpcomingReleases,
      refetchInterval: false,
      staleTime: 15 * 60 * 1000, // 15 minutes - upcoming releases don't change often
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      enabled: true,
    });

  // Refresh service health when screen comes back into focus
  // This ensures service status is up-to-date when user returns to dashboard
  useFocusEffect(
    useCallback(() => {
      // Only refresh service health, not all data to avoid long delays
      // Use the regular refetch (faster health checks) instead of full connection tests
      void refetch();

      return undefined;
    }, [refetch]),
  );

  const services = useMemo(() => data ?? [], [data]);
  const isRefreshing = isFetching && !isLoading;

  const listData: DashboardListItem[] = useMemo(() => {
    const items: DashboardListItem[] = [
      { type: "header" },
      { type: "welcome-section" },
      { type: "shortcuts" },
    ];

    // Always show services grid if there are services or they're loading
    if (services.length > 0) {
      items.push({ type: "services-grid", data: services });
    }

    // Always show statistics section
    if (statisticsData) {
      items.push({ type: "statistics", data: statisticsData });
    }

    // Add continue watching section - always show during loading or when available
    if (isLoadingContinueWatching) {
      items.push({ type: "continue-watching-loading" });
    } else if (continueWatchingData && continueWatchingData.length > 0) {
      items.push({ type: "continue-watching", data: continueWatchingData });
    }

    // Add trending TV section - always show during loading or when available
    if (isLoadingTrendingTV) {
      items.push({ type: "trending-tv-loading" });
    } else if (trendingTVData && trendingTVData.length > 0) {
      items.push({ type: "trending-tv", data: trendingTVData });
    }

    // Add upcoming releases section - always show during loading or when available
    if (isLoadingUpcomingReleases) {
      items.push({ type: "upcoming-releases-loading" });
    } else if (upcomingReleasesData && upcomingReleasesData.length > 0) {
      items.push({ type: "upcoming-releases", data: upcomingReleasesData });
    }

    // Add recent activity header and content
    items.push({ type: "recent-activity-header" });
    if (recentActivityData && recentActivityData.length > 0) {
      items.push({ type: "recent-activity", data: recentActivityData });
    }

    // Only show empty state if there are no services AND no dynamic content is loading/available
    if (
      services.length === 0 &&
      !isLoadingContinueWatching &&
      !continueWatchingData &&
      !isLoadingTrendingTV &&
      !trendingTVData &&
      !isLoadingUpcomingReleases &&
      !upcomingReleasesData
    ) {
      items.push({ type: "empty" });
    }

    return items;
  }, [
    services,
    statisticsData,
    continueWatchingData,
    trendingTVData,
    upcomingReleasesData,
    recentActivityData,
    isLoadingContinueWatching,
    isLoadingTrendingTV,
    isLoadingUpcomingReleases,
  ]);

  const screenWidth = Dimensions.get("window").width;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingBottom: 100,
        },

        // Welcome Section
        welcomeSection: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          marginBottom: spacing.md,
        },
        welcomeHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        welcomeTitle: {
          fontSize: 28,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        seeAllButton: {
          fontSize: 16,
          fontWeight: "500",
          color: theme.colors.primary,
        },

        // Shortcuts Section
        shortcutsSection: {
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        shortcutsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        shortcutCard: {
          width: (screenWidth - spacing.lg * 2 - spacing.sm * 3) / 4,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        shortcutIconContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.xs,
        },
        shortcutLabel: {
          fontSize: 12,
          fontWeight: "600",
          color: theme.colors.onSurface,
          textAlign: "center",
        },
        shortcutSubtitle: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginTop: 2,
        },

        // Services Grid
        servicesGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        serviceCard: {
          width: (screenWidth - spacing.lg * 2 - spacing.sm) / 2,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        serviceContent: {
          flexDirection: "row",
          alignItems: "center",
        },
        serviceIcon: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.sm,
        },
        serviceInfo: {
          flex: 1,
        },
        serviceName: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: 4,
        },
        serviceStatus: {
          flexDirection: "row",
          alignItems: "center",
        },
        statusIndicator: {
          width: 6,
          height: 6,
          borderRadius: 3,
          marginRight: 6,
        },
        statusOnline: {
          backgroundColor: "#10B981", // Green
        },
        statusOffline: {
          backgroundColor: "#EF4444", // Red
        },
        statusDegraded: {
          backgroundColor: "#F59E0B", // Amber
        },
        serviceStatusText: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "500",
        },

        // Statistics Section
        statisticsSection: {
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        statisticsHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        statisticsTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        filterButton: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.primary,
        },
        statisticsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        statCard: {
          width: (screenWidth - spacing.lg * 2 - spacing.sm) / 2,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        statNumber: {
          fontSize: 28,
          fontWeight: "700",
          color: theme.colors.primary,
          marginBottom: spacing.xs,
        },
        statLabel: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },

        // Continue Watching Section
        continueWatchingSection: {
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        continueWatchingHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        continueWatchingTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        seeAllButtonSmall: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.primary,
        },
        continueWatchingList: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        continueWatchingCard: {
          width: (screenWidth - spacing.lg * 2 - spacing.sm) / 2,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          overflow: "hidden",
        },
        continueWatchingPoster: {
          width: "100%",
          height: 120,
          backgroundColor: theme.colors.surfaceVariant,
          position: "relative",
        },
        continueWatchingOverlay: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing.sm,
          backgroundColor: "rgba(0,0,0,0.7)",
        },
        progressBar: {
          height: 3,
          backgroundColor: "rgba(255,255,255,0.3)",
          borderRadius: 1.5,
          overflow: "hidden",
        },
        progressFill: {
          height: "100%",
          backgroundColor: theme.colors.primary,
        },
        continueWatchingContent: {
          padding: spacing.md,
        },
        continueWatchingCardTitle: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        continueWatchingMeta: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },

        // Trending TV Section
        trendingTVSection: {
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        trendingTVHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        trendingTVSectionTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        trendingTVList: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        trendingTVCard: {
          width: (screenWidth - spacing.lg * 2 - spacing.sm * 3) / 4,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          overflow: "hidden",
        },
        trendingTVPoster: {
          width: "100%",
          height: 160,
          backgroundColor: theme.colors.surfaceVariant,
        },
        trendingTVContent: {
          padding: spacing.sm,
        },
        trendingTVTitle: {
          fontSize: 12,
          fontWeight: "600",
          color: theme.colors.onSurface,
          textAlign: "center",
        },
        trendingTVRating: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginTop: 2,
        },

        // Upcoming Releases Section
        upcomingReleasesSection: {
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
        upcomingReleasesHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        upcomingReleasesTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        upcomingReleasesList: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        upcomingReleaseCard: {
          width: (screenWidth - spacing.lg * 2 - spacing.sm) / 2,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          overflow: "hidden",
        },
        upcomingReleasePoster: {
          width: "100%",
          height: 100,
          backgroundColor: theme.colors.surfaceVariant,
        },
        upcomingReleaseContent: {
          padding: spacing.md,
        },
        upcomingReleaseTitle: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        upcomingReleaseMeta: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        releaseDateBadge: {
          fontSize: 10,
          fontWeight: "500",
          color: theme.colors.onPrimary,
          backgroundColor: theme.colors.primary,
          paddingHorizontal: spacing.xs,
          paddingVertical: 2,
          borderRadius: 4,
          alignSelf: "flex-start",
          marginTop: spacing.xs,
        },

        // Recent Activity Section
        recentActivityHeader: {
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.lg,
        },
        recentActivityTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        recentActivityList: {
          paddingHorizontal: spacing.lg,
        },
        activityCard: {
          flexDirection: "row",
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        activityImage: {
          width: 50,
          height: 75,
          borderRadius: 8,
          marginRight: spacing.md,
          backgroundColor: theme.colors.surfaceVariant,
        },
        activityContent: {
          flex: 1,
          justifyContent: "center",
        },
        activityTitle: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: 4,
        },
        activityShow: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginBottom: 4,
        },
        activityDate: {
          fontSize: 12,
          color: theme.colors.outline,
        },

        // Legacy styles for backward compatibility
        section: {
          marginTop: spacing.xs,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          lineHeight: theme.custom.typography.titleLarge.lineHeight,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
          fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.md,
        },
        listSpacer: {
          height: spacing.sm,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
      }),
    [theme, screenWidth],
  );

  // Summary metrics are currently unused in this component; keep calculation
  // in case they are needed later. If not required, we can remove this.

  // Note: sign out flow and menu handler moved to settings screen. Handlers
  // were removed from dashboard to avoid unused variable lint warnings.

  const handleAddService = useCallback(() => {
    router.push("/(auth)/add-service");
  }, [router]);

  const handleServicePress = useCallback(
    (service: ServiceOverviewItem) => {
      switch (service.config.type) {
        case "sonarr":
          router.push({
            pathname: "/(auth)/sonarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "radarr":
          router.push({
            pathname: "/(auth)/radarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "jellyseerr":
          router.push({
            pathname: "/(auth)/jellyseerr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "qbittorrent":
          router.push({
            pathname: "/(auth)/qbittorrent/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "jellyfin":
          router.push({
            pathname: "/(auth)/jellyfin/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "prowlarr":
          router.push({
            pathname: "/(auth)/prowlarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        default:
          alert(
            "Coming soon",
            `${
              serviceTypeLabels[service.config.type]
            } integration is coming soon.`,
          );
          break;
      }
    },
    [router],
  );

  const renderHeader = useCallback(
    () => (
      <AnimatedHeader>
        <TabHeader
          rightAction={{
            icon: "plus",
            onPress: handleAddService,
            accessibilityLabel: "Add service",
          }}
        />
      </AnimatedHeader>
    ),
    [handleAddService],
  );

  const handleOpenSearch = useCallback(() => {
    router.push("/(auth)/search");
  }, [router]);

  const handleOpenCalendar = useCallback(() => {
    router.push("/(auth)/calendar");
  }, [router]);

  const handleOpenDiscover = useCallback(() => {
    router.push("/(auth)/discover");
  }, [router]);

  const handleStatsFilter = useCallback(
    (filter: "all" | "recent" | "month") => {
      setStatsFilter(filter);
      setFilterVisible(false);
      void refetchStatistics();
    },
    [refetchStatistics],
  );

  const handleContinueWatchingPress = useCallback(
    (item: ContinueWatchingItem) => {
      // Navigate to the media details page
      if (item.type === "movie") {
        // For movies, try to navigate to Jellyfin details
        router.push(`/(auth)/jellyfin/${item.id}`);
      } else if (item.type === "episode") {
        // For episodes, try to navigate to Jellyfin details
        router.push(`/(auth)/jellyfin/${item.id}`);
      }
    },
    [router],
  );

  const handleTrendingTVPress = useCallback(
    (item: TrendingTVItem) => {
      // Navigate to TV show details in discover
      if (item.tmdbId) {
        router.push(`/(auth)/discover/tmdb/tv/${item.tmdbId}`);
      } else {
        // Fallback: navigate to general discover page if no tmdbId
        router.push("/(auth)/discover");
      }
    },
    [router],
  );

  const handleUpcomingReleasePress = useCallback(
    (item: UpcomingReleaseItem) => {
      // Navigate to calendar or details based on type
      router.push(`/(auth)/calendar`);
    },
    [router],
  );

  const handleRecentActivityPress = useCallback(
    (item: RecentActivityItem) => {
      // Navigate to appropriate service page based on the activity source
      // Extract service type from the item ID
      if (item.id.startsWith("sonarr-")) {
        // Navigate to Sonarr series list
        router.push(`/(auth)/sonarr/${item.id.split("-")[1]}`);
      } else if (item.id.startsWith("radarr-")) {
        // Navigate to Radarr movies list
        router.push(`/(auth)/radarr/${item.id.split("-")[1]}`);
      }
    },
    [router],
  );

  const ShortcutCard = React.memo(
    ({
      label,
      subtitle,
      icon,
      onPress,
      testID,
    }: {
      label: string;
      subtitle?: string;
      icon: string;
      onPress: () => void;
      testID?: string;
    }) => (
      <TouchableOpacity
        style={styles.shortcutCard}
        onPress={onPress}
        activeOpacity={0.7}
        testID={testID}
      >
        <View style={styles.shortcutIconContainer}>
          <IconButton icon={icon} size={20} iconColor={theme.colors.primary} />
        </View>
        <Text style={styles.shortcutLabel}>{label}</Text>
        {subtitle ? (
          <Text style={styles.shortcutSubtitle}>{subtitle}</Text>
        ) : null}
      </TouchableOpacity>
    ),
  );

  const ServiceCard = React.memo(({ item }: { item: ServiceOverviewItem }) => {
    const getStatusColor = (status: ServiceStatusState) => {
      switch (status) {
        case "online":
          return styles.statusOnline;
        case "offline":
          return styles.statusOffline;
        case "degraded":
          return styles.statusDegraded;
        default:
          return styles.statusOffline;
      }
    };

    const getStatusIcon = (type: ServiceType) => {
      switch (type) {
        case "sonarr":
          return "television-classic";
        case "radarr":
          return "movie-open";
        case "jellyseerr":
          return "account-search";
        case "jellyfin":
          return "television-classic";
        case "qbittorrent":
          return "download-network";
        case "prowlarr":
          return "radar";
        default:
          return "server";
      }
    };

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => handleServicePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.serviceContent}>
          <View style={styles.serviceIcon}>
            <IconButton
              icon={getStatusIcon(item.config.type)}
              size={20}
              iconColor={theme.colors.primary}
            />
          </View>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>{item.config.name}</Text>
            <View style={styles.serviceStatus}>
              <View
                style={[styles.statusIndicator, getStatusColor(item.status)]}
              />
              <Text style={styles.serviceStatusText}>
                {item.status === "online"
                  ? "Connected"
                  : item.status === "offline"
                    ? "Offline"
                    : "Degraded"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  const StatCard = React.memo(
    ({
      number,
      label,
      onPress,
    }: {
      number: number;
      label: string;
      onPress?: () => void;
    }) => (
      <TouchableOpacity
        style={styles.statCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.statNumber}>{number}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </TouchableOpacity>
    ),
  );

  const handleStatCardPress = useCallback(
    (label: string) => {
      // Navigate to appropriate pages based on statistics type
      switch (label) {
        case "Shows":
          // Navigate to Sonarr series list
          router.push("/(auth)/sonarr");
          break;
        case "Movies":
          // Navigate to Radarr movies list
          router.push("/(auth)/radarr");
          break;
        case "Episodes":
          // Navigate to calendar page for episode releases
          router.push("/(auth)/calendar");
          break;
        case "Watched":
          // Navigate to recently added page
          router.push("/(auth)/(tabs)/recently-added");
          break;
        default:
          break;
      }
    },
    [router],
  );

  const ContinueWatchingCardSkeleton = React.memo(() => (
    <View style={styles.continueWatchingCard}>
      <SkeletonPlaceholder
        width="100%"
        height={120}
        borderRadius={0}
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      />
      <View style={styles.continueWatchingContent}>
        <SkeletonPlaceholder
          width="80%"
          height={16}
          borderRadius={4}
          style={{ marginBottom: spacing.xs }}
        />
        <SkeletonPlaceholder width="60%" height={12} borderRadius={4} />
      </View>
    </View>
  ));

  const TrendingTVCardSkeleton = React.memo(() => (
    <View style={styles.trendingTVCard}>
      <SkeletonPlaceholder
        width="100%"
        height={160}
        borderRadius={0}
        style={{ marginBottom: spacing.sm }}
      />
      <View style={styles.trendingTVContent}>
        <SkeletonPlaceholder
          width="90%"
          height={12}
          borderRadius={4}
          style={{ marginBottom: 2 }}
        />
        <SkeletonPlaceholder width="40%" height={10} borderRadius={4} />
      </View>
    </View>
  ));

  const UpcomingReleaseCardSkeleton = React.memo(() => (
    <View style={styles.upcomingReleaseCard}>
      <SkeletonPlaceholder
        width="100%"
        height={100}
        borderRadius={0}
        style={{ marginBottom: spacing.md }}
      />
      <View style={styles.upcomingReleaseContent}>
        <SkeletonPlaceholder
          width="85%"
          height={14}
          borderRadius={4}
          style={{ marginBottom: spacing.xs }}
        />
        <SkeletonPlaceholder
          width="50%"
          height={12}
          borderRadius={4}
          style={{ marginBottom: spacing.xs }}
        />
        <SkeletonPlaceholder width={40} height={16} borderRadius={4} />
      </View>
    </View>
  ));

  const ContinueWatchingCard = React.memo(
    ({
      item,
      onPress,
    }: {
      item: ContinueWatchingItem;
      onPress?: (item: ContinueWatchingItem) => void;
    }) => {
      const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      };

      return (
        <TouchableOpacity
          style={styles.continueWatchingCard}
          onPress={() => onPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={styles.continueWatchingPoster}>
            {item.posterUri ? (
              <MediaPoster
                uri={item.posterUri}
                size={((screenWidth - spacing.lg * 2 - spacing.sm) / 2) * 0.5}
                borderRadius={0}
                style={{ width: "100%", height: "100%" }}
              />
            ) : null}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "rgba(0,0,0,0.7)",
                padding: spacing.sm,
              }}
            >
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${item.progress}%` }]}
                />
              </View>
            </View>
          </View>
          <View style={styles.continueWatchingContent}>
            <Text style={styles.continueWatchingCardTitle} numberOfLines={2}>
              {item.type === "episode" ? item.show : item.title}
            </Text>
            <Text style={styles.continueWatchingMeta} numberOfLines={1}>
              {item.type === "episode"
                ? `S${item.season}E${item.episode}`
                : `${formatTime(item.duration)}`}
              {" • "}
              {Math.round(item.progress)}% watched
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
  );

  const TrendingTVCard = React.memo(
    ({
      item,
      onPress,
      style,
      posterSize,
    }: {
      item: TrendingTVItem;
      onPress?: (item: TrendingTVItem) => void;
      style?: ViewStyle | ViewStyle[];
      posterSize?: number;
    }) => (
      <TouchableOpacity
        style={[styles.trendingTVCard, style]}
        onPress={() => onPress?.(item)}
        activeOpacity={0.7}
      >
        <View style={styles.trendingTVPoster}>
          {item.posterUri ? (
            <MediaPoster
              uri={item.posterUri}
              size={
                posterSize ??
                (screenWidth - spacing.lg * 2 - spacing.sm * 3) / 4
              }
              borderRadius={0}
              style={{ width: "100%", height: "100%" }}
            />
          ) : null}
        </View>
        <View style={styles.trendingTVContent}>
          <Text style={styles.trendingTVTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.trendingTVRating} numberOfLines={1}>
            {item.rating ? `★ ${item.rating.toFixed(1)}` : ""}
          </Text>
        </View>
      </TouchableOpacity>
    ),
  );

  const UpcomingReleaseCard = React.memo(
    ({
      item,
      onPress,
    }: {
      item: UpcomingReleaseItem;
      onPress?: (item: UpcomingReleaseItem) => void;
    }) => {
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year:
            date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });
      };

      const getTimeToRelease = (dateString: string) => {
        const releaseDate = new Date(dateString);
        const now = new Date();
        const diffMs = releaseDate.getTime() - now.getTime();

        if (diffMs < 0) return "Released";

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const remainingMinutes = diffMinutes % 60;
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays === 0) {
          if (diffHours === 0) {
            if (diffMinutes <= 1) return "In 1 min";
            return `In ${diffMinutes} min`;
          }
          if (diffHours === 1) {
            return remainingMinutes > 0
              ? `In 1h ${remainingMinutes}m`
              : "In 1h";
          }
          return remainingMinutes > 0
            ? `In ${diffHours}h ${remainingMinutes}m`
            : `In ${diffHours}h`;
        }
        if (diffDays === 1) return "Tomorrow";
        if (diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays <= 30) return `In ${Math.floor(diffDays / 7)} weeks`;
        return `In ${Math.floor(diffDays / 30)} months`;
      };

      const getReleaseDisplay = (dateString: string) => {
        const releaseDate = new Date(dateString);
        const now = new Date();
        const diffMs = releaseDate.getTime() - now.getTime();

        if (diffMs < 0) return formatDate(dateString);

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        // For releases today, show only the time to release
        if (diffDays === 0) {
          return getTimeToRelease(dateString);
        }

        // For other releases, show the date
        return formatDate(dateString);
      };

      return (
        <TouchableOpacity
          style={styles.upcomingReleaseCard}
          onPress={() => onPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={styles.upcomingReleasePoster}>
            {item.posterUri ? (
              <MediaPoster
                uri={item.posterUri}
                size={(screenWidth - spacing.lg * 2 - spacing.sm) / 2}
                borderRadius={0}
                style={{ width: "100%", height: "100%" }}
              />
            ) : null}
          </View>
          <View style={styles.upcomingReleaseContent}>
            <Text style={styles.upcomingReleaseTitle} numberOfLines={2}>
              {item.type === "episode" ? item.show : item.title}
            </Text>
            <Text style={styles.upcomingReleaseMeta} numberOfLines={1}>
              {item.type === "episode"
                ? `S${item.season}E${item.episode}`
                : "Movie"}
            </Text>
            <View style={styles.releaseDateBadge}>
              <Text style={{ color: theme.colors.onPrimary, fontSize: 10 }}>
                {getReleaseDisplay(item.releaseDate)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
  );

  const RecentActivityCard = React.memo(
    ({
      item,
      onPress,
    }: {
      item: RecentActivityItem;
      onPress?: (item: RecentActivityItem) => void;
    }) => (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => onPress?.(item)}
        activeOpacity={0.7}
      >
        {item.image ? (
          <MediaPoster
            uri={item.image}
            size={50}
            borderRadius={8}
            style={styles.activityImage}
          />
        ) : (
          <View style={styles.activityImage} />
        )}
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{item.title}</Text>
          <Text style={styles.activityShow}>
            {item.show} • {item.episode}
          </Text>
          <Text style={styles.activityDate}>{item.date}</Text>
        </View>
      </TouchableOpacity>
    ),
  );

  const emptyServicesContent = useMemo(() => {
    if (isError) {
      const message =
        error instanceof Error ? error.message : "Unable to load services.";

      return (
        <EmptyState
          title="Unable to load services"
          description={message}
          actionLabel="Retry"
          onActionPress={() => void refetch()}
        />
      );
    }

    return (
      <EmptyState
        title="No services configured"
        description="Connect Sonarr, Radarr, Jellyseerr, qBittorrent, and more to see their status here."
        actionLabel="Add Service"
        onActionPress={handleAddService}
      />
    );
  }, [error, handleAddService, isError, refetch]);

  const renderItem = ({ item }: { item: DashboardListItem }) => {
    switch (item.type) {
      case "header":
        return renderHeader();

      case "welcome-section":
        return (
          <View style={styles.welcomeSection}>
            <View style={styles.welcomeHeader}>
              <Text style={styles.welcomeTitle}>Dashboard</Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/services")}>
                <Text style={styles.seeAllButton}>See all</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "shortcuts":
        return (
          <View style={styles.shortcutsSection}>
            <AnimatedSection style={styles.shortcutsGrid} delay={40}>
              <AnimatedListItem index={0} totalItems={4}>
                <ShortcutCard
                  testID="shortcut-discover"
                  label="Discover"
                  subtitle="Trending"
                  icon="compass-outline"
                  onPress={handleOpenDiscover}
                />
              </AnimatedListItem>
              <AnimatedListItem index={1} totalItems={4}>
                <ShortcutCard
                  testID="shortcut-search"
                  label="Search"
                  subtitle="Unified"
                  icon="magnify"
                  onPress={handleOpenSearch}
                />
              </AnimatedListItem>
              <AnimatedListItem index={2} totalItems={4}>
                <ShortcutCard
                  testID="shortcut-calendar"
                  label="Calendar"
                  subtitle="Releases"
                  icon="calendar"
                  onPress={handleOpenCalendar}
                />
              </AnimatedListItem>
              <AnimatedListItem index={3} totalItems={4}>
                <ShortcutCard
                  testID="shortcut-animehub"
                  label="Anime"
                  subtitle="Hub"
                  icon="animation"
                  onPress={() => router.push("/(auth)/anime-hub")}
                />
              </AnimatedListItem>
            </AnimatedSection>
          </View>
        );

      case "services-grid":
        return (
          <View style={styles.servicesGrid}>
            {item.data.slice(0, 4).map((service, index) => (
              <AnimatedListItem
                key={service.config.id}
                index={index}
                totalItems={item.data.length}
              >
                <ServiceCard item={service} />
              </AnimatedListItem>
            ))}
          </View>
        );

      case "statistics":
        return (
          <View style={styles.statisticsSection}>
            <View style={styles.statisticsHeader}>
              <Text style={styles.statisticsTitle}>Statistics</Text>
              <TouchableOpacity onPress={() => setFilterVisible(true)}>
                <Text style={styles.filterButton}>
                  {statsFilter === "all"
                    ? "All"
                    : statsFilter === "recent"
                      ? "Recent"
                      : "Month"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statisticsGrid}>
              <AnimatedListItem index={0} totalItems={4}>
                <StatCard
                  number={item.data.shows}
                  label="Shows"
                  onPress={() => handleStatCardPress("Shows")}
                />
              </AnimatedListItem>
              <AnimatedListItem index={1} totalItems={4}>
                <StatCard
                  number={item.data.movies}
                  label="Movies"
                  onPress={() => handleStatCardPress("Movies")}
                />
              </AnimatedListItem>
              <AnimatedListItem index={2} totalItems={4}>
                <StatCard
                  number={item.data.episodes}
                  label="Episodes"
                  onPress={() => handleStatCardPress("Episodes")}
                />
              </AnimatedListItem>
              <AnimatedListItem index={3} totalItems={4}>
                <StatCard
                  number={item.data.watched}
                  label="Watched"
                  onPress={() => handleStatCardPress("Watched")}
                />
              </AnimatedListItem>
            </View>
          </View>
        );

      case "continue-watching":
        return (
          <View style={styles.continueWatchingSection}>
            <View style={styles.continueWatchingHeader}>
              <Text style={styles.continueWatchingTitle}>
                Continue Watching
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/continue-watching")}
              >
                <Text style={styles.seeAllButtonSmall}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.continueWatchingList}>
              {item.data.slice(0, 4).map((watching, index) => (
                <AnimatedListItem
                  key={watching.id}
                  index={index}
                  totalItems={item.data.length}
                >
                  <ContinueWatchingCard
                    item={watching}
                    onPress={handleContinueWatchingPress}
                  />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        );

      case "continue-watching-loading":
        return (
          <View style={styles.continueWatchingSection}>
            <View style={styles.continueWatchingHeader}>
              <Text style={styles.continueWatchingTitle}>
                Continue Watching
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/continue-watching")}
              >
                <Text style={styles.seeAllButtonSmall}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.continueWatchingList}>
              {Array.from({ length: 4 }).map((_, index) => (
                <AnimatedListItem
                  key={`continue-watching-loading-${index}`}
                  index={index}
                  totalItems={4}
                >
                  <ContinueWatchingCardSkeleton />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        );

      case "trending-tv": {
        // Use 2 columns when there are fewer than 4 items to make better use of space
        const totalItems = Math.min(item.data.length, 8);
        const columns = totalItems < 4 ? 2 : 4;
        const gutterTotal = spacing.lg * 2 + spacing.sm * (columns - 1);
        const cardWidth = (screenWidth - gutterTotal) / columns;
        const posterSize = cardWidth; // poster should fill card width

        return (
          <View style={styles.trendingTVSection}>
            <View style={styles.trendingTVHeader}>
              <Text style={styles.trendingTVSectionTitle}>
                Trending TV Shows
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/discover")}>
                <Text style={styles.seeAllButtonSmall}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.trendingTVList}>
              {item.data.slice(0, 8).map((show, index) => (
                <AnimatedListItem
                  key={show.id}
                  index={index}
                  totalItems={totalItems}
                >
                  <TrendingTVCard
                    item={show}
                    onPress={handleTrendingTVPress}
                    style={{ width: cardWidth }}
                    posterSize={posterSize}
                  />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        );
      }

      case "trending-tv-loading":
        return (
          <View style={styles.trendingTVSection}>
            <View style={styles.trendingTVHeader}>
              <Text style={styles.trendingTVSectionTitle}>
                Trending TV Shows
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/discover")}>
                <Text style={styles.seeAllButtonSmall}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.trendingTVList}>
              {Array.from({ length: 8 }).map((_, index) => (
                <AnimatedListItem
                  key={`trending-tv-loading-${index}`}
                  index={index}
                  totalItems={8}
                >
                  <TrendingTVCardSkeleton />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        );

      case "upcoming-releases":
        return (
          <View style={styles.upcomingReleasesSection}>
            <View style={styles.upcomingReleasesHeader}>
              <Text style={styles.upcomingReleasesTitle}>
                Upcoming Releases
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/calendar")}>
                <Text style={styles.seeAllButtonSmall}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.upcomingReleasesList}>
              {item.data.slice(0, 4).map((release, index) => (
                <AnimatedListItem
                  key={release.id}
                  index={index}
                  totalItems={item.data.length}
                >
                  <UpcomingReleaseCard
                    item={release}
                    onPress={handleUpcomingReleasePress}
                  />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        );

      case "upcoming-releases-loading":
        return (
          <View style={styles.upcomingReleasesSection}>
            <View style={styles.upcomingReleasesHeader}>
              <Text style={styles.upcomingReleasesTitle}>
                Upcoming Releases
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/calendar")}>
                <Text style={styles.seeAllButtonSmall}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.upcomingReleasesList}>
              {Array.from({ length: 4 }).map((_, index) => (
                <AnimatedListItem
                  key={`upcoming-releases-loading-${index}`}
                  index={index}
                  totalItems={4}
                >
                  <UpcomingReleaseCardSkeleton />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        );

      case "recent-activity-header":
        return (
          <View style={styles.recentActivityHeader}>
            <Text style={styles.recentActivityTitle}>Recent Activity</Text>
          </View>
        );

      case "recent-activity":
        return (
          <View style={styles.recentActivityList}>
            {item.data.length > 0 ? (
              item.data.map((activity, index) => (
                <AnimatedListItem
                  key={activity.id}
                  index={index}
                  totalItems={item.data.length}
                >
                  <RecentActivityCard
                    item={activity}
                    onPress={handleRecentActivityPress}
                  />
                </AnimatedListItem>
              ))
            ) : (
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: 12,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                  }}
                >
                  No recent activity found
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                    marginTop: spacing.xs,
                    opacity: 0.7,
                  }}
                >
                  Recent downloads and imports will appear here
                </Text>
              </View>
            )}
          </View>
        );

      case "empty":
        return (
          <AnimatedSection style={styles.section}>
            {emptyServicesContent}
          </AnimatedSection>
        );

      default:
        return null;
    }
  };

  const keyExtractor = useCallback((item: DashboardListItem) => {
    switch (item.type) {
      case "header":
        return "header";
      case "welcome-section":
        return "welcome-section";
      case "shortcuts":
        return "shortcuts";
      case "services-grid":
        return "services-grid";
      case "statistics":
        return "statistics";
      case "continue-watching":
        return `continue-watching-${item.data.length}`;
      case "continue-watching-loading":
        return "continue-watching-loading";
      case "trending-tv":
        return `trending-tv-${item.data.length}`;
      case "trending-tv-loading":
        return "trending-tv-loading";
      case "upcoming-releases":
        return `upcoming-releases-${item.data.length}`;
      case "upcoming-releases-loading":
        return "upcoming-releases-loading";
      case "recent-activity-header":
        return "recent-activity-header";
      case "recent-activity":
        return `recent-activity-${item.data.length}`;
      case "empty":
        return "empty";
      default:
        return "unknown";
    }
  }, []);

  const getItemType = useCallback((item: DashboardListItem) => item.type, []);

  return (
    <Portal.Host>
      <SafeAreaView style={styles.container}>
        <FlashList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
          ListEmptyComponent={
            <AnimatedSection style={styles.emptyContainer}>
              {emptyServicesContent}
            </AnimatedSection>
          }
          refreshControl={
            <ListRefreshControl
              refreshing={isRefreshing}
              onRefresh={() => refetchWithFullTest()}
            />
          }
          showsVerticalScrollIndicator={false}
          getItemType={getItemType}
          removeClippedSubviews={true}
        />
        <Portal>
          <Modal
            visible={filterVisible}
            onDismiss={() => setFilterVisible(false)}
            contentContainerStyle={{
              backgroundColor: theme.colors.surface,
              padding: spacing.lg,
              margin: spacing.lg,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                marginBottom: spacing.md,
                color: theme.colors.onSurface,
              }}
            >
              Filter Statistics
            </Text>

            <TouchableOpacity
              style={{
                padding: spacing.md,
                borderRadius: 8,
                backgroundColor:
                  statsFilter === "all"
                    ? theme.colors.primaryContainer
                    : "transparent",
                marginBottom: spacing.sm,
              }}
              onPress={() => handleStatsFilter("all")}
            >
              <Text
                style={{
                  color: theme.colors.onSurface,
                  fontWeight: statsFilter === "all" ? "600" : "400",
                  fontSize: 16,
                }}
              >
                All Time
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                padding: spacing.md,
                borderRadius: 8,
                backgroundColor:
                  statsFilter === "recent"
                    ? theme.colors.primaryContainer
                    : "transparent",
                marginBottom: spacing.sm,
              }}
              onPress={() => handleStatsFilter("recent")}
            >
              <Text
                style={{
                  color: theme.colors.onSurface,
                  fontWeight: statsFilter === "recent" ? "600" : "400",
                  fontSize: 16,
                }}
              >
                Recent (7 days)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                padding: spacing.md,
                borderRadius: 8,
                backgroundColor:
                  statsFilter === "month"
                    ? theme.colors.primaryContainer
                    : "transparent",
                marginBottom: spacing.sm,
              }}
              onPress={() => handleStatsFilter("month")}
            >
              <Text
                style={{
                  color: theme.colors.onSurface,
                  fontWeight: statsFilter === "month" ? "600" : "400",
                  fontSize: 16,
                }}
              >
                This Month
              </Text>
            </TouchableOpacity>
          </Modal>
        </Portal>
      </SafeAreaView>
    </Portal.Host>
  );
};

export default DashboardScreen;
