import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import {
  Card,
  Text,
  ProgressBar,
  IconButton,
  Chip,
  Surface,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import type { AppTheme } from "@/constants/theme";
import type { DetailedSonarrQueueItem } from "@/models/queue.types";
import { formatBytes } from "@/utils/format.utils";

interface SonarrQueueItemProps {
  item: DetailedSonarrQueueItem;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  onBlock?: () => void;
  onRetry?: () => void;
  onLongPress?: () => void; // For opening drawer when item is in import pending state
  showActions?: boolean;
}

const SonarrQueueItemComponent = ({
  item,
  selected = false,
  onSelect,
  onRemove,
  onBlock,
  onRetry,
  onLongPress,
  showActions = true,
}: SonarrQueueItemProps) => {
  const theme = useTheme<AppTheme>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "downloading":
        return theme.colors.primary;
      case "completed":
        return theme.colors.tertiary;
      case "paused":
        return theme.colors.secondary;
      case "warning":
        return "#FF9800";
      case "failed":
        return theme.colors.error;
      case "queued":
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "downloading":
        return "download";
      case "completed":
        return "check-circle";
      case "paused":
        return "pause";
      case "warning":
        return "alert";
      case "failed":
        return "alert-circle";
      case "queued":
      default:
        return "clock";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "downloading":
        return "Downloading";
      case "completed":
        return "Completed";
      case "paused":
        return "Paused";
      case "warning":
        return "Warning";
      case "failed":
        return "Failed";
      case "queued":
        return "Queued";
      default:
        return status;
    }
  };

  const getTrackedDownloadStateText = (state?: string): string | null => {
    if (!state) return null;
    switch (state) {
      case "importing":
        return "Importing";
      case "importBlocked":
        return "Import Blocked";
      case "importPending":
        return "Import Pending";
      case "failedPending":
        return "Failed - Pending Action";
      case "downloading":
        return "Downloading";
      case "imported":
        return "Imported";
      case "failed":
        return "Import Failed";
      case "ignored":
        return "Ignored";
      default:
        return state;
    }
  };

  const renderStatusIndicator = () => (
    <View style={styles.statusContainer}>
      <MaterialCommunityIcons
        name={getStatusIcon(item.status) as any}
        size={16}
        color={getStatusColor(item.status)}
      />
      <Text
        variant="labelMedium"
        style={[
          styles.statusText,
          { color: getStatusColor(item.status) as any },
        ]}
      >
        {getStatusText(item.status)}
      </Text>
    </View>
  );

  const renderTrackedDownloadState = () => {
    const stateText = getTrackedDownloadStateText(item.trackedDownloadState);
    if (!stateText) return null;

    const isBlockedOrFailed =
      item.trackedDownloadState === "importBlocked" ||
      item.trackedDownloadState === "failedPending";

    const stateColor = isBlockedOrFailed
      ? theme.colors.error
      : theme.colors.onSurfaceVariant;
    const stateIcon = isBlockedOrFailed ? "alert-octagon" : "information";

    return (
      <Chip
        compact
        mode="flat"
        icon={stateIcon}
        style={[
          styles.trackedStateChip,
          isBlockedOrFailed && {
            backgroundColor: theme.colors.errorContainer,
          },
        ]}
        textStyle={[
          styles.trackedStateText,
          { color: isBlockedOrFailed ? theme.colors.error : stateColor },
        ]}
      >
        {stateText}
      </Chip>
    );
  };

  const renderQualityInfo = () => (
    <View style={styles.qualityContainer}>
      <Chip compact mode="flat" textStyle={styles.qualityText}>
        {item.quality?.quality?.name || "Unknown"}
      </Chip>
      {item.customFormatScore && item.customFormatScore > 0 && (
        <Chip compact mode="flat" textStyle={styles.customFormatText}>
          CF: {item.customFormatScore}
        </Chip>
      )}
    </View>
  );

  const renderProgressBar = () => {
    if (item.status !== "downloading" && !item.progress) {
      return null;
    }

    return (
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={item.progress ? item.progress / 100 : 0}
          color={getStatusColor(item.status)}
          style={styles.progressBar}
        />
        {item.status === "downloading" && (
          <View style={styles.progressStats}>
            <Text variant="bodySmall">
              {formatBytes(item.sizeleft || 0)} / {formatBytes(item.size || 0)}
            </Text>
            {item.timeRemaining && (
              <Text variant="bodySmall">{item.timeRemaining}</Text>
            )}
            {item.progress && <Text variant="bodySmall">{item.progress}%</Text>}
          </View>
        )}
      </View>
    );
  };

  const renderActions = () => {
    if (!showActions) {
      return null;
    }

    return (
      <View style={styles.actionsContainer}>
        {item.status === "failed" && (
          <IconButton icon="refresh" size={20} onPress={onRetry} />
        )}
        <IconButton
          icon="block-helper"
          size={20}
          iconColor={theme.colors.error}
          onPress={onBlock}
        />
        <IconButton
          icon="delete"
          size={20}
          iconColor={theme.colors.error}
          onPress={onRemove}
        />
      </View>
    );
  };

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={onSelect}
        onLongPress={
          item.trackedDownloadState === "importPending"
            ? onLongPress
            : undefined
        }
        disabled={!onSelect}
      >
        <View style={styles.container}>
          {/* Content */}
          <View style={styles.content}>
            {/* Series Title */}
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={styles.seriesTitle}
            >
              {item.seriesTitle}
            </Text>

            {/* Episode Number and Title */}
            <View style={styles.episodeNumberContainer}>
              {item.seasonNumber !== undefined &&
              item.seasonNumber !== null &&
              item.episodeNumber !== undefined &&
              item.episodeNumber !== null ? (
                <Text variant="labelMedium" style={styles.episodeNumber}>
                  S{(item.seasonNumber as number).toString().padStart(2, "0")}E
                  {(item.episodeNumber as number).toString().padStart(2, "0")}
                </Text>
              ) : null}
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={styles.episodeTitle}
              >
                {item.episodeTitle || "No episode title"}
              </Text>
            </View>

            {/* Added Time */}
            {item.added && (
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={styles.addedTime}
              >
                Added {formatDistanceToNow(new Date(item.added))} ago
              </Text>
            )}

            {/* Status and Quality */}
            <View style={styles.infoRow}>
              {renderStatusIndicator()}
              {renderQualityInfo()}
            </View>

            {/* Tracked Download State (manual intervention indicator) */}
            {renderTrackedDownloadState()}

            {/* Progress Bar */}
            {renderProgressBar()}

            {/* Download Info */}
            {item.downloadClient && (
              <View style={styles.downloadContainer}>
                <MaterialCommunityIcons
                  name="download-network"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodySmall" style={styles.downloadClient}>
                  {item.downloadClient}
                </Text>
                <Chip compact mode="flat" textStyle={styles.protocolText}>
                  {item.protocol?.toUpperCase() || "Unknown"}
                </Chip>
              </View>
            )}
          </View>

          {/* Actions */}
          {renderActions()}
        </View>

        {/* Error Message */}
        {item.errorMessage && (
          <Surface
            style={[
              styles.errorContainer,
              { backgroundColor: theme.colors.errorContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="alert-circle"
              size={16}
              color={theme.colors.error}
            />
            <Text
              variant="bodySmall"
              numberOfLines={2}
              style={[
                styles.errorMessage,
                { color: theme.colors.onErrorContainer },
              ]}
            >
              {item.errorMessage}
            </Text>
          </Surface>
        )}
      </TouchableOpacity>
    </Card>
  );
};

export const SonarrQueueItem = memo(SonarrQueueItemComponent);

const styles = StyleSheet.create({
  card: {
    marginVertical: 6,
  },
  touchable: {
    overflow: "hidden",
  },
  container: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  seriesTitle: {
    fontWeight: "500",
  },
  episodeNumberContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  episodeNumber: {
    fontWeight: "600",
    minWidth: 50,
  },
  episodeTitle: {
    flex: 1,
  },
  addedTime: {
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginLeft: 4,
    fontWeight: "500",
  },
  qualityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  qualityText: {
    fontSize: 10,
    paddingHorizontal: 4,
  },
  customFormatText: {
    fontSize: 10,
    paddingHorizontal: 4,
  },
  progressContainer: {
    marginTop: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  downloadContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  downloadClient: {
    marginHorizontal: 6,
    flex: 1,
  },
  protocolText: {
    fontSize: 10,
  },
  trackedStateChip: {
    marginTop: 6,
  },
  trackedStateText: {
    fontSize: 11,
  },
  actionsContainer: {
    justifyContent: "center",
  },
  errorContainer: {
    flexDirection: "row",
    padding: 8,
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 4,
    alignItems: "center",
  },
  errorMessage: {
    marginLeft: 6,
    flex: 1,
  },
});
