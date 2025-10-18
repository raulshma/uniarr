import React, { useState, useCallback, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import {
  useTheme,
  Text,
  List,
  Switch,
  Button,
  Surface,
  Divider,
  Portal,
  Dialog,
  TextInput,
  SegmentedButtons,
  ProgressBar,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { useDownloadStore, useDownloadConfig } from "@/store/downloadStore";
import { useDownloadService } from "@/services/download";
import { useDownloadPortal } from "@/providers/DownloadPortalProvider";
import { formatBytes } from "@/utils/torrent.utils";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

interface DownloadSettingsProps {
  /** Whether to show a compact version */
  compact?: boolean;
  /** Callback when settings change */
  onSettingsChange?: () => void;
}

/**
 * Download settings component for configuring download behavior
 */
const DownloadSettings: React.FC<DownloadSettingsProps> = ({
  compact = false,
  onSettingsChange,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  // Store and service hooks
  const config = useDownloadConfig();
  const { service, getStats, clearCompletedDownloads } = useDownloadService();
  const { showDownloads, activeDownloadsCount } = useDownloadPortal();

  // Local state for settings
  const [localConfig, setLocalConfig] = useState(config);
  const [clearDialogVisible, setClearDialogVisible] = useState(false);
  const [storageLimitDialogVisible, setStorageLimitDialogVisible] =
    useState(false);
  const [tempStorageLimit, setTempStorageLimit] = useState(
    Math.round(config.maxStorageUsage / 1024 / 1024 / 1024).toString(),
  );

  // Get download statistics
  const stats = service ? getStats() : null;

  // Update local config when store config changes
  React.useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Handle config change
  const handleConfigChange = useCallback(
    (updates: Partial<typeof config>) => {
      const newConfig = { ...localConfig, ...updates };
      setLocalConfig(newConfig);

      // Update store
      useDownloadStore.getState().updateConfig(updates);

      // Notify parent
      onSettingsChange?.();

      logger.info("Download settings updated", { updates });
    },
    [localConfig, onSettingsChange],
  );

  // Handle clear completed downloads
  const handleClearCompleted = useCallback(async () => {
    try {
      await clearCompletedDownloads();
      setClearDialogVisible(false);
      logger.info("Completed downloads cleared from settings");
    } catch (error) {
      logger.error("Failed to clear completed downloads", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [clearCompletedDownloads]);

  // Handle storage limit change
  const handleStorageLimitChange = useCallback(
    (value: string) => {
      const limitGB = parseFloat(value);
      if (!isNaN(limitGB) && limitGB > 0 && limitGB <= 100) {
        const limitBytes = limitGB * 1024 * 1024 * 1024;
        handleConfigChange({ maxStorageUsage: limitBytes });
        setStorageLimitDialogVisible(false);
      }
    },
    [handleConfigChange],
  );

  // Storage usage percentage
  const storageUsagePercentage =
    stats && config.maxStorageUsage > 0
      ? (stats.storageUsed / config.maxStorageUsage) * 100
      : 0;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text variant="titleMedium">Downloads</Text>
          <Button
            mode="text"
            onPress={showDownloads}
            compact
            textColor={theme.colors.primary}
          >
            Manage
          </Button>
        </View>

        {stats && (
          <View style={styles.compactStats}>
            <View style={styles.statItem}>
              <Text variant="labelMedium" style={styles.statLabel}>
                Active
              </Text>
              <Text variant="headlineSmall" style={styles.statValue}>
                {stats.activeDownloads}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="labelMedium" style={styles.statLabel}>
                Storage
              </Text>
              <Text variant="headlineSmall" style={styles.statValue}>
                {Math.round(storageUsagePercentage)}%
              </Text>
            </View>
          </View>
        )}

        <Divider style={styles.compactDivider} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Download Settings
      </Text>

      <Surface style={styles.surface}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Download Configuration */}
          <View style={styles.section}>
            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Download Configuration
            </Text>

            <List.Item
              title="Mobile Data Downloads"
              description="Allow downloads when on mobile data"
              left={(props) => <List.Icon {...props} icon="cellphone" />}
              right={() => (
                <Switch
                  value={localConfig.allowMobileData}
                  onValueChange={(value) =>
                    handleConfigChange({ allowMobileData: value })
                  }
                />
              )}
            />

            <List.Item
              title="Background Downloads"
              description="Continue downloads when app is backgrounded"
              left={(props) => (
                <List.Icon {...props} icon="play-box-multiple" />
              )}
              right={() => (
                <Switch
                  value={localConfig.allowBackgroundDownloads}
                  onValueChange={(value) =>
                    handleConfigChange({ allowBackgroundDownloads: value })
                  }
                />
              )}
            />

            <List.Item
              title="Max Concurrent Downloads"
              description={`Currently set to ${localConfig.maxConcurrentDownloads}`}
              left={(props) => (
                <List.Icon {...props} icon="download-multiple" />
              )}
              right={() => (
                <SegmentedButtons
                  value={localConfig.maxConcurrentDownloads.toString()}
                  onValueChange={(value) =>
                    handleConfigChange({
                      maxConcurrentDownloads: parseInt(value, 10),
                    })
                  }
                  buttons={[
                    { value: "1", label: "1" },
                    { value: "3", label: "3" },
                    { value: "5", label: "5" },
                  ]}
                  style={styles.segmentedButtons}
                />
              )}
            />

            <List.Item
              title="Storage Limit"
              description={`${(config.maxStorageUsage / 1024 / 1024 / 1024).toFixed(1)} GB maximum`}
              left={(props) => <List.Icon {...props} icon="database" />}
              onPress={() => setStorageLimitDialogVisible(true)}
            />

            {stats && (
              <View style={styles.storageSection}>
                <Text variant="bodySmall" style={styles.storageLabel}>
                  Storage Usage
                </Text>
                <ProgressBar
                  progress={Math.min(storageUsagePercentage / 100, 1)}
                  color={
                    storageUsagePercentage > 80
                      ? theme.colors.error
                      : theme.colors.primary
                  }
                  style={styles.storageProgress}
                />
                <Text variant="bodySmall" style={styles.storageText}>
                  {formatBytes(stats.storageUsed)} of{" "}
                  {formatBytes(config.maxStorageUsage)} used
                </Text>
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Download Statistics */}
          <View style={styles.section}>
            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Download Statistics
            </Text>

            {stats ? (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {stats.activeDownloads}
                    </Text>
                    <Text variant="bodySmall" style={styles.statDescription}>
                      Active
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {stats.completedDownloads}
                    </Text>
                    <Text variant="bodySmall" style={styles.statDescription}>
                      Completed
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {stats.failedDownloads}
                    </Text>
                    <Text variant="bodySmall" style={styles.statDescription}>
                      Failed
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {formatBytes(stats.totalBytesDownloaded)}
                    </Text>
                    <Text variant="bodySmall" style={styles.statDescription}>
                      Downloaded
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <List.Item
                    title="View Active Downloads"
                    description={`${activeDownloadsCount} downloads in progress`}
                    left={(props) => <List.Icon {...props} icon="download" />}
                    onPress={showDownloads}
                    style={styles.actionItem}
                  />

                  {stats.completedDownloads > 0 && (
                    <List.Item
                      title="Clear Completed Downloads"
                      description="Remove all completed downloads from history"
                      left={(props) => (
                        <List.Icon {...props} icon="trash-can" />
                      )}
                      onPress={() => setClearDialogVisible(true)}
                      style={styles.actionItem}
                    />
                  )}
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No download statistics available
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.emptySubtext,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Start a download to see statistics here
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </Surface>

      {/* Clear Completed Downloads Dialog */}
      <Portal>
        <Dialog
          visible={clearDialogVisible}
          onDismiss={() => setClearDialogVisible(false)}
        >
          <Dialog.Title>Clear Completed Downloads</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to remove all{" "}
              {stats?.completedDownloads || 0} completed downloads from your
              history? This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setClearDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleClearCompleted}>
              Clear
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Storage Limit Dialog */}
      <Portal>
        <Dialog
          visible={storageLimitDialogVisible}
          onDismiss={() => setStorageLimitDialogVisible(false)}
        >
          <Dialog.Title>Storage Limit</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Set the maximum storage space to use for downloads (1-100 GB):
            </Text>
            <TextInput
              label="Storage Limit (GB)"
              value={tempStorageLimit}
              onChangeText={setTempStorageLimit}
              keyboardType="numeric"
              mode="outlined"
              style={styles.textInput}
              error={
                isNaN(parseFloat(tempStorageLimit)) ||
                parseFloat(tempStorageLimit) <= 0
              }
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStorageLimitDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => handleStorageLimitChange(tempStorageLimit)}
              disabled={
                isNaN(parseFloat(tempStorageLimit)) ||
                parseFloat(tempStorageLimit) <= 0
              }
            >
              Set Limit
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const createStyles = (theme: AppTheme, compact: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    sectionTitle: {
      fontWeight: "600",
      marginBottom: spacing.md,
      color: theme.colors.onSurface,
    },
    surface: {
      borderRadius: spacing.md,
      backgroundColor: theme.colors.surface,
    },
    section: {
      padding: spacing.md,
    },
    sectionSubtitle: {
      fontWeight: "600",
      marginBottom: spacing.md,
      color: theme.colors.onSurface,
    },
    segmentedButtons: {
      marginTop: spacing.sm,
    },
    storageSection: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
    },
    storageLabel: {
      marginBottom: spacing.xs,
      color: theme.colors.onSurfaceVariant,
    },
    storageProgress: {
      height: 8,
      borderRadius: 4,
      marginBottom: spacing.xs,
    },
    storageText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    divider: {
      backgroundColor: theme.colors.outlineVariant,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: theme.colors.surfaceVariant,
      padding: spacing.md,
      borderRadius: spacing.md,
      alignItems: "center",
    },
    statNumber: {
      fontWeight: "600",
      color: theme.colors.primary,
      marginBottom: spacing.xs,
    },
    statDescription: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    actionItem: {
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: spacing.sm,
      borderRadius: spacing.md,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: spacing.xl,
    },
    emptyText: {
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    emptySubtext: {
      textAlign: "center",
    },
    dialogText: {
      marginBottom: spacing.md,
    },
    textInput: {
      marginBottom: spacing.md,
    },
    // Compact styles
    compactContainer: {
      marginVertical: spacing.md,
    },
    compactHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    compactStats: {
      flexDirection: "row",
      gap: spacing.lg,
    },
    statItem: {
      alignItems: "center",
    },
    statLabel: {
      color: theme.colors.onSurfaceVariant,
    },
    statValue: {
      color: theme.colors.primary,
    },
    compactDivider: {
      marginTop: spacing.sm,
    },
  });

export default DownloadSettings;
