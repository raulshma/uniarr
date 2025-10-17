import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, Dimensions, TouchableOpacity } from "react-native";
import type { ViewStyle } from "react-native";
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
import { MediaPoster } from "@/components/media/MediaPoster";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
// Unified search has been moved to its own page. Navigate to the search route from the dashboard.
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

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

// Note: relative time formatting is provided by components where needed.

const fetchStatistics = async (
  filter: "all" | "recent" | "month" = "all",
): Promise<StatisticsData> => {
  // Since we removed services functionality, return placeholder statistics
  // This could be enhanced later to fetch from a local database or other sources
  return {
    shows: 0,
    movies: 0,
    episodes: 0,
    watched: 0,
  };
};

const fetchRecentActivity = async (): Promise<RecentActivityItem[]> => {
  // Since we removed services functionality, return empty array
  // This could be enhanced later to fetch from a local database or other sources
  return [];
};

const fetchContinueWatching = async (): Promise<ContinueWatchingItem[]> => {
  // Since we removed services functionality, return empty array
  // This could be enhanced later to fetch from a local database or other sources
  return [];
};

// progress calculation is handled inline where used

const fetchTrendingTV = async (): Promise<TrendingTVItem[]> => {
  // Since we removed services functionality, return empty array
  // This could be enhanced later to fetch from TMDB API directly or other sources
  return [];
};

const fetchUpcomingReleases = async (): Promise<UpcomingReleaseItem[]> => {
  // Since we removed services functionality, return empty array
  // This could be enhanced later to fetch from a local database or other sources
  return [];
};

const DashboardScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [filterVisible, setFilterVisible] = useState(false);
  const [statsFilter, setStatsFilter] = useState<"all" | "recent" | "month">(
    "all",
  );

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

  const listData: DashboardListItem[] = useMemo(() => {
    const items: DashboardListItem[] = [
      { type: "header" },
      { type: "welcome-section" },
      { type: "shortcuts" },
    ];

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

    // Only show empty state if no dynamic content is loading/available
    if (
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

  const renderHeader = useCallback(
    () => (
      <AnimatedHeader>
        <TabHeader />
      </AnimatedHeader>
    ),
    [],
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

  const StatCard = React.memo(
    ({ number, label }: { number: number; label: string }) => (
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{number}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    ),
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

  const emptyStateContent = useMemo(() => {
    return (
      <EmptyState
        title="Welcome to UniArr"
        description="Start exploring your media library with trending shows, upcoming releases, and more."
        actionLabel="Discover"
        onActionPress={handleOpenDiscover}
      />
    );
  }, [handleOpenDiscover]);

  const renderItem = useCallback(
    ({ item }: { item: DashboardListItem }) => {
      switch (item.type) {
        case "header":
          return renderHeader();

        case "welcome-section":
          return (
            <View style={styles.welcomeSection}>
              <View style={styles.welcomeHeader}>
                <Text style={styles.welcomeTitle}>Dashboard</Text>
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
                  <StatCard number={item.data.shows} label="Shows" />
                </AnimatedListItem>
                <AnimatedListItem index={1} totalItems={4}>
                  <StatCard number={item.data.movies} label="Movies" />
                </AnimatedListItem>
                <AnimatedListItem index={2} totalItems={4}>
                  <StatCard number={item.data.episodes} label="Episodes" />
                </AnimatedListItem>
                <AnimatedListItem index={3} totalItems={4}>
                  <StatCard number={item.data.watched} label="Watched" />
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
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/discover")}
                >
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
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/discover")}
                >
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
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/calendar")}
                >
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
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/calendar")}
                >
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
              {emptyStateContent}
            </AnimatedSection>
          );

        default:
          return null;
      }
    },
    [
      emptyStateContent,
      renderHeader,
      router,
      styles,
      handleContinueWatchingPress,
      handleTrendingTVPress,
      handleUpcomingReleasePress,
      handleRecentActivityPress,
      statsFilter,
      ContinueWatchingCard,
      ContinueWatchingCardSkeleton,
      RecentActivityCard,
      ShortcutCard,
      StatCard,
      TrendingTVCard,
      TrendingTVCardSkeleton,
      UpcomingReleaseCard,
      UpcomingReleaseCardSkeleton,
      handleOpenCalendar,
      handleOpenDiscover,
      handleOpenSearch,
      screenWidth,
      theme.colors.onSurfaceVariant,
      theme.colors.outlineVariant,
      theme.colors.surface,
    ],
  );

  const keyExtractor = useCallback((item: DashboardListItem) => {
    switch (item.type) {
      case "header":
        return "header";
      case "welcome-section":
        return "welcome-section";
      case "shortcuts":
        return "shortcuts";
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
              {emptyStateContent}
            </AnimatedSection>
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
