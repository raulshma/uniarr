import React, { useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  useTheme,
  Text,
  IconButton,
  Button,
  ProgressBar,
  Surface,
  Badge,
} from "react-native-paper";
import BottomDrawer from "@/components/common/BottomDrawer";
import type { AppTheme } from "@/constants/theme";
import {
  useDownloadStore,
  selectActiveDownloadsArray,
  selectCompletedDownloadsArray,
  selectFailedDownloadsArray,
} from "@/store/downloadStore";
import type { DownloadItem } from "@/models/download.types";
import { formatBytes, formatSpeed, formatEta } from "@/utils/torrent.utils";
import { spacing } from "@/theme/spacing";

interface DownloadProgressSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

interface DownloadItemProps {
  download: DownloadItem;
  onPause?: (downloadId: string) => void;
  onResume?: (downloadId: string) => void;
  onCancel?: (downloadId: string) => void;
  onRetry?: (downloadId: string) => void;
}

/**
 * Individual download item component
 */
const DownloadItemCard: React.FC<DownloadItemProps> = ({
  download,
  onPause,
  onResume,
  onCancel,
  onRetry,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const progress = Math.max(0, Math.min(1, download.state.progress));
  const percent = Math.round(progress * 100);
  const isActive = download.state.status === "downloading";
  const isPaused = download.state.status === "paused";
  const isCompleted = download.state.status === "completed";
  const isFailed = download.state.status === "failed";
  const canRetry =
    isFailed && download.state.retryCount < download.state.maxRetries;

  const getStatusText = () => {
    if (isCompleted) {
      return `Completed • ${formatBytes(download.download.size || download.state.bytesDownloaded)}`;
    }
    if (isPaused) {
      return `Paused • ${formatBytes(download.state.bytesDownloaded)} downloaded`;
    }
    if (isFailed) {
      return `Failed • ${download.state.errorMessage || "Unknown error"}`;
    }
    if (isActive) {
      const progressText =
        download.state.totalBytes > 0
          ? `${formatBytes(download.state.bytesDownloaded)} / ${formatBytes(download.state.totalBytes)}`
          : formatBytes(download.state.bytesDownloaded);

      const speedText =
        download.state.downloadSpeed > 0
          ? ` • ${formatSpeed(download.state.downloadSpeed)}`
          : "";

      const etaText =
        download.state.eta > 0 && download.state.downloadSpeed > 0
          ? ` • ~${formatEta(download.state.eta)}`
          : "";

      return `${progressText}${speedText}${etaText}`;
    }
    return `Pending • ${formatBytes(download.state.bytesDownloaded)}`;
  };

  const getStatusColor = () => {
    if (isCompleted) return theme.colors.primary;
    if (isFailed) return theme.colors.error;
    if (isPaused) return theme.colors.onSurfaceVariant;
    if (isActive) return theme.colors.primary;
    return theme.colors.onSurfaceVariant;
  };

  const getProgressColor = () => {
    if (isCompleted) return theme.colors.primary;
    if (isFailed) return theme.colors.error;
    if (isPaused) return theme.colors.onSurfaceVariant;
    return theme.colors.primary;
  };

  const handleActionPress = () => {
    if (isCompleted) return;
    if (isPaused && onResume) {
      onResume(download.id);
    } else if (isActive && onPause) {
      onPause(download.id);
    } else if (canRetry && onRetry) {
      onRetry(download.id);
    }
  };

  const handleCancelPress = () => {
    if (onCancel && !isCompleted) {
      onCancel(download.id);
    }
  };

  return (
    <Surface style={styles.downloadItem}>
      <View style={styles.downloadHeader}>
        <View style={styles.downloadInfo}>
          <Text
            variant="titleSmall"
            style={styles.downloadTitle}
            numberOfLines={2}
          >
            {download.content.title}
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.downloadService,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {download.serviceConfig.name}
          </Text>
        </View>
        <View style={styles.downloadActions}>
          <IconButton
            icon={
              isCompleted
                ? "check"
                : isPaused
                  ? "play"
                  : isActive
                    ? "pause"
                    : canRetry
                      ? "refresh"
                      : "close"
            }
            size={20}
            onPress={handleActionPress}
            disabled={isCompleted}
            iconColor={getStatusColor()}
            style={styles.actionButton}
          />
          {!isCompleted && (
            <IconButton
              icon="close"
              size={20}
              onPress={handleCancelPress}
              iconColor={theme.colors.error}
              style={styles.actionButton}
            />
          )}
        </View>
      </View>

      <View style={styles.downloadProgress}>
        <ProgressBar
          progress={progress}
          color={getProgressColor()}
          style={styles.progressBar}
        />
        <View style={styles.progressInfo}>
          <Text
            variant="labelSmall"
            style={[styles.progressPercent, { color: getStatusColor() }]}
          >
            {percent}%
          </Text>
          <Text
            variant="labelSmall"
            style={[
              styles.progressStatus,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {getStatusText()}
          </Text>
        </View>
      </View>

      {download.content.thumbnailUrl && (
        <View style={styles.thumbnailContainer}>
          {/* Thumbnail would go here - using expo-image */}
          {/* <Image
            source={{ uri: download.content.thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          /> */}
        </View>
      )}
    </Surface>
  );
};

/**
 * Download progress sheet component
 */
const DownloadProgressSheet: React.FC<DownloadProgressSheetProps> = ({
  visible,
  onDismiss,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Get downloads from store
  const activeDownloads = useDownloadStore(selectActiveDownloadsArray);
  const completedDownloads = useDownloadStore(selectCompletedDownloadsArray);
  const failedDownloads = useDownloadStore(selectFailedDownloadsArray);

  // Combine all downloads for display
  const downloads = useMemo(() => {
    return [
      ...activeDownloads,
      ...failedDownloads,
      ...completedDownloads.slice(0, 5),
    ];
  }, [activeDownloads, failedDownloads, completedDownloads]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalBytes = activeDownloads.reduce(
      (sum, d) => sum + d.state.bytesDownloaded,
      0,
    );
    const totalSpeed = activeDownloads.reduce(
      (sum, d) => sum + d.state.downloadSpeed,
      0,
    );
    const avgProgress =
      activeDownloads.length > 0
        ? activeDownloads.reduce((sum, d) => sum + d.state.progress, 0) /
          activeDownloads.length
        : 0;

    return {
      activeCount: activeDownloads.length,
      completedCount: completedDownloads.length,
      failedCount: failedDownloads.length,
      totalBytes,
      totalSpeed,
      avgProgress,
    };
  }, [activeDownloads, completedDownloads, failedDownloads]);

  // Handle download actions (these would be connected to DownloadManager)
  const handlePauseDownload = useCallback((downloadId: string) => {
    // TODO: Connect to DownloadManager
    console.log("Pause download:", downloadId);
  }, []);

  const handleResumeDownload = useCallback((downloadId: string) => {
    // TODO: Connect to DownloadManager
    console.log("Resume download:", downloadId);
  }, []);

  const handleCancelDownload = useCallback((downloadId: string) => {
    // TODO: Connect to DownloadManager
    console.log("Cancel download:", downloadId);
  }, []);

  const handleRetryDownload = useCallback((downloadId: string) => {
    // TODO: Connect to DownloadManager
    console.log("Retry download:", downloadId);
  }, []);

  const handleClearCompleted = useCallback(() => {
    // TODO: Connect to DownloadManager
    console.log("Clear completed downloads");
  }, []);

  const handleShowAllHistory = useCallback(() => {
    // TODO: Navigate to download history screen
    console.log("Show all download history");
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <BottomDrawer
      visible={visible}
      onDismiss={onDismiss}
      title="Downloads"
      maxHeight="80%"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Section */}
        <Surface style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text variant="titleMedium" style={styles.summaryTitle}>
              Download Activity
            </Text>
            <View style={styles.summaryBadges}>
              {totals.activeCount > 0 && (
                <Badge
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  {`${totals.activeCount} active`}
                </Badge>
              )}
              {totals.completedCount > 0 && (
                <Badge
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.secondary },
                  ]}
                >
                  {`${totals.completedCount} completed`}
                </Badge>
              )}
              {totals.failedCount > 0 && (
                <Badge
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.error },
                  ]}
                >
                  {`${totals.failedCount} failed`}
                </Badge>
              )}
            </View>
          </View>

          {totals.activeCount > 0 && (
            <View style={styles.progressSummary}>
              <View style={styles.progressRow}>
                <Text variant="bodyMedium" style={styles.progressLabel}>
                  Overall Progress
                </Text>
                <Text variant="bodyMedium" style={styles.progressValue}>
                  {Math.round(totals.avgProgress * 100)}%
                </Text>
              </View>
              <ProgressBar
                progress={totals.avgProgress}
                color={theme.colors.primary}
                style={styles.summaryProgressBar}
              />
              <View style={styles.speedInfo}>
                <Text variant="bodySmall" style={styles.speedText}>
                  {formatSpeed(totals.totalSpeed)} •{" "}
                  {formatBytes(totals.totalBytes)} downloaded
                </Text>
              </View>
            </View>
          )}
        </Surface>

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Active Downloads ({activeDownloads.length})
            </Text>
            {activeDownloads.map((download) => (
              <DownloadItemCard
                key={download.id}
                download={download}
                onPause={handlePauseDownload}
                onResume={handleResumeDownload}
                onCancel={handleCancelDownload}
              />
            ))}
          </>
        )}

        {/* Failed Downloads */}
        {failedDownloads.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Failed Downloads ({failedDownloads.length})
            </Text>
            {failedDownloads.map((download) => (
              <DownloadItemCard
                key={download.id}
                download={download}
                onRetry={handleRetryDownload}
                onCancel={handleCancelDownload}
              />
            ))}
          </>
        )}

        {/* Recent Completed Downloads */}
        {completedDownloads.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Completed ({completedDownloads.length})
              </Text>
              <Button
                mode="text"
                onPress={handleClearCompleted}
                compact
                textColor={theme.colors.primary}
              >
                Clear All
              </Button>
            </View>
            {completedDownloads.slice(0, 3).map((download) => (
              <DownloadItemCard key={download.id} download={download} />
            ))}
            {completedDownloads.length > 3 && (
              <Button
                mode="text"
                onPress={handleShowAllHistory}
                style={styles.showMoreButton}
                textColor={theme.colors.primary}
              >
                Show All ({completedDownloads.length} total)
              </Button>
            )}
          </>
        )}

        {/* Empty State */}
        {downloads.length === 0 && (
          <View style={styles.emptyState}>
            <Text variant="bodyLarge" style={styles.emptyTitle}>
              No Downloads
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.emptyDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Downloaded content will appear here
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </BottomDrawer>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
    },
    summaryCard: {
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: spacing.md,
      backgroundColor: theme.colors.surface,
    },
    summaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    summaryTitle: {
      fontWeight: "600",
    },
    summaryBadges: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    badge: {
      paddingHorizontal: spacing.sm,
    },
    progressSummary: {
      marginTop: spacing.sm,
    },
    progressRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    progressLabel: {
      color: theme.colors.onSurface,
    },
    progressValue: {
      fontWeight: "600",
      color: theme.colors.primary,
    },
    summaryProgressBar: {
      height: 6,
      borderRadius: 3,
      marginBottom: spacing.xs,
    },
    speedInfo: {
      alignItems: "center",
    },
    speedText: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionTitle: {
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      fontWeight: "600",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    downloadItem: {
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: spacing.md,
      backgroundColor: theme.colors.elevation.level1,
    },
    downloadHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },
    downloadInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    downloadTitle: {
      fontWeight: "500",
      marginBottom: spacing.xs,
      color: theme.colors.onSurface,
    },
    downloadService: {
      fontSize: 12,
    },
    downloadActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionButton: {
      margin: 0,
    },
    downloadProgress: {
      marginBottom: spacing.sm,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.elevation.level2,
      marginBottom: spacing.xs,
    },
    progressInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressPercent: {
      fontWeight: "600",
      fontSize: 12,
    },
    progressStatus: {
      fontSize: 11,
      flex: 1,
      marginLeft: spacing.sm,
    },
    thumbnailContainer: {
      marginTop: spacing.sm,
    },
    thumbnail: {
      width: 60,
      height: 40,
      borderRadius: spacing.xs,
    },
    showMoreButton: {
      marginTop: spacing.md,
      alignSelf: "center",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
    },
    emptyTitle: {
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    emptyDescription: {
      textAlign: "center",
    },
    bottomSpacing: {
      height: spacing.xl,
    },
  });

export default DownloadProgressSheet;
