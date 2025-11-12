import React, { useCallback, useMemo, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  Pressable,
  Animated as RNAnimated,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Text, useTheme, IconButton, Banner } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useAnimeDiscover } from "@/hooks/useAnimeDiscover";
import {
  useJikanDiscover,
  type DiscoverItem as JikanDiscoverItem,
} from "@/hooks/useJikanDiscover";
import { useSkeletonLoading } from "@/hooks/useSkeletonLoading";
import { useConnectorsStore } from "@/store/connectorsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AnimeCard, AnimeHubSectionSkeleton } from "@/components/anime";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import AnimatedSkiaBackground from "@/components/common/AnimatedSkiaBackground";
import { EmptyState } from "@/components/common/EmptyState";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

const AnimeHubScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const router = useRouter();
  const { getAllConnectors } = useConnectorsStore();

  // Backdrop with blur settings
  const enableBackdropWithBlur = useSettingsStore(
    (state) => state.enableBackdropWithBlur,
  );
  const animeHubBannerDismissed = useSettingsStore(
    (state) => state.animeHubBannerDismissed,
  );
  const setAnimeHubBannerDismissed = useSettingsStore(
    (state) => state.setAnimeHubBannerDismissed,
  );

  // State for banner visibility with animation
  const [bannerState, setBannerState] = useState({
    show: false,
    visible: false,
  });

  // Initialize skeleton loading hook with 500ms minimum display time
  const skeleton = useSkeletonLoading({ minLoadingTime: 500 });

  // Find the first Jellyseerr service (optional)
  const jellyseerrService = useMemo(() => {
    const allConnectors = getAllConnectors();
    return allConnectors.find(
      (c) => c.config.type === "jellyseerr" && c.config.enabled,
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

  // Get a backdrop image from the anime data for the background
  const backgroundImageUri = useMemo(() => {
    // Check Jellyseerr data first
    const allJellyseerrItems = [
      ...recommendations,
      ...upcoming,
      ...trending,
      ...movies,
    ];

    for (const item of allJellyseerrItems) {
      if ("backdropPath" in item && item.backdropPath) {
        return `https://image.tmdb.org/t/p/w780${item.backdropPath}`;
      }
    }

    // Check Jikan data
    const allJikanItems = [
      ...jikan.top,
      ...jikan.recommendations,
      ...jikan.now,
      ...jikan.upcoming,
    ];

    for (const item of allJikanItems) {
      // Jikan doesn't seem to have backdrop URLs, so we'll use poster as fallback
      if (item.posterUrl) {
        return item.posterUrl;
      }
    }

    return undefined; // Will use default image
  }, [
    recommendations,
    upcoming,
    trending,
    movies,
    jikan.top,
    jikan.recommendations,
    jikan.now,
    jikan.upcoming,
  ]);

  // Memoize data getter functions to prevent recreations on every render
  const getJellyTitle = useCallback((r: JellyseerrSearchResult) => {
    if ("title" in r && r.title) return r.title as string;
    if ("name" in r && r.name) return r.name as string;
    return "Untitled";
  }, []);

  const getJellyId = useCallback((r: JellyseerrSearchResult) => {
    if (typeof r.id === "number") return r.id;
    return r.mediaInfo?.tmdbId ?? 0;
  }, []);

  const getJellyPosterPath = useCallback((r: JellyseerrSearchResult) => {
    if ("posterPath" in r) return r.posterPath;
    return undefined;
  }, []);

  const getJellyVoteAverage = useCallback((r: JellyseerrSearchResult) => {
    if ("voteAverage" in r) return r.voteAverage ?? undefined;
    return undefined;
  }, []);

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
    [jellyseerrService, router],
  );

  const handleJikanCardPress = useCallback(
    (item: JikanDiscoverItem) => {
      router.push({
        pathname: "/(auth)/anime-hub/[malId]",
        params: { malId: item.id.toString() },
      });
    },
    [router],
  );

  const handleSearch = useCallback(() => {
    router.push("/(auth)/anime-hub/search");
  }, [router]);

  const handleBannerSettingsPress = useCallback(() => {
    setAnimeHubBannerDismissed(true);
    router.push("/(auth)/settings/experimental");
  }, [router, setAnimeHubBannerDismissed]);

  const handleBannerDismiss = useCallback(() => {
    setAnimeHubBannerDismissed(true);
    setBannerState((prev) => ({ ...prev, visible: false }));
    // Hide banner after fade animation
    const timer = setTimeout(
      () => setBannerState((prev) => ({ ...prev, show: false })),
      600,
    );
    return () => clearTimeout(timer);
  }, [setAnimeHubBannerDismissed]);

  // Memoize render functions to prevent recreations
  const renderAnimeItem = useCallback(
    ({ item, index }: { item: JellyseerrSearchResult; index: number }) => {
      const idNum = getJellyId(item) as number;
      const title = getJellyTitle(item);
      const poster = getJellyPosterPath(item);
      const posterUrl = poster
        ? `https://image.tmdb.org/t/p/w500${poster}`
        : undefined;
      const rating = getJellyVoteAverage(item);

      return (
        <AnimatedListItem index={index}>
          <AnimeCard
            id={idNum}
            title={title}
            posterUrl={posterUrl}
            rating={rating}
            onPress={() => handleCardPress(item)}
            width={160}
          />
        </AnimatedListItem>
      );
    },
    [
      getJellyId,
      getJellyTitle,
      getJellyPosterPath,
      getJellyVoteAverage,
      handleCardPress,
    ],
  );

  const renderJikanItem = useCallback(
    ({ item, index }: { item: JikanDiscoverItem; index: number }) => (
      <AnimatedListItem index={index}>
        <AnimeCard
          id={item.id}
          title={item.title}
          posterUrl={item.posterUrl}
          rating={item.rating}
          onPress={() => handleJikanCardPress(item)}
          width={160}
        />
      </AnimatedListItem>
    ),
    [handleJikanCardPress],
  );

  // Banner delay effect
  useEffect(() => {
    let timers: NodeJS.Timeout[] = [];

    // Only show banner if backdrop is disabled and not previously dismissed
    if (!enableBackdropWithBlur && !animeHubBannerDismissed) {
      const timer = setTimeout(() => {
        setBannerState((prev) => ({ ...prev, show: true }));
        // Start animation after a small delay
        const animTimer = setTimeout(
          () => setBannerState((prev) => ({ ...prev, visible: true })),
          50,
        );
        timers.push(animTimer);
      }, 2000); // 2-second delay
      timers.push(timer);
    }

    // Auto-hide banner if feature gets enabled
    if (enableBackdropWithBlur && bannerState.show) {
      setBannerState((prev) => ({ ...prev, visible: false }));
      const hideTimer = setTimeout(
        () => setBannerState((prev) => ({ ...prev, show: false })),
        600,
      ); // Match fade animation duration
      timers.push(hideTimer);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [enableBackdropWithBlur, animeHubBannerDismissed, bannerState.show]);

  // Effect to manage skeleton visibility based on loading state
  useEffect(() => {
    const combinedLoading =
      (Boolean(jellyseerrService) && isLoading) || jikan.isLoading;

    if (combinedLoading) {
      skeleton.startLoading();
    } else {
      skeleton.stopLoading();
    }
  }, [isLoading, jikan.isLoading, jellyseerrService, skeleton]);

  // All callback functions are already defined above

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
          backgroundColor: "transparent",
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
          height: 48,
          borderRadius: 24,
          overflow: "hidden",
          marginBottom: spacing.md,
          backgroundColor: theme.dark
            ? "rgba(30, 41, 59, 0.3)"
            : "rgba(248, 250, 252, 0.5)",
        },
        searchBarContent: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        searchPlaceholder: {
          flex: 1,
          marginLeft: spacing.sm,
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          fontFamily: theme.custom.typography.bodyLarge.fontFamily,
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
        banner: {
          marginHorizontal: spacing.md,
          marginBottom: spacing.md,
        },
        bannerAnimated: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: 80,
        },
      }),
    [theme],
  );

  // Combined loading state — show skeletons while both sources are fetching
  const combinedLoading =
    (Boolean(jellyseerrService) && isLoading) || jikan.isLoading;
  const combinedError = Boolean(jellyseerrService) && isError && jikan.isError;

  // Show skeleton loading state
  if (skeleton.showSkeleton && combinedLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {enableBackdropWithBlur ? (
          <RNAnimated.View style={{ opacity: 1 }}>
            <AnimatedSkiaBackground
              theme={theme}
              imageUri={backgroundImageUri}
              scrollY={scrollY}
            />
          </RNAnimated.View>
        ) : null}

        {/* Banner with delay and animation */}
        {bannerState.show && (
          <RNAnimated.View
            style={[
              styles.bannerAnimated,
              {
                opacity: bannerState.visible ? 1 : 0,
                top: spacing.sm,
              },
            ]}
          >
            <Banner
              visible
              actions={[
                {
                  label: "Settings",
                  onPress: handleBannerSettingsPress,
                },
                {
                  label: "Dismiss",
                  onPress: handleBannerDismiss,
                },
              ]}
              icon="information"
            >
              Enable backdrop effects in Experimental Settings
            </Banner>
          </RNAnimated.View>
        )}

        <View style={[styles.header, { backgroundColor: "transparent" }]}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Anime Hub</Text>
          </View>
        </View>

        {/* Scrollable skeleton sections */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
        >
          {/* Render 6 skeleton sections matching the typical page layout */}
          {Array.from({ length: 6 }).map((_, index) => (
            <AnimeHubSectionSkeleton key={`skeleton-section-${index}`} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
  // Show error state when both sources failed
  if (combinedError) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {enableBackdropWithBlur ? (
          <RNAnimated.View style={{ opacity: 1 }}>
            <AnimatedSkiaBackground
              theme={theme}
              imageUri={backgroundImageUri}
              scrollY={scrollY}
            />
          </RNAnimated.View>
        ) : null}

        {/* Banner with delay and animation */}
        {bannerState.show && (
          <RNAnimated.View
            style={[
              styles.bannerAnimated,
              {
                opacity: bannerState.visible ? 1 : 0,
                top: spacing.sm,
              },
            ]}
          >
            <Banner
              visible
              actions={[
                {
                  label: "Settings",
                  onPress: handleBannerSettingsPress,
                },
                {
                  label: "Dismiss",
                  onPress: handleBannerDismiss,
                },
              ]}
              icon="information"
            >
              Enable backdrop effects in Experimental Settings
            </Banner>
          </RNAnimated.View>
        )}

        <View style={[styles.header, { backgroundColor: "transparent" }]}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Anime Hub</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <EmptyState
            title="Failed to Load"
            description="Unable to fetch anime content. Please check your connection and try again."
            actionLabel="Retry"
            onActionPress={() => Promise.all([refetch(), jikan.refetch()])}
          />
        </View>
      </SafeAreaView>
    );
  }

  // All memoized data getter functions and render functions are defined before early returns

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {enableBackdropWithBlur ? (
        <RNAnimated.View style={{ opacity: 1 }}>
          <AnimatedSkiaBackground
            theme={theme}
            imageUri={backgroundImageUri}
            scrollY={scrollY}
          />
        </RNAnimated.View>
      ) : null}

      {/* Banner with delay and animation */}
      {bannerState.show && (
        <RNAnimated.View
          style={[
            styles.bannerAnimated,
            {
              opacity: bannerState.visible ? 1 : 0,
              top: spacing.sm,
            },
          ]}
        >
          <Banner
            visible
            actions={[
              {
                label: "Settings",
                onPress: handleBannerSettingsPress,
              },
              {
                label: "Dismiss",
                onPress: handleBannerDismiss,
              },
            ]}
            icon="information"
          >
            Enable backdrop effects in Experimental Settings
          </Banner>
        </RNAnimated.View>
      )}

      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: "transparent" }]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Anime Hub</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton
              icon="dots-vertical"
              size={24}
              onPress={() => {}}
              style={styles.menuButton}
            />
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={10}
            tint={theme.dark ? "dark" : "light"}
          />
          <Pressable
            style={styles.searchBarContent}
            onPress={handleSearch}
            accessibilityRole="button"
          >
            <IconButton
              icon="magnify"
              size={24}
              onPress={handleSearch}
              accessibilityLabel="Search for anime"
            />
            <Text style={styles.searchPlaceholder}>
              Search for anime titles
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => Promise.all([refetch(), jikan.refetch()])}
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
              keyExtractor={(item, index) => `rec-${getJellyId(item)}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
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
                key={`new-${getJellyId(item)}`}
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
                        ? `https://image.tmdb.org/t/p/w342${getJellyPosterPath(item)}`
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
                      {(item as any).title ??
                        (item as any).name ??
                        (item as any).mediaInfo?.title ??
                        "Untitled"}
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
              keyExtractor={(item, index) =>
                `trend-${getJellyId(item)}-${index}`
              }
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
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
              keyExtractor={(item, index) =>
                `movie-${getJellyId(item)}-${index}`
              }
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.list}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
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
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
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
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
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
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
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
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
            />
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export default AnimeHubScreen;
