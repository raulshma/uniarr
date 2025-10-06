import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Text, useTheme, Card, Surface, Portal, Dialog, TouchableRipple, Button } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { AppTheme } from '@/constants/theme';
import type { Season } from '@/models/media.types';
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
  const [episodesModalVisible, setEpisodesModalVisible] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

  const handleMonitorPress = useCallback(() => {
    if (!onToggleMonitor) {
      return;
    }

    onToggleMonitor(!monitored);
  }, [monitored, onToggleMonitor]);

  const handleSeasonPress = useCallback((season: Season) => {
    setSelectedSeason(season);
    setEpisodesModalVisible(true);
  }, []);

  const handleCloseEpisodesModal = useCallback(() => {
    setEpisodesModalVisible(false);
    setSelectedSeason(null);
  }, []);


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
              buttonColor="#B8860B"
              textColor="#FFFFFF"
              style={{
                flex: 1,
                borderRadius: 8,
              }}
              labelStyle={{ fontWeight: '600' }}
            >
              Search
            </Button>
          ) : null}

          <Button
            mode="contained"
            onPress={handleMonitorPress}
            loading={isUpdatingMonitor}
            disabled={isUpdatingMonitor}
            buttonColor="#FFD700"
            textColor="#000000"
            style={{
              flex: 1,
              borderRadius: 8,
            }}
            labelStyle={{ fontWeight: '600' }}
          >
            Upgrade
          </Button>
        </View>
      </View>

      {/* Seasons - Only show for series */}
      {showSeasons ? (
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text variant="titleLarge" style={{
            color: theme.colors.onSurface,
            marginBottom: 16,
            fontWeight: 'bold'
          }}>
            Seasons
          </Text>
          <View style={{ gap: 12 }}>
            {seasons?.map((season) => {
              const totalEpisodes = season.statistics?.episodeCount ?? season.episodes?.length ?? 0;
              const downloadedEpisodes = season.statistics?.episodeFileCount ??
                (season.episodes ? season.episodes.filter((episode) => episode.hasFile).length : 0);
              const progress = totalEpisodes > 0 ? downloadedEpisodes / totalEpisodes : 0;

              return (
                <Animated.View
                  key={season.id ?? season.seasonNumber}
                  entering={FadeIn.delay(100).duration(300)}
                  style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  <TouchableRipple
                    onPress={() => handleSeasonPress(season)}
                    style={{
                      backgroundColor: theme.colors.surfaceVariant,
                      padding: 16,
                    }}
                    borderless={false}
                  >
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                      <MediaPoster
                        uri={season.posterUrl}
                        size={80}
                        borderRadius={12}
                        accessibilityLabel={`Season ${season.seasonNumber} poster`}
                        showPlaceholderLabel
                        style={{ marginRight: 16 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={{
                          color: theme.colors.onSurface,
                          fontWeight: '600',
                          marginBottom: 4
                        }}>
                          Season {season.seasonNumber}
                        </Text>
                        <Text variant="bodyMedium" style={{
                          color: theme.colors.onSurfaceVariant,
                          marginBottom: 8
                        }}>
                          {totalEpisodes} Episodes
                        </Text>
                        <View style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.colors.surface,
                          overflow: 'hidden'
                        }}>
                          <View style={{
                            height: '100%',
                            width: `${Math.round(progress * 100)}%`,
                            backgroundColor: progress === 1 ? theme.colors.primary : theme.colors.primaryContainer,
                            borderRadius: 3,
                          }} />
                        </View>
                        <Text variant="bodySmall" style={{
                          color: theme.colors.onSurfaceVariant,
                          marginTop: 4,
                          fontWeight: '500'
                        }}>
                          {downloadedEpisodes} / {totalEpisodes} episodes
                        </Text>
                      </View>
                    </View>
                  </TouchableRipple>
                </Animated.View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Episodes Modal */}
      <Portal>
        <Dialog
          visible={episodesModalVisible}
          onDismiss={handleCloseEpisodesModal}
          style={{
            borderRadius: 16,
            backgroundColor: theme.colors.elevation.level1,
            maxHeight: '80%',
          }}
        >
          <Dialog.Title style={{
            color: theme.colors.onSurface,
            fontWeight: '600',
          }}>
            {selectedSeason ? `Season ${selectedSeason.seasonNumber} Episodes` : 'Episodes'}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: '70%' }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {selectedSeason?.episodes && selectedSeason.episodes.length > 0 ? (
                selectedSeason.episodes.map((episode, index) => (
                  <View
                    key={episode.id ?? `${selectedSeason.seasonNumber}-${episode.episodeNumber}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: episode.hasFile ? theme.colors.surfaceVariant : theme.colors.surface,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: episode.hasFile ? theme.colors.outlineVariant : theme.colors.error,
                    }}
                  >
                    <View style={{
                      width: 60,
                      height: 60,
                      borderRadius: 8,
                      backgroundColor: episode.hasFile ? theme.colors.primaryContainer : theme.colors.errorContainer,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <MediaPoster
                        uri={episode.posterUrl}
                        size={56}
                        borderRadius={6}
                        accessibilityLabel={`Episode ${episode.episodeNumber} poster`}
                        showPlaceholderLabel
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={{
                        color: theme.colors.onSurface,
                        fontWeight: '600',
                        marginBottom: 4,
                      }}>
                        Episode {episode.episodeNumber}: {episode.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          backgroundColor: episode.hasFile ? theme.colors.primary : theme.colors.error,
                          borderRadius: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          marginRight: 8,
                        }}>
                          <Text variant="labelSmall" style={{
                            color: episode.hasFile ? theme.colors.onPrimary : theme.colors.onError,
                            fontWeight: '600',
                          }}>
                            {episode.hasFile ? '✓ DOWNLOADED' : '⚠ MISSING'}
                          </Text>
                        </View>
                        {episode.sizeInMB && (
                          <Text variant="bodySmall" style={{
                            color: theme.colors.onSurfaceVariant,
                            fontWeight: '500',
                          }}>
                            {formatFileSize(episode.sizeInMB)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 12,
                  padding: 20,
                  alignItems: 'center',
                }}>
                  <Text variant="bodyMedium" style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: 'center',
                  }}>
                    No episodes available for this season
                  </Text>
                </View>
              )}
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={handleCloseEpisodesModal}
              textColor={theme.colors.onSurfaceVariant}
            >
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

    </ScrollView>
  );
};

export default MediaDetails;

// Styles are defined inline using the theme object to avoid static theme references

