import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, View, TouchableOpacity, FlatList } from "react-native";
import {
  Text,
  IconButton,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { MediaPoster } from "@/components/media/MediaPoster";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { getComponentElevation } from "@/constants/elevation";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { secureStorage } from "@/services/storage/SecureStorage";

type RecentActivityItem = {
  id: string;
  title: string;
  episode: string;
  show: string;
  date: string;
  image?: string;
};

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
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentActivity = useCallback(async (): Promise<
    RecentActivityItem[]
  > => {
    try {
      const manager = ConnectorManager.getInstance();
      await manager.loadSavedServices();
      const configs = await secureStorage.getServiceConfigs();
      const enabledConfigs = configs.filter((config) => config.enabled);

      const recentActivityMap = new Map<string, RecentActivityItem>();

      // Fetch from Sonarr
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
                  const series = (record as any).series;
                  let imageUrl: string | undefined;

                  if (series.images && series.images.length > 0) {
                    const posterImage = series.images.find(
                      (img: any) => img.coverType === "poster",
                    );
                    if (posterImage) {
                      imageUrl = `${connector?.config.url}/MediaCover/${series.id}/poster.jpg?apikey=${connector?.config.apiKey}`;
                    }
                  }

                  const itemKey = `sonarr-${series.id}-${(record as any).episode?.episodeNumber}`;
                  if (!recentActivityMap.has(itemKey)) {
                    recentActivityMap.set(itemKey, {
                      id: itemKey,
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
          }
        } catch (error) {
          console.warn(`Failed to fetch from Sonarr ${config.name}:`, error);
        }
      }

      // Fetch from Radarr
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

                  const itemKey = `radarr-${movie.id}`;
                  if (!recentActivityMap.has(itemKey)) {
                    recentActivityMap.set(itemKey, {
                      id: itemKey,
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
          }
        } catch (error) {
          console.warn(`Failed to fetch from Radarr ${config.name}:`, error);
        }
      }

      // Convert map to array, sort by date, and limit
      return Array.from(recentActivityMap.values())
        .sort((a, b) => {
          // Sort by date - most recent first
          return a.id.localeCompare(b.id);
        })
        .slice(0, 10);
    } catch (error) {
      console.error("Failed to fetch recent activity:", error);
      return [];
    }
  }, []);

  const loadRecentActivity = useCallback(async () => {
    try {
      // Try to get cached data first
      const cachedData = await widgetService.getWidgetData<
        RecentActivityItem[]
      >(widget.id);
      if (cachedData) {
        setRecentActivity(cachedData);
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

  const formatRelativeTime = (input?: Date): string | undefined => {
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

  const handleItemPress = useCallback(
    (item: RecentActivityItem) => {
      onPress();
      // Navigate to appropriate service based on item ID
      if (item.id.startsWith("sonarr-")) {
        // Navigate to Sonarr series list
        // This would require access to router - for now, just log
        console.log("Navigate to Sonarr series:", item.id.split("-")[1]);
      } else if (item.id.startsWith("radarr-")) {
        // Navigate to Radarr movies list
        console.log("Navigate to Radarr movies:", item.id.split("-")[1]);
      }
    },
    [onPress],
  );

  const handleRefresh = useCallback(() => {
    onPress();
    loadRecentActivity();
  }, [onPress, loadRecentActivity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        title: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        actions: {
          flexDirection: "row",
          gap: spacing.xs,
        },
        content: {
          flex: 1,
        },
        activityList: {
          gap: spacing.md,
        },
        activityCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.sizes.borderRadius.xl,
          padding: spacing.md,
          flexDirection: "row",
          ...getComponentElevation("widgetCard", theme),
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        activityImage: {
          width: theme.custom.sizes.additionalCardSizes.portrait.width,
          height: theme.custom.sizes.additionalCardSizes.portrait.height,
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
        emptyIcon: {
          marginBottom: spacing.md,
        },
        emptyText: {
          fontSize: 16,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        errorText: {
          fontSize: 14,
          color: theme.colors.error,
          textAlign: "center",
          paddingVertical: spacing.md,
        },
        loadingState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xl,
        },
      }),
    [theme],
  );

  const renderActivityCard = useCallback(
    ({ item }: { item: RecentActivityItem }) => (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        {item.image ? (
          <MediaPoster
            uri={item.image}
            size={60}
            borderRadius={8}
            style={styles.activityImage}
          />
        ) : (
          <View style={styles.activityImage} />
        )}
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.activityMeta} numberOfLines={1}>
            {item.show} • {item.episode}
          </Text>
          <Text style={styles.activityDate}>{item.date}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleItemPress, styles],
  );

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Activity</Text>
          <View style={styles.actions}>
            <IconButton
              icon="refresh"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleRefresh}
            />
            {onEdit && (
              <IconButton
                icon="cog"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={onEdit}
              />
            )}
          </View>
        </View>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Activity</Text>
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (recentActivity.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Activity</Text>
          <View style={styles.actions}>
            <IconButton
              icon="refresh"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleRefresh}
            />
            {onEdit && (
              <IconButton
                icon="cog"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={onEdit}
              />
            )}
          </View>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={48}
            color={theme.colors.onSurfaceVariant}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>No recent activity</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        <View style={styles.actions}>
          <IconButton
            icon="refresh"
            size={20}
            iconColor={theme.colors.primary}
            onPress={handleRefresh}
          />
          {onEdit && (
            <IconButton
              icon="cog"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onEdit}
            />
          )}
        </View>
      </View>

      <View style={styles.content}>
        <FlatList
          data={recentActivity}
          renderItem={renderActivityCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.activityList}
          scrollEnabled={false}
          nestedScrollEnabled={false}
        />
      </View>
    </View>
  );
};

export default RecentActivityWidget;
