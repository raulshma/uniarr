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
import { useRadarrMovies } from '@/hooks/useRadarrMovies';
import type { Movie } from '@/models/movie.types';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';

const FILTER_ALL = 'all';
const FILTER_MONITORED = 'monitored';
const FILTER_UNMONITORED = 'unmonitored';

type FilterValue = typeof FILTER_ALL | typeof FILTER_MONITORED | typeof FILTER_UNMONITORED;

const formatRuntime = (runtime?: number): string | undefined => {
  if (!runtime) {
    return undefined;
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes}m`;
};

const formatByteSize = (bytes?: number): string | undefined => {
  if (bytes === undefined || bytes === null) {
    return undefined;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const precision = index === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[index]}`;
};

const deriveDownloadStatus = (movie: Movie): MediaDownloadStatus => {
  if (movie.hasFile || movie.statistics?.percentAvailable === 100) {
    return 'available';
  }

  if (movie.movieFile || movie.statistics?.movieFileCount) {
    return 'downloading';
  }

  return movie.monitored ? 'missing' : 'unknown';
};

const normalizeSearchTerm = (input: string): string => input.trim().toLowerCase();

const RadarrMoviesListScreen = () => {
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

  const { movies, isLoading, isFetching, isError, error, refetch } = useRadarrMovies(serviceId);

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
        const message = bootstrapError instanceof Error ? bootstrapError.message : 'Unknown connector bootstrap error.';
        void logger.warn('Failed to preload Radarr connector.', {
          location: 'RadarrMoviesListScreen.bootstrap',
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
  const connectorIsRadarr = connector?.config.type === 'radarr';

  const isRefreshing = isFetching && !isLoading;
  const isInitialLoad = isBootstrapping || isLoading;

  const filteredMovies = useMemo(() => {
    if (!movies) {
      return [] as Movie[];
    }

    const query = debouncedSearch;

    return movies.filter((item) => {
      if (filterValue === FILTER_MONITORED && !item.monitored) {
        return false;
      }

      if (filterValue === FILTER_UNMONITORED && item.monitored) {
        return false;
      }

      if (query.length === 0) {
        return true;
      }

      const candidates = [item.title, item.sortTitle]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return candidates.some((candidate) => candidate.includes(query));
    });
  }, [debouncedSearch, filterValue, movies]);

  const totalMovies = movies?.length ?? 0;

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

  const handleMoviePress = useCallback(
    (item: Movie) => {
      if (!hasValidServiceId) {
        return;
      }

      router.push({
        pathname: '/(auth)/radarr/[serviceId]/movies/[id]',
        params: {
          serviceId,
          id: item.id.toString(),
        },
      });
    },
    [hasValidServiceId, router, serviceId],
  );

  const handleAddMovie = useCallback(() => {
    if (!hasValidServiceId) {
      Alert.alert('Invalid service', 'The selected service identifier is not valid.');
      return;
    }

    router.push({
      pathname: '/(auth)/radarr/[serviceId]/add',
      params: { serviceId },
    });
  }, [hasValidServiceId, router, serviceId]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterValue(FILTER_ALL);
  }, []);

  const renderMovieItem = useCallback(
    ({ item }: { item: Movie }) => {
      const runtime = formatRuntime(item.runtime);
      const size = formatByteSize(item.statistics?.sizeOnDisk);
      const footerParts: string[] = [];

      if (runtime) {
        footerParts.push(runtime);
      }

      if (size) {
        footerParts.push(size);
      }

      const footerContent = footerParts.length ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {footerParts.join(' • ')}
        </Text>
      ) : null;

      return (
        <MediaCard
          id={item.id}
          title={item.title}
          year={item.year}
          status={item.status}
          subtitle={item.studio}
          monitored={item.monitored}
          downloadStatus={deriveDownloadStatus(item)}
          posterUri={item.posterUrl}
          type="movie"
          onPress={() => handleMoviePress(item)}
          footer={footerContent}
        />
      );
    },
    [handleMoviePress, theme.colors.onSurfaceVariant],
  );

  const keyExtractor = useCallback((item: Movie) => item.id.toString(), []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.headerRow}>
          <View>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Movies
            </Text>
            <Text variant="bodySmall" style={styles.headerMeta}>
              Showing {filteredMovies.length} of {totalMovies} movies
            </Text>
          </View>
          <Button mode="contained" onPress={handleAddMovie}>
            Add Movie
          </Button>
        </View>
        <Searchbar
          placeholder="Search movies"
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.searchBar}
          accessibilityLabel="Search movies"
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
    [filteredMovies.length, filterValue, handleAddMovie, searchTerm, styles, totalMovies],
  );

  const listEmptyComponent = useMemo(() => {
    if (filteredMovies.length === 0 && totalMovies > 0) {
      return (
        <EmptyState
          title="No movies match your filters"
          description="Try a different search query or reset the filters."
          actionLabel="Clear filters"
          onActionPress={handleClearFilters}
        />
      );
    }

    return (
      <EmptyState
        title="No movies available"
        description="Add a movie in Radarr or adjust your filters to see it here."
        actionLabel="Add Movie"
        onActionPress={handleAddMovie}
      />
    );
  }, [filteredMovies.length, handleAddMovie, handleClearFilters, totalMovies]);

  if (!hasValidServiceId) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Missing service identifier"
          description="Return to the dashboard and select a Radarr service before continuing."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isInitialLoad) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <LoadingState message="Loading movies..." />
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsRadarr) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Radarr connector unavailable"
          description="Verify the service configuration in settings and try again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load movies from Radarr.';

    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Failed to load movies"
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
        data={filteredMovies}
        keyExtractor={keyExtractor}
        renderItem={renderMovieItem}
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

export default RadarrMoviesListScreen;
