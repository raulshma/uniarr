import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import {
  FAB,
  Icon,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";
import type {
  BazarrMovie,
  BazarrEpisode,
  BazarrMissingSubtitle,
} from "@/models/bazarr.types";
// logger intentionally omitted — avoid logging secrets in UI components
import { spacing } from "@/theme/spacing";
import { useBazarrSubtitles } from "@/hooks/useBazarrSubtitles";

const FILTER_ALL = "all";
const FILTER_MOVIES = "movies";
const FILTER_EPISODES = "episodes";
const FILTER_MISSING = "missing";

type FilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_MOVIES
  | typeof FILTER_EPISODES
  | typeof FILTER_MISSING;

const normalizeSearchTerm = (input: string): string =>
  input.trim().toLowerCase();

const MediaItemSkeleton = () => {
  const theme = useTheme<AppTheme>();

  return (
    <View style={[styles.mediaItem, { borderColor: theme.colors.outline }]}>
      <View style={styles.mediaContent}>
        <SkeletonPlaceholder style={styles.mediaPoster} />
        <View style={styles.mediaInfo}>
          <SkeletonPlaceholder style={styles.mediaTitle} />
          <SkeletonPlaceholder style={styles.mediaSubtitle} />
          <SkeletonPlaceholder style={styles.mediaStatus} />
        </View>
        <SkeletonPlaceholder style={styles.mediaActions} />
      </View>
    </View>
  );
};

const MediaItem = ({
  item,
  onPress,
  onSearchSubtitles,
}: {
  item: BazarrMovie | BazarrEpisode;
  onPress: () => void;
  onSearchSubtitles: () => void;
}) => {
  const theme = useTheme<AppTheme>();

  const isMovie = "tmdbId" in item;
  const title = isMovie
    ? item.title
    : `${item.title} - S${"season" in item ? item.season : 0}E${
        "episode" in item ? item.episode : 0
      }`;
  const subtitleCount = item.subtitles?.length || 0;
  const missingCount = item.missingSubtitles?.length || 0;

  return (
    <View style={[styles.mediaItem, { borderColor: theme.colors.outline }]}>
      <TouchableRipple onPress={onPress} style={styles.mediaContent}>
        <>
          <View style={styles.mediaPoster}>
            <Icon
              source="movie"
              size={32}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
          <View style={styles.mediaInfo}>
            <Text variant="titleMedium" numberOfLines={1}>
              {title}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {isMovie ? `Movie` : `Episode`} •{" "}
              {item.monitored ? "Monitored" : "Unmonitored"}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {subtitleCount} subtitles • {missingCount} missing
            </Text>
          </View>
          <View style={styles.mediaActions}>
            <IconButton
              icon="magnify"
              size={20}
              onPress={onSearchSubtitles}
              disabled={missingCount === 0}
            />
          </View>
        </>
      </TouchableRipple>
    </View>
  );
};

const MissingSubtitleItem = ({
  item,
  onPress,
}: {
  item: BazarrMissingSubtitle;
  onPress: () => void;
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <View style={[styles.missingItem, { borderColor: theme.colors.outline }]}>
      <TouchableRipple onPress={onPress} style={styles.missingContent}>
        <>
          <View style={styles.missingIcon}>
            <Icon source="alert-circle" size={24} color={theme.colors.error} />
          </View>
          <View style={styles.missingInfo}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {item.language.name} subtitles missing
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {item.type === "movie" ? "Movie" : "Episode"} •{" "}
              {item.hi ? "HI" : "Regular"}
            </Text>
          </View>
        </>
      </TouchableRipple>
    </View>
  );
};

const BazarrSubtitlesScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const hasValidServiceId = serviceId.length > 0;

  const theme = useTheme<AppTheme>();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>(FILTER_ALL);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the Bazarr subtitles hook
  const {
    movies,
    episodes,
    missingSubtitles,
    statistics,
    isLoading,
    error,
    refetch,
    searchSubtitles,
  } = useBazarrSubtitles(serviceId);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // Handle focus effect
  useFocusEffect(
    useCallback(() => {
      if (hasValidServiceId) {
        refetch();
      }
    }, [hasValidServiceId, refetch]),
  );

  // Filter and search items
  const filteredItems = useMemo(() => {
    if (!movies || !episodes || !missingSubtitles) return [];

    const allItems: (BazarrMovie | BazarrEpisode | BazarrMissingSubtitle)[] = [
      ...movies,
      ...episodes,
      ...missingSubtitles,
    ];

    // Apply filter
    let filtered = allItems;
    switch (selectedFilter) {
      case FILTER_MOVIES:
        filtered = movies;
        break;
      case FILTER_EPISODES:
        filtered = episodes;
        break;
      case FILTER_MISSING:
        filtered = missingSubtitles;
        break;
      default:
        // FILTER_ALL - show all items
        break;
    }

    // Apply search
    if (searchQuery) {
      const searchTerm = normalizeSearchTerm(searchQuery);
      filtered = filtered.filter((item) => {
        if ("title" in item) {
          return normalizeSearchTerm(item.title).includes(searchTerm);
        }
        if ("name" in item) {
          return normalizeSearchTerm(item.language.name).includes(searchTerm);
        }
        return false;
      });
    }

    return filtered;
  }, [movies, episodes, missingSubtitles, selectedFilter, searchQuery]);

  // Handle search subtitles
  const handleSearchSubtitles = useCallback(
    (item: BazarrMovie | BazarrEpisode) => {
      if (item.missingSubtitles && item.missingSubtitles.length > 0) {
        const missingSub = item.missingSubtitles?.[0];
        if (missingSub) {
          const searchRequest = {
            id:
              "radarrId" in item
                ? item.radarrId!
                : "sonarrEpisodeId" in item
                  ? item.sonarrEpisodeId!
                  : 0,
            language: missingSub.language.code2,
            forced: missingSub.forced,
            hi: missingSub.hi,
          };
          searchSubtitles(searchRequest);
        }
      }
    },
    [searchSubtitles],
  );

  // Handle item press
  const handleItemPress = useCallback(
    (item: BazarrMovie | BazarrEpisode | BazarrMissingSubtitle) => {
      // For now, just show item details in alert
      // In the future, this could navigate to a detail screen
      alert(
        "title" in item ? item.title : item.language.name,
        `Type: ${"radarrId" in item ? "Movie" : "Episode"}\nMonitored: ${
          "monitored" in item ? item.monitored : "Unknown"
        }`,
      );
    },
    [],
  );

  // Render item based on type
  const renderBazarrItem = useCallback(
    ({
      item,
      index,
    }: {
      item: BazarrMovie | BazarrEpisode | BazarrMissingSubtitle;
      index: number;
    }) => {
      const itemContent =
        "language" in item &&
        "code2" in item.language &&
        "movieFileId" in item ? (
          // This is a missing subtitle
          <MissingSubtitleItem
            item={item}
            onPress={() => handleItemPress(item)}
          />
        ) : (
          // This is a movie or episode
          <MediaItem
            item={item as BazarrMovie | BazarrEpisode}
            onPress={() => handleItemPress(item)}
            onSearchSubtitles={() =>
              handleSearchSubtitles(item as BazarrMovie | BazarrEpisode)
            }
          />
        );

      return <AnimatedListItem index={index}>{itemContent}</AnimatedListItem>;
    },
    [handleItemPress, handleSearchSubtitles],
  );

  // Show error state
  if (error && !isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle"
            title="Connection Error"
            description={`Failed to connect to Bazarr service: ${
              error instanceof Error ? error.message : "Unknown error"
            }`}
            actionLabel="Retry"
            onActionPress={() => refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state
  if (isLoading && !movies && !episodes) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <ListRefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <MediaItemSkeleton key={index} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show empty state
  if (filteredItems.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <ListRefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <EmptyState
            icon="subtitles"
            title="No Subtitles Found"
            description={
              searchQuery
                ? `No items match "${searchQuery}"`
                : selectedFilter === FILTER_MISSING
                  ? "No missing subtitles found. All items have subtitles!"
                  : "No movies or episodes found. Check your Bazarr configuration."
            }
            actionLabel={searchQuery ? "Clear Search" : "Refresh"}
            onActionPress={
              searchQuery ? () => setSearchQuery("") : handleRefresh
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header with search and filter */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.elevation.level2 },
        ]}
      >
        <Searchbar
          placeholder="Search movies, episodes, or languages..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        <SegmentedButtons
          value={selectedFilter}
          onValueChange={setSelectedFilter}
          buttons={[
            { value: FILTER_ALL, label: "All" },
            { value: FILTER_MOVIES, label: "Movies" },
            { value: FILTER_EPISODES, label: "Episodes" },
            { value: FILTER_MISSING, label: "Missing" },
          ]}
          style={styles.filterButtons}
        />
      </View>

      {/* Statistics summary */}
      {statistics && (
        <View
          style={[
            styles.statsContainer,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {statistics.moviesTotal} movies • {statistics.episodesTotal}{" "}
            episodes • {statistics.missingSubtitles} missing subtitles
          </Text>
        </View>
      )}

      {/* Content list */}
      <FlashList<BazarrMovie | BazarrEpisode | BazarrMissingSubtitle>
        data={filteredItems}
        renderItem={renderBazarrItem}
        keyExtractor={(
          item: BazarrMovie | BazarrEpisode | BazarrMissingSubtitle,
        ) => {
          if ("id" in item && "language" in item) {
            // Missing subtitle
            return `missing-${item.id}`;
          }
          // Movie or episode
          return `media-${item.id}`;
        }}
        // estimatedItemSize={80} // Note: This property may not be available in all FlashList versions
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating action button for manual search */}
      <FAB
        icon="magnify"
        onPress={() => {
          // TODO: Open manual search dialog
          alert(
            "Manual Search",
            "Manual search functionality will be implemented in a future update.",
          );
        }}
        style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  header: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    elevation: 0,
  },
  filterButtons: {
    marginTop: spacing.xs,
  },
  statsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  mediaItem: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  mediaContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  mediaPoster: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  mediaInfo: {
    flex: 1,
  },
  mediaTitle: {
    height: 20,
    marginBottom: spacing.xs,
  },
  mediaSubtitle: {
    height: 16,
    marginBottom: spacing.xs,
  },
  mediaStatus: {
    height: 14,
    marginBottom: spacing.xs,
  },
  mediaActions: {
    justifyContent: "center",
  },
  missingItem: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  missingContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  missingIcon: {
    marginRight: spacing.md,
  },
  missingInfo: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    margin: spacing.md,
    right: 0,
    bottom: 0,
  },
});

export default BazarrSubtitlesScreen;
