import React, { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

import type { DiscoverMediaItem } from '@/models/discover.types';
import { spacing } from '@/theme/spacing';
import type { AppTheme } from '@/constants/theme';
import { useTmdbDetails } from '@/hooks/tmdb/useTmdbDetails';
import type { TmdbMediaType } from '@/connectors/implementations/TmdbConnector';
import MediaPoster from '@/components/media/MediaPoster/MediaPoster';

interface Props {
  visible: boolean;
  item: DiscoverMediaItem | null;
  onDismiss: () => void;
  onAdd: (item: DiscoverMediaItem) => void;
}

const resolveTmdbMediaType = (item: DiscoverMediaItem | null): TmdbMediaType =>
  item?.mediaType === 'series' ? 'tv' : 'movie';

const getTrailerUrl = (videos: any): string | undefined => {
  const results = videos?.results as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(results)) {
    return undefined;
  }

  const match = results.find((video) => {
    const site = typeof video.site === 'string' ? video.site : undefined;
    const type = typeof video.type === 'string' ? video.type : undefined;
    return site === 'YouTube' && (type === 'Trailer' || type === 'Teaser');
  });

  if (!match) {
    return undefined;
  }

  const key = typeof match.key === 'string' ? match.key : undefined;
  if (!key) {
    return undefined;
  }

  return `https://www.youtube.com/watch?v=${key}`;
};

const getProviderNames = (watchProviders: any): string | undefined => {
  if (!watchProviders?.results) {
    return undefined;
  }

  const region = watchProviders.results.US ?? watchProviders.results.GB ?? Object.values(watchProviders.results)[0];
  if (!region) {
    return undefined;
  }

  const collect = (entries?: Array<{ provider_name?: string }>) =>
    entries?.map((entry) => entry.provider_name).filter(Boolean) as string[];

  const names = [
    ...(collect(region.flatrate) ?? []),
    ...(collect(region.rent) ?? []),
    ...(collect(region.buy) ?? []),
  ];

  if (!names.length) {
    return undefined;
  }

  return Array.from(new Set(names)).join(', ');
};

export const TmdbDetails: React.FC<Props> = ({ visible, item, onDismiss, onAdd }) => {
  const theme = useTheme<AppTheme>();

  const tmdbId = item?.tmdbId ?? null;
  const mediaType = resolveTmdbMediaType(item);

  const detailsQuery = useTmdbDetails(mediaType, tmdbId, {
    enabled: visible && Boolean(tmdbId),
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        dialog: {
          borderRadius: 16,
          backgroundColor: theme.colors.elevation.level2,
        },
        container: {
          gap: spacing.md,
        },
        header: {
          flexDirection: 'row',
          gap: spacing.md,
        },
        overview: {
          color: theme.colors.onSurfaceVariant,
        },
        pill: {
          color: theme.colors.onSurfaceVariant,
          fontStyle: 'italic',
        },
        sectionTitle: {
          color: theme.colors.onSurface,
          fontWeight: '600',
          marginBottom: spacing.xs,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.md,
        },
      }),
    [theme],
  );

  const trailerUrl = detailsQuery.data ? getTrailerUrl(detailsQuery.data.videos) : undefined;
  const providers = detailsQuery.data ? getProviderNames(detailsQuery.data.watchProviders) : undefined;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{item?.title ?? 'Details'}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
              <MediaPoster uri={item?.posterUrl} size={120} borderRadius={12} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="titleMedium" style={styles.pill}>
                  {item?.mediaType === 'series' ? 'TV Series' : 'Movie'}
                </Text>
                {item?.releaseDate ? (
                  <Text variant="bodyMedium" style={styles.pill}>
                    Released {item.releaseDate}
                  </Text>
                ) : null}
                {typeof item?.rating === 'number' ? (
                  <Text variant="bodyMedium" style={styles.pill}>
                    Rating {item.rating.toFixed(1)} ({item.voteCount ?? 0} votes)
                  </Text>
                ) : null}
              </View>
            </View>

            {item?.overview ? (
              <View>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Overview
                </Text>
                <Text variant="bodyMedium" style={styles.overview}>
                  {item.overview}
                </Text>
              </View>
            ) : null}

            {providers ? (
              <View>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Watch providers
                </Text>
                <Text variant="bodyMedium" style={styles.overview}>
                  {providers}
                </Text>
              </View>
            ) : null}

            <View style={styles.buttonRow}>
              <Button mode="contained" onPress={() => item && onAdd(item)}>
                Add to service
              </Button>
              {trailerUrl ? (
                <Button
                  mode="outlined"
                  onPress={() => {
                    void Linking.openURL(trailerUrl);
                  }}
                >
                  Watch trailer
                </Button>
              ) : null}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default TmdbDetails;
