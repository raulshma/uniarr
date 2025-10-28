import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { AnimatedSection } from "@/components/common/AnimatedComponents";
import { MediaDetails } from "@/components/media/MediaDetails";
import { MovieDetailsSkeleton } from "@/components/media/skeletons";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import type { AppTheme } from "@/constants/theme";
import { useRadarrMovieDetails } from "@/hooks/useRadarrMovieDetails";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";

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
        {!movie ? (
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

        {isLoading && !movie ? (
          <MovieDetailsSkeleton />
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
