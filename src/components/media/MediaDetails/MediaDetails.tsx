import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Chip, Text, useTheme, ProgressBar, Card } from 'react-native-paper';

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
  hasFile?: boolean;
  movieFile?: {
    size?: number;
    quality?: {
      quality?: {
        name?: string;
      };
    };
  };
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
  hasFile = false,
  movieFile,
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

  const handleMonitorPress = useCallback(() => {
    if (!onToggleMonitor) {
      return;
    }

    onToggleMonitor(!monitored);
  }, [monitored, onToggleMonitor]);

  const showSeasons = type === 'series' && seasons?.length;

  // Format file size for display
  const formatFileSize = (sizeInBytes?: number): string => {
    if (!sizeInBytes) return '';
    
    const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
    if (sizeInGB >= 1) {
      return `${sizeInGB.toFixed(1)} GB`;
    }
    
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return `${sizeInMB.toFixed(1)} MB`;
  };

  // Get quality from movie file or default
  const getQuality = (): string => {
    return movieFile?.quality?.quality?.name || 'Unknown';
  };

  // Get file size from movie file
  const getFileSize = (): string => {
    if (!movieFile?.size) return 'Unknown';
    return formatFileSize(movieFile.size);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      testID={testID}
    >
      {/* Movie Poster */}
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <MediaPoster
          uri={posterUri}
          size={280}
          borderRadius={16}
          accessibilityLabel={`${title} poster`}
          showPlaceholderLabel
        />
      </View>

      {/* Movie Title */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <Text variant="headlineLarge" style={{ 
          color: theme.colors.onSurface, 
          fontWeight: 'bold', 
          textAlign: 'center',
          marginBottom: 12 
        }}>
          {title}
        </Text>
      </View>

      {/* Synopsis */}
      {overview ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text variant="bodyLarge" style={{ 
            color: theme.colors.onSurfaceVariant, 
            lineHeight: 24,
            textAlign: 'center'
          }}>
            {overview}
          </Text>
        </View>
      ) : null}

      {/* Movie Details Card */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Card style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 12 }}>
          <Card.Content style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Release Year
              </Text>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {year || 'N/A'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Studio
              </Text>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {network || 'N/A'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                File Status
              </Text>
              <Chip
                mode="flat"
                style={{ 
                  backgroundColor: '#FFD700', // Golden color
                  borderRadius: 16
                }}
                textStyle={{ color: '#000000', fontWeight: '600' }}
              >
                {hasFile ? 'Owned' : 'Missing'}
              </Chip>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* File Information */}
      <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
        <Text variant="titleLarge" style={{ 
          color: theme.colors.onSurface, 
          fontWeight: 'bold', 
          marginBottom: 16 
        }}>
          File Information
        </Text>
        
        <Card style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 12 }}>
          <Card.Content style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Quality
              </Text>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {getQuality()}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Size
              </Text>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {getFileSize()}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Action Buttons */}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {onSearchPress ? (
            <Button
              mode="contained"
              onPress={onSearchPress}
              loading={isSearching}
              disabled={isSearching}
              style={{ 
                flex: 1,
                backgroundColor: '#B8860B', // Dark golden color
                borderRadius: 8
              }}
              labelStyle={{ color: '#FFFFFF', fontWeight: '600' }}
            >
              Search
            </Button>
          ) : null}
          
          <Button
            mode="contained"
            onPress={handleMonitorPress}
            loading={isUpdatingMonitor}
            disabled={isUpdatingMonitor}
            style={{ 
              flex: 1,
              backgroundColor: '#FFD700', // Golden color
              borderRadius: 8
            }}
            labelStyle={{ color: '#000000', fontWeight: '600' }}
          >
            Upgrade
          </Button>
        </View>
      </View>

      {/* Seasons - Only show for series */}
      {showSeasons ? (
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
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

      {/* Episodes - Only show for series */}
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

