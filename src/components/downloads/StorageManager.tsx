import React, { useState, useCallback, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import {
  useTheme,
  Text,
  Surface,
  ProgressBar,
  Button,
  List,
  Dialog,
  Portal,
  TextInput,
  Chip,
  Card,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { useDownloadStore } from "@/store/downloadStore";
import { StorageManager } from "@/services/download/StorageManager";
import type { DownloadStorageInfo } from "@/models/download.types";
import { formatBytes } from "@/utils/torrent.utils";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

interface StorageManagerProps {
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
  /** Show detailed breakdown */
  showDetailed?: boolean;
}

interface CleanupOptions {
  olderThanDays: number;
  largerThanMB: number;
  keepCount: number;
}

/**
 * Storage management component
 */
const StorageManagerComponent: React.FC<StorageManagerProps> = ({
  refreshInterval = 30,
  showDetailed = false,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // State
  const [storageInfo, setStorageInfo] = useState<DownloadStorageInfo | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [cleanupDialogVisible, setCleanupDialogVisible] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<{
    removed: number;
    errors: string[];
  } | null>(null);
  const [storageRecommendations, setStorageRecommendations] =
    useState<any>(null);

  // Cleanup options
  const [cleanupOptions, setCleanupOptions] = useState<CleanupOptions>({
    olderThanDays: 30,
    largerThanMB: 500,
    keepCount: 50,
  });

  // Storage manager instance
  const storageManager = useMemo(() => StorageManager.getInstance(), []);

  // Get downloads from store
  const allDownloads = useDownloadStore((state) =>
    Array.from(state.downloads.values()),
  );

  // Load storage information
  const loadStorageInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      const [info, recommendations] = await Promise.all([
        storageManager.getStorageInfo(),
        storageManager.getStorageRecommendations(
          allDownloads,
          await storageManager.getStorageInfo(),
        ),
      ]);

      setStorageInfo(info);
      setStorageRecommendations(recommendations);
    } catch (error) {
      logger.error("Failed to load storage info", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [allDownloads, storageManager]);

  // Load data on mount
  React.useEffect(() => {
    loadStorageInfo();

    // Set up periodic refresh
    if (refreshInterval > 0) {
      const interval = setInterval(loadStorageInfo, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [loadStorageInfo, refreshInterval]);

  // Handle cleanup
  const handleCleanup = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await storageManager.cleanupOldDownloads(
        allDownloads,
        cleanupOptions,
      );
      setCleanupResults(results);
      setCleanupDialogVisible(false);

      // Reload storage info after cleanup
      await loadStorageInfo();

      logger.info("Storage cleanup completed", results);
    } catch (error) {
      logger.error("Storage cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [allDownloads, cleanupOptions, storageManager, loadStorageInfo]);

  // Handle orphaned cleanup
  const handleOrphanedCleanup = useCallback(async () => {
    try {
      setIsLoading(true);
      const results =
        await storageManager.cleanupOrphanedDownloads(allDownloads);

      if (results.cleaned > 0) {
        logger.info("Orphaned cleanup completed", results);
      }

      // Reload storage info after cleanup
      await loadStorageInfo();
    } catch (error) {
      logger.error("Orphaned cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [allDownloads, storageManager, loadStorageInfo]);

  // Calculate usage percentages
  const usagePercentage = storageInfo
    ? ((storageInfo.totalSpace - storageInfo.freeSpace) /
        storageInfo.totalSpace) *
      100
    : 0;

  const downloadUsagePercentage =
    storageInfo && storageInfo.totalSpace > 0
      ? (storageInfo.usedSpace / storageInfo.totalSpace) * 100
      : 0;

  // Get color based on usage
  const getUsageColor = (percentage: number) => {
    if (percentage > 90) return theme.colors.error;
    if (percentage > 80) return theme.colors.errorContainer;
    if (percentage > 60) return theme.colors.tertiaryContainer;
    return theme.colors.primary;
  };

  if (!storageInfo) {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Loading storage information...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Storage Management
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Overall Storage Status */}
        <Surface style={styles.surface}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Overall Storage
          </Text>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="bodyMedium" style={styles.progressLabel}>
                Total Storage Used
              </Text>
              <Text variant="bodyMedium" style={styles.progressValue}>
                {usagePercentage.toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={usagePercentage / 100}
              color={getUsageColor(usagePercentage)}
              style={styles.progressBar}
            />
            <Text variant="bodySmall" style={styles.progressDescription}>
              {formatBytes(storageInfo.totalSpace - storageInfo.freeSpace)} of{" "}
              {formatBytes(storageInfo.totalSpace)} used
            </Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="bodyMedium" style={styles.progressLabel}>
                Downloads Storage
              </Text>
              <Text variant="bodyMedium" style={styles.progressValue}>
                {downloadUsagePercentage.toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={downloadUsagePercentage / 100}
              color={theme.colors.primary}
              style={styles.progressBar}
            />
            <Text variant="bodySmall" style={styles.progressDescription}>
              {formatBytes(storageInfo.usedSpace)} of{" "}
              {formatBytes(storageInfo.totalSpace)} used for downloads
            </Text>
          </View>

          <View style={styles.storageStats}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>
                {formatBytes(storageInfo.freeSpace)}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Free Space
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statValue}>
                {storageInfo.fileCount}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Download Files
              </Text>
            </View>
          </View>
        </Surface>

        {/* Storage Recommendations */}
        {storageRecommendations && (
          <Surface style={styles.surface}>
            <View style={styles.recommendationHeader}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Storage Status
              </Text>
              <Chip
                style={[
                  styles.priorityChip,
                  {
                    backgroundColor:
                      storageRecommendations.priority === "critical"
                        ? theme.colors.errorContainer
                        : storageRecommendations.priority === "high"
                          ? theme.colors.tertiaryContainer
                          : storageRecommendations.priority === "medium"
                            ? theme.colors.secondaryContainer
                            : theme.colors.primaryContainer,
                  },
                ]}
              >
                {storageRecommendations.priority}
              </Chip>
            </View>

            <Text variant="bodyMedium" style={styles.recommendationMessage}>
              {storageRecommendations.message}
            </Text>

            <View style={styles.recommendationActions}>
              <Text variant="titleSmall" style={styles.actionsTitle}>
                Recommended Actions:
              </Text>
              {storageRecommendations.actions.map(
                (action: string, index: number) => (
                  <Text
                    key={index}
                    variant="bodySmall"
                    style={styles.actionItem}
                  >
                    • {action}
                  </Text>
                ),
              )}
            </View>
          </Surface>
        )}

        {/* Quick Actions */}
        <Surface style={styles.surface}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Quick Actions
          </Text>

          <List.Item
            title="Clear Old Downloads"
            description="Remove downloads older than specified criteria"
            left={(props) => <List.Icon {...props} icon="trash-can" />}
            onPress={() => setCleanupDialogVisible(true)}
          />

          <List.Item
            title="Clean Orphaned Files"
            description="Remove downloads that no longer exist on disk"
            left={(props) => <List.Icon {...props} icon="broom" />}
            onPress={handleOrphanedCleanup}
          />

          <List.Item
            title="Refresh Storage Info"
            description="Update storage usage statistics"
            left={(props) => <List.Icon {...props} icon="refresh" />}
            onPress={loadStorageInfo}
            disabled={isLoading}
          />
        </Surface>

        {/* Detailed Breakdown */}
        {showDetailed && (
          <Surface style={styles.surface}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Detailed Breakdown
            </Text>

            <Card style={styles.detailCard}>
              <Text variant="titleSmall" style={styles.detailCardTitle}>
                Download Statistics
              </Text>
              <View style={styles.detailRow}>
                <Text variant="bodySmall">Total Downloads:</Text>
                <Text variant="bodySmall">
                  {
                    allDownloads.filter((d) => d.state.status === "completed")
                      .length
                  }
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text variant="bodySmall">Failed Downloads:</Text>
                <Text variant="bodySmall">
                  {
                    allDownloads.filter((d) => d.state.status === "failed")
                      .length
                  }
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text variant="bodySmall">Download Directory:</Text>
                <Text variant="bodySmall" numberOfLines={1}>
                  {storageManager.getDownloadDirectory()}
                </Text>
              </View>
            </Card>
          </Surface>
        )}
      </ScrollView>

      {/* Cleanup Dialog */}
      <Portal>
        <Dialog
          visible={cleanupDialogVisible}
          onDismiss={() => setCleanupDialogVisible(false)}
        >
          <Dialog.Title>Cleanup Old Downloads</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Remove downloads that match the following criteria:
            </Text>

            <View style={styles.cleanupOption}>
              <Text variant="bodyMedium">Older than (days):</Text>
              <TextInput
                value={cleanupOptions.olderThanDays.toString()}
                onChangeText={(value) =>
                  setCleanupOptions((prev) => ({
                    ...prev,
                    olderThanDays: parseInt(value) || 0,
                  }))
                }
                keyboardType="numeric"
                mode="outlined"
                style={styles.textInput}
              />
            </View>

            <View style={styles.cleanupOption}>
              <Text variant="bodyMedium">Larger than (MB):</Text>
              <TextInput
                value={cleanupOptions.largerThanMB.toString()}
                onChangeText={(value) =>
                  setCleanupOptions((prev) => ({
                    ...prev,
                    largerThanMB: parseInt(value) || 0,
                  }))
                }
                keyboardType="numeric"
                mode="outlined"
                style={styles.textInput}
              />
            </View>

            <View style={styles.cleanupOption}>
              <Text variant="bodyMedium">Keep most recent:</Text>
              <TextInput
                value={cleanupOptions.keepCount.toString()}
                onChangeText={(value) =>
                  setCleanupOptions((prev) => ({
                    ...prev,
                    keepCount: parseInt(value) || 0,
                  }))
                }
                keyboardType="numeric"
                mode="outlined"
                style={styles.textInput}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCleanupDialogVisible(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleCleanup}>
              Clean Up
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Cleanup Results Dialog */}
      {cleanupResults && (
        <Portal>
          <Dialog visible={true} onDismiss={() => setCleanupResults(null)}>
            <Dialog.Title>Cleanup Results</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogText}>
                Removed {cleanupResults.removed} downloads
              </Text>
              {cleanupResults.errors.length > 0 && (
                <>
                  <Text variant="titleSmall" style={styles.errorTitle}>
                    Errors:
                  </Text>
                  {cleanupResults.errors.map((error, index) => (
                    <Text
                      key={index}
                      variant="bodySmall"
                      style={styles.errorText}
                    >
                      • {error}
                    </Text>
                  ))}
                </>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button mode="contained" onPress={() => setCleanupResults(null)}>
                OK
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    title: {
      fontWeight: "600",
      marginBottom: spacing.md,
      color: theme.colors.onSurface,
    },
    surface: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: spacing.md,
      backgroundColor: theme.colors.surface,
    },
    sectionTitle: {
      fontWeight: "600",
      marginBottom: spacing.md,
      color: theme.colors.onSurface,
    },
    progressSection: {
      marginBottom: spacing.md,
    },
    progressHeader: {
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
    progressBar: {
      height: 8,
      borderRadius: 4,
      marginBottom: spacing.xs,
    },
    progressDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    storageStats: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingTop: spacing.md,
    },
    statItem: {
      alignItems: "center",
    },
    statValue: {
      fontWeight: "600",
      color: theme.colors.primary,
      marginBottom: spacing.xs,
    },
    statLabel: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      fontSize: 12,
    },
    recommendationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    priorityChip: {
      // textTransform: "capitalize", // Removed due to TypeScript issue
    },
    recommendationMessage: {
      marginBottom: spacing.md,
      color: theme.colors.onSurface,
    },
    recommendationActions: {
      backgroundColor: theme.colors.surfaceVariant,
      padding: spacing.md,
      borderRadius: spacing.md,
    },
    actionsTitle: {
      fontWeight: "600",
      marginBottom: spacing.sm,
      color: theme.colors.onSurface,
    },
    actionItem: {
      marginBottom: spacing.xs,
      color: theme.colors.onSurfaceVariant,
    },
    detailCard: {
      marginTop: spacing.md,
    },
    detailCardTitle: {
      fontWeight: "600",
      marginBottom: spacing.sm,
      color: theme.colors.onSurface,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    dialogText: {
      marginBottom: spacing.md,
    },
    cleanupOption: {
      marginBottom: spacing.md,
    },
    textInput: {
      marginTop: spacing.xs,
    },
    errorTitle: {
      fontWeight: "600",
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      color: theme.colors.error,
    },
    errorText: {
      color: theme.colors.error,
      marginBottom: spacing.xs,
    },
  });

export default StorageManagerComponent;
