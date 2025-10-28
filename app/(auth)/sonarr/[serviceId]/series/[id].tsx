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
import { MediaDetailsSkeleton } from "@/components/media/skeletons";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import type { AppTheme } from "@/constants/theme";
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
    triggerSearch,
    isTriggeringSearch,
    searchMissingEpisodes,
    isSearchingMissing,
    unmonitorAllEpisodes,
    isUnmonitoringAll,
    deleteSeriesAsync,
    isDeleting,
  } = useSonarrSeriesDetails({
    serviceId: serviceKey,
    seriesId: numericSeriesId,
  });

  const isMutating =
    isTogglingMonitor ||
    isTogglingSeasonMonitor ||
    isTriggeringSearch ||
    isSearchingMissing ||
    isUnmonitoringAll ||
    isDeleting;
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
        {!series ? (
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

        {isLoading && !series ? (
          <MediaDetailsSkeleton showSeasons={true} />
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
                onSearchPress={handleTriggerSearch}
                onSearchMissingPress={searchMissingEpisodes}
                onUnmonitorAllPress={unmonitorAllEpisodes}
                onDeletePress={handleDeleteSeries}
                isUpdatingMonitor={isTogglingMonitor}
                isSearching={isTriggeringSearch}
                isSearchingMissing={isSearchingMissing}
                isUnmonitoringAll={isUnmonitoringAll}
                isTogglingSeasonMonitor={isTogglingSeasonMonitor}
                isDeleting={isDeleting}
                showPoster={false}
                disableScroll={true}
                serviceConfig={serviceConfig}
                contentId={numericSeriesId.toString()}
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
