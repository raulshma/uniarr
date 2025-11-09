import React, { useCallback, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import {
  Chip,
  Text,
  useTheme,
  Card,
  TouchableRipple,
  Button,
  Switch,
} from "react-native-paper";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";

import type { AppTheme } from "@/constants/theme";
import type { Season } from "@/models/media.types";
import type { ServiceConfig } from "@/models/service.types";
import { MediaPoster } from "@/components/media/MediaPoster";
import { DownloadButton } from "@/components/downloads";
import type { MediaKind } from "@/components/media/MediaCard";
import {
  useSettingsStore,
  selectJellyfinLocalAddress,
  selectJellyfinPublicAddress,
} from "@/store/settingsStore";
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
  isUpdatingMonitor?: boolean;
  isSearching?: boolean;
  isDeleting?: boolean;
  isSearchingMissing?: boolean;
  isUnmonitoringAll?: boolean;
  isTogglingSeasonMonitor?: boolean;
  isTogglingEpisodeMonitor?: boolean;
  isSearchingMissingEpisode?: boolean;
  /** Service configuration for download functionality */
  serviceConfig?: ServiceConfig;
  /** Content ID for download functionality */
  contentId?: string;
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
  isUpdatingMonitor = false,
  isSearching = false,
  isDeleting = false,
  isSearchingMissing = false,
  isUnmonitoringAll = false,
  isTogglingSeasonMonitor = false,
  isTogglingEpisodeMonitor = false,
  isSearchingMissingEpisode = false,
  showPoster = true,
  contentInsetTop = 0,
  disableScroll = false,
  testID = "media-details",
  serviceConfig,
  contentId,
}) => {
  const theme = useTheme<AppTheme>();
  // episodesModalVisible removed — seasons use inline selectedSeason state instead
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

  const jellyfinLocalAddress = useSettingsStore(selectJellyfinLocalAddress);
  const jellyfinPublicAddress = useSettingsStore(selectJellyfinPublicAddress);

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

  const handleViewOnJellyfin = useCallback(async () => {
    // Determine which Jellyfin address to use (prefer public, fallback to local)
    const jellyfinAddress = jellyfinPublicAddress || jellyfinLocalAddress;

    if (!jellyfinAddress) {
      alert(
        "Jellyfin Not Configured",
        "Please configure your Jellyfin server address in settings to use this feature.",
      );
      return;
    }

    // Construct search URL using external IDs (IMDB preferred for broadest compatibility)
    let searchUrl: string;
    if (imdbId) {
      searchUrl = `${jellyfinAddress}/web/index.html#!/search.html?q=imdb:${imdbId}`;
    } else if (tmdbId) {
      searchUrl = `${jellyfinAddress}/web/index.html#!/search.html?q=tmdb:${tmdbId}`;
    } else if (tvdbId) {
      searchUrl = `${jellyfinAddress}/web/index.html#!/search.html?q=tvdb:${tvdbId}`;
    } else {
      alert(
        "No External IDs",
        "This media item doesn't have external IDs (IMDB, TMDB, TVDB) required for Jellyfin linking.",
      );
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(searchUrl);
      if (canOpen) {
        await Linking.openURL(searchUrl);
      } else {
        alert(
          "Cannot Open Link",
          "Unable to open Jellyfin link. Please check your Jellyfin server address in settings.",
        );
      }
    } catch (error) {
      alert(
        "Error Opening Jellyfin",
        `Failed to open Jellyfin: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }, [jellyfinLocalAddress, jellyfinPublicAddress, imdbId, tmdbId, tvdbId]);

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
          <MediaPoster
            uri={posterUri}
            size={280}
            borderRadius={16}
            accessibilityLabel={`${title} poster`}
            showPlaceholderLabel
          />
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
              style={{ flexDirection: "row", justifyContent: "space-between" }}
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

        {/* View on Jellyfin button - show if we have external IDs */}
        {(imdbId || tmdbId || tvdbId) && (
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
            View on Jellyfin
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
              (episode, index) => (
                <Animated.View
                  key={
                    episode.id ??
                    `${(selectedSeason || seasons?.[0])?.seasonNumber}-${
                      episode.episodeNumber
                    }`
                  }
                  entering={FadeIn.delay(index * 30).duration(300)}
                  style={{
                    width: "48%",
                    backgroundColor: theme.colors.elevation.level1,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: episode.hasFile
                      ? theme.colors.outlineVariant
                      : theme.colors.error,
                  }}
                >
                  <View style={{ alignItems: "center", marginBottom: 12 }}>
                    <MediaPoster
                      uri={episode.posterUrl}
                      size={80}
                      borderRadius={8}
                      accessibilityLabel={`Episode ${episode.episodeNumber} poster`}
                      showPlaceholderLabel
                    />
                  </View>

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
                      {episode.hasFile ? "Downloaded • 42m" : "Missing • 35m"}
                    </Text>
                  </View>

                  {episode.hasFile && episode.sizeInMB && (
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginBottom: 8,
                        textAlign: "center",
                        fontWeight: "500",
                      }}
                    >
                      {formatFileSizeFromMB(episode.sizeInMB)}
                    </Text>
                  )}

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
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {!episode.hasFile && onSearchMissingEpisodePress && (
                      <Button
                        mode="contained"
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
                        buttonColor={theme.colors.primary}
                        textColor={theme.colors.onPrimary}
                        style={{ flex: 1 }}
                        labelStyle={{ fontWeight: "600", fontSize: 11 }}
                      >
                        Search
                      </Button>
                    )}

                    {onToggleEpisodeMonitor && (
                      <Button
                        mode={episode.monitored ? "contained" : "outlined"}
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
                        buttonColor={
                          episode.monitored ? theme.colors.primary : undefined
                        }
                        textColor={
                          episode.monitored
                            ? theme.colors.onPrimary
                            : theme.colors.onSurfaceVariant
                        }
                        style={{ flex: 1 }}
                        labelStyle={{ fontWeight: "600", fontSize: 11 }}
                      >
                        {episode.monitored ? "Monitored" : "Unmonitored"}
                      </Button>
                    )}
                  </View>
                </Animated.View>
              ),
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
