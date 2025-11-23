import React, { useCallback, useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import {
  Chip,
  Text,
  useTheme,
  Card,
  TouchableRipple,
  Button,
  Switch,
  Snackbar,
  IconButton,
  Tooltip,
} from "react-native-paper";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";

import type { AppTheme } from "@/constants/theme";
import type { Season } from "@/models/media.types";
import type { ServiceConfig } from "@/models/service.types";
import { MediaPoster } from "@/components/media/MediaPoster";
import { DownloadButton } from "@/components/downloads";
import type { MediaKind } from "@/components/media/MediaCard";
import { alert } from "@/services/dialogService";

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
  // External IDs for Jellyfin deep linking
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;
  onToggleMonitor?: (nextState: boolean) => void;
  onSearchPress?: () => void;
  onDeletePress?: () => void;
  onToggleSeasonMonitor?: (seasonNumber: number, nextState: boolean) => void;
  onSearchMissingPress?: () => void;
  onUnmonitorAllPress?: () => void;
  onToggleEpisodeMonitor?: (
    seasonNumber: number,
    episodeNumber: number,
    nextState: boolean,
  ) => void;
  onSearchMissingEpisodePress?: (
    seasonNumber: number,
    episodeNumber: number,
  ) => void;
  onRemoveAndSearchEpisodePress?: (
    episodeFileId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) => void;
  isUpdatingMonitor?: boolean;
  isSearching?: boolean;
  isDeleting?: boolean;
  isSearchingMissing?: boolean;
  isUnmonitoringAll?: boolean;
  isTogglingSeasonMonitor?: boolean;
  isTogglingEpisodeMonitor?: boolean;
  isRemovingAndSearching?: boolean;
  isRemovingAndSearchingEpisodeFileId?: number | null;
  isSearchingMissingEpisode?: boolean;
  /** Service configuration for download functionality */
  serviceConfig?: ServiceConfig;
  /** Content ID for download functionality */
  contentId?: string;
  /** Total size of all episode files on disk in MB (for series) */
  totalSizeOnDiskMB?: number;
  /**
   * When rendered inside a page-level hero (DetailHero) the poster and
   * scroll container are provided by the hero. Set showPoster=false to
   * avoid rendering the internal poster.
   */
  showPoster?: boolean;
  /**
   * When rendered inside an outer scroll container, the parent can reserve
   * top space for pinned posters by passing contentInsetTop.
   */
  contentInsetTop?: number;
  /**
   * When true, render non-scrollable content (suitable for being a child
   * of a scroll container provided by a wrapper like DetailHero).
   */
  disableScroll?: boolean;
  testID?: string;
  /** Callback when an episode is long-pressed */
  onEpisodeLongPress?: (episodeId: string, episode: any) => void;
  /** Callback when an episode poster is pressed */
  onEpisodePosterPress?: (episode: any) => void;
  /** Callback when the main poster is pressed (for movies/series) */
  onPosterPress?: () => void;
};

