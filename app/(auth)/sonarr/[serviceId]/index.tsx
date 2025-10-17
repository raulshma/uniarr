import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import {
  Icon,
  IconButton,
  Menu,
  Searchbar,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
// Animations disabled on this list page for snappy UX. Detail pages retain their animations.

import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { MediaPoster } from "@/components/media/MediaPoster";
import MediaEditor, { type MediaItem } from "@/components/media/MediaEditor";
import {
  MediaSelectorProvider,
  MediaSelectorActions,
  MediaSelectableItem,
  type SelectableMediaItem,
} from "@/components/media/MediaSelector";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { SeriesListItemSkeleton } from "@/components/media/skeletons";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useSonarrSeries } from "@/hooks/useSonarrSeries";
import type { Series } from "@/models/media.types";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

const FILTER_ALL = "all";
const FILTER_MONITORED = "monitored";
const FILTER_UNMONITORED = "unmonitored";

type FilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_MONITORED
  | typeof FILTER_UNMONITORED;

const FILTER_OPTIONS: FilterValue[] = [
  FILTER_ALL,
  FILTER_MONITORED,
  FILTER_UNMONITORED,
];

const FILTER_LABELS: Record<FilterValue, string> = {
  [FILTER_ALL]: "All Statuses",
  [FILTER_MONITORED]: "Monitored",
  [FILTER_UNMONITORED]: "Unmonitored",
};

const SonarrSeriesListScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const hasValidServiceId = serviceId.length > 0;

  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterValue, setFilterValue] = useState<FilterValue>(FILTER_ALL);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Series | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);

  const { series, isLoading, isFetching, isError, error, refetch } =
    useSonarrSeries(serviceId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      if (!hasValidServiceId) {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        if (!manager.getConnector(serviceId)) {
          await manager.loadSavedServices();
        }
      } catch (bootstrapError) {
        const message =
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Unknown connector bootstrap error.";

        void logger.warn("Failed to preload Sonarr connector.", {
          location: "SonarrSeriesListScreen.bootstrap",
          serviceId,
          message,
        });
      } finally {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [hasValidServiceId, manager, serviceId]);

  useFocusEffect(
    useCallback(() => {
      if (!hasValidServiceId) {
        return;
      }

      void refetch();
    }, [hasValidServiceId, refetch]),
  );

  const connector = hasValidServiceId
    ? manager.getConnector(serviceId)
    : undefined;
  const connectorIsSonarr = connector?.config.type === "sonarr";

  const isRefreshing = isFetching && !isLoading;
  const isInitialLoad = isBootstrapping || isLoading;

  const filteredSeries = useMemo(() => {
    if (!series) {
      return [] as Series[];
    }

    const query = debouncedSearch;

    return series.filter((item) => {
      if (filterValue === FILTER_MONITORED && !item.monitored) {
        return false;
      }

      if (filterValue === FILTER_UNMONITORED && item.monitored) {
        return false;
      }

      if (query.length === 0) {
        return true;
      }

      const candidates = [item.title, item.sortTitle, item.cleanTitle]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return candidates.some((candidate) => candidate.includes(query));
    });
  }, [debouncedSearch, filterValue, series]);

  const totalSeries = series?.length ?? 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        listHeader: {
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
        },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.lg,
        },
        topBarSpacer: {
          width: 48,
        },
        topBarTitle: {
          flex: 1,
          textAlign: "center",
          color: theme.colors.onBackground,
        },
        topBarAction: {
          margin: 0,
        },
        searchBar: {
          borderRadius: 20,
          marginBottom: spacing.md,
          backgroundColor: theme.colors.surfaceVariant,
        },
        searchInput: {
          color: theme.colors.onSurface,
        },
        filterRow: {
          flexDirection: "row",
          marginBottom: spacing.lg,
        },
        filterButton: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 16,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
        },
        filterButtonLabel: {
          color: theme.colors.onSurface,
        },
        filterButtonContent: {
          flexDirection: "row",
          alignItems: "center",
        },
        filterButtonIcon: {
          marginLeft: spacing.xs,
        },
        filterMenu: {
          borderRadius: 16,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        itemSpacing: {
          height: spacing.md,
        },
        seriesCard: {
          flexDirection: "row",
          padding: spacing.md,
          borderRadius: 18,
        },
        seriesCardPressed: {
          opacity: 0.9,
        },
        seriesPoster: {
          marginRight: spacing.lg,
        },
        seriesMeta: {
          flex: 1,
          justifyContent: "center",
        },
        seriesTitle: {
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        seriesStatus: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.sm,
        },
        progressTrack: {
          height: 6,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: theme.colors.surfaceVariant,
          marginBottom: spacing.xs,
        },
        progressFill: {
          height: "100%",
          backgroundColor: theme.colors.primary,
        },
        episodesMeta: {
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const handleSeriesPress = useCallback(
    (item: SelectableMediaItem) => {
      if (!hasValidServiceId) {
        return;
      }

      router.push({
        pathname: "/(auth)/sonarr/[serviceId]/series/[id]",
        params: {
          serviceId,
          id: item.id.toString(),
        },
      });
    },
    [hasValidServiceId, router, serviceId],
  );

  const handleAddSeries = useCallback(() => {
    if (!hasValidServiceId) {
      alert("Invalid service", "The selected service identifier is not valid.");
      return;
    }

    router.push({
      pathname: "/(auth)/sonarr/[serviceId]/add",
      params: { serviceId },
    });
  }, [hasValidServiceId, router, serviceId]);

  const handleEditSeries = useCallback((item: Series) => {
    setEditingItem(item);
    setIsEditorVisible(true);
  }, []);

  const handleEditorDismiss = useCallback(() => {
    setIsEditorVisible(false);
    setEditingItem(null);
  }, []);

  const handleEditorSave = useCallback(
    async (updatedItem: MediaItem) => {
      // The updated item is already saved via the connector in MediaEditor
      await refetch();
    },
    [refetch],
  );

  const handleSeriesLongPress = useCallback(
    (item: SelectableMediaItem) => {
      handleEditSeries(item as Series);
    },
    [handleEditSeries],
  );

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterValue(FILTER_ALL);
    setStatusMenuVisible(false);
  }, []);

  const handleStatusChange = useCallback((value: FilterValue) => {
    setFilterValue(value);
    setStatusMenuVisible(false);
  }, []);

  const renderSeriesItem = useCallback(
    ({ item, index }: { item: Series; index: number }) => {
      const totalEpisodes =
        item.episodeCount ?? item.statistics?.episodeCount ?? 0;
      const availableEpisodes =
        item.episodeFileCount ?? item.statistics?.episodeFileCount ?? 0;
      const progress =
        totalEpisodes > 0 ? Math.min(availableEpisodes / totalEpisodes, 1) : 0;

      return (
        <View>
          <MediaSelectableItem
            item={item}
            onPress={handleSeriesPress}
            onLongPress={handleSeriesLongPress}
            onPressSeries={handleSeriesPress}
          >
            <Pressable
              style={({ pressed }) => [
                styles.seriesCard,
                pressed && styles.seriesCardPressed,
              ]}
            >
              <MediaPoster
                uri={item.posterUrl}
                size={96}
                borderRadius={16}
                style={styles.seriesPoster}
              />
              <View style={styles.seriesMeta}>
                <Text
                  variant="titleMedium"
                  numberOfLines={1}
                  style={styles.seriesTitle}
                >
                  {item.title}
                </Text>
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  style={styles.seriesStatus}
                >
                  {item.status ?? "Status unavailable"}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
                <Text variant="bodySmall" style={styles.episodesMeta}>
                  {totalEpisodes > 0
                    ? `${availableEpisodes} / ${totalEpisodes} episodes`
                    : "Episodes unavailable"}
                </Text>
              </View>
            </Pressable>
          </MediaSelectableItem>
        </View>
      );
    },
    [handleSeriesPress, handleSeriesLongPress, styles],
  );

  const keyExtractor = useCallback((item: Series) => item.id.toString(), []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Text variant="headlineSmall" style={styles.topBarTitle}>
            TV Series
          </Text>
          <IconButton
            icon="plus"
            size={24}
            mode="contained"
            style={styles.topBarAction}
            containerColor={theme.colors.primary}
            iconColor={theme.colors.onPrimary}
            accessibilityLabel="Add series"
            onPress={handleAddSeries}
          />
        </View>
        <View>
          <Searchbar
            placeholder="Search TV Series"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={theme.colors.onSurfaceVariant}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            accessibilityLabel="Search series"
          />
        </View>
        <View>
          <View style={styles.filterRow}>
            <Menu
              key={`status-menu-${statusMenuVisible}-${filterValue}`}
              visible={statusMenuVisible}
              onDismiss={() => setStatusMenuVisible(false)}
              anchorPosition="bottom"
              contentStyle={styles.filterMenu}
              anchor={
                <TouchableRipple
                  borderless={false}
                  style={styles.filterButton}
                  onPress={() => setStatusMenuVisible(true)}
                >
                  <View style={styles.filterButtonContent}>
                    <Text variant="bodyMedium" style={styles.filterButtonLabel}>
                      {FILTER_LABELS[filterValue]}
                    </Text>
                    <View style={styles.filterButtonIcon}>
                      <Icon
                        source="chevron-down"
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </View>
                  </View>
                </TouchableRipple>
              }
            >
              {FILTER_OPTIONS.map((value) => (
                <Menu.Item
                  key={value}
                  title={FILTER_LABELS[value]}
                  onPress={() => handleStatusChange(value)}
                  trailingIcon={filterValue === value ? "check" : undefined}
                />
              ))}
            </Menu>
          </View>
        </View>
      </View>
    ),
    [
      filterValue,
      handleAddSeries,
      handleStatusChange,
      searchTerm,
      statusMenuVisible,
      styles,
      theme,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (filteredSeries.length === 0 && totalSeries > 0) {
      return (
        <EmptyState
          title="No series match your filters"
          description="Try a different search query or reset the filters."
          actionLabel="Clear filters"
          onActionPress={handleClearFilters}
        />
      );
    }

    return (
      <EmptyState
        title="No series available"
        description="Add a series in Sonarr or adjust your filters to see it here."
        actionLabel="Add Series"
        onActionPress={handleAddSeries}
      />
    );
  }, [filteredSeries.length, handleAddSeries, handleClearFilters, totalSeries]);

  if (!hasValidServiceId) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
        <EmptyState
          title="Missing service identifier"
          description="Return to the dashboard and select a Sonarr service before continuing."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isInitialLoad) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={styles.listHeader}>
            <View style={styles.topBar}>
              <View style={styles.topBarSpacer}>
                <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
              </View>
              <SkeletonPlaceholder width="40%" height={28} borderRadius={10} />
              <SkeletonPlaceholder width={44} height={44} borderRadius={22} />
            </View>
            <SkeletonPlaceholder
              width="100%"
              height={48}
              borderRadius={24}
              style={{ marginBottom: spacing.md }}
            />
            <SkeletonPlaceholder width="55%" height={36} borderRadius={18} />
          </View>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={{ marginBottom: spacing.md }}>
              <SeriesListItemSkeleton />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsSonarr) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
        <EmptyState
          title="Sonarr connector unavailable"
          description="Verify the service configuration in settings and try again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load series from Sonarr.";

    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
        <EmptyState
          title="Failed to load series"
          description={message}
          actionLabel="Retry"
          onActionPress={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <MediaSelectorProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1 }}>
          <FlashList
            data={filteredSeries}
            keyExtractor={keyExtractor}
            renderItem={renderSeriesItem}
            ItemSeparatorComponent={() => <View style={styles.itemSpacing} />}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>{listEmptyComponent}</View>
            }
            refreshControl={
              <ListRefreshControl
                refreshing={isRefreshing}
                onRefresh={() => refetch()}
              />
            }
          />
        </View>
        <MediaSelectorActions serviceId={serviceId} onRefresh={refetch} />
        <MediaEditor
          visible={isEditorVisible}
          mediaItem={editingItem}
          onDismiss={handleEditorDismiss}
          onSave={handleEditorSave}
          serviceId={serviceId}
        />
      </SafeAreaView>
    </MediaSelectorProvider>
  );
};

export default SonarrSeriesListScreen;
