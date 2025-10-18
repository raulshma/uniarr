import React, { useMemo, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import {
  useTheme,
  Text,
  IconButton,
  Button,
  Surface,
  Badge,
  Searchbar,
  SegmentedButtons,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import {
  useDownloadStore,
  selectCompletedDownloadsArray,
  selectFailedDownloadsArray,
} from "@/store/downloadStore";
import { useDownloadActions } from "@/hooks/useDownloadActions";
import type { DownloadItem } from "@/models/download.types";
import { formatBytes } from "@/utils/torrent.utils";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

interface DownloadHistoryProps {
  /** Whether to show failed downloads */
  showFailed?: boolean;
  /** Maximum number of items to show */
  maxItems?: number;
  /** Show search functionality */
  showSearch?: boolean;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Whether data is currently refreshing */
  refreshing?: boolean;
}

interface DownloadHistoryItemProps {
  download: DownloadItem;
  onRetry?: (downloadId: string) => void;
  onRemove?: (downloadId: string) => void;
  onOpenFile?: (downloadPath: string) => void;
}

/**
 * Individual download history item
 */
const DownloadHistoryItem: React.FC<DownloadHistoryItemProps> = ({
  download,
  onRetry,
  onRemove,
  onOpenFile,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isCompleted = download.state.status === "completed";
  const isFailed = download.state.status === "failed";
  const canRetry =
    isFailed && download.state.retryCount < download.state.maxRetries;

  const getStatusColor = () => {
    if (isCompleted) return theme.colors.primary;
    if (isFailed) return theme.colors.error;
    return theme.colors.onSurfaceVariant;
  };

  const getStatusText = () => {
    if (isCompleted) {
      return `Completed • ${formatBytes(download.download.size || download.state.bytesDownloaded)}`;
    }
    if (isFailed) {
      return `Failed • ${download.state.errorMessage || "Unknown error"}`;
    }
    return download.state.status;
  };

  const handleActionPress = () => {
    if (isCompleted && onOpenFile) {
      onOpenFile(download.download.localPath);
    } else if (canRetry && onRetry) {
      onRetry(download.id);
    } else if (onRemove) {
      onRemove(download.id);
    }
  };

  const handleRemovePress = () => {
    if (onRemove) {
      onRemove(download.id);
    }
  };

  return (
    <Surface style={styles.historyItem}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text variant="titleSmall" style={styles.itemTitle} numberOfLines={2}>
            {download.content.title}
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.itemService,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {download.serviceConfig.name}
          </Text>
        </View>
        <View style={styles.itemActions}>
          <IconButton
            icon={isCompleted ? "folder-open" : canRetry ? "refresh" : "close"}
            size={20}
            onPress={handleActionPress}
            disabled={isFailed && !canRetry}
            iconColor={getStatusColor()}
            style={styles.actionButton}
          />
          <IconButton
            icon="trash-can"
            size={20}
            onPress={handleRemovePress}
            iconColor={theme.colors.error}
            style={styles.actionButton}
          />
        </View>
      </View>

      <View style={styles.itemDetails}>
        <Text
          variant="bodySmall"
          style={[styles.statusText, { color: getStatusColor() }]}
        >
          {getStatusText()}
        </Text>
        <Text
          variant="bodySmall"
          style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}
        >
          {new Date(
            download.state.completedAt || download.state.updatedAt,
          ).toLocaleDateString()}
        </Text>
      </View>

      {isCompleted && download.content.thumbnailUrl && (
        <View style={styles.thumbnailContainer}>
          {/* Thumbnail would go here */}
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
 * Download history component
 */
const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  showFailed = false,
  maxItems,
  showSearch = false,
  onRefresh,
  refreshing = false,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Get downloads from store
  const completedDownloads = useDownloadStore(selectCompletedDownloadsArray);
  const failedDownloads = useDownloadStore(selectFailedDownloadsArray);
  const { removeDownload } = useDownloadActions();

  // State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "completed" | "failed">(
    "all",
  );

  // Filter downloads based on props and state
  const allDownloads = useMemo(() => {
    let downloads = showFailed ? failedDownloads : completedDownloads;

    if (filter === "completed") {
      downloads = completedDownloads;
    } else if (filter === "failed") {
      downloads = failedDownloads;
    } else {
      downloads = [...completedDownloads, ...failedDownloads];
    }

    // Apply search filter
    if (searchQuery.trim()) {
      downloads = downloads.filter(
        (download) =>
          download.content.title
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          download.serviceConfig.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Sort by date (newest first)
    downloads.sort(
      (a, b) =>
        new Date(b.state.completedAt || b.state.updatedAt).getTime() -
        new Date(a.state.completedAt || a.state.updatedAt).getTime(),
    );

    // Apply max items limit
    if (maxItems && maxItems > 0) {
      downloads = downloads.slice(0, maxItems);
    }

    return downloads;
  }, [
    completedDownloads,
    failedDownloads,
    showFailed,
    filter,
    searchQuery,
    maxItems,
  ]);

  // Handle actions
  const handleRetry = useCallback((downloadId: string) => {
    // This would be connected to the download actions
    logger.info("Retry download from history", { downloadId });
  }, []);

  const handleRemove = useCallback(
    (downloadId: string) => {
      removeDownload(downloadId, { confirmDestructive: true });
    },
    [removeDownload],
  );

  const handleOpenFile = useCallback((downloadPath: string) => {
    // This would open the downloaded file
    logger.info("Open downloaded file", { path: downloadPath });
  }, []);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: allDownloads.length,
      completed: allDownloads.filter((d) => d.state.status === "completed")
        .length,
      failed: allDownloads.filter((d) => d.state.status === "failed").length,
    };
  }, [allDownloads]);

  if (allDownloads.length === 0) {
    return (
      <View style={styles.container}>
        {showSearch && (
          <Searchbar
            placeholder="Search downloads..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
        )}
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No Download History
          </Text>
          <Text variant="bodyMedium" style={styles.emptyDescription}>
            {showFailed
              ? "No failed downloads found."
              : "No completed downloads yet."}
          </Text>
          <Button
            mode="outlined"
            onPress={handleRefresh}
            style={styles.emptyButton}
          >
            Refresh
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with search and filters */}
      <View style={styles.header}>
        {showSearch && (
          <Searchbar
            placeholder="Search downloads..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
        )}

        <View style={styles.filterContainer}>
          <Text variant="titleSmall" style={styles.filterLabel}>
            Show:
          </Text>
          <SegmentedButtons
            value={filter}
            onValueChange={(value) =>
              setFilter(value as "all" | "completed" | "failed")
            }
            buttons={[
              { value: "all", label: "All" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        <View style={styles.statsContainer}>
          <Badge
            style={[styles.badge, { backgroundColor: theme.colors.primary }]}
          >
            {`${stats.total} total`}
          </Badge>
          {stats.completed > 0 && (
            <Badge
              style={[
                styles.badge,
                { backgroundColor: theme.colors.secondary },
              ]}
            >
              {`${stats.completed} completed`}
            </Badge>
          )}
          {stats.failed > 0 && (
            <Badge
              style={[styles.badge, { backgroundColor: theme.colors.error }]}
            >
              {`${stats.failed} failed`}
            </Badge>
          )}
        </View>
      </View>

      {/* Download list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {allDownloads.map((download) => (
          <DownloadHistoryItem
            key={download.id}
            download={download}
            onRetry={handleRetry}
            onRemove={handleRemove}
            onOpenFile={handleOpenFile}
          />
        ))}

        {maxItems && allDownloads.length >= maxItems && (
          <View style={styles.showMoreContainer}>
            <Button
              mode="text"
              onPress={() => logger.info("Show all downloads")}
              textColor={theme.colors.primary}
            >
              Show All Downloads
            </Button>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      marginBottom: spacing.md,
    },
    searchBar: {
      marginBottom: spacing.md,
    },
    filterContainer: {
      marginBottom: spacing.md,
    },
    filterLabel: {
      marginBottom: spacing.sm,
      color: theme.colors.onSurface,
    },
    segmentedButtons: {
      marginBottom: spacing.sm,
    },
    statsContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    badge: {
      paddingHorizontal: spacing.sm,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: spacing.xl,
    },
    historyItem: {
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: spacing.md,
      backgroundColor: theme.colors.surface,
    },
    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },
    itemInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    itemTitle: {
      fontWeight: "500",
      marginBottom: spacing.xs,
      color: theme.colors.onSurface,
    },
    itemService: {
      fontSize: 12,
    },
    itemActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionButton: {
      margin: 0,
    },
    itemDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusText: {
      fontSize: 12,
      fontWeight: "500",
    },
    dateText: {
      fontSize: 11,
    },
    thumbnailContainer: {
      marginTop: spacing.sm,
    },
    thumbnail: {
      width: 60,
      height: 40,
      borderRadius: spacing.xs,
    },
    showMoreContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxl,
    },
    emptyTitle: {
      fontWeight: "600",
      marginBottom: spacing.sm,
      color: theme.colors.onSurface,
    },
    emptyDescription: {
      textAlign: "center",
      marginBottom: spacing.md,
      color: theme.colors.onSurfaceVariant,
    },
    emptyButton: {
      marginTop: spacing.sm,
    },
  });

export default DownloadHistory;
