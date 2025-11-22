import React, { useCallback, useMemo, useState, useRef } from "react";
import { View, StyleSheet, RefreshControl, Alert } from "react-native";
import {
  Text,
  useTheme,
  ActivityIndicator,
  Searchbar,
  IconButton,
  Menu,
} from "react-native-paper";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import * as Sharing from "expo-sharing";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  MONITORING_SHORTCUTS,
  announceForAccessibility,
} from "@/utils/accessibility/keyboardNavigation.utils";
import type { AppTheme } from "@/constants/theme";
import type { ServiceLog, ServiceLogLevel } from "@/models/logger.types";
import EmptyState from "@/components/common/EmptyState/EmptyState";
import { LogEntry } from "./LogEntry";
import { LogFilters as LogFiltersPanel } from "./LogFilters";
import {
  exportLogs,
  checkExportSize,
  formatFileSize,
  type ExportFormat,
} from "@/utils/logs/logExport.utils";

export interface LogViewerProps {
  /**
   * Array of logs to display
   */
  logs: ServiceLog[];

  /**
   * Whether data is currently loading
   */
  isLoading?: boolean;

  /**
   * Whether data is being refreshed
   */
  isRefreshing?: boolean;

  /**
   * Callback when user pulls to refresh
   */
  onRefresh?: () => void;

  /**
   * Callback when a log entry is pressed
   */
  onLogPress?: (log: ServiceLog) => void;

  /**
   * Cache timestamp for offline display
   */
  cacheTimestamp?: Date | null;

  /**
   * Available service IDs for filtering
   */
  availableServices?: { id: string; name: string }[];

  /**
   * Callback when filters change
   */
  onFiltersChange?: (filters: LogFilters) => void;

  /**
   * Initial filters
   */
  initialFilters?: LogFilters;
}

export interface LogFilters {
  serviceIds?: string[];
  levels?: ServiceLogLevel[];
  timeRange?: { start: Date; end: Date };
  searchQuery?: string;
}

