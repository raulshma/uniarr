import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import { Chip, Searchbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SkeletonPlaceholder } from "@/components/common/Skeleton/";
import MovieListItem from "@/components/media/MediaCard/MovieListItem";
import { MovieListItemSkeleton } from "@/components/media/MediaCard";
import type { MediaDownloadStatus } from "@/components/media/MediaCard";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useRadarrMovies } from "@/hooks/useRadarrMovies";
import type { Movie } from "@/models/movie.types";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

const FILTER_ALL = "all";
const FILTER_OWNED = "owned";
const FILTER_MISSING = "missing";
const FILTER_DOWNLOADING = "downloading";
const FILTER_MONITORED = "monitored";
const FILTER_UNMONITORED = "unmonitored";

type FilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_OWNED
  | typeof FILTER_MISSING
  | typeof FILTER_DOWNLOADING
  | typeof FILTER_MONITORED
  | typeof FILTER_UNMONITORED;

const deriveDownloadStatus = (movie: Movie): MediaDownloadStatus => {
  if (movie.hasFile || movie.statistics?.percentAvailable === 100) {
    return "available";
  }

  if (movie.movieFile || movie.statistics?.movieFileCount) {
    return "downloading";
  }

  return movie.monitored ? "missing" : "unknown";
};

const getFilterForMovie = (movie: Movie): FilterValue => {
  if (movie.hasFile || movie.statistics?.percentAvailable === 100) {
    return FILTER_OWNED;
  }

  if (movie.movieFile || movie.statistics?.movieFileCount) {
    return FILTER_DOWNLOADING;
  }

  if (movie.monitored) {
    return FILTER_MISSING;
  }

  return FILTER_ALL; // This shouldn't happen for properly configured movies
};

