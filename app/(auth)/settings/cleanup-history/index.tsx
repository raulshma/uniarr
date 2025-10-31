import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Text,
  useTheme,
  Button,
  Chip,
  Portal,
  Dialog,
  Icon,
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import { AnimatedListItem, AnimatedSection } from "@/components/common";
import { alert } from "@/services/dialogService";
import { logger, LogLevel } from "@/services/logger/LoggerService";
import type { LogEntry } from "@/services/logger/LoggerService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const CleanupHistoryScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  shouldAnimateLayout(false, false);

  // State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [showSortDialog, setShowSortDialog] = useState(false);

  // Load logs on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        setIsLoading(true);
        // Get all logs and filter for cleanup-related entries
        const allLogs = await logger.getLogs();
        const cleanupLogs = allLogs.filter(
          (log) =>
            log.message.includes("[StorageCleanup]") ||
            log.message.includes("[StorageMigration]"),
        );
        setLogs(cleanupLogs);
      } catch (error) {
        await alert(
          "Error Loading Logs",
          error instanceof Error
            ? error.message
            : "Failed to load cleanup logs",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadLogs();
  }, []);

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Sort
    if (sortBy === "oldest") {
      filtered = filtered.reverse();
    }

    return filtered;
  }, [logs, sortBy]);

  const handleClearAll = useCallback(async () => {
    await alert(
      "Clear All Cleanup Logs",
      "Are you sure you want to delete all cleanup history logs? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              const removedCount = await logger.clearByFilter(
                (log) =>
                  log.message.includes("[StorageCleanup]") ||
                  log.message.includes("[StorageMigration]"),
              );

              // Reload logs to reflect changes
              const allLogs = await logger.getLogs();
              const cleanupLogs = allLogs.filter(
                (log) =>
                  log.message.includes("[StorageCleanup]") ||
                  log.message.includes("[StorageMigration]"),
              );
              setLogs(cleanupLogs);

              await alert(
                "Logs Cleared",
                `Successfully removed ${removedCount} cleanup log${removedCount === 1 ? "" : "s"}.`,
              );
            } catch (error) {
              await alert(
                "Clear Failed",
                error instanceof Error ? error.message : "Failed to clear logs",
              );
            }
          },
        },
      ],
    );
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    actionButtonContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
      justifyContent: "space-between",
    },
    controlRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
      justifyContent: "space-between",
      alignItems: "center",
    },
    statsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderColor: theme.colors.outlineVariant,
      borderWidth: 1,
    },
    statsText: {
      fontSize: 14,
      color: theme.colors.onSurface,
      marginBottom: spacing.xs,
    },
    statsNumber: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    logListContainer: {
      flex: 1,
      minHeight: 300,
    },
    logItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
    },
    logItemInfo: {
      borderLeftColor: theme.colors.primary,
    },
    logItemWarn: {
      borderLeftColor: theme.colors.secondary,
    },
    logItemError: {
      borderLeftColor: theme.colors.error,
    },
    logMessage: {
      fontSize: 13,
      color: theme.colors.onSurface,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
    logMeta: {
      fontSize: 11,
      color: theme.colors.outlineVariant,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 200,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      marginTop: spacing.md,
    },
  });

  const renderLogItem = (item: LogEntry) => {
    const level = item.level;

    let colorStyle = {};
    if (level === LogLevel.INFO) colorStyle = styles.logItemInfo;
    else if (level === LogLevel.WARN) colorStyle = styles.logItemWarn;
    else if (level === LogLevel.ERROR) colorStyle = styles.logItemError;

    return (
      <AnimatedListItem key={item.id}>
        <View style={[styles.logItem, colorStyle]}>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logMessage}>{item.message}</Text>
              <Text style={styles.logMeta}>
                {new Date(item.timestamp).toLocaleString()} • {level}
              </Text>
            </View>
          </View>
        </View>
      </AnimatedListItem>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <TabHeader
          title="Cleanup History"
          showBackButton
          onBackPress={router.back}
        />
        <View style={styles.content}>
          <Text>Loading cleanup logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <TabHeader
        title="Cleanup History"
        showBackButton
        onBackPress={router.back}
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Stats */}
        <AnimatedSection>
          <View style={styles.statsCard}>
            <Text style={styles.statsText}>Total Cleanup Operations</Text>
            <Text style={styles.statsNumber}>{logs.length}</Text>
          </View>
        </AnimatedSection>

        {/* Filters & Controls */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.onSurfaceVariant,
                marginBottom: spacing.xs,
              }}
            >
              Sort
            </Text>
            <Button
              mode="outlined"
              onPress={() => setShowSortDialog(true)}
              icon="sort"
            >
              {sortBy === "newest" ? "Newest" : "Oldest"}
            </Button>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonContainer}>
          <Button
            mode="outlined"
            onPress={handleClearAll}
            icon="trash-can-outline"
          >
            Clear All Logs
          </Button>
        </View>

        {/* Log List */}
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              source="broom"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.emptyText}>No cleanup operations logged</Text>
          </View>
        ) : (
          <View style={styles.logListContainer}>
            <FlashList
              data={filteredLogs}
              renderItem={({ item }: { item: LogEntry }) => renderLogItem(item)}
              keyExtractor={(item: LogEntry) => item.id}
              estimatedItemSize={100}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Dialogs */}
      <Portal>
        {/* Sort Dialog */}
        <Dialog
          visible={showSortDialog}
          onDismiss={() => setShowSortDialog(false)}
        >
          <Dialog.Title>Sort By</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: spacing.sm }}>
              <Chip
                selected={sortBy === "newest"}
                onPress={() => {
                  setSortBy("newest");
                  setShowSortDialog(false);
                }}
              >
                Newest First
              </Chip>
              <Chip
                selected={sortBy === "oldest"}
                onPress={() => {
                  setSortBy("oldest");
                  setShowSortDialog(false);
                }}
              >
                Oldest First
              </Chip>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default CleanupHistoryScreen;
