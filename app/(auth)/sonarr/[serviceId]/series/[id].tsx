import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { AnimatedSection } from "@/components/common/AnimatedComponents";
import { MediaDetails } from "@/components/media/MediaDetails";
import { MediaDetailsSkeleton } from "@/components/media/skeletons";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import type { AppTheme } from "@/constants/theme";
import { useSkeletonLoading } from "@/hooks/useSkeletonLoading";
import { skeletonTiming } from "@/constants/skeletonTiming";
import type { Series } from "@/models/media.types";
import { useSonarrSeriesDetails } from "@/hooks/useSonarrSeriesDetails";
import { spacing } from "@/theme/spacing";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { shouldAnimateLayout } from "@/utils/animations.utils";
const findEpisodeRuntime = (series?: Series): number | undefined => {
  if (!series?.seasons) {
    return undefined;
  }

  for (const season of series.seasons) {
    if (!season?.episodes?.length) {
      continue;
    }

    const runtime = season.episodes.find((episode) => episode.runtime)?.runtime;
    if (runtime) {
      return runtime;
    }
  }

  return undefined;
};

const SonarrSeriesDetailsScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { serviceId, id } = useLocalSearchParams<{
    serviceId?: string;
    id?: string;
  }>();
  const numericSeriesId = Number(id);
  const isSeriesIdValid = Number.isFinite(numericSeriesId);
  const serviceKey = serviceId ?? "";

  const {
    series,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    toggleMonitor,
    isTogglingMonitor,
    toggleSeasonMonitor,
    isTogglingSeasonMonitor,
    toggleEpisodeMonitor,
    isTogglingEpisodeMonitor,
    triggerSearch,
    isTriggeringSearch,
    searchMissingEpisodes,
    isSearchingMissing,
    searchMissingEpisode,
    isSearchingMissingEpisode,
    unmonitorAllEpisodes,
    isUnmonitoringAll,
    deleteSeriesAsync,
    isDeleting,
    removeAndSearchEpisodeAsync,
    isRemovingAndSearching,
  } = useSonarrSeriesDetails({
    serviceId: serviceKey,
    seriesId: numericSeriesId,
  });

  // Track which episode is currently being processed for remove & search
  const [processingEpisodeFileId, setProcessingEpisodeFileId] = useState<
    number | null
  >(null);

  // Initialize skeleton loading hook with low complexity timing (500ms) for local service queries
  const skeleton = useSkeletonLoading(skeletonTiming.lowComplexity);

  // Effect to manage skeleton visibility based on loading state
  useEffect(() => {
    if (isLoading && !series) {
      skeleton.startLoading();
    } else {
      skeleton.stopLoading();
    }
  }, [isLoading, series, skeleton]);

  const isMutating =
    isTogglingMonitor ||
    isTogglingSeasonMonitor ||
    isTogglingEpisodeMonitor ||
    isTriggeringSearch ||
    isSearchingMissing ||
    isSearchingMissingEpisode ||
    isUnmonitoringAll ||
    isDeleting ||
    isRemovingAndSearching;
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
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        title: {
          marginBottom: spacing.sm,
          textAlign: "center",
          color: theme.colors.onBackground,
        },
        subtitle: {
          textAlign: "center",
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const runtimeMinutes = useMemo(() => findEpisodeRuntime(series), [series]);

  // Get service config for download functionality
  const serviceConfig = useMemo(() => {
    if (!serviceId) return undefined;
    const connector = ConnectorManager.getInstance().getConnector(serviceId);
    return connector?.config;
  }, [serviceId]);

  const handleToggleMonitor = useCallback(
    (nextState: boolean) => {
      toggleMonitor(nextState);
    },
    [toggleMonitor],
  );

  const handleTriggerSearch = useCallback(() => {
    triggerSearch();
  }, [triggerSearch]);

  const handleDeleteSeries = useCallback(() => {
    alert(
      "Remove Series",
      "Are you sure you want to remove this series from Sonarr? Existing files will be kept.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteSeriesAsync()
              .then(() => {
                router.back();
              })
              .catch((err) => {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Unable to delete series.";
                alert("Delete Failed", message);
              });
          },
        },
      ],
      { cancelable: true },
    );
  }, [deleteSeriesAsync, router]);

  const handleRemoveAndSearchEpisode = useCallback(
    (episodeFileId: number, seasonNumber: number, episodeNumber: number) => {
      setProcessingEpisodeFileId(episodeFileId);
      void removeAndSearchEpisodeAsync(
        episodeFileId,
        seasonNumber,
        episodeNumber,
      )
        .then(() => {
          // Success is handled by query invalidation and UI update
          setProcessingEpisodeFileId(null);
        })
        .catch((err) => {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to remove and search episode.";
          alert("Operation Failed", message);
          setProcessingEpisodeFileId(null);
        });
    },
    [removeAndSearchEpisodeAsync],
  );

  const handleEpisodeLongPress = useCallback(
    (episodeId: string, episode: any) => {
      if (!series) return;

      // Find which season this episode belongs to
      let seasonNumber = 0;
      for (const season of series.seasons || []) {
        const foundEpisode = season.episodes?.find(
          (ep) =>
            ep.id === episode.id || ep.episodeNumber === episode.episodeNumber,
        );
        if (foundEpisode) {
          seasonNumber = season.seasonNumber;
          break;
        }
      }

      // Navigate to episode details modal with episode data
      router.push({
        pathname: `/sonarr/[serviceId]/series/[id]/episode/[episodeId]`,
        params: {
          serviceId: serviceKey,
          id: numericSeriesId.toString(),
          episodeId: episodeId,
          seasonNumber: seasonNumber.toString(),
          seriesTitle: series.title,
          episodeData: JSON.stringify(episode),
        },
      });
    },
    [router, series, serviceKey, numericSeriesId],
  );

  // Handle error states outside of sheet for immediate feedback
  if (!serviceId || !isSeriesIdValid) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <EmptyState
          title="Missing series information"
          description="We couldn't find the service or series identifier. Please navigate from the Sonarr library again."
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
        {!series && !(skeleton.showSkeleton && isLoading && !series) ? (
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

        {skeleton.showSkeleton && isLoading && !series ? (
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
                <MediaDetailsSkeleton showSeasons={true} />
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
              title="Failed to load series"
              description={
                error instanceof Error
                  ? error.message
                  : "Unable to load series details."
              }
              actionLabel="Retry"
              onActionPress={() => {
                void refetch();
              }}
              icon="alert-circle-outline"
            />
          </AnimatedSection>
        ) : series ? (
          <AnimatedSection
            animated={animationsEnabled}
            style={{ flex: 1 }}
            delay={150}
          >
            <DetailHero
              posterUri={series.posterUrl}
              backdropUri={series.backdropUrl}
              onBack={handleClose}
              isFetching={isFetching}
            >
              <MediaDetails
                title={series.title}
                year={series.year}
                status={series.status}
                overview={series.overview}
                genres={series.genres}
                network={series.network}
                posterUri={series.posterUrl}
                backdropUri={series.backdropUrl}
                monitored={series.monitored}
                seasons={series.seasons}
                runtimeMinutes={runtimeMinutes}
                type="series"
                tmdbId={series.tmdbId}
                tvdbId={series.tvdbId}
                imdbId={series.imdbId}
                onToggleMonitor={handleToggleMonitor}
                onToggleSeasonMonitor={toggleSeasonMonitor}
                onToggleEpisodeMonitor={toggleEpisodeMonitor}
                onSearchPress={handleTriggerSearch}
                onSearchMissingPress={searchMissingEpisodes}
                onSearchMissingEpisodePress={searchMissingEpisode}
                onRemoveAndSearchEpisodePress={handleRemoveAndSearchEpisode}
                onUnmonitorAllPress={unmonitorAllEpisodes}
                onDeletePress={handleDeleteSeries}
                isUpdatingMonitor={isTogglingMonitor}
                isSearching={isTriggeringSearch}
                isSearchingMissing={isSearchingMissing}
                isSearchingMissingEpisode={isSearchingMissingEpisode}
                isRemovingAndSearching={isRemovingAndSearching}
                isRemovingAndSearchingEpisodeFileId={processingEpisodeFileId}
                isUnmonitoringAll={isUnmonitoringAll}
                isTogglingSeasonMonitor={isTogglingSeasonMonitor}
                isTogglingEpisodeMonitor={isTogglingEpisodeMonitor}
                isDeleting={isDeleting}
                showPoster={false}
                disableScroll={true}
                serviceConfig={serviceConfig}
                contentId={numericSeriesId.toString()}
                totalSizeOnDiskMB={series.totalSizeOnDiskMB}
                onEpisodeLongPress={handleEpisodeLongPress}
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
              title="No series data"
              description="We couldn't load details for this series."
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

export default SonarrSeriesDetailsScreen;