const RadarrMoviesListScreen = () => {
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

  const { movies, isLoading, isFetching, isError, error, refetch } =
    useRadarrMovies(serviceId);

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
        void logger.warn("Failed to preload Radarr connector.", {
          location: "RadarrMoviesListScreen.bootstrap",
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
  const connectorIsRadarr = connector?.config.type === "radarr";

  const isRefreshing = isFetching && !isLoading;
  const isInitialLoad = isBootstrapping || isLoading;

  const filteredMovies = useMemo(() => {
    if (!movies) {
      return [] as Movie[];
    }

    const query = debouncedSearch;

    return movies.filter((item) => {
      // Filter by status category
      if (filterValue !== FILTER_ALL) {
        if (filterValue === FILTER_MONITORED && !item.monitored) {
          return false;
        }

        if (filterValue === FILTER_UNMONITORED && item.monitored) {
          return false;
        }

        if (
          filterValue === FILTER_OWNED ||
          filterValue === FILTER_MISSING ||
          filterValue === FILTER_DOWNLOADING
        ) {
          const movieFilter = getFilterForMovie(item);
          if (movieFilter !== filterValue) {
            return false;
          }
        }
      }

      // Filter by search query
      if (query.length === 0) {
        return true;
      }

      const candidates = [item.title, item.sortTitle, item.overview]
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
          paddingTop: spacing.xl,
          paddingBottom: spacing.lg,
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        headerTitle: {
          color: theme.colors.onSurface,
        },
        headerMeta: {
          color: theme.colors.onSurfaceVariant,
          marginTop: spacing.xs,
        },
        searchBar: {
          marginBottom: spacing.lg,
        },
        filterPills: {
          flexDirection: "row",
          marginBottom: spacing.md,
        },
        filterPillsScroll: {
          flexDirection: "row",
          gap: spacing.sm,
        },
        filterChip: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 20,
          flex: 0,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxxs,
          minHeight: 28,
        },
        filterChipSelected: {
          backgroundColor: theme.colors.primary,
          borderRadius: 20,
          flex: 0,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xxxs,
          minHeight: 28,
        },
        filterChipText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
        },
        filterChipTextSelected: {
          color: theme.colors.onPrimary,
          fontSize: 14,
          fontWeight: "500",
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        itemSpacing: {
          height: spacing.md,
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
        pathname: "/(auth)/radarr/[serviceId]/movies/[id]",
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
      alert("Invalid service", "The selected service identifier is not valid.");
      return;
    }

    router.push({
      pathname: "/(auth)/radarr/[serviceId]/add",
      params: { serviceId },
    });
  }, [hasValidServiceId, router, serviceId]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterValue(FILTER_ALL);
  }, []);

  const renderMovieItem = useCallback(
    ({ item, index }: { item: Movie; index: number }) => {
      return (
        <AnimatedListItem index={index}>
          <View>
            <MovieListItem
              id={item.id}
              title={item.title}
              year={item.year}
              runtime={item.runtime}
              sizeOnDisk={item.statistics?.sizeOnDisk}
              status={item.status}
              subtitle={item.studio}
              monitored={item.monitored}
              downloadStatus={deriveDownloadStatus(item)}
              posterUri={item.posterUrl}
              genres={item.genres}
              studio={item.studio}
              statistics={item.statistics}
              onPress={() => handleMoviePress(item)}
            />
          </View>
        </AnimatedListItem>
      );
    },
    [handleMoviePress],
  );

  const keyExtractor = useCallback((item: Movie) => item.id.toString(), []);

  // Header used as the FlashList ListHeaderComponent
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
        <View>
          <Searchbar
            placeholder="Search movies"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchBar}
            accessibilityLabel="Search movies"
          />
        </View>
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsScroll}
            style={styles.filterPills}
          >
            {[
              { label: "All", value: FILTER_ALL },
              { label: "Owned", value: FILTER_OWNED },
              { label: "Missing", value: FILTER_MISSING },
              { label: "Downloading", value: FILTER_DOWNLOADING },
              { label: "Monitored", value: FILTER_MONITORED },
              { label: "Unmonitored", value: FILTER_UNMONITORED },
            ].map((filter) => (
              <View key={filter.value}>
                <Chip
                  mode="flat"
                  onPress={() => setFilterValue(filter.value as FilterValue)}
                  style={[
                    styles.filterChip,
                    filterValue === filter.value && styles.filterChipSelected,
                  ]}
                  textStyle={[
                    styles.filterChipText,
                    filterValue === filter.value &&
                      styles.filterChipTextSelected,
                  ]}
                >
                  {filter.label}
                </Chip>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    ),
    [
      filteredMovies.length,
      totalMovies,
      handleAddMovie,
      searchTerm,
      filterValue,
      styles,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (filteredMovies.length === 0 && totalMovies > 0) {
      return (
        <View>
          <EmptyState
            title="No movies match your filters"
            description="Try a different search query or reset the filters."
            actionLabel="Clear filters"
            onActionPress={handleClearFilters}
          />
        </View>
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
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={styles.listHeader}>
            <View style={styles.headerRow}>
              <View>
                <SkeletonPlaceholder
                  width="60%"
                  height={28}
                  borderRadius={10}
                  style={{ marginBottom: spacing.xs }}
                />
                <SkeletonPlaceholder width="40%" height={18} borderRadius={8} />
              </View>
              <SkeletonPlaceholder width={120} height={40} borderRadius={20} />
            </View>
            <SkeletonPlaceholder
              width="100%"
              height={48}
              borderRadius={24}
              style={styles.searchBar}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsScroll}
              style={styles.filterPills}
            >
              {[0, 1, 2, 3, 4, 5].map((pill) => (
                <SkeletonPlaceholder
                  key={`pill-${pill}`}
                  width={80}
                  height={28}
                  borderRadius={14}
                />
              ))}
            </ScrollView>
          </View>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={{ marginBottom: spacing.md }}>
              <MovieListItemSkeleton />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsRadarr) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
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
    const message = (() => {
      if (error instanceof Error) return error.message;
      try {
        // If the error is a fetch-like response with a message payload
        const maybe = (error as any) ?? {};
        if (typeof maybe === "string") return maybe;
        if (typeof maybe?.message === "string") return maybe.message;
      } catch {
        // fallthrough
      }
      return "Unable to load movies from Radarr.";
    })();

    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
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
      <View style={{ flex: 1 }}>
        <FlashList
          data={filteredMovies}
          keyExtractor={keyExtractor}
          renderItem={renderMovieItem}
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
    </SafeAreaView>
  );
};

export default RadarrMoviesListScreen;
