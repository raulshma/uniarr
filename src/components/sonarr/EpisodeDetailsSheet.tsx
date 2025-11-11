import React, { useCallback } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { Text, useTheme, IconButton, Tooltip } from "react-native-paper";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { AppTheme } from "@/constants/theme";
import type { Episode } from "@/models/media.types";
import type { ServiceConfig } from "@/models/service.types";
import { DownloadButton } from "@/components/downloads";
import { spacing } from "@/theme/spacing";

interface EpisodeDetailsSheetProps {
  episode: Episode;
  seasonNumber: number;
  seriesTitle: string;
  serviceConfig?: ServiceConfig;
  contentId?: string;
  onRemoveAndSearchPress?: (
    episodeFileId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) => void;
  onSearchMissingPress?: (seasonNumber: number, episodeNumber: number) => void;
  onToggleMonitorPress?: (
    seasonNumber: number,
    episodeNumber: number,
    nextState: boolean,
  ) => void;
  isRemovingAndSearching?: boolean;
  isSearchingMissing?: boolean;
  isTogglingMonitor?: boolean;
  onClose?: () => void;
}

const EpisodeDetailsSheet: React.FC<EpisodeDetailsSheetProps> = ({
  episode,
  seasonNumber,
  seriesTitle,
  serviceConfig,
  contentId,
  onRemoveAndSearchPress,
  onSearchMissingPress,
  onToggleMonitorPress,
  isRemovingAndSearching = false,
  isSearchingMissing = false,
  isTogglingMonitor = false,
  onClose,
}) => {
  const theme = useTheme<AppTheme>();

  const handleRemoveAndSearch = useCallback(() => {
    if (
      onRemoveAndSearchPress &&
      episode.episodeFileId &&
      !isRemovingAndSearching
    ) {
      onRemoveAndSearchPress(
        episode.episodeFileId,
        seasonNumber,
        episode.episodeNumber,
      );
    }
  }, [
    onRemoveAndSearchPress,
    episode.episodeFileId,
    seasonNumber,
    episode.episodeNumber,
    isRemovingAndSearching,
  ]);

  const handleSearchMissing = useCallback(() => {
    if (onSearchMissingPress && !isSearchingMissing) {
      onSearchMissingPress(seasonNumber, episode.episodeNumber);
    }
  }, [
    onSearchMissingPress,
    seasonNumber,
    episode.episodeNumber,
    isSearchingMissing,
  ]);

  const handleToggleMonitor = useCallback(() => {
    if (onToggleMonitorPress && !isTogglingMonitor) {
      onToggleMonitorPress(
        seasonNumber,
        episode.episodeNumber,
        !episode.monitored,
      );
    }
  }, [
    onToggleMonitorPress,
    seasonNumber,
    episode.episodeNumber,
    episode.monitored,
    isTogglingMonitor,
  ]);

  const formatFileSizeFromMB = (sizeInMB?: number): string => {
    if (!sizeInMB) return "";
    if (sizeInMB >= 1024) {
      return `${(sizeInMB / 1024).toFixed(1)} GB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    header: {
      marginBottom: spacing.lg,
      alignItems: "center",
    },
    headerTitle: {
      color: theme.colors.onBackground,
      fontWeight: "600",
      marginBottom: spacing.sm,
    },
    headerSubtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.outlineVariant,
      marginVertical: spacing.lg,
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      marginBottom: spacing.md,
      marginTop: spacing.lg,
    },
    detailCard: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    detailRow: {
      marginBottom: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    detailLabel: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "600",
      flex: 1,
      marginRight: spacing.md,
    },
    detailValue: {
      color: theme.colors.onSurface,
      fontWeight: "500",
      flex: 1,
      textAlign: "right",
    },
    actionButtons: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.md,
      marginTop: spacing.xl,
      flexWrap: "wrap",
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp.duration(300)} style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          S{seasonNumber.toString().padStart(2, "0")}E
          {episode.episodeNumber.toString().padStart(2, "0")} – {episode.title}
        </Text>
        <Text variant="bodySmall" style={styles.headerSubtitle}>
          {seriesTitle}
        </Text>
      </Animated.View>

      <View style={styles.divider} />

      {/* Episode Info */}
      <Animated.View
        entering={FadeInUp.duration(300).delay(100)}
        style={styles.detailCard}
      >
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Episode Information
        </Text>

        <View style={styles.detailRow}>
          <Text variant="bodyMedium" style={styles.detailLabel}>
            Status
          </Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {episode.hasFile ? "Downloaded" : "Missing"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text variant="bodyMedium" style={styles.detailLabel}>
            Monitored
          </Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {episode.monitored ? "Yes" : "No"}
          </Text>
        </View>

        {episode.airDate && (
          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.detailLabel}>
              Air Date
            </Text>
            <Text variant="bodyMedium" style={styles.detailValue}>
              {new Date(episode.airDate).toLocaleDateString()}
            </Text>
          </View>
        )}

        {episode.runtime && (
          <View style={[styles.detailRow, { marginBottom: 0 }]}>
            <Text variant="bodyMedium" style={styles.detailLabel}>
              Runtime
            </Text>
            <Text variant="bodyMedium" style={styles.detailValue}>
              {episode.runtime} minutes
            </Text>
          </View>
        )}
      </Animated.View>

      {/* File Information */}
      {episode.hasFile && (
        <Animated.View
          entering={FadeInUp.duration(300).delay(200)}
          style={styles.detailCard}
        >
          <Text variant="titleMedium" style={styles.sectionTitle}>
            File Information
          </Text>

          {episode.sizeInMB && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Size
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {formatFileSizeFromMB(episode.sizeInMB)}
              </Text>
            </View>
          )}

          {episode.qualityInfo && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Quality
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.qualityInfo.name}
                {episode.qualityInfo.resolution &&
                  ` • ${episode.qualityInfo.resolution}p`}
              </Text>
            </View>
          )}

          {episode.releaseGroup && (
            <View style={[styles.detailRow, { marginBottom: 0 }]}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Release Group
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.releaseGroup}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Media Info */}
      {episode.hasFile && episode.mediaInfo && (
        <Animated.View
          entering={FadeInUp.duration(300).delay(300)}
          style={styles.detailCard}
        >
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Media Details
          </Text>

          {episode.mediaInfo.resolution && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Resolution
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.mediaInfo.resolution}
              </Text>
            </View>
          )}

          {episode.mediaInfo.videoCodec && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Video Codec
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.mediaInfo.videoCodec}
              </Text>
            </View>
          )}

          {episode.mediaInfo.audioCodec && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Audio Codec
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.mediaInfo.audioCodec}
              </Text>
            </View>
          )}

          {episode.mediaInfo.audioChannels && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Audio Channels
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.mediaInfo.audioChannels}
              </Text>
            </View>
          )}

          {episode.mediaInfo.videoFps && (
            <View style={[styles.detailRow, { marginBottom: 0 }]}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                FPS
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {episode.mediaInfo.videoFps}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Actions */}
      <Animated.View
        entering={FadeInUp.duration(300).delay(400)}
        style={{
          gap: spacing.md,
        }}
      >
        <View style={styles.actionButtons}>
          {episode.hasFile &&
            onRemoveAndSearchPress &&
            episode.episodeFileId && (
              <Tooltip title="Remove downloaded file and search for replacement">
                <IconButton
                  icon="delete-restore"
                  size={24}
                  loading={isRemovingAndSearching}
                  disabled={isRemovingAndSearching}
                  onPress={handleRemoveAndSearch}
                  iconColor={theme.colors.error}
                  style={{
                    backgroundColor: theme.colors.errorContainer,
                  }}
                />
              </Tooltip>
            )}

          {!episode.hasFile && onSearchMissingPress && (
            <Tooltip title="Search for this episode">
              <IconButton
                icon="magnify"
                size={24}
                loading={isSearchingMissing}
                disabled={isSearchingMissing}
                onPress={handleSearchMissing}
                iconColor={theme.colors.primary}
                style={{
                  backgroundColor: theme.colors.primaryContainer,
                }}
              />
            </Tooltip>
          )}

          {onToggleMonitorPress && (
            <Tooltip
              title={
                episode.monitored
                  ? "Unmonitor this episode"
                  : "Monitor this episode"
              }
            >
              <IconButton
                icon={episode.monitored ? "eye" : "eye-off"}
                size={24}
                loading={isTogglingMonitor}
                disabled={isTogglingMonitor}
                onPress={handleToggleMonitor}
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

          {!episode.hasFile && serviceConfig && contentId && (
            <DownloadButton
              serviceConfig={serviceConfig}
              contentId={contentId}
              size="medium"
              variant="icon"
            />
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
};

export default EpisodeDetailsSheet;
