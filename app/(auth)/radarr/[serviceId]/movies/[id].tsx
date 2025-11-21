import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { alert } from "@/services/dialogService";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  findJellyfinItemByExternalIds,
  getFirstJellyfinServiceId,
} from "@/utils/jellyfin.utils";
import {
  showLoadingSnackbar,
  dismissSnackbar,
  showErrorSnackbar,
} from "@/services/snackbarService";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { AnimatedSection } from "@/components/common/AnimatedComponents";
import { MediaDetails } from "@/components/media/MediaDetails";
import { MovieDetailsSkeleton } from "@/components/media/skeletons";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import TrailerFadeOverlay from "@/components/media/TrailerFadeOverlay/TrailerFadeOverlay";
import type { AppTheme } from "@/constants/theme";
import { useSkeletonLoading } from "@/hooks/useSkeletonLoading";
import { skeletonTiming } from "@/constants/skeletonTiming";
import { useRadarrMovieDetails } from "@/hooks/useRadarrMovieDetails";
import { useTmdbDetails } from "@/hooks/tmdb/useTmdbDetails";
import { useSettingsStore } from "@/store/settingsStore";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import Animated, { FadeIn } from "react-native-reanimated";

const RadarrMovieDetailsScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { serviceId, id } = useLocalSearchParams<{
    serviceId?: string;
    id?: string;
  }>();
  const numericMovieId = Number(id);
  const isMovieIdValid = Number.isFinite(numericMovieId);
  const serviceKey = serviceId ?? "";

  const {
    movie,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    toggleMonitor,
    isTogglingMonitor,
    triggerSearch,
    isTriggeringSearch,
    deleteMovieAsync,
    isDeleting,
  } = useRadarrMovieDetails({
    serviceId: serviceKey,
    movieId: numericMovieId,
  });

  // Initialize skeleton loading hook with low complexity timing (500ms) for local service queries
  const skeleton = useSkeletonLoading(skeletonTiming.lowComplexity);

  // Effect to manage skeleton visibility based on loading state
  useEffect(() => {
    if (isLoading && !movie) {
      skeleton.startLoading();
    } else {
      skeleton.stopLoading();
    }
  }, [isLoading, movie, skeleton]);

  const isMutating = isTogglingMonitor || isTriggeringSearch || isDeleting;
  const animationsEnabled = shouldAnimateLayout(
    isLoading,
    isFetching,
    isMutating,
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingHorizontal: spacing.none,
          paddingBottom: spacing.lg,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        trailerContainer: {
          marginBottom: spacing.md,
          marginHorizontal: spacing.lg,
          borderRadius: 12,
          overflow: "hidden",
        },
      }),
    [theme],
  );

  const handleToggleMonitor = useCallback(
    (nextState: boolean) => {
      toggleMonitor(nextState);
    },
    [toggleMonitor],
  );

  const handleTriggerSearch = useCallback(() => {
    triggerSearch();
  }, [triggerSearch]);

  // Fetch TMDB video data if we have a TMDB ID
  const tmdbDetailsQuery = useTmdbDetails("movie", movie?.tmdbId ?? null, {
    enabled: !!movie?.tmdbId,
  });

  // Extract trailer video key
  const trailerVideoKey = useMemo(() => {
    const videos = (tmdbDetailsQuery.data?.details as any)?.videos;
    if (!Array.isArray(videos?.results)) return undefined;

    const match = videos.results.find((video: any) => {
      const site = typeof video.site === "string" ? video.site : undefined;
      const type = typeof video.type === "string" ? video.type : undefined;
      return site === "YouTube" && (type === "Trailer" || type === "Teaser");
    });

    return match?.key ?? undefined;
  }, [tmdbDetailsQuery.data]);

  const trailerFeatureEnabled = useSettingsStore(
    (s) => s.trailerFeatureEnabled,
  );

  const handleDeleteMovie = useCallback(() => {
    alert(
      "Remove Movie",
      "Are you sure you want to remove this movie from Radarr? Existing files will be kept.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteMovieAsync()
              .then(() => {
                router.back();
              })
              .catch((err) => {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Unable to delete movie.";
                alert("Delete Failed", message);
              });
          },
        },
      ],
      { cancelable: true },
    );
  }, [deleteMovieAsync, router]);

  const handlePosterPress = useCallback(async () => {
    if (!movie) return;

    // Get Jellyfin service ID
    const jellyfinServiceId = getFirstJellyfinServiceId();
    if (!jellyfinServiceId) {
      alert(
        "Jellyfin Not Configured",
        "Please add a Jellyfin service to play movies.",
      );
      return;
    }

    // Show loading snackbar
    showLoadingSnackbar("Searching Jellyfin...");

    try {
      // Find the Jellyfin item
      const jellyfinItem = await findJellyfinItemByExternalIds(
        jellyfinServiceId,
        {
          tmdbId: movie.tmdbId,
          imdbId: movie.imdbId,
          type: "Movie",
        },
      );

      // Dismiss loading snackbar
      dismissSnackbar();

      if (!jellyfinItem?.Id) {
        showErrorSnackbar(`Movie not found in Jellyfin: ${movie.title}`);
        return;
      }

      // Navigate to Jellyfin item details
      router.push({
        pathname: `/jellyfin/[serviceId]/details/[itemId]`,
        params: {
          serviceId: jellyfinServiceId,
          itemId: jellyfinItem.Id,
        },
      });
    } catch (error) {
      dismissSnackbar();
      showErrorSnackbar(
        `Failed to search Jellyfin: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }, [router, movie]);

  // Handle error states outside of sheet for immediate feedback
  if (!serviceId || !isMovieIdValid) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <EmptyState
          title="Missing movie information"
          description="We couldn't find the service or movie identifier. Please navigate from the Radarr library again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
          icon="alert-circle-outline"
        />
      </View>
    );
  }

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <View style={styles.container}>
        {!movie && !(skeleton.showSkeleton && isLoading && !movie) ? (
          <AnimatedSection
            animated={animationsEnabled}
            style={styles.header}
            delay={150}
          >
            <Button
              mode="text"
              onPress={handleClose}
              accessibilityLabel="Go back"
            >
              Back
            </Button>
            {isFetching ? (
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Refreshing…
              </Text>
            ) : null}
          </AnimatedSection>
        ) : null}

        {skeleton.showSkeleton && isLoading && !movie ? (
          <AnimatedSection
            animated={animationsEnabled}
            style={{ flex: 1 }}
            delay={150}
          >
            <DetailHero
              posterUri={undefined}
              backdropUri={undefined}
              onBack={handleClose}
            >
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.xxxxl,
                }}
              >
                <MovieDetailsSkeleton />
              </ScrollView>
            </DetailHero>
          </AnimatedSection>
        ) : isError ? (
          <AnimatedSection
            animated={animationsEnabled}
            style={{ flex: 1, justifyContent: "center" }}
            delay={100}
          >
            <EmptyState
              title="Failed to load movie"
              description={
                error instanceof Error
                  ? error.message
                  : "Unable to load movie details."
              }
              actionLabel="Retry"
              onActionPress={() => {
                void refetch();
              }}
              icon="alert-circle-outline"
            />
          </AnimatedSection>
        ) : movie ? (
          <AnimatedSection
            animated={animationsEnabled}
            style={{ flex: 1 }}
            delay={150}
          >
            <DetailHero
              posterUri={movie.posterUrl}
              backdropUri={movie.backdropUrl}
              onBack={handleClose}
              isFetching={isFetching}
            >
              {/* Trailer Fade Overlay - shows trailer if enabled and available */}
              {trailerFeatureEnabled && trailerVideoKey && movie.backdropUrl ? (
                <Animated.View
                  style={styles.trailerContainer}
                  entering={FadeIn.delay(350)}
                >
                  <TrailerFadeOverlay
                    backdropUri={movie.backdropUrl}
                    videoKey={trailerVideoKey}
                    height={200}
                  />
                </Animated.View>
              ) : null}
              <MediaDetails
                title={movie.title}
                year={movie.year}
                status={movie.status}
                overview={movie.overview}
                genres={movie.genres}
                runtimeMinutes={movie.runtime}
                network={movie.studio}
                posterUri={movie.posterUrl}
                backdropUri={movie.backdropUrl}
                monitored={movie.monitored}
                hasFile={movie.hasFile}
                movieFile={movie.movieFile}
                type="movie"
                rating={movie.ratings?.value}
                tmdbId={movie.tmdbId}
                imdbId={movie.imdbId}
                onToggleMonitor={handleToggleMonitor}
                onSearchPress={handleTriggerSearch}
                onDeletePress={handleDeleteMovie}
                isUpdatingMonitor={isTogglingMonitor}
                isSearching={isTriggeringSearch}
                isDeleting={isDeleting}
                showPoster={false}
                disableScroll={true}
                onPosterPress={handlePosterPress}
              />
            </DetailHero>
          </AnimatedSection>
        ) : (
          <AnimatedSection
            animated={animationsEnabled}
            style={{ flex: 1, justifyContent: "center" }}
            delay={100}
          >
            <EmptyState
              title="No movie data"
              description="We couldn't load details for this movie."
              actionLabel="Go back"
              onActionPress={handleClose}
              icon="alert-circle-outline"
            />
          </AnimatedSection>
        )}
      </View>
    </SafeAreaView>
  );
};

export default RadarrMovieDetailsScreen;
