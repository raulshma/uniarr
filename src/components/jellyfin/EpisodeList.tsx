import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, Chip, Surface, IconButton } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import type { AppTheme } from "@/constants/theme";
import type { JellyfinItem } from "@/models/jellyfin.types";
import { spacing } from "@/theme/spacing";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";

interface EpisodeListProps {
  episodes: JellyfinItem[];
  connector: JellyfinConnector;
  onEpisodePress: (episode: JellyfinItem) => void;
  onEpisodePlay: (episode: JellyfinItem) => void;
}

const formatRuntime = (ticks?: number): string => {
  if (!ticks || ticks <= 0) return "";
  const minutes = Math.round(ticks / 600_000_000);
  return `${minutes}m`;
};

const EpisodeCard: React.FC<{
  episode: JellyfinItem;
  connector: JellyfinConnector;
  onPress: () => void;
  onPlay: () => void;
  theme: AppTheme;
}> = ({ episode, connector, onPress, onPlay, theme }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  const thumbnailUri = episode.Id
    ? connector.getImageUrl(episode.Id, "Primary", {
        tag: episode.ImageTags?.Primary ?? undefined,
        width: 400,
      })
    : undefined;

  const episodeNumber = episode.IndexNumber ?? 0;
  const seasonNumber = episode.ParentIndexNumber ?? 0;
  const runtime = formatRuntime(episode.RunTimeTicks ?? undefined);
  const hasWatched = episode.UserData?.Played ?? false;

  // Calculate playback progress - Jellyfin may not always return PlayedPercentage
  const playbackProgress = (() => {
    // Use PlayedPercentage if available
    if (episode.UserData?.PlayedPercentage != null) {
      return episode.UserData.PlayedPercentage;
    }

    // Otherwise calculate from PlaybackPositionTicks and RunTimeTicks
    const positionTicks = episode.UserData?.PlaybackPositionTicks ?? 0;
    const runtimeTicks = episode.RunTimeTicks ?? 0;

    if (runtimeTicks > 0 && positionTicks > 0) {
      return (positionTicks / runtimeTicks) * 100;
    }

    return 0;
  })();

  // Show progress bar if there's any progress and not fully watched
  const showProgressBar =
    playbackProgress > 0 && playbackProgress < 100 && !hasWatched;

  return (
    <Pressable onPress={onPress}>
      <Surface style={styles.episodeCard} elevation={1}>
        <View style={styles.episodeContent}>
          {/* Thumbnail */}
          <View style={styles.thumbnailContainer}>
            {thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={styles.thumbnail}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Text variant="titleLarge" style={styles.episodeNumberLarge}>
                  {episodeNumber}
                </Text>
              </View>
            )}
            {/* Progress bar - only show if in progress and not fully watched */}
            {showProgressBar && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${playbackProgress}%` },
                    ]}
                  />
                </View>
              </View>
            )}
            {/* Watched indicator - show when fully watched */}
            {hasWatched && (
              <View style={styles.watchedBadge}>
                <Text style={styles.watchedText}>✓</Text>
              </View>
            )}
            {/* Progress percentage text - show when in progress */}
            {showProgressBar && (
              <View style={styles.progressPercentBadge}>
                <Text style={styles.progressPercentText}>
                  {Math.round(playbackProgress)}%
                </Text>
              </View>
            )}
          </View>

          {/* Episode info */}
          <View style={styles.episodeInfo}>
            <View style={styles.episodeHeader}>
              <Text variant="titleSmall" style={styles.episodeTitle}>
                {episodeNumber}. {episode.Name || "Untitled"}
              </Text>
              {runtime && (
                <Chip compact style={styles.runtimeChip}>
                  {runtime}
                </Chip>
              )}
            </View>
            {episode.Overview && (
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={styles.episodeOverview}
              >
                {episode.Overview}
              </Text>
            )}
            <View style={styles.episodeFooter}>
              <Text variant="bodySmall" style={styles.seasonEpisode}>
                S{seasonNumber.toString().padStart(2, "0")}E
                {episodeNumber.toString().padStart(2, "0")}
              </Text>
              <IconButton
                icon="play-circle"
                size={28}
                onPress={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
                style={styles.playButton}
                iconColor={theme.colors.primary}
              />
            </View>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
};

export const EpisodeList: React.FC<EpisodeListProps> = ({
  episodes,
  connector,
  onEpisodePress,
  onEpisodePlay,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped = new Map<number, JellyfinItem[]>();
    episodes.forEach((episode) => {
      const season = episode.ParentIndexNumber ?? 0;
      if (!grouped.has(season)) {
        grouped.set(season, []);
      }
      grouped.get(season)!.push(episode);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [episodes]);

  if (episodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="bodyMedium" style={styles.emptyText}>
          No episodes available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {episodesBySeason.map(([seasonNumber, seasonEpisodes]) => (
        <View key={seasonNumber} style={styles.seasonSection}>
          <Text variant="titleMedium" style={styles.seasonTitle}>
            Season {seasonNumber}
          </Text>
          <FlashList
            data={seasonEpisodes}
            keyExtractor={(item: JellyfinItem) => item.Id || ""}
            renderItem={({ item }: { item: JellyfinItem }) => (
              <EpisodeCard
                episode={item}
                connector={connector}
                onPress={() => onEpisodePress(item)}
                onPlay={() => onEpisodePlay(item)}
                theme={theme}
              />
            )}
            estimatedItemSize={120}
            scrollEnabled={false}
          />
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      gap: spacing.lg,
    },
    seasonSection: {
      gap: spacing.md,
    },
    seasonTitle: {
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    episodeCard: {
      marginBottom: spacing.sm,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
    },
    episodeContent: {
      flexDirection: "row",
      padding: spacing.sm,
      gap: spacing.md,
    },
    thumbnailContainer: {
      position: "relative",
      width: 160,
      height: 90,
      borderRadius: 8,
      overflow: "hidden",
    },
    thumbnail: {
      width: "100%",
      height: "100%",
      borderRadius: 8,
    },
    thumbnailPlaceholder: {
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
    },
    episodeNumberLarge: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "700",
    },
    progressBarContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    progressBar: {
      height: "100%",
      width: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: 0,
    },
    watchedBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    watchedText: {
      color: theme.colors.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    progressPercentBadge: {
      position: "absolute",
      top: 6,
      left: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
    progressPercentText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    episodeInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    episodeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.xs,
    },
    episodeTitle: {
      flex: 1,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    runtimeChip: {
      height: 24,
    },
    episodeOverview: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
    },
    seasonEpisode: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "500",
    },
    episodeFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "auto",
    },
    playButton: {
      margin: 0,
    },
    emptyContainer: {
      padding: spacing.lg,
      alignItems: "center",
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
    },
  });
