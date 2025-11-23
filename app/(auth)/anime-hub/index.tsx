import React, { useCallback, useMemo, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Animated as RNAnimated,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
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
import QuickViewModal from "@/components/anime/QuickViewModal";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import AnimatedSkiaBackground from "@/components/common/AnimatedSkiaBackground";
import { EmptyState } from "@/components/common/EmptyState";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";

type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

const HEADER_MAX_HEIGHT = 180;
const HEADER_MIN_HEIGHT = 100;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

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

  // State for Quick View Modal
  const [quickViewData, setQuickViewData] = useState<{
    item: any;
    layout: any;
  } | null>(null);

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
            onLongPress={(layout) => {
              const overview =
                "overview" in item && item.overview
                  ? (item.overview as string)
                  : undefined;
              setQuickViewData({
                item: { id: idNum, title, posterUrl, rating, overview },
                layout,
              });
            }}
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
          onLongPress={(layout) =>
            setQuickViewData({
              item: {
                id: item.id,
                title: item.title,
                posterUrl: item.posterUrl,
                rating: item.rating,
                overview: item.synopsis ?? undefined,
              },
              layout,
            })
          }
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

  // Styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          overflow: "hidden",
        },
        headerContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          justifyContent: "flex-end",
        },
        headerTitle: {
          fontSize: 34,
          fontWeight: "700",
          color: theme.colors.onBackground,
          marginBottom: spacing.xs,
        },
        headerSubtitle: {
          fontSize: 16,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.md,
        },
        searchBar: {
          height: 52,
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: theme.dark
            ? "rgba(30, 41, 59, 0.6)"
            : "rgba(240, 242, 245, 0.8)",
          borderWidth: 1,
          borderColor: theme.dark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.05)",
        },
        searchBarContent: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
        },
        searchPlaceholder: {
          flex: 1,
          marginLeft: spacing.sm,
          color: theme.colors.onSurfaceVariant,
          fontSize: 16,
          fontFamily: theme.custom.typography.bodyLarge.fontFamily,
        },
        scrollContent: {
          paddingTop: HEADER_MAX_HEIGHT + spacing.md,
          paddingBottom: spacing.xl * 2,
        },
        section: {
          marginBottom: spacing.xl,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.md,
        },
        sectionTitle: {
          fontSize: 22,
          fontWeight: "700",
          color: theme.colors.onBackground,
        },
        sectionAction: {
          color: theme.colors.primary,
          fontSize: 14,
          fontWeight: "600",
        },
        list: {
          paddingHorizontal: spacing.lg,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingTop: HEADER_MAX_HEIGHT,
        },
        episodeInfo: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginTop: spacing.xs,
        },
        episodeText: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
        },
        bannerAnimated: {
          position: "absolute",
          top: HEADER_MAX_HEIGHT,
          left: 0,
          right: 0,
          zIndex: 10,
        },
      }),
    [theme],
  );

  // Animated Styles
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolate.CLAMP,
    );

    return {
      height,
    };
  });

  const headerTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE / 2],
      [1, 0],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      [0, -20],
      Extrapolate.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const smallHeaderTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
      [0, 1],
      Extrapolate.CLAMP,
    );

    return {
      opacity,
    };
  });

  const headerBackgroundAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_SCROLL_DISTANCE],
      [0, 1],
      Extrapolate.CLAMP,
    );

    return {
      opacity,
    };
  });

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

        <View style={[styles.header, { height: HEADER_MAX_HEIGHT }]}>
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={80}
            tint={theme.dark ? "dark" : "light"}
          />
          <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
            <View style={[styles.headerContent, { flex: 1 }]}>
              <Text style={styles.headerTitle}>Anime Hub</Text>
              <View style={styles.searchBar}>
                <View style={styles.searchBarContent}>
                  <IconButton icon="magnify" size={24} />
                  <Text style={styles.searchPlaceholder}>
                    Search for anime...
                  </Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <AnimeHubSectionSkeleton key={`skeleton-section-${index}`} />
          ))}
        </Animated.ScrollView>
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

        <View style={[styles.header, { height: HEADER_MIN_HEIGHT }]}>
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={80}
            tint={theme.dark ? "dark" : "light"}
          />
          <SafeAreaView
            edges={["top"]}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "bold" }}>Anime Hub</Text>
          </SafeAreaView>
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

  return (
    <View style={styles.container}>
      {enableBackdropWithBlur ? (
        <RNAnimated.View style={{ opacity: 1 }}>
          <AnimatedSkiaBackground
            theme={theme}
            imageUri={backgroundImageUri}
            scrollY={scrollY}
          />
        </RNAnimated.View>
      ) : null}

      {/* Animated Header */}
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, headerBackgroundAnimatedStyle]}
        >
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={80}
            tint="dark"
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.3)" },
            ]}
          />
        </Animated.View>
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <View style={[styles.headerContent, { flex: 1 }]}>
            {/* Small Title (Visible on Scroll) */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                },
                smallHeaderTitleAnimatedStyle,
              ]}
            >
              <Text style={{ fontSize: 20, fontWeight: "bold" }}>
                Anime Hub
              </Text>
            </Animated.View>

            {/* Large Title (Visible initially) */}
            <Animated.View style={headerTitleAnimatedStyle}>
              <Text style={styles.headerTitle}>Anime Hub</Text>
              <Text style={styles.headerSubtitle}>
                Discover your next favorite anime
              </Text>
            </Animated.View>

            {/* Search Bar */}
            <Pressable onPress={handleSearch}>
              <View style={styles.searchBar}>
                <View style={styles.searchBarContent}>
                  <IconButton
                    icon="magnify"
                    size={24}
                    onPress={handleSearch}
                    style={{ margin: 0 }}
                  />
                  <Text style={styles.searchPlaceholder}>
                    Search for anime titles
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Banner */}
      {bannerState.show && (
        <RNAnimated.View
          style={[
            styles.bannerAnimated,
            {
              opacity: bannerState.visible ? 1 : 0,
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
            style={{ marginHorizontal: spacing.md, borderRadius: 16 }}
          >
            Enable backdrop effects in Experimental Settings
          </Banner>
        </RNAnimated.View>
      )}

      {/* Scrollable Content */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => Promise.all([refetch(), jikan.refetch()])}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressViewOffset={HEADER_MAX_HEIGHT}
          />
        }
      >
        {/* Recommended For You (Jellyseerr) */}
        {recommendations.length > 0 && jellyseerrService && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended For You</Text>
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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
            {upcoming.slice(0, 3).map((item) => (
              <Pressable
                key={`new-${getJellyId(item)}`}
                onPress={() => handleCardPress(item)}
                style={{
                  marginBottom: spacing.md,
                  marginHorizontal: spacing.lg,
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 20,
                  padding: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <AnimeCard
                  id={getJellyId(item)}
                  title="" // Hide title in card, show in list item
                  posterUrl={
                    getJellyPosterPath(item)
                      ? `https://image.tmdb.org/t/p/w342${getJellyPosterPath(item)}`
                      : undefined
                  }
                  rating={getJellyVoteAverage(item)}
                  onPress={() => handleCardPress(item)}
                  width={80}
                />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    variant="titleMedium"
                    numberOfLines={2}
                    style={{
                      color: theme.colors.onSurface,
                      fontWeight: "700",
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
                      {item.mediaType === "tv" ? "New Episode" : "New Release"}
                    </Text>
                  </View>
                </View>
                <IconButton icon="chevron-right" size={24} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Trending Anime Series (Jellyseerr) */}
        {trending.length > 0 && jellyseerrService && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trending Anime Series</Text>
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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

        {/* MyAnimeList (Jikan) - Now Airing */}
        {jikan.now.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Now Airing</Text>
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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
              <Text style={styles.sectionTitle}>Upcoming</Text>
              <Pressable>
                <Text style={styles.sectionAction}>See All</Text>
              </Pressable>
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

      {/* Quick View Modal */}
      <QuickViewModal
        visible={!!quickViewData}
        item={quickViewData?.item ?? null}
        initialLayout={quickViewData?.layout ?? null}
        onClose={() => setQuickViewData(null)}
      />
    </View>
  );
};

export default AnimeHubScreen;
