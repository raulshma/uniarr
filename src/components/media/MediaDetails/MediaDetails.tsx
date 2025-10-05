import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Chip, Text, useTheme, ProgressBar } from 'react-native-paper';

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
  return `Chapter ${episode.episodeNumber}: ${episode.title}`;
};

const formatFileSize = (sizeInMB?: number): string => {
  if (!sizeInMB) return '';

  if (sizeInMB >= 1024) {
    return `${(sizeInMB / 1024).toFixed(1)}GB`;
  }

  return `${sizeInMB}MB`;
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
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      testID={testID}
    >
      {/* Backdrop Header */}
      <View style={{ position: 'relative', height: 300 }}>
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
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.backdrop, opacity: 0.7 }]} />

        {/* Header Content */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text variant="headlineLarge" style={{ color: theme.colors.onSurface, fontWeight: 'bold', marginBottom: 12 }}>
            {title}
          </Text>

          <View style={{ flexDirection: 'row', gap: 32 }}>
            {network && (
              <View style={{ flexDirection: 'column' }}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Network</Text>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{network}</Text>
              </View>
            )}
            {status && (
              <View style={{ flexDirection: 'column' }}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Status</Text>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{status}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: theme.colors.background }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {onToggleMonitor ? (
            <Button
              mode={monitored ? 'outlined' : 'contained'}
              onPress={handleMonitorPress}
              loading={isUpdatingMonitor}
              disabled={isUpdatingMonitor}
              style={{ flex: 1 }}
            >
              {monitored ? 'Unmonitor' : 'Monitor'}
            </Button>
          ) : null}
          {onSearchPress ? (
            <Button
              mode="outlined"
              onPress={onSearchPress}
              loading={isSearching}
              disabled={isSearching}
              style={{ flex: 1 }}
            >
              Search Missing
            </Button>
          ) : null}
          {onDeletePress ? (
            <Button
              mode="outlined"
              onPress={onDeletePress}
              loading={isDeleting}
              disabled={isDeleting}
              style={{ flex: 1 }}
            >
              Delete
            </Button>
          ) : null}
        </View>
      </View>

      {/* Overview */}
      {overview ? (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginBottom: 16, fontWeight: 'bold' }}>Overview</Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 24 }}>
            {overview}
          </Text>
        </View>
      ) : null}

      {/* Seasons */}
      {showSeasons ? (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginBottom: 16, fontWeight: 'bold' }}>Seasons</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {seasons?.map((season) => {
              const totalEpisodes = season.statistics?.episodeCount ?? season.episodes?.length ?? 0;
              const downloadedEpisodes = season.statistics?.episodeFileCount ??
                (season.episodes ? season.episodes.filter((episode) => episode.hasFile).length : 0);

              return (
                <View key={season.id ?? season.seasonNumber} style={{
                  width: '48%',
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 12,
                  padding: 12,
                  alignItems: 'center'
                }}>
                  <MediaPoster
                    uri={season.posterUrl}
                    size={120}
                    borderRadius={12}
                    accessibilityLabel={`Season ${season.seasonNumber} poster`}
                    showPlaceholderLabel
                  />
                  <View style={{ alignItems: 'center', marginTop: 8 }}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                      Season {season.seasonNumber}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      {totalEpisodes} Episodes
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Episodes */}
      {showSeasons && seasons?.some(season => season.episodes?.length) ? (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginBottom: 16, fontWeight: 'bold' }}>Episodes</Text>
          {seasons.map((season) =>
            season.episodes?.map((episode) => {
              const progress = episode.hasFile ? 1 : 0;
              const fileSize = formatFileSize(episode.sizeInMB);

              return (
                <View key={episode.id ?? `${season.seasonNumber}-${episode.episodeNumber}`} style={{
                  flexDirection: 'row',
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  alignItems: 'center'
                }}>
                  <MediaPoster
                    uri={episode.posterUrl}
                    size={80}
                    borderRadius={8}
                    accessibilityLabel={`${formatEpisodeLabel(episode)} poster`}
                    showPlaceholderLabel
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600', marginBottom: 4 }}>
                      {formatEpisodeLabel(episode)}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {episode.hasFile ? 'Downloaded' : 'Missing'}
                      </Text>
                      {fileSize && (
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          {fileSize}
                        </Text>
                      )}
                    </View>
                    <ProgressBar
                      progress={progress}
                      style={{ height: 4, borderRadius: 2 }}
                      theme={{
                        colors: {
                          primary: episode.hasFile ? theme.colors.primary : theme.colors.surfaceVariant
                        }
                      }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </ScrollView>
  );
};

export default MediaDetails;

// Styles are defined inline using the theme object to avoid static theme references
