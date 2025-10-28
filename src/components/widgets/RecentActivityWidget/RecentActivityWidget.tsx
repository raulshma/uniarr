import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import { Text, IconButton, useTheme, Card } from "react-native-paper";
import { useRouter } from "expo-router";
import Animated from "react-native-reanimated";

import { MediaPoster } from "@/components/media/MediaPoster";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { useHaptics } from "@/hooks/useHaptics";
import {
  COMPONENT_ANIMATIONS,
  FadeIn,
  FadeOut,
  ANIMATION_DURATIONS,
} from "@/utils/animations.utils";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { getComponentElevation } from "@/constants/elevation";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { secureStorage } from "@/services/storage/SecureStorage";
import { createCrossServiceKey } from "@/utils/dedupe.utils";
import { createServiceNavigation } from "@/utils/navigation.utils";
import { alert } from "@/services/dialogService";
import { useSettingsStore } from "@/store/settingsStore";
import type { RecentActivityItem } from "@/models/recentActivity.types";
import { borderRadius } from "@/constants/sizes";

interface RecentActivityWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const recentActivitySourceIds = useSettingsStore(
    (s) => s.recentActivitySourceServiceIds,
  );

  const { onPress } = useHaptics();
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecentActivity = useCallback(async (): Promise<
    RecentActivityItem[]
  > => {
    const formatRelativeTimeLocal = (input?: Date): string | undefined => {
      if (!input) return undefined;

      const diffMs = Date.now() - input.getTime();
      if (diffMs < 0) return "Just now";

      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;

      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;

      const weeks = Math.floor(days / 7);
      if (weeks < 5) return `${weeks}w ago`;

      const months = Math.floor(days / 30);
      return `${months}mo ago`;
    };

    try {
      const manager = ConnectorManager.getInstance();
      await manager.loadSavedServices();
      const configs = await secureStorage.getServiceConfigs();
      const enabledConfigs = configs.filter((config) => config.enabled);

      // Filter by recent activity sources if set
      let sourceConfigs = enabledConfigs;
      if (
        recentActivitySourceIds !== undefined &&
        recentActivitySourceIds.length > 0
      ) {
        sourceConfigs = enabledConfigs.filter((c) =>
          recentActivitySourceIds.includes(c.id),
        );
      }

      // Map to aggregate items by cross-service key
      const dedupeMap = new Map<string, RecentActivityItem>();

      // Fetch from Sonarr
      const sonarrConfigs = sourceConfigs.filter(
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
                  const series = (record as any).series;
                  const episode = (record as any).episode;
                  let imageUrl: string | undefined;

                  if (series.images && series.images.length > 0) {
                    const posterImage = series.images.find(
                      (img: any) => img.coverType === "poster",
                    );
                    if (posterImage) {
                      imageUrl = `${connector?.config.url}/MediaCover/${series.id}/poster.jpg?apikey=${connector?.config.apiKey}`;
                    }
                  }

                  // Create cross-service key for deduplication
                  const dedupeKey = createCrossServiceKey(
                    {
                      serviceId: config.id,
                      serviceType: "sonarr",
                      serviceName: config.name,
                      nativeId: series.id,
                      seriesId: series.id,
                      episodeNumber: episode?.episodeNumber,
                    },
                    true, // isEpisode
                  );

                  const dateObj = new Date((record as any).date);
                  const episodeDisplay = episode
                    ? `S${episode.seasonNumber?.toString().padStart(2, "0")}E${episode.episodeNumber?.toString().padStart(2, "0")}`
                    : "";

                  if (dedupeMap.has(dedupeKey)) {
                    // Merge origins for multi-service items
                    const existing = dedupeMap.get(dedupeKey)!;
                    if (!existing.originServiceIds.includes(config.id)) {
                      existing.originServiceIds.push(config.id);
                      existing.originServices.push({
                        serviceId: config.id,
                        serviceType: "sonarr",
                        serviceName: config.name,
                      });
                      existing.serviceTypes = Array.from(
                        new Set([...existing.serviceTypes, "sonarr"]),
                      );
                      // Update timestamp to most recent
                      if (dateObj.getTime() > (existing.timestamp ?? 0)) {
                        existing.timestamp = dateObj.getTime();
                        existing.date =
                          formatRelativeTimeLocal(dateObj) || "Unknown";
                      }
                      // Update image if we have one
                      if (imageUrl && !existing.image) {
                        existing.image = imageUrl;
                      }
                    }
                  } else {
                    dedupeMap.set(dedupeKey, {
                      id: dedupeKey,
                      title: series.title || "Unknown",
                      episode: episodeDisplay,
                      show: series.title || "",
                      date: formatRelativeTimeLocal(dateObj) || "Unknown",
                      timestamp: dateObj.getTime(),
                      image: imageUrl,
                      contentId: series.id,
                      serviceTypes: ["sonarr"],
                      originServiceIds: [config.id],
                      originServices: [
                        {
                          serviceId: config.id,
                          serviceType: "sonarr",
                          serviceName: config.name,
                        },
                      ],
                      isEpisode: !!episode,
                      episodeInfo: episode
                        ? {
                            seriesId: series.id,
                            seasonNumber: episode.seasonNumber,
                            episodeNumber: episode.episodeNumber,
                          }
                        : undefined,
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch from Sonarr ${config.name}:`, error);
        }
      }

      // Fetch from Radarr
      const radarrConfigs = sourceConfigs.filter(
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
                  const movie = (record as any).movie;
                  let imageUrl: string | undefined;

                  if (movie.images && movie.images.length > 0) {
                    const posterImage = movie.images.find(
                      (img: any) => img.coverType === "poster",
                    );
                    if (posterImage) {
                      imageUrl = `${connector?.config.url}/MediaCover/${movie.id}/poster.jpg?apikey=${connector?.config.apiKey}`;
                    }
                  }

                  // Create cross-service key
                  const dedupeKey = createCrossServiceKey(
                    {
                      serviceId: config.id,
                      serviceType: "radarr",
                      serviceName: config.name,
                      nativeId: movie.id,
                    },
                    false,
                  );

                  const dateObj = new Date((record as any).date);

                  if (dedupeMap.has(dedupeKey)) {
                    // Merge origins
                    const existing = dedupeMap.get(dedupeKey)!;
                    if (!existing.originServiceIds.includes(config.id)) {
                      existing.originServiceIds.push(config.id);
                      existing.originServices.push({
                        serviceId: config.id,
                        serviceType: "radarr",
                        serviceName: config.name,
                      });
                      existing.serviceTypes = Array.from(
                        new Set([...existing.serviceTypes, "radarr"]),
                      );
                      if (dateObj.getTime() > (existing.timestamp ?? 0)) {
                        existing.timestamp = dateObj.getTime();
                        existing.date =
                          formatRelativeTimeLocal(dateObj) || "Unknown";
                      }
                      if (imageUrl && !existing.image) {
                        existing.image = imageUrl;
                      }
                    }
                  } else {
                    dedupeMap.set(dedupeKey, {
                      id: dedupeKey,
                      title: movie.title || "Unknown",
                      episode: "Movie",
                      show: movie.title || "",
                      date: formatRelativeTimeLocal(dateObj) || "Unknown",
                      timestamp: dateObj.getTime(),
                      image: imageUrl,
                      contentId: movie.id,
                      serviceTypes: ["radarr"],
                      originServiceIds: [config.id],
                      originServices: [
                        {
                          serviceId: config.id,
                          serviceType: "radarr",
                          serviceName: config.name,
                        },
                      ],
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch from Radarr ${config.name}:`, error);
        }
      }

      // Convert map to array, sort by date (most recent first), and limit
      return Array.from(dedupeMap.values())
        .sort((a, b) => {
          // Sort by timestamp in descending order (most recent first)
          const timestampA = a.timestamp ?? 0;
          const timestampB = b.timestamp ?? 0;
          return timestampB - timestampA;
        })
        .slice(0, 10);
    } catch (error) {
      console.error("Failed to fetch recent activity:", error);
      return [];
    }
  }, [recentActivitySourceIds]);

  const loadRecentActivity = useCallback(async () => {
    try {
      // Try to get cached data first
      const cachedData = await widgetService.getWidgetData<
        RecentActivityItem[]
      >(widget.id);
      if (cachedData) {
        // Filter out cached items missing required navigation fields (backward compatibility)
        const validatedData = cachedData.filter(
          (item) =>
            item.contentId !== undefined &&
            item.contentId !== null &&
            item.serviceTypes &&
            item.serviceTypes.length > 0 &&
            item.originServices &&
            item.originServices.length > 0,
        );
        setRecentActivity(validatedData);
        setLoading(false);
        setError(null);
        // Don't return, continue to fetch fresh data in background
      } else {
        // Only show loading if no cached data
        setLoading(true);
      }

      // Fetch fresh data
      const freshData = await fetchRecentActivity();
      setRecentActivity(freshData);
      setError(null);

      // Cache the data for 5 minutes
      await widgetService.setWidgetData(widget.id, freshData, 5 * 60 * 1000);
    } catch (err) {
      console.error("Failed to load recent activity:", err);
      setError("Failed to load recent activity");
    } finally {
      setLoading(false);
    }
  }, [widget.id, fetchRecentActivity]);

  useEffect(() => {
    loadRecentActivity();
  }, [loadRecentActivity]);

  const handleItemPress = useCallback(
    (item: RecentActivityItem) => {
      onPress();

      // Validate required navigation fields
      if (
        item.contentId === undefined ||
        item.contentId === null ||
        !item.serviceTypes ||
        item.serviceTypes.length === 0 ||
        !item.originServices ||
        item.originServices.length === 0
      ) {
        alert(
          "This should not happen",
          "Missing service or content information for this item.",
        );
        return;
      }

      // Handle single-origin items
      if (item.originServices.length === 1) {
        const origin = item.originServices[0]!;
        // For Sonarr episodes, navigate to series detail
        const itemId =
          item.isEpisode && item.episodeInfo?.seriesId
            ? item.episodeInfo.seriesId
            : item.contentId;

        createServiceNavigation(origin.serviceType).navigateToDetail(
          router,
          origin.serviceId,
          itemId,
        );
      } else {
        // Handle multi-origin aggregated items
        // For now, navigate to the first origin (or preferred if set)
        const origin = item.originServices[0]!;
        const itemId =
          item.isEpisode && item.episodeInfo?.seriesId
            ? item.episodeInfo.seriesId
            : item.contentId;

        createServiceNavigation(origin.serviceType).navigateToDetail(
          router,
          origin.serviceId,
          itemId,
        );
      }
    },
    [onPress, router],
  );

  const handleRefresh = useCallback(async () => {
    onPress();
    setRefreshing(true);
    await loadRecentActivity();
    setRefreshing(false);
  }, [onPress, loadRecentActivity]);

  const containerElevationStyle = getComponentElevation("widget", theme);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: borderRadius.xl,
          padding: spacing.md,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.md,
        },
        title: {
          fontWeight: "600",
        },
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: spacing.lg,
        },
        activityCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.sizes.borderRadius.xl,
          padding: spacing.md,
          flexDirection: "row",
          marginBottom: spacing.sm,
          ...getComponentElevation("widgetCard", theme),
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        activityImage: {
          width: theme.custom.sizes.additionalCardSizes.portrait.width, // 60 * 1.5 = 90 (50% bigger)
          height: theme.custom.sizes.additionalCardSizes.portrait.height, // 80 * 1.5 = 120 (50% bigger)
          borderRadius: theme.custom.sizes.borderRadius.md,
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
          marginBottom: spacing.xs,
        },
        activityMeta: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        activityDate: {
          fontSize: 12,
          color: theme.colors.outline,
        },
        emptyState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xl,
        },
        emptyText: {
          fontSize: 16,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        loadingSkeleton: {
          gap: spacing.md,
        },
        skeletonCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.sizes.borderRadius.xl,
          padding: spacing.md,
          flexDirection: "row",
          marginBottom: spacing.sm,
          ...getComponentElevation("widgetCard", theme),
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
      }),
    [theme],
  );

  if (error) {
    return (
      <Card
        style={[
          styles.container,
          { backgroundColor: theme.colors.surface },
          containerElevationStyle,
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            {widget.title}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="refresh" onPress={handleRefresh} />
            {onEdit && <IconButton icon="cog" onPress={onEdit} />}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyState}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              {error}
            </Text>
          </View>
        </ScrollView>
      </Card>
    );
  }

  if (loading) {
    return (
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: theme.colors.surface },
          containerElevationStyle,
        ]}
        entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.NORMAL)}
      >
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            {widget.title}
          </Text>
        </View>
        <View style={styles.loadingSkeleton}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.skeletonCard}>
              <View style={styles.activityImage} />
              <View style={styles.activityContent}>
                <SkeletonPlaceholder
                  width="80%"
                  height={16}
                  borderRadius={4}
                  style={{ marginBottom: spacing.xs }}
                />
                <SkeletonPlaceholder
                  width="60%"
                  height={14}
                  borderRadius={4}
                  style={{ marginBottom: spacing.xs }}
                />
                <SkeletonPlaceholder width="40%" height={12} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  if (recentActivity.length === 0) {
    return (
      <Card
        style={[
          styles.container,
          { backgroundColor: theme.colors.surface },
          containerElevationStyle,
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            {widget.title}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="refresh" onPress={handleRefresh} />
            {onEdit && <IconButton icon="cog" onPress={onEdit} />}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyState}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No recent activity
            </Text>
            <Text
              variant="bodySmall"
              style={{ opacity: 0.7, marginTop: spacing.xs }}
            >
              Recent activity will appear here
            </Text>
          </View>
        </ScrollView>
      </Card>
    );
  }

  return (
    <Card
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface },
        containerElevationStyle,
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          {widget.title}
        </Text>
        <View style={{ flexDirection: "row" }}>
          <IconButton icon="refresh" onPress={handleRefresh} />
          {onEdit && <IconButton icon="cog" onPress={onEdit} />}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={COMPONENT_ANIMATIONS.SECTION_ENTRANCE(100)}>
          {recentActivity.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={COMPONENT_ANIMATIONS.LIST_ITEM_STAGGER(index, 50).delay(
                150,
              )}
            >
              <View
                style={styles.activityCard}
                onTouchEnd={() => handleItemPress(item)}
              >
                {item.image ? (
                  <MediaPoster
                    uri={item.image}
                    size={90}
                    borderRadius={8}
                    style={styles.activityImage}
                  />
                ) : (
                  <View style={styles.activityImage} />
                )}
                <View style={styles.activityContent}>
                  <Text variant="titleMedium" style={styles.activityTitle}>
                    {item.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.activityMeta}>
                    {item.show} • {item.episode}
                  </Text>
                  <Text variant="bodySmall" style={styles.activityDate}>
                    {item.date}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
    </Card>
  );
};

export default RecentActivityWidget;
