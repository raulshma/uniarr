import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Dimensions, RefreshControl } from "react-native";
import { Text, IconButton, Portal, Avatar } from "react-native-paper";
import { useHaptics } from "@/hooks/useHaptics";

import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { useTheme } from "@/hooks/useTheme";
import { AnimatedSection } from "@/components/common/AnimatedComponents";
import WidgetContainer from "@/components/widgets/WidgetContainer/WidgetContainer";
import { useWidgetServiceInitialization } from "@/hooks/useWidgetServiceInitialization";

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

  // Initialize WidgetService early to prevent loading issues
  useWidgetServiceInitialization();

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
          paddingHorizontal: theme.custom.spacing.lg,
          paddingTop: theme.custom.spacing.lg,
          paddingBottom: theme.custom.spacing.md,
        },
        headerContainer: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.custom.spacing.lg,
        },
        headerActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.sm,
        },
        profileSection: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.md,
          flexShrink: 1,
        },
        profileAvatar: {
          backgroundColor: theme.colors.primaryContainer,
        },
        profileInfo: {
          flex: 1,
        },
        profileName: {
          fontSize: theme.custom.typography.headlineSmall.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.headlineSmall.letterSpacing,
        },
        profileSubtitle: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          color: theme.colors.onSurfaceVariant,
          marginTop: 2,
        },
        settingsButton: {
          backgroundColor: theme.colors.surfaceVariant,
        },

        // Statistics Section
        statisticsSection: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.xl,
        },
        statisticsHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.custom.spacing.lg,
        },
        statisticsTitle: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
        },
        filterButton: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "500",
          color: theme.colors.primary,
        },
        statisticsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        statCard: {
          width:
            (screenWidth -
              theme.custom.spacing.lg * 2 -
              theme.custom.spacing.sm) /
            2,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.config?.posterStyle.borderRadius ?? 12,
          padding: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.1,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
          elevation: 3,
        },
        statNumber: {
          fontSize: theme.custom.typography.headlineMedium.fontSize,
          fontWeight: "700",
          color: theme.colors.primary,
          marginBottom: theme.custom.spacing.xs,
        },
        statLabel: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },

        // Continue Watching Section
        continueWatchingSection: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.xl,
        },
        continueWatchingHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.custom.spacing.lg,
        },
        continueWatchingTitle: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
        },
        seeAllButtonSmall: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "500",
          color: theme.colors.primary,
        },
        continueWatchingList: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        continueWatchingCard: {
          width:
            (screenWidth -
              theme.custom.spacing.lg * 2 -
              theme.custom.spacing.sm) /
            2,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.config?.posterStyle.borderRadius ?? 12,
          marginBottom: theme.custom.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.1,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
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
          padding: theme.custom.spacing.sm,
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
          padding: theme.custom.spacing.md,
        },
        continueWatchingCardTitle: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: theme.custom.spacing.xs,
        },
        continueWatchingMeta: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          color: theme.colors.onSurfaceVariant,
        },

        // Trending TV Section
        trendingTVSection: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.xl,
        },
        trendingTVHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.custom.spacing.lg,
        },
        trendingTVSectionTitle: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
        },
        trendingTVList: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        trendingTVCard: {
          width:
            (screenWidth -
              theme.custom.spacing.lg * 2 -
              theme.custom.spacing.sm * 3) /
            4,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.config?.posterStyle.borderRadius ?? 12,
          marginBottom: theme.custom.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.1,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
          elevation: 3,
          overflow: "hidden",
        },
        trendingTVPoster: {
          width: "100%",
          height: 160,
          backgroundColor: theme.colors.surfaceVariant,
        },
        trendingTVContent: {
          padding: theme.custom.spacing.sm,
        },
        trendingTVTitle: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurface,
          textAlign: "center",
        },
        trendingTVRating: {
          fontSize: theme.custom.typography.labelSmall.fontSize,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginTop: 2,
        },

        // Upcoming Releases Section
        upcomingReleasesSection: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.xl,
        },
        upcomingReleasesHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.custom.spacing.lg,
        },
        upcomingReleasesTitle: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
        },
        upcomingReleasesList: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        },
        upcomingReleaseCard: {
          width:
            (screenWidth -
              theme.custom.spacing.lg * 2 -
              theme.custom.spacing.sm) /
            2,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.config?.posterStyle.borderRadius ?? 12,
          marginBottom: theme.custom.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.1,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
          elevation: 3,
          overflow: "hidden",
        },
        upcomingReleasePoster: {
          width: "100%",
          height: 100,
          backgroundColor: theme.colors.surfaceVariant,
        },
        upcomingReleaseContent: {
          padding: theme.custom.spacing.md,
        },
        upcomingReleaseTitle: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: theme.custom.spacing.xs,
        },
        upcomingReleaseMeta: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          color: theme.colors.onSurfaceVariant,
        },
        releaseDateBadge: {
          fontSize: theme.custom.typography.labelSmall.fontSize,
          fontWeight: "500",
          color: theme.colors.onPrimary,
          backgroundColor: theme.colors.primary,
          paddingHorizontal: theme.custom.spacing.xs,
          paddingVertical: 2,
          borderRadius: 4,
          alignSelf: "flex-start",
          marginTop: theme.custom.spacing.xs,
        },

        // Recent Activity Section
        recentActivityHeader: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.lg,
        },
        recentActivityTitle: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
        },
        recentActivityList: {
          paddingHorizontal: theme.custom.spacing.lg,
        },
        activityCard: {
          flexDirection: "row",
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.config?.posterStyle.borderRadius ?? 12,
          padding: theme.custom.spacing.md,
          marginBottom: theme.custom.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.1,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
          elevation: 3,
        },
        activityImage: {
          width: 50,
          height: 75,
          borderRadius: 8,
          marginRight: theme.custom.spacing.md,
          backgroundColor: theme.colors.surfaceVariant,
        },
        activityContent: {
          flex: 1,
          justifyContent: "center",
        },
        activityTitle: {
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: 4,
        },
        activityShow: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          color: theme.colors.onSurfaceVariant,
          marginBottom: 4,
        },
        activityDate: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
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
          <AnimatedSection delay={0}>
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
                <View style={styles.headerActions}>
                  <IconButton
                    icon="download"
                    size={24}
                    iconColor={theme.colors.onSurfaceVariant}
                    style={styles.settingsButton}
                    onPress={() => router.push("/(auth)/jellyfin-downloads")}
                  />
                  <IconButton
                    icon="cog"
                    size={24}
                    iconColor={theme.colors.onSurfaceVariant}
                    style={styles.settingsButton}
                    onPress={() => router.push("/(auth)/settings")}
                  />
                </View>
              </View>
            </View>
          </AnimatedSection>
        );

      case "widgets":
        return (
          <AnimatedSection
            delay={100}
            style={{
              paddingHorizontal: theme.custom.spacing.lg,
              marginTop: theme.custom.spacing.md,
            }}
          >
            <WidgetContainer editable={true} />
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
