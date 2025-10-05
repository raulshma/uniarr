import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import {
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { MediaCard } from '@/components/media/MediaCard';
import type { MediaDownloadStatus } from '@/components/media/MediaCard';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { useSonarrSeries } from '@/hooks/useSonarrSeries';
import type { Series } from '@/models/media.types';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';

const FILTER_ALL = 'all';
const FILTER_MONITORED = 'monitored';
const FILTER_UNMONITORED = 'unmonitored';

type FilterValue = typeof FILTER_ALL | typeof FILTER_MONITORED | typeof FILTER_UNMONITORED;

const deriveDownloadStatus = (series: Series): MediaDownloadStatus => {
  const totalEpisodes = series.episodeCount ?? series.statistics?.episodeCount ?? 0;
  const availableEpisodes = series.episodeFileCount ?? series.statistics?.episodeFileCount ?? 0;

  if (totalEpisodes === 0) {
    return 'unknown';
  }

  if (availableEpisodes >= totalEpisodes) {
    return 'available';
  }

  if (availableEpisodes > 0) {
    return 'downloading';
  }

  return series.monitored ? 'missing' : 'unknown';
};

const normalizeSearchTerm = (input: string): string => input.trim().toLowerCase();

const SonarrSeriesListScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : '';
  const hasValidServiceId = serviceId.length > 0;

  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValue, setFilterValue] = useState<FilterValue>(FILTER_ALL);

  const { series, isLoading, isFetching, isError, error, refetch } = useSonarrSeries(serviceId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(normalizeSearchTerm(searchTerm));
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
          bootstrapError instanceof Error ? bootstrapError.message : 'Unknown connector bootstrap error.';

        void logger.warn('Failed to preload Sonarr connector.', {
          location: 'SonarrSeriesListScreen.bootstrap',
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

  const connector = hasValidServiceId ? manager.getConnector(serviceId) : undefined;
  const connectorIsSonarr = connector?.config.type === 'sonarr';

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
          paddingBottom: spacing.md,
        },
        searchBar: {
          marginBottom: spacing.md,
        },
        filters: {
          marginBottom: spacing.sm,
        },
        filterLabel: {
          marginBottom: spacing.xs,
          color: theme.colors.onSurfaceVariant,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        itemSpacing: {
          height: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        },
        headerTitle: {
          color: theme.colors.onBackground,
        },
        headerMeta: {
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const handleSeriesPress = useCallback(
    (item: Series) => {
      if (!hasValidServiceId) {
        return;
      }

      router.push({
        pathname: '/(auth)/sonarr/[serviceId]/series/[id]',
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
      Alert.alert('Invalid service', 'The selected service identifier is not valid.');
      return;
    }

    router.push({
      pathname: '/(auth)/sonarr/[serviceId]/add',
      params: { serviceId },
    });
  }, [hasValidServiceId, router, serviceId]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterValue(FILTER_ALL);
  }, []);

  const renderSeriesItem = useCallback(
    ({ item }: { item: Series }) => (
      <MediaCard
        id={item.id}
        title={item.title}
        year={item.year}
        status={item.status}
        subtitle={item.network}
        monitored={item.monitored}
        downloadStatus={deriveDownloadStatus(item)}
        posterUri={item.posterUrl}
        type="series"
        onPress={() => handleSeriesPress(item)}
        footer={
          item.episodeCount || item.episodeFileCount ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Episodes: {item.episodeFileCount ?? item.statistics?.episodeFileCount ?? 0} /{' '}
              {item.episodeCount ?? item.statistics?.episodeCount ?? 0}
            </Text>
          ) : null
        }
      />
    ),
    [handleSeriesPress, theme.colors.onSurfaceVariant],
  );

  const keyExtractor = useCallback((item: Series) => item.id.toString(), []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.headerRow}>
          <View>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Series
            </Text>
            <Text variant="bodySmall" style={styles.headerMeta}>
              Showing {filteredSeries.length} of {totalSeries} series
            </Text>
          </View>
          <Button mode="contained" onPress={handleAddSeries}>
            Add Series
          </Button>
        </View>
        <Searchbar
          placeholder="Search series"
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.searchBar}
          accessibilityLabel="Search series"
        />
        <Text variant="labelSmall" style={styles.filterLabel}>
          Filter by monitoring status
        </Text>
        <SegmentedButtons
          style={styles.filters}
          value={filterValue}
          onValueChange={(value) => setFilterValue(value as FilterValue)}
          buttons={[
            { label: 'All', value: FILTER_ALL },
            { label: 'Monitored', value: FILTER_MONITORED },
            { label: 'Unmonitored', value: FILTER_UNMONITORED },
          ]}
        />
      </View>
    ),
    [filteredSeries.length, filterValue, handleAddSeries, searchTerm, styles, totalSeries],
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
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
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
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <LoadingState message="Loading series..." />
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsSonarr) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
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
    const message = error instanceof Error ? error.message : 'Unable to load series from Sonarr.';

    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
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
    <SafeAreaView style={styles.safeArea}>
      <FlashList
        data={filteredSeries}
        keyExtractor={keyExtractor}
  renderItem={renderSeriesItem}
        ItemSeparatorComponent={() => <View style={styles.itemSpacing} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={styles.emptyContainer}>{listEmptyComponent}</View>}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetch()}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

export default SonarrSeriesListScreen;
