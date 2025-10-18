import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Dimensions, RefreshControl } from "react-native";
import { Text, IconButton, Portal, Avatar } from "react-native-paper";
import { useHaptics } from "@/hooks/useHaptics";

import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { spacing } from "@/theme/spacing";
import { useTheme } from "@/hooks/useTheme";
import WidgetContainer from "@/components/widgets/WidgetContainer/WidgetContainer";

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
  | { type: "widgets" }
  | { type: "statistics"; data: StatisticsData }
  | { type: "statistics-loading" }
  | { type: "trending-tv"; data: TrendingTVItem[] }
  | { type: "trending-tv-loading" }
  | { type: "upcoming-releases"; data: UpcomingReleaseItem[] }
  | { type: "upcoming-releases-loading" }
  | { type: "recent-activity-header" }
  | { type: "recent-activity"; data: RecentActivityItem[] }
  | { type: "activity" };

// Helper function to calculate progress percentage

const DashboardScreen = () => {
  const router = useRouter();
  const theme = useTheme();
  const { onPress } = useHaptics();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    onPress();
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [onPress]);

  const listData: DashboardListItem[] = useMemo(() => {
    const items: DashboardListItem[] = [
      { type: "header" },
      { type: "widgets" },
    ];

    return items;
  }, []);

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

        // Header Section
        headerSection: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        },
        headerContainer: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        profileSection: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          flexShrink: 1,
        },
        profileAvatar: {
          backgroundColor: theme.colors.primaryContainer,
        },
        profileInfo: {
          flex: 1,
        },
        profileName: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        profileSubtitle: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginTop: 2,
        },
        settingsButton: {
          backgroundColor: theme.colors.surfaceVariant,
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
      }),
    [theme, screenWidth],
  );

  // Summary metrics are currently unused in this component; keep calculation
  // in case they are needed later. If not required, we can remove this.

  const renderItem = ({ item }: { item: DashboardListItem }) => {
    switch (item.type) {
      case "header":
        return (
          <View style={styles.headerSection}>
            <View style={styles.headerContainer}>
              <View style={styles.profileSection}>
                <Avatar.Text
                  size={48}
                  label="arr"
                  style={styles.profileAvatar}
                  labelStyle={{ color: theme.colors.onPrimaryContainer }}
                />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>Dashboard</Text>
                  <Text style={styles.profileSubtitle}>Welcome back</Text>
                </View>
              </View>
              <IconButton
                icon="cog"
                size={24}
                iconColor={theme.colors.onSurfaceVariant}
                style={styles.settingsButton}
                onPress={() => router.push("/(auth)/settings")}
              />
            </View>
          </View>
        );

      case "widgets":
        return (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <WidgetContainer editable={true} />
          </View>
        );

      default:
        return null;
    }
  };

  const keyExtractor = useCallback((item: DashboardListItem) => {
    switch (item.type) {
      case "header":
        return "header";
      case "widgets":
        return "widgets";
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
          showsVerticalScrollIndicator={false}
          getItemType={getItemType}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      </SafeAreaView>
    </Portal.Host>
  );
};

export default DashboardScreen;