// Removed top-level MB-based formatter (duplicate). Per-file helpers are defined below where needed.

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
  tmdbId,
  tvdbId,
  imdbId,
  onToggleMonitor,
  onSearchPress,
  onDeletePress,
  onToggleSeasonMonitor,
  onSearchMissingPress,
  onUnmonitorAllPress,
  onToggleEpisodeMonitor,
  onSearchMissingEpisodePress,
  onRemoveAndSearchEpisodePress,
  isUpdatingMonitor = false,
  isSearching = false,
  isDeleting = false,
  isSearchingMissing = false,
  isUnmonitoringAll = false,
  isTogglingSeasonMonitor = false,
  isTogglingEpisodeMonitor = false,
  isSearchingMissingEpisode = false,
  isRemovingAndSearching = false,
  isRemovingAndSearchingEpisodeFileId = null,
  showPoster = true,
  contentInsetTop = 0,
  disableScroll = false,
  testID = "media-details",
  serviceConfig,
  contentId,
  totalSizeOnDiskMB,
  onEpisodeLongPress,
  onEpisodePosterPress,
  onPosterPress,
}) => {
  const theme = useTheme<AppTheme>();
  // episodesModalVisible removed — seasons use inline selectedSeason state instead
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarOnRetry] = useState<(() => void) | null>(null);

  const handleMonitorPress = useCallback(() => {
    if (!onToggleMonitor) {
      return;
    }

    onToggleMonitor(!monitored);
  }, [monitored, onToggleMonitor]);

  const handleSeasonPress = useCallback((season: Season) => {
    setSelectedSeason(season);
  }, []);

  const handleBackToSeasons = useCallback(() => {
    setSelectedSeason(null);
  }, []);

  const handleSeasonMonitorToggle = useCallback(
    (seasonNumber: number, nextState: boolean) => {
      if (onToggleSeasonMonitor) {
        onToggleSeasonMonitor(seasonNumber, nextState);
      }
    },
    [onToggleSeasonMonitor],
  );

  const handleViewOnJellyfin = useCallback(() => {
    // Trigger the onPosterPress callback if provided (for movies/series)
    // This will handle the Jellyfin search and navigation
    if (onPosterPress) {
      onPosterPress();
    } else {
      alert(
        "Not Available",
        "Jellyfin navigation is not available for this item.",
      );
    }
  }, [onPosterPress]);

  const handleRemoveAndSearchEpisode = useCallback(
    (episodeFileId: number, seasonNumber: number, episodeNumber: number) => {
      alert(
        "Remove & Search Episode",
        "This will delete the downloaded episode file and start searching for a replacement. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove & Search",
            style: "destructive",
            onPress: () => {
              if (onRemoveAndSearchEpisodePress) {
                try {
                  onRemoveAndSearchEpisodePress(
                    episodeFileId,
                    seasonNumber,
                    episodeNumber,
                  );
                } catch (error) {
                  console.error("Failed to remove and search episode:", error);
                  setSnackbarMessage("Failed to remove and search episode");
                  setSnackbarVisible(true);
                }
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [onRemoveAndSearchEpisodePress],
  );

  const showSeasons = type === "series" && seasons?.length;
  const showEpisodes = showSeasons && (selectedSeason || seasons?.length === 1);

  // Helper: format bytes into a human-readable string
  const formatFileSizeBytes = (sizeInBytes?: number): string => {
    if (!sizeInBytes) return "";

    const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
    if (sizeInGB >= 1) {
      return `${sizeInGB.toFixed(1)} GB`;
    }

    const sizeInMB = sizeInBytes / (1024 * 1024);
    return `${sizeInMB.toFixed(1)} MB`;
  };

  // Some data sources provide episode sizes in MB; format those as well
  const formatFileSizeFromMB = (sizeInMB?: number): string => {
    if (!sizeInMB) return "";
    if (sizeInMB >= 1024) {
      return `${(sizeInMB / 1024).toFixed(1)} GB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  };

  // Get quality from movie file or default
  const getQuality = (): string => {
    return movieFile?.quality?.quality?.name || "Unknown";
  };

  // Get file size from movie file (movieFile.size is bytes)
  const getFileSize = (): string => {
    if (!movieFile?.size) return "Unknown";
    return formatFileSizeBytes(movieFile.size);
  };

  const content = (
    <>
      {/* Movie Poster */}
      {showPoster ? (
        <Animated.View
          entering={ZoomIn.duration(400).springify()}
          style={{ alignItems: "center", paddingVertical: 20 }}
        >
          <Pressable onPress={onPosterPress}>
            <MediaPoster
              uri={posterUri}
              size={280}
              borderRadius={16}
              accessibilityLabel={`${title} poster`}
              showPlaceholderLabel
            />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Movie Title */}
      <Animated.View
        entering={FadeInUp.duration(300).delay(100)}
        style={{ paddingHorizontal: 20, marginBottom: 16 }}
      >
        <Text
          variant="headlineLarge"
          style={{
            color: theme.colors.onSurface,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {title}
        </Text>
      </Animated.View>

      {/* Synopsis */}
      {overview ? (
        <Animated.View
          entering={FadeInUp.duration(300).delay(200)}
          style={{ paddingHorizontal: 20, marginBottom: 24 }}
        >
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.onSurfaceVariant,
              lineHeight: 24,
              textAlign: "center",
            }}
          >
            {overview}
          </Text>
        </Animated.View>
      ) : null}

      {/* Movie Details Card */}
      <Animated.View
        entering={FadeInUp.duration(300).delay(300)}
        style={{ paddingHorizontal: 20, marginBottom: 20 }}
      >
        <Card
          style={{
            backgroundColor: theme.colors.elevation.level1,
            borderRadius: 12,
          }}
        >
          <Card.Content style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Release Year
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, fontWeight: "600" }}
              >
                {year || "N/A"}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Studio
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, fontWeight: "600" }}
              >
                {network || "N/A"}
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                File Status
              </Text>
              <Chip
                mode="flat"
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 16,
                }}
                textStyle={{ color: theme.colors.onPrimary, fontWeight: "600" }}
              >
                {hasFile ? "Owned" : "Missing"}
              </Chip>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>

      {/* File Information */}
      <Animated.View
        entering={FadeInUp.duration(300).delay(400)}
        style={{ paddingHorizontal: 20, marginBottom: 32 }}
      >
        <Text
          variant="titleLarge"
          style={{
            color: theme.colors.onSurface,
            fontWeight: "bold",
            marginBottom: 16,
          }}
        >
          File Information
        </Text>

        <Card
          style={{
            backgroundColor: theme.colors.elevation.level1,
            borderRadius: 12,
          }}
        >
          <Card.Content style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Quality
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, fontWeight: "600" }}
              >
                {getQuality()}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Size
              </Text>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, fontWeight: "600" }}
              >
                {getFileSize()}
              </Text>
            </View>

            {totalSizeOnDiskMB !== undefined &&
              totalSizeOnDiskMB > 0 &&
              type === "series" && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Total Series Size
                  </Text>
                  <Text
                    variant="bodyLarge"
                    style={{ color: theme.colors.onSurface, fontWeight: "600" }}
                  >
                    {formatFileSizeFromMB(totalSizeOnDiskMB)}
                  </Text>
                </View>
              )}
          </Card.Content>
        </Card>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View
        entering={FadeInUp.duration(300).delay(500)}
        style={{ paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          {onSearchPress ? (
            <Button
              mode="contained"
              onPress={onSearchPress}
              loading={isSearching}
              disabled={isSearching}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              style={{
                flex: 1,
                borderRadius: 8,
              }}
              labelStyle={{ fontWeight: "600" }}
            >
              Search
            </Button>
          ) : null}

          <Button
            mode="contained"
            onPress={handleMonitorPress}
            loading={isUpdatingMonitor}
            disabled={isUpdatingMonitor}
            buttonColor={theme.colors.primary}
            textColor={theme.colors.onPrimary}
            style={{
              flex: 1,
              borderRadius: 8,
            }}
            labelStyle={{ fontWeight: "600" }}
          >
            {monitored ? "Unmonitor" : "Monitor"}
          </Button>
        </View>

        {/* Play on Jellyfin button - show if we have external IDs and onPosterPress handler */}
        {(imdbId || tmdbId || tvdbId) && onPosterPress && (
          <Button
            mode="outlined"
            onPress={handleViewOnJellyfin}
            icon="play-circle-outline"
            textColor={theme.colors.primary}
            style={{
              borderRadius: 8,
              borderColor: theme.colors.primary,
            }}
            labelStyle={{ fontWeight: "600" }}
          >
            Play on Jellyfin
          </Button>
        )}
      </Animated.View>

      {/* Seasons - Only show for series */}
      {showSeasons ? (
        <Animated.View
          entering={FadeInUp.duration(300).delay(600)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <Text
            variant="titleLarge"
            style={{
              color: theme.colors.onSurface,
              marginBottom: 16,
              fontWeight: "bold",
            }}
          >
            Seasons
          </Text>
          <View style={{ gap: 12 }}>
            {seasons?.map((season, seasonIndex) => {
              const totalEpisodes =
                season.statistics?.episodeCount ?? season.episodes?.length ?? 0;
              const downloadedEpisodes =
                season.statistics?.episodeFileCount ??
                (season.episodes
                  ? season.episodes.filter((episode) => episode.hasFile).length
                  : 0);

              return (
                <Animated.View
                  key={season.id ?? season.seasonNumber}
                  entering={FadeIn.delay(seasonIndex * 50 + 100).duration(300)}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: theme.colors.elevation.level1,
                    shadowColor: theme.colors.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  <TouchableRipple
                    onPress={() => handleSeasonPress(season)}
                    style={{
                      padding: 16,
                    }}
                    borderless={false}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <MediaPoster
                        uri={season.posterUrl}
                        size={80}
                        borderRadius={12}
                        accessibilityLabel={`Season ${season.seasonNumber} poster`}
                        showPlaceholderLabel
                        style={{ marginRight: 16 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="titleMedium"
                          style={{
                            color: theme.colors.onSurface,
                            fontWeight: "600",
                            marginBottom: 4,
                          }}
                        >
                          Season {season.seasonNumber}
                        </Text>
                        <Text
                          variant="bodyMedium"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {totalEpisodes} Episodes • {downloadedEpisodes}{" "}
                          Downloaded
                        </Text>
                      </View>
                      <Switch
                        value={season.monitored ?? true}
                        onValueChange={(value) => {
                          handleSeasonMonitorToggle(season.seasonNumber, value);
                        }}
                        color={theme.colors.primary}
                        trackColor={{
                          false: theme.colors.surfaceVariant,
                          true: theme.colors.primaryContainer,
                        }}
                        disabled={isUpdatingMonitor || isTogglingSeasonMonitor}
                      />
                    </View>
                  </TouchableRipple>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      ) : null}

      {/* Episodes Section */}
      {showEpisodes ? (
        <Animated.View
          entering={FadeIn.duration(300).delay(700)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            {seasons && seasons.length > 1 && selectedSeason && (
              <Button
                mode="text"
                onPress={handleBackToSeasons}
                style={{ marginRight: 8 }}
                labelStyle={{ fontSize: 12 }}
              >
                ← Seasons
              </Button>
            )}
            <Text
              variant="titleLarge"
              style={{
                color: theme.colors.onSurface,
                fontWeight: "bold",
                flex: 1,
              }}
            >
              {selectedSeason
                ? `Season ${selectedSeason.seasonNumber} Episodes`
                : "Episodes"}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {(selectedSeason || seasons?.[0])?.episodes?.map(
              (episode, index) => {
                const episodeKey =
                  episode.id?.toString() ??
                  `${(selectedSeason || seasons?.[0])?.seasonNumber}-${
                    episode.episodeNumber
                  }`;

                const handleEpisodeLongPress = () => {
                  if (onEpisodeLongPress) {
                    onEpisodeLongPress(episodeKey, episode);
                  }
                };

                return (
                  <Animated.View
                    key={episodeKey}
                    entering={FadeIn.delay(index * 30).duration(300)}
                    style={{
                      width: "48%",
                    }}
                  >
                    <Pressable
                      onLongPress={handleEpisodeLongPress}
                      style={{
                        backgroundColor: theme.colors.elevation.level1,
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: episode.hasFile
                          ? theme.colors.outlineVariant
                          : theme.colors.error,
                      }}
                    >
                      <Pressable
                        onPress={() => onEpisodePosterPress?.(episode)}
                        style={{ alignItems: "center", marginBottom: 12 }}
                      >
                        <MediaPoster
                          uri={episode.posterUrl}
                          size={80}
                          borderRadius={8}
                          accessibilityLabel={`Episode ${episode.episodeNumber} poster`}
                          showPlaceholderLabel
                        />
                      </Pressable>

                      <Text
                        variant="bodyMedium"
                        numberOfLines={2}
                        style={{
                          color: theme.colors.onSurface,
                          fontWeight: "600",
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        E{episode.episodeNumber}: {episode.title}
                      </Text>

                      <View
                        style={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: episode.hasFile
                            ? theme.colors.primary
                            : theme.colors.error,
                          marginBottom: 8,
                        }}
                      />

                      <View
                        style={{
                          backgroundColor: episode.hasFile
                            ? theme.colors.primaryContainer
                            : theme.colors.errorContainer,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          variant="labelSmall"
                          style={{
                            color: episode.hasFile
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onErrorContainer,
                            fontWeight: "600",
                          }}
                        >
                          {episode.hasFile
                            ? "Downloaded • 42m"
                            : "Missing • 35m"}
                        </Text>
                      </View>

                      {!episode.hasFile && serviceConfig && contentId && (
                        <DownloadButton
                          serviceConfig={serviceConfig}
                          contentId={contentId}
                          size="small"
                          variant="icon"
                          style={{ alignSelf: "center", marginBottom: 8 }}
                        />
                      )}

                      {/* Episode Action Buttons */}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 4,
                          marginTop: 8,
                          justifyContent: "center",
                        }}
                      >
                        {episode.hasFile &&
                          episode.episodeFileId &&
                          onRemoveAndSearchEpisodePress && (
                            <Tooltip title="Remove & Search">
                              <IconButton
                                icon="delete-restore"
                                size={18}
                                loading={
                                  isRemovingAndSearchingEpisodeFileId ===
                                  episode.episodeFileId
                                }
                                disabled={
                                  isRemovingAndSearching ||
                                  !!(
                                    isRemovingAndSearchingEpisodeFileId &&
                                    isRemovingAndSearchingEpisodeFileId !==
                                      episode.episodeFileId
                                  )
                                }
                                onPress={() =>
                                  handleRemoveAndSearchEpisode(
                                    episode.episodeFileId!,
                                    selectedSeason?.seasonNumber ??
                                      seasons?.[0]?.seasonNumber ??
                                      0,
                                    episode.episodeNumber,
                                  )
                                }
                                iconColor={theme.colors.error}
                                style={{
                                  backgroundColor: `${theme.colors.errorContainer}`,
                                }}
                              />
                            </Tooltip>
                          )}

                        {!episode.hasFile && onSearchMissingEpisodePress && (
                          <Tooltip title="Search">
                            <IconButton
                              icon="magnify"
                              size={18}
                              loading={isSearchingMissingEpisode}
                              disabled={isSearchingMissingEpisode}
                              onPress={() =>
                                onSearchMissingEpisodePress(
                                  selectedSeason?.seasonNumber ??
                                    seasons?.[0]?.seasonNumber ??
                                    0,
                                  episode.episodeNumber,
                                )
                              }
                              iconColor={theme.colors.primary}
                              style={{
                                backgroundColor: theme.colors.primaryContainer,
                              }}
                            />
                          </Tooltip>
                        )}

                        {onToggleEpisodeMonitor && (
                          <Tooltip
                            title={
                              episode.monitored
                                ? "Unmonitor Episode"
                                : "Monitor Episode"
                            }
                          >
                            <IconButton
                              icon={episode.monitored ? "eye" : "eye-off"}
                              size={18}
                              loading={isTogglingEpisodeMonitor}
                              disabled={isTogglingEpisodeMonitor}
                              onPress={() =>
                                onToggleEpisodeMonitor(
                                  selectedSeason?.seasonNumber ??
                                    seasons?.[0]?.seasonNumber ??
                                    0,
                                  episode.episodeNumber,
                                  !episode.monitored,
                                )
                              }
                              iconColor={
                                episode.monitored
                                  ? theme.colors.primary
                                  : theme.colors.onSurfaceVariant
                              }
                              style={{
                                backgroundColor: episode.monitored
                                  ? theme.colors.primaryContainer
                                  : theme.colors.surfaceVariant,
                              }}
                            />
                          </Tooltip>
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              },
            ) || (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={{
                  width: "100%",
                  backgroundColor: theme.colors.elevation.level1,
                  borderRadius: 12,
                  padding: 20,
                  alignItems: "center",
                }}
              >
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                  }}
                >
                  No episodes available for this season
                </Text>
              </Animated.View>
            )}
          </View>

          {/* Action Buttons for Episodes */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              mode="contained"
              onPress={onSearchMissingPress}
              loading={isSearchingMissing}
              disabled={isSearchingMissing}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              style={{
                flex: 1,
                borderRadius: 8,
              }}
              labelStyle={{ fontWeight: "600" }}
            >
              Search Missing
            </Button>

            <Button
              mode="outlined"
              onPress={onUnmonitorAllPress}
              loading={isUnmonitoringAll}
              disabled={isUnmonitoringAll}
              textColor={theme.colors.onSurfaceVariant}
              style={{ flex: 1, borderRadius: 8 }}
              labelStyle={{ fontWeight: "600" }}
            >
              Unmonitor All
            </Button>
          </View>
        </Animated.View>
      ) : null}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={
          snackbarOnRetry
            ? {
                label: "Retry",
                onPress: () => {
                  snackbarOnRetry();
                  setSnackbarVisible(false);
                },
              }
            : undefined
        }
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );

  if (disableScroll) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: contentInsetTop,
        }}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32, paddingTop: contentInsetTop }}
      testID={testID}
    >
      {content}
    </ScrollView>
  );
};

export default MediaDetails;

// Styles are defined inline using the theme object to avoid static theme references
