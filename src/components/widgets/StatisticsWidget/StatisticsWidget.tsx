import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, View, TouchableOpacity, Dimensions } from "react-native";
import Animated from "react-native-reanimated";
import { Text, useTheme, Button, Portal, Dialog } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { Card } from "@/components/common";
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { borderRadius, iconSizes } from "@/constants/sizes";
import { getComponentElevation } from "@/constants/elevation";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { secureStorage } from "@/services/storage/SecureStorage";
import { COMPONENT_ANIMATIONS } from "@/utils/animations.utils";
import { useSettingsStore } from "@/store/settingsStore";

type StatisticsData = {
  shows: number;
  movies: number;
  episodes: number;
  watched: number;
};

interface StatisticsWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

const StatisticsWidget: React.FC<StatisticsWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const [statistics, setStatistics] = useState<StatisticsData>({
    shows: 0,
    movies: 0,
    episodes: 0,
    watched: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDialogVisible, setFilterDialogVisible] = useState(false);
  const [filter, setFilter] = useState<"all" | "recent" | "month">("all");

  // Load filter from widget config
  useEffect(() => {
    if (widget.config?.filter) {
      setFilter(widget.config.filter);
    }
  }, [widget.config]);

  const loadStatistics = useCallback(async () => {
    try {
      // Try to get cached data first
      const cacheKey = `${widget.id}-${filter}`;
      const cachedData =
        await widgetService.getWidgetData<StatisticsData>(cacheKey);
      if (cachedData) {
        setStatistics(cachedData);
        setLoading(false);
        setError(null);
        // Don't return, continue to fetch fresh data in background
      } else {
        // Only show loading if no cached data
        setLoading(true);
      }

      // Fetch fresh data
      const freshData = await fetchStatistics(filter);
      setStatistics(freshData);
      setError(null);

      // Cache the data for 10 minutes
      await widgetService.setWidgetData(cacheKey, freshData, 10 * 60 * 1000);
    } catch (err) {
      console.error("Failed to load statistics:", err);
      setError("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  }, [filter, widget.id]);

  useEffect(() => {
    loadStatistics();
  }, [filter, loadStatistics]);

  const fetchStatistics = async (
    filterType: "all" | "recent" | "month" = "all",
  ): Promise<StatisticsData> => {
    try {
      const manager = ConnectorManager.getInstance();
      await manager.loadSavedServices();
      const configs = await secureStorage.getServiceConfigs();
      const enabledConfigs = configs.filter((config) => config.enabled);

      const now = new Date();
      let cutoffDate: Date | null = null;
      if (filterType === "recent") {
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      } else if (filterType === "month") {
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      }

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
            const series = await sonarrConnector.getSeries?.();
            if (series) {
              let filteredSeries = series;
              if (cutoffDate) {
                filteredSeries = series.filter((s: any) => {
                  const added = new Date(s.added);
                  return added >= cutoffDate!;
                });
              }
              shows += filteredSeries.length;
              episodes += filteredSeries.reduce(
                (sum: number, s: any) => sum + (s.episodeFileCount || 0),
                0,
              );
              watched += filteredSeries.reduce(
                (sum: number, s: any) => sum + (s.episodeCount || 0),
                0,
              );
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch from Sonarr ${config.name}:`, error);
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
            const moviesList = await radarrConnector.getMovies?.();
            if (moviesList) {
              let filteredMovies = moviesList;
              if (cutoffDate) {
                filteredMovies = moviesList.filter((m: any) => {
                  const added = new Date(m.added);
                  return added >= cutoffDate!;
                });
              }
              movies += filteredMovies.filter((m: any) => m.hasFile).length;
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch from Radarr ${config.name}:`, error);
        }
      }

      return {
        shows,
        movies,
        episodes,
        watched,
      };
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
      return {
        shows: 0,
        movies: 0,
        episodes: 0,
        watched: 0,
      };
    }
  };

  const handleStatCardPress = (label: string) => {
    onPress();
    // Navigate to appropriate pages based on statistics type
    // This would require access to router - for now, just log
    console.log("Navigate to:", label);
  };

  const handleRefresh = () => {
    onPress();
    loadStatistics();
  };

  const handleFilterSelect = (selectedFilter: "all" | "recent" | "month") => {
    setFilter(selectedFilter);
    setFilterDialogVisible(false);

    // Update widget config
    widgetService.updateWidget(widget.id, {
      config: { ...widget.config, filter: selectedFilter },
    });
  };

  const getFilterLabel = () => {
    switch (filter) {
      case "all":
        return "All";
      case "recent":
        return "Recent";
      case "month":
        return "Month";
      default:
        return "All";
    }
  };

  const screenWidth = Dimensions.get("window").width;
  const cardSize =
    (screenWidth - theme.custom.spacing.lg * 2 - theme.custom.spacing.md) / 2 -
    theme.custom.spacing.sm;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: borderRadius.xl,
        },
        container: {
          flex: 1,
        },
        title: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        filterButton: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "500",
          color: theme.colors.primary,
        },
        content: {
          flex: 1,
        },
        statsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: theme.custom.spacing.sm,
        },
        statCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.xl,
          padding: theme.custom.spacing.lg,
          alignItems: "flex-start",
          width: cardSize,
          minHeight: 120,
          ...getComponentElevation("widgetCard", theme),
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        statIconContainer: {
          width: iconSizes.xxl,
          height: iconSizes.xxl,
          borderRadius: borderRadius.xxl,
          backgroundColor: theme.colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: theme.custom.spacing.md,
        },
        statNumber: {
          fontSize: theme.custom.typography.headlineSmall.fontSize,
          fontWeight: "700",
          color: theme.colors.onSurface,
          marginBottom: theme.custom.spacing.xs,
        },
        statLabel: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
        },
        errorText: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          color: theme.colors.error,
          textAlign: "center",
          paddingVertical: theme.custom.spacing.md,
        },
        loadingSkeleton: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: theme.custom.spacing.sm,
        },
        statSkeleton: {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.xl,
          padding: theme.custom.spacing.lg,
          alignItems: "flex-start",
          width: cardSize,
          minHeight: 120,
          ...getComponentElevation("widgetCard", theme),
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        skeletonIconContainer: {
          width: iconSizes.lg,
          height: iconSizes.lg,
          borderRadius: borderRadius.lg,
          backgroundColor: theme.colors.primaryContainer,
          marginBottom: theme.custom.spacing.md,
        },
        skeletonNumber: {
          width: iconSizes.lg,
          height: iconSizes.md + 8,
          borderRadius: borderRadius.sm,
          marginBottom: theme.custom.spacing.xs,
        },
        skeletonLabel: {
          width: iconSizes.lg + 10,
          height: iconSizes.sm - 2,
          borderRadius: borderRadius.sm,
        },
      }),
    [theme, cardSize],
  );

  if (error) {
    return (
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
        <View style={styles.container}>
          <WidgetHeader
            title={widget.title}
            onEdit={onEdit}
            onRefresh={handleRefresh}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
        <View style={styles.container}>
          <WidgetHeader
            title={widget.title}
            onEdit={onEdit}
            onRefresh={handleRefresh}
          />
          <View style={styles.loadingSkeleton}>
            {[1, 2, 3, 4].map((key) => (
              <View key={key} style={styles.statSkeleton}>
                <View style={styles.skeletonIconContainer} />
                <SkeletonPlaceholder style={styles.skeletonNumber} />
                <SkeletonPlaceholder style={styles.skeletonLabel} />
              </View>
            ))}
          </View>
        </View>
      </Card>
    );
  }

  const statItems = [
    { number: statistics.shows, label: "Shows", icon: "television" as const },
    { number: statistics.movies, label: "Movies", icon: "movie" as const },
    {
      number: statistics.episodes,
      label: "Episodes",
      icon: "play-box-multiple" as const,
    },
    { number: statistics.watched, label: "Watched", icon: "eye" as const },
  ];

  // itemsToShow intentionally omitted; layout uses responsive grid

  return (
    <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
      <View style={styles.container}>
        <WidgetHeader
          title={widget.title}
          onEdit={onEdit}
          onRefresh={handleRefresh}
          additionalActions={
            <TouchableOpacity onPress={() => setFilterDialogVisible(true)}>
              <Text style={styles.filterButton}>{getFilterLabel()}</Text>
            </TouchableOpacity>
          }
        />

        <Animated.View
          style={styles.content}
          entering={COMPONENT_ANIMATIONS.SECTION_ENTRANCE(100)}
        >
          <View style={styles.statsGrid}>
            {statItems.slice(0, 4).map((item, index) => (
              <Animated.View
                key={item.label}
                entering={COMPONENT_ANIMATIONS.LIST_ITEM_STAGGER(
                  index,
                  100,
                ).delay(150)}
                style={[]}
              >
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => handleStatCardPress(item.label)}
                  activeOpacity={0.7}
                >
                  <View style={styles.statIconContainer}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={24}
                      color={theme.colors.onPrimaryContainer}
                    />
                  </View>
                  <Text style={styles.statNumber}>{item.number}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Filter Selection Dialog */}
        <Portal>
          <Dialog
            visible={filterDialogVisible}
            onDismiss={() => setFilterDialogVisible(false)}
            style={{
              borderRadius: borderRadius.lg,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Dialog.Title style={{ color: theme.colors.onSurface }}>
              Filter Statistics
            </Dialog.Title>
            <Dialog.Content>
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: theme.custom.spacing.md,
                }}
              >
                Select time range for statistics:
              </Text>
              <View style={{ gap: theme.custom.spacing.xs }}>
                {[
                  { key: "all" as const, label: "All Time" },
                  { key: "recent" as const, label: "Recent (7 days)" },
                  { key: "month" as const, label: "This Month" },
                ].map((option) => (
                  <Button
                    key={option.key}
                    mode={filter === option.key ? "contained" : "outlined"}
                    onPress={() => handleFilterSelect(option.key)}
                    style={{ marginVertical: 0 }}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                mode="outlined"
                onPress={() => setFilterDialogVisible(false)}
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </Card>
  );
};

export default StatisticsWidget;
