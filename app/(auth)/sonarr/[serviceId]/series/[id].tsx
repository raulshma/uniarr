import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetTransition from '@/components/common/SheetTransition';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { MediaDetails } from '@/components/media/MediaDetails';
import { MediaDetailsSkeleton } from '@/components/media/skeletons';
import type { AppTheme } from '@/constants/theme';
import type { Series } from '@/models/media.types';
import { useSonarrSeriesDetails } from '@/hooks/useSonarrSeriesDetails';
import { spacing } from '@/theme/spacing';

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
  const { serviceId, id } = useLocalSearchParams<{ serviceId?: string; id?: string }>();
  const numericSeriesId = Number(id);
  const isSeriesIdValid = Number.isFinite(numericSeriesId);
  const serviceKey = serviceId ?? '';
  const [isVisible, setIsVisible] = useState(true);

  const {
    series,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    toggleMonitor,
    isTogglingMonitor,
    triggerSearch,
    isTriggeringSearch,
    deleteSeriesAsync,
    isDeleting,
  } = useSonarrSeriesDetails({
    serviceId: serviceKey,
    seriesId: numericSeriesId,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        title: {
          marginBottom: spacing.sm,
          textAlign: 'center',
          color: theme.colors.onBackground,
        },
        subtitle: {
          textAlign: 'center',
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  const runtimeMinutes = useMemo(() => findEpisodeRuntime(series), [series]);

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
    Alert.alert(
      'Remove Series',
      'Are you sure you want to remove this series from Sonarr? Existing files will be kept.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteSeriesAsync()
              .then(() => {
                setIsVisible(false);
                setTimeout(() => router.back(), 300);
              })
              .catch((err) => {
                const message = err instanceof Error ? err.message : 'Unable to delete series.';
                Alert.alert('Delete Failed', message);
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
      <View style={[styles.container, { justifyContent: 'center' }]}>
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
    setIsVisible(false);
    setTimeout(() => router.back(), 300);
  };

  // Render only the SheetTransition content since we're using transparentModal presentation
  return (
    <SheetTransition
      visible={isVisible}
      onClose={handleClose}
      style={{
        backgroundColor: theme.colors.background,
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Button mode="text" onPress={handleClose} accessibilityLabel="Go back">
            Back
          </Button>
          {isFetching ? <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Refreshing…</Text> : null}
        </View>

        {isLoading && !series ? (
          <MediaDetailsSkeleton showSeasons={true} />
        ) : isError ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              title="Failed to load series"
              description={error instanceof Error ? error.message : 'Unable to load series details.'}
              actionLabel="Retry"
              onActionPress={() => {
                void refetch();
              }}
              icon="alert-circle-outline"
            />
          </View>
        ) : series ? (
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
            onToggleMonitor={handleToggleMonitor}
            onSearchPress={handleTriggerSearch}
            onDeletePress={handleDeleteSeries}
            isUpdatingMonitor={isTogglingMonitor}
            isSearching={isTriggeringSearch}
            isDeleting={isDeleting}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              title="No series data"
              description="We couldn't load details for this series."
              actionLabel="Go back"
              onActionPress={handleClose}
              icon="alert-circle-outline"
            />
          </View>
        )}
      </View>
    </SheetTransition>
  );
};

export default SonarrSeriesDetailsScreen;
