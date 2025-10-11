import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { Text, useTheme, ActivityIndicator, IconButton, Searchbar, Chip } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useAnimeDiscover } from "@/hooks/useAnimeDiscover";
import {
  useJikanDiscover,
  type DiscoverItem as JikanDiscoverItem,
} from "@/hooks/useJikanDiscover";
import { Linking } from "react-native";
import { useConnectorsStore } from "@/store/connectorsStore";
import { AnimeCard } from "@/components/anime";
import { EmptyState } from "@/components/common/EmptyState";
import type { components } from '@/connectors/client-schemas/jellyseerr-openapi';
type JellyseerrSearchResult =
  | components['schemas']['MovieResult']
  | components['schemas']['TvResult'];

const FILTER_CATEGORIES = [
  "All",
  "Mecha",
  "Slice of Life",
  "Isekai",
  "Shonen",
] as const;

type FilterCategory = (typeof FILTER_CATEGORIES)[number];

const AnimeHubScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { getAllConnectors } = useConnectorsStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>("All");

  // Find the first Jellyseerr service (optional)
  const jellyseerrService = useMemo(() => {
    const allConnectors = getAllConnectors();
    return allConnectors.find(
      (c) => c.config.type === "jellyseerr" && c.config.enabled
    );
  }, [getAllConnectors]);

  const {
    recommendations,
    upcoming,
    trending,
    movies,
    isLoading,
    isError,
    refetch,
  } = useAnimeDiscover({
    serviceId: jellyseerrService?.config.id ?? "",
    enabled: Boolean(jellyseerrService),
  });

  // Jikan (MyAnimeList) Discover data — public API, does not require a configured service
  const jikan = useJikanDiscover();

  const handleCardPress = useCallback(
    (item: JellyseerrSearchResult) => {
      if (!jellyseerrService) return;
      const mediaIdStr = item.mediaInfo?.tmdbId ?? item.id ?? "";
      router.push({
        pathname: "/jellyseerr/[serviceId]/[mediaType]/[mediaId]",
        params: {
          serviceId: jellyseerrService.config.id,
          mediaType: item.mediaType ?? "movie",
          mediaId: mediaIdStr,
        },
      });
    },
    [jellyseerrService, router]
  );

  const handleJikanCardPress = useCallback(async (item: JikanDiscoverItem) => {
    const malUrl = `https://myanimelist.net/anime/${item.id}`;
    try {
      await Linking.openURL(malUrl);
    } catch (err) {
      // ignore errors opening external link
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    // Navigate to search with anime filter
    router.push({
      pathname: "/search",
      params: { query: searchQuery, filter: "anime" },
    });
  }, [searchQuery, router]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: theme.colors.background,
        },
        headerTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        title: {
          fontSize: 28,
          fontWeight: "bold",
          color: theme.colors.onBackground,
        },
        searchBar: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          elevation: 0,
          marginBottom: spacing.md,
        },
        filterContainer: {
          flexDirection: "row",
          gap: spacing.xs,
        },
        filterChip: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 20,
        },
        filterChipSelected: {
          backgroundColor: theme.colors.primary,
        },
        filterChipText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 13,
        },
        filterChipTextSelected: {
          color: theme.colors.onPrimary,
          fontWeight: "600",
        },
        scrollContent: {
          paddingBottom: spacing.xl * 2,
        },
        section: {
          marginBottom: spacing.lg,
        },
        sectionHeader: {
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
        sectionTitle: {
          fontSize: 20,
          fontWeight: "bold",
          color: theme.colors.onBackground,
        },
        list: {
          paddingLeft: spacing.md,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
        episodeInfo: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
        episodeText: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
        },
        menuButton: {
          margin: 0,
        },
      }),
    [theme]
  );

  // If Jellyseerr is not configured we still show the Jikan discover sections.

  // Combined loading state — show global loader while both sources are fetching
  const combinedLoading =
    (Boolean(jellyseerrService) && isLoading) || jikan.isLoading;
  const combinedError = Boolean(jellyseerrService) && isError && jikan.isError;

  // Show loading state
  if (combinedLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Anime Hub</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={{
              marginTop: spacing.md,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            Loading anime content...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  // Show error state when both sources failed
  if (combinedError) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Anime Hub</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <EmptyState
            title="Failed to Load"
            description="Unable to fetch anime content. Please check your connection and try again."
            actionLabel="Retry"
            onActionPress={() => void Promise.all([refetch(), jikan.refetch()])}
          />
        </View>
      </SafeAreaView>
    );
  }

  const getJellyTitle = (r: JellyseerrSearchResult) => {
    if ('title' in r && r.title) return r.title as string;
    if ('name' in r && r.name) return r.name as string;
    return 'Untitled';
  };

  const getJellyId = (r: JellyseerrSearchResult) => {
    if (typeof r.id === 'number') return r.id;
    return r.mediaInfo?.tmdbId ?? 0;
  };

  const getJellyPosterPath = (r: JellyseerrSearchResult) => {
    if ('posterPath' in r) return r.posterPath;
    return undefined;
  };

  const getJellyVoteAverage = (r: JellyseerrSearchResult) => {
    if ('voteAverage' in r) return r.voteAverage ?? undefined;
    return undefined;
  };

  const renderAnimeItem = ({ item }: { item: JellyseerrSearchResult }) => {
    const idNum = getJellyId(item) as number;
    const title = getJellyTitle(item);
    const poster = getJellyPosterPath(item);
    const posterUrl = poster ? `https://image.tmdb.org/t/p/original${poster}` : undefined;
    const rating = getJellyVoteAverage(item);

    return (
      <AnimeCard
        id={idNum}
        title={title}
        posterUrl={posterUrl}
        rating={rating}
        onPress={() => handleCardPress(item)}
        width={160}
      />
    );
  };

  const renderJikanItem = ({ item }: { item: JikanDiscoverItem }) => (
    <AnimeCard
      id={item.id}
      title={item.title}
      posterUrl={item.posterUrl}
      rating={item.rating}
      onPress={() => void handleJikanCardPress(item)}
      width={160}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Anime Hub</Text>
          <IconButton
            icon="dots-vertical"
            size={24}
            onPress={() => {}}
            style={styles.menuButton}
          />
        </View>

        {/* Search Bar */}
        <Searchbar
          placeholder="Search for anime titles"
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchBar}
          inputStyle={{ fontSize: 15 }}
          icon="magnify"
          iconColor={theme.colors.onSurfaceVariant}
        />

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {FILTER_CATEGORIES.map((category) => (
            <Chip
              key={category}
              selected={selectedFilter === category}
              onPress={() => setSelectedFilter(category)}
              style={[
                styles.filterChip,
                selectedFilter === category && styles.filterChipSelected,
              ]}
              textStyle={[
                styles.filterChipText,
                selectedFilter === category && styles.filterChipTextSelected,
              ]}
              mode="flat"
            >
              {category}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void Promise.all([refetch(), jikan.refetch()])}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Recommended For You (Jellyseerr) */}
        {recommendations.length > 0 && jellyseerrService && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended For You</Text>
            </View>
            <FlatList
              data={recommendations}
              renderItem={renderAnimeItem}
              keyExtractor={(item) => `rec-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}

        {/* What's New */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>What's New</Text>
            </View>
            {upcoming.slice(0, 2).map((item) => (
              <Pressable
                key={`new-${item.id}`}
                onPress={() => handleCardPress(item)}
                style={{ marginBottom: spacing.sm }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    paddingHorizontal: spacing.md,
                    alignItems: "center",
                  }}
                >
                  <AnimeCard
                    id={getJellyId(item)}
                    title={getJellyTitle(item)}
                    posterUrl={
                      getJellyPosterPath(item)
                        ? `https://image.tmdb.org/t/p/original${getJellyPosterPath(item)}`
                        : undefined
                    }
                    rating={getJellyVoteAverage(item)}
                    onPress={() => handleCardPress(item)}
                    width={100}
                  />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text
                      variant="titleMedium"
                      numberOfLines={2}
                      style={{
                        color: theme.colors.onSurface,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {(item as any).title ?? (item as any).name ?? (item as any).mediaInfo?.title ?? 'Untitled'}
                    </Text>
                    <View style={styles.episodeInfo}>
                      <Text style={styles.episodeText}>
                        {item.mediaType === "tv"
                          ? "S2 E23 - Shibuya Incident"
                          : "New Release"}
                      </Text>
                      <IconButton
                        icon="dots-horizontal"
                        size={20}
                        onPress={() => {}}
                        style={{ margin: 0 }}
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Trending Anime Series (Jellyseerr) */}
        {trending.length > 0 && jellyseerrService && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trending Anime Series</Text>
            </View>
            <FlatList
              data={trending}
              renderItem={renderAnimeItem}
              keyExtractor={(item) => `trend-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}

        {/* New Anime Movies (Jellyseerr) */}
        {movies.length > 0 && jellyseerrService && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>New Anime Movies</Text>
            </View>
            <FlatList
              data={movies}
              renderItem={renderAnimeItem}
              keyExtractor={(item) => `movie-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}

        {/* MyAnimeList (Jikan) - Trending */}
        {jikan.top.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MAL Top Anime</Text>
            </View>
            <FlatList
              data={jikan.top}
              renderItem={renderJikanItem}
              keyExtractor={(item, index) => `jikan-top-${item.id}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}

        {/* MyAnimeList (Jikan) - Recommendations */}
        {jikan.recommendations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MAL Recommendations</Text>
            </View>
            <FlatList
              data={jikan.recommendations}
              renderItem={renderJikanItem}
              keyExtractor={(item, index) => `jikan-rec-${item.id}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}

        {/* MyAnimeList (Jikan) - Season Now */}
        {jikan.now.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Season Now</Text>
            </View>
            <FlatList
              data={jikan.now}
              renderItem={renderJikanItem}
              keyExtractor={(item, index) => `jikan-now-${item.id}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}

        {/* MyAnimeList (Jikan) - Upcoming */}
        {jikan.upcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Season</Text>
            </View>
            <FlatList
              data={jikan.upcoming}
              renderItem={renderJikanItem}
              keyExtractor={(item, index) => `jikan-up-${item.id}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AnimeHubScreen;