/**
 * LogViewer component displays aggregated logs in a virtualized list
 *
 * Features:
 * - Display logs in virtualized list (FlashList)
 * - Support search with debounced input (300ms)
 * - Support filtering by service, severity, and time range
 * - Show cache timestamp when offline
 * - Pull-to-refresh support
 *
 * @example
 * ```tsx
 * <LogViewer
 *   logs={logs}
 *   isRefreshing={isRefreshing}
 *   onRefresh={handleRefresh}
 *   cacheTimestamp={cacheTimestamp}
 *   availableServices={services}
 *   onFiltersChange={handleFiltersChange}
 * />
 * ```
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onLogPress,
  cacheTimestamp,
  availableServices = [],
  onFiltersChange,
  initialFilters,
}) => {
  const theme = useTheme<AppTheme>();
  const { isConnected } = useNetworkStatus();

  // Refs for keyboard navigation
  const searchInputRef = useRef<any>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState(
    initialFilters?.searchQuery || "",
  );
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Filter state
  const [filters, setFilters] = useState<LogFilters>(initialFilters || {});
  const [showFilters, setShowFilters] = useState(false);

  // Export menu state
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Memoized filter functions for better performance
  const applySearchFilter = useCallback(
    (logs: ServiceLog[], query: string): ServiceLog[] => {
      if (!query.trim()) return logs;

      const lowerQuery = query.toLowerCase();
      return logs.filter((log) => {
        const searchableText =
          `${log.message} ${log.logger || ""} ${log.method || ""} ${log.exception || ""}`.toLowerCase();
        return searchableText.includes(lowerQuery);
      });
    },
    [],
  );

  const applyServiceFilter = useCallback(
    (logs: ServiceLog[], serviceIds: string[]): ServiceLog[] => {
      if (serviceIds.length === 0) return logs;
      return logs.filter((log) => serviceIds.includes(log.serviceId));
    },
    [],
  );

  const applyLevelFilter = useCallback(
    (logs: ServiceLog[], levels: ServiceLogLevel[]): ServiceLog[] => {
      if (levels.length === 0) return logs;
      return logs.filter((log) => levels.includes(log.level));
    },
    [],
  );

  const applyTimeRangeFilter = useCallback(
    (
      logs: ServiceLog[],
      timeRange: { start: Date; end: Date },
    ): ServiceLog[] => {
      const startTime = timeRange.start.getTime();
      const endTime = timeRange.end.getTime();
      return logs.filter((log) => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startTime && logTime <= endTime;
      });
    },
    [],
  );

  // Apply filters and search to logs with memoized filter functions
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Apply search
    if (debouncedSearchQuery.trim()) {
      filtered = applySearchFilter(filtered, debouncedSearchQuery);
    }

    // Apply service filter
    if (filters.serviceIds && filters.serviceIds.length > 0) {
      filtered = applyServiceFilter(filtered, filters.serviceIds);
    }

    // Apply level filter
    if (filters.levels && filters.levels.length > 0) {
      filtered = applyLevelFilter(filtered, filters.levels);
    }

    // Apply time range filter
    if (filters.timeRange) {
      filtered = applyTimeRangeFilter(filtered, filters.timeRange);
    }

    return filtered;
  }, [
    logs,
    debouncedSearchQuery,
    filters,
    applySearchFilter,
    applyServiceFilter,
    applyLevelFilter,
    applyTimeRangeFilter,
  ]);

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: LogFilters) => {
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [onFiltersChange],
  );

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery("");
    onFiltersChange?.({});
    announceForAccessibility("All filters cleared");
  }, [onFiltersChange]);

  // Toggle filters
  const handleToggleFilters = useCallback(() => {
    setShowFilters((prev) => {
      const newValue = !prev;
      announceForAccessibility(newValue ? "Filters opened" : "Filters closed");
      return newValue;
    });
  }, []);

  // Focus search
  const handleFocusSearch = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      announceForAccessibility("Search focused");
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: {
      refresh: {
        ...MONITORING_SHORTCUTS.REFRESH,
        action: () => {
          if (onRefresh && !isRefreshing) {
            onRefresh();
            announceForAccessibility("Refreshing logs");
          }
        },
      },
      search: {
        ...MONITORING_SHORTCUTS.SEARCH,
        action: handleFocusSearch,
      },
      filter: {
        ...MONITORING_SHORTCUTS.FILTER,
        action: handleToggleFilters,
      },
      export: {
        ...MONITORING_SHORTCUTS.EXPORT,
        action: () => {
          if (filteredLogs.length > 0 && !isExporting) {
            setExportMenuVisible(true);
            announceForAccessibility("Export menu opened");
          }
        },
      },
      clearFilters: {
        ...MONITORING_SHORTCUTS.CLEAR_FILTERS,
        action: () => {
          if (activeFilterCount > 0 || showFilters) {
            if (showFilters) {
              setShowFilters(false);
            }
            if (activeFilterCount > 0) {
              handleClearFilters();
            }
          }
        },
      },
    },
  });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.serviceIds && filters.serviceIds.length > 0) count++;
    if (filters.levels && filters.levels.length > 0) count++;
    if (filters.timeRange) count++;
    if (debouncedSearchQuery.trim()) count++;
    return count;
  }, [filters, debouncedSearchQuery]);
  const performExport = useCallback(
    async (format: ExportFormat) => {
      setIsExporting(true);

      try {
        const result = await exportLogs(filteredLogs, { format });

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri, {
            mimeType: format === "json" ? "application/json" : "text/plain",
            dialogTitle: "Export Logs",
          });
        } else {
          Alert.alert(
            "Export Complete",
            `Logs exported successfully (${formatFileSize(result.size)}). File saved to: ${result.uri}`,
          );
        }
      } catch (error) {
        Alert.alert(
          "Export Failed",
          `Failed to export logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsExporting(false);
      }
    },
    [filteredLogs],
  );
  // Handle export
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportMenuVisible(false);

      if (filteredLogs.length === 0) {
        Alert.alert("No Logs", "There are no logs to export.");
        return;
      }

      // Check size and warn if needed
      const exceedsSize = checkExportSize(filteredLogs, format);
      if (exceedsSize) {
        Alert.alert(
          "Large Export",
          `This export will be larger than 10MB. Do you want to continue?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              onPress: () => performExport(format),
            },
          ],
        );
      } else {
        await performExport(format);
      }
    },
    [filteredLogs, performExport],
  );

  // Render log entry
  const renderLogEntry = useCallback(
    ({ item, index }: ListRenderItemInfo<ServiceLog>) => {
      return (
        <LogEntry
          log={item}
          onPress={() => onLogPress?.(item)}
          searchQuery={debouncedSearchQuery}
          style={
            index === filteredLogs.length - 1 ? styles.lastItem : undefined
          }
        />
      );
    },
    [onLogPress, debouncedSearchQuery, filteredLogs.length],
  );

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" />
          <Text
            variant="bodyLarge"
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            Loading logs...
          </Text>
        </View>
      );
    }

    if (activeFilterCount > 0) {
      return (
        <EmptyState
          icon="filter-off"
          title="No Matching Logs"
          description="Try adjusting your filters or search query"
          actionLabel="Clear Filters"
          onActionPress={handleClearFilters}
        />
      );
    }

    return (
      <EmptyState
        icon="text-box-outline"
        title="No Logs Available"
        description="Logs will appear here once services start generating them"
      />
    );
  }, [isLoading, activeFilterCount, handleClearFilters, theme]);

  // Render header
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header}>
        {/* Action buttons */}
        <View style={styles.actionBar}>
          <IconButton
            icon="filter"
            mode={showFilters ? "contained" : "outlined"}
            onPress={handleToggleFilters}
            disabled={isExporting}
            accessibilityLabel={showFilters ? "Hide filters" : "Show filters"}
            accessibilityHint={`${activeFilterCount} filters active. Keyboard shortcut: Control+L`}
            accessibilityRole="button"
          />

          <Menu
            visible={exportMenuVisible}
            onDismiss={() => setExportMenuVisible(false)}
            anchor={
              <IconButton
                icon="export"
                mode="outlined"
                onPress={() => setExportMenuVisible(true)}
                disabled={isExporting || filteredLogs.length === 0}
                accessibilityLabel="Export logs"
                accessibilityHint={
                  filteredLogs.length > 0
                    ? `Export ${filteredLogs.length} log entries`
                    : "No logs to export"
                }
                accessibilityRole="button"
              />
            }
          >
            <Menu.Item
              onPress={() => handleExport("json")}
              title="Export as JSON"
              leadingIcon="code-json"
              accessibilityLabel="Export logs as JSON file"
            />
            <Menu.Item
              onPress={() => handleExport("text")}
              title="Export as Text"
              leadingIcon="text"
              accessibilityLabel="Export logs as text file"
            />
          </Menu>
        </View>

        {/* Search bar */}
        <Searchbar
          ref={searchInputRef}
          placeholder="Search logs..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          inputStyle={{ color: theme.colors.onSurface, minHeight: 0 }}
          iconColor={theme.colors.onSurfaceVariant}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          accessibilityLabel="Search logs"
          accessibilityHint="Type to search through log messages. Keyboard shortcut: Control+F"
          accessibilityRole="search"
        />

        {/* Cache timestamp (offline mode) */}
        {!isConnected && cacheTimestamp && (
          <View
            style={[
              styles.cacheInfo,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            accessible
            accessibilityLabel={`Offline mode: Showing cached data from ${new Date(cacheTimestamp).toLocaleString()}`}
            accessibilityRole="text"
          >
            <Text
              variant="bodySmall"
              style={[
                styles.cacheText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Showing cached data from{" "}
              {new Date(cacheTimestamp).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Filter summary */}
        {activeFilterCount > 0 && (
          <View
            style={styles.filterSummary}
            accessible
            accessibilityLabel={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active, showing ${filteredLogs.length} result${filteredLogs.length !== 1 ? "s" : ""}`}
            accessibilityRole="text"
          >
            <Text
              variant="bodySmall"
              style={[
                styles.filterText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}{" "}
              active • {filteredLogs.length} result
              {filteredLogs.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    );
  }, [
    searchQuery,
    handleSearchChange,
    handleToggleFilters,
    isConnected,
    cacheTimestamp,
    activeFilterCount,
    filteredLogs.length,
    theme,
    showFilters,
    exportMenuVisible,
    isExporting,
    handleExport,
  ]);

  const keyExtractor = useCallback((item: ServiceLog) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Filters panel */}
      {showFilters && (
        <LogFiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClose={() => setShowFilters(false)}
          availableServices={availableServices}
        />
      )}

      {/* Log list */}
      <FlashList
        data={filteredLogs}
        renderItem={renderLogEntry}
        keyExtractor={keyExtractor}
        estimatedItemSize={100}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  header: {
    padding: 12,
    gap: 8,
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 4,
  },
  searchBar: {
    elevation: 0,
    borderRadius: 24,
    height: 48,
  },
  cacheInfo: {
    padding: 10,
    borderRadius: 16,
  },
  cacheText: {
    textAlign: "center",
    fontSize: 11,
  },
  filterSummary: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  filterText: {
    fontSize: 11,
  },
  lastItem: {
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    marginTop: 16,
    textAlign: "center",
  },
});
