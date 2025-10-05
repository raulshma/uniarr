import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { MediaDetails } from '@/components/media/MediaDetails';
import type { AppTheme } from '@/constants/theme';
import { useRadarrMovieDetails } from '@/hooks/useRadarrMovieDetails';
import { spacing } from '@/theme/spacing';

const RadarrMovieDetailsScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { serviceId, id } = useLocalSearchParams<{ serviceId?: string; id?: string }>();
  const numericMovieId = Number(id);
  const isMovieIdValid = Number.isFinite(numericMovieId);
  const serviceKey = serviceId ?? '';

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
    Alert.alert(
      'Remove Movie',
      'Are you sure you want to remove this movie from Radarr? Existing files will be kept.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteMovieAsync()
              .then(() => {
                router.back();
              })
              .catch((err) => {
                const message = err instanceof Error ? err.message : 'Unable to delete movie.';
                Alert.alert('Delete Failed', message);
              });
          },
        },
      ],
      { cancelable: true },
    );
  }, [deleteMovieAsync, router]);

  if (!serviceId || !isMovieIdValid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <EmptyState
            title="Missing movie information"
            description="We couldn't find the service or movie identifier. Please navigate from the Radarr library again."
            actionLabel="Go back"
            onActionPress={() => router.back()}
            icon="alert-circle-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !movie) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <LoadingState message="Loading movie details" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load movie details.';
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <EmptyState
            title="Failed to load movie"
            description={message}
            actionLabel="Retry"
            onActionPress={() => {
              void refetch();
            }}
            icon="alert-circle-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Button mode="text" onPress={() => router.back()} accessibilityLabel="Go back">
            Back
          </Button>
          {isFetching ? <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Refreshing…</Text> : null}
        </View>
        {movie ? (
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
            type="movie"
            rating={movie.ratings?.value}
            onToggleMonitor={handleToggleMonitor}
            onSearchPress={handleTriggerSearch}
            onDeletePress={handleDeleteMovie}
            isUpdatingMonitor={isTogglingMonitor}
            isSearching={isTriggeringSearch}
            isDeleting={isDeleting}
          />
        ) : (
          <EmptyState
            title="No movie data"
            description="We couldn't load details for this movie."
            actionLabel="Go back"
            onActionPress={() => router.back()}
            icon="alert-circle-outline"
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default RadarrMovieDetailsScreen;
