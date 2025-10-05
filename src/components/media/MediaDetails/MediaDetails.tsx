import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Chip, Divider, List, Text, useTheme } from 'react-native-paper';

import { Button } from '@/components/common/Button';
import type { AppTheme } from '@/constants/theme';
import type { Episode, Season } from '@/models/media.types';
import { MediaPoster } from '@/components/media/MediaPoster';
import type { MediaKind } from '@/components/media/MediaCard';

export type MediaDetailsProps = {
  title: string;
  year?: number;
  status?: string;
  rating?: number;
  overview?: string;
  genres?: string[];
  runtimeMinutes?: number;
  network?: string;
  posterUri?: string;
  backdropUri?: string;
  monitored?: boolean;
  seasons?: Season[];
  type: MediaKind;
  onToggleMonitor?: (nextState: boolean) => void;
  onSearchPress?: () => void;
  onDeletePress?: () => void;
  isUpdatingMonitor?: boolean;
  isSearching?: boolean;
  isDeleting?: boolean;
  testID?: string;
};

const formatRuntime = (runtimeMinutes?: number): string | undefined => {
  if (!runtimeMinutes) {
    return undefined;
  }

  const hours = Math.floor(runtimeMinutes / 60);
  const minutes = runtimeMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  return `${minutes}m`;
};

const formatEpisodeLabel = (episode: Episode): string => {
  const paddedEpisode = episode.episodeNumber.toString().padStart(2, '0');
  const paddedSeason = episode.seasonNumber.toString().padStart(2, '0');
  return `S${paddedSeason}E${paddedEpisode} • ${episode.title}`;
};

const MediaDetails: React.FC<MediaDetailsProps> = ({
  title,
  year,
  status,
  rating,
  overview,
  genres,
  runtimeMinutes,
  network,
  posterUri,
  backdropUri,
  monitored,
  seasons,
  type,
  onToggleMonitor,
  onSearchPress,
  onDeletePress,
  isUpdatingMonitor = false,
  isSearching = false,
  isDeleting = false,
  testID = 'media-details',
}) => {
  const theme = useTheme<AppTheme>();

  const metaLine = useMemo(() => {
    const items: string[] = [];
    if (year) {
      items.push(String(year));
    }
    if (status) {
      items.push(status);
    }
    const runtimeLabel = formatRuntime(runtimeMinutes);
    if (runtimeLabel) {
      items.push(runtimeLabel);
    }
    if (network) {
      items.push(network);
    }

    return items.join(' • ');
  }, [network, runtimeMinutes, status, year]);

  const handleMonitorPress = useCallback(() => {
    if (!onToggleMonitor) {
      return;
    }

    onToggleMonitor(!monitored);
  }, [monitored, onToggleMonitor]);

  const showSeasons = type === 'series' && seasons?.length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: theme.custom.spacing.xxl }}
      testID={testID}
    >
      <View style={styles.backdropContainer}>
        {backdropUri ? (
          <Image
            source={{ uri: backdropUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.surfaceVariant }]} />
        )}
        <View style={[styles.backdropOverlay, { backgroundColor: theme.colors.backdrop }]} />
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: theme.custom.spacing.lg,
              paddingVertical: theme.custom.spacing.lg,
            },
          ]}
        >
          <MediaPoster
            uri={posterUri}
            size={160}
            borderRadius={16}
            accessibilityLabel={`${title} poster`}
            showPlaceholderLabel
          />
          <View style={[styles.headerContent, { marginLeft: theme.custom.spacing.lg }]}>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }} numberOfLines={2}>
              {title}
            </Text>
            {metaLine ? (
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                {metaLine}
              </Text>
            ) : null}
            {rating !== undefined ? (
              <Chip
                style={[styles.ratingChip, { backgroundColor: theme.colors.secondaryContainer }]}
                textStyle={{ color: theme.colors.onSecondaryContainer, fontWeight: '600' }}
                compact
              >
                Rating {rating.toFixed(1)} / 10
              </Chip>
            ) : null}
            {genres && genres.length ? (
              <View style={styles.genreRow}>
                {genres.map((genre) => (
                  <Chip
                    key={genre}
                    compact
                    mode="outlined"
                    style={[styles.genreChip, { borderColor: theme.colors.outline }]}
                    textStyle={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {genre}
                  </Chip>
                ))}
              </View>
            ) : null}
            <View style={styles.actions}>
              {onToggleMonitor ? (
                <View style={styles.actionItem}>
                  <Button
                    mode={monitored ? 'outlined' : 'contained'}
                    onPress={handleMonitorPress}
                    loading={isUpdatingMonitor}
                    disabled={isUpdatingMonitor}
                  >
                    {monitored ? 'Unmonitor' : 'Monitor'}
                  </Button>
                </View>
              ) : null}
              {onSearchPress ? (
                <View style={styles.actionItem}>
                  <Button
                    mode="outlined"
                    onPress={onSearchPress}
                    loading={isSearching}
                    disabled={isSearching}
                  >
                    Trigger Search
                  </Button>
                </View>
              ) : null}
              {onDeletePress ? (
                <View style={styles.actionItem}>
                  <Button
                    mode="outlined"
                    onPress={onDeletePress}
                    loading={isDeleting}
                    disabled={isDeleting}
                  >
                    Delete
                  </Button>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: theme.custom.spacing.lg, paddingTop: theme.custom.spacing.lg }}>
        {overview ? (
          <View>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Overview
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              {overview}
            </Text>
          </View>
        ) : null}

        {showSeasons ? (
          <View style={{ marginTop: theme.custom.spacing.xl }}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Seasons
            </Text>
            <List.Section>
              {seasons?.map((season) => {
                const totalEpisodes = season.statistics?.episodeCount ?? season.episodes?.length ?? 0;
                const downloadedEpisodesFromEpisodes = season.episodes
                  ? season.episodes.filter((episode) => episode.hasFile).length
                  : 0;
                const downloadedEpisodes = season.statistics?.episodeFileCount ?? downloadedEpisodesFromEpisodes;

                return (
                  <List.Accordion
                    key={season.id ?? season.seasonNumber}
                    title={`Season ${season.seasonNumber}`}
                    description={`${downloadedEpisodes}/${totalEpisodes} episodes downloaded`}
                    left={(props) => (
                      <List.Icon {...props} icon={season.monitored ? 'eye-outline' : 'eye-off-outline'} />
                    )}
                  >
                    {season.episodes?.length ? (
                      season.episodes.map((episode) => (
                        <List.Item
                          key={episode.id ?? `${season.seasonNumber}-${episode.episodeNumber}`}
                          title={formatEpisodeLabel(episode)}
                          description={episode.airDate ? `Air date: ${episode.airDate}` : undefined}
                          left={(props) => (
                            <List.Icon
                              {...props}
                              icon={episode.hasFile ? 'check-circle-outline' : 'cloud-download-outline'}
                            />
                          )}
                        />
                      ))
                    ) : (
                      <View style={{ padding: theme.custom.spacing.md }}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          No episode information available.
                        </Text>
                      </View>
                    )}
                    <Divider />
                  </List.Accordion>
                );
              })}
            </List.Section>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

export default MediaDetails;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdropContainer: {
    position: 'relative',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  ratingChip: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  genreChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 16,
  },
  actionItem: {
    marginRight: 12,
    marginBottom: 12,
  },
});
