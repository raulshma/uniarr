import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { UniArrLoader } from "@/components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { LogViewer, type LogFilters } from "@/components/logs/LogViewer";
import { LogPatternList } from "@/components/logs/LogPatternList";
import {
  useServiceLogs,
  useLogCacheTimestamp,
  useRefreshLogs,
} from "@/hooks/useServiceLogs";
import {
  useLogPatterns,
  usePatternSelection,
  useFilterLogsByPattern,
} from "@/hooks/useLogPatterns";
import {
  useConnectorsStore,
  selectAllConnectorsArray,
} from "@/store/connectorsStore";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { LogPattern } from "@/services/logs/LogAggregationService";

/**
 * Logs Screen
 *
 * Displays aggregated logs from all configured services.
 *
 * Features:
 * - Display aggregated logs using LogViewer
 * - Support search, filtering, and pattern analysis
 * - Show cache status when offline
 * - Pull-to-refresh support
 * - Export functionality
 *
 * Requirements: 2.1, 2.2, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5,
 *               7.1, 7.2, 7.4, 9.1, 9.2, 9.3
 */
const LogsScreen = () => {
  const theme = useTheme<AppTheme>();

  // Get all configured services
  const allConnectors = useConnectorsStore(selectAllConnectorsArray);
  const serviceIds = useMemo(
    () => allConnectors.map((c) => c.config.id),
    [allConnectors],
  );

  // Available services for filtering
  const availableServices = useMemo(
    () =>
      allConnectors.map((c) => ({
        id: c.config.id,
        name: c.config.name,
      })),
    [allConnectors],
  );

  // Filter state
  const [filters, setFilters] = useState<LogFilters>({});
  const showPatterns = false; // Pattern analysis feature - to be implemented

  // Pattern selection
  const { selectedPattern, selectPattern, clearSelection } =
    usePatternSelection();

  // Fetch logs
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useServiceLogs({
    serviceIds: filters.serviceIds || serviceIds,
    level: filters.levels,
    since: filters.timeRange?.start,
    until: filters.timeRange?.end,
    limit: 1000,
  });

  // Fetch patterns
  const { data: patterns, isLoading: isPatternsLoading } = useLogPatterns({
    serviceIds: filters.serviceIds || serviceIds,
    level: filters.levels,
    since: filters.timeRange?.start,
    until: filters.timeRange?.end,
    minCount: 2,
    maxPatterns: 20,
    enabled: showPatterns,
  });

  // Get cache timestamp
  const cacheTimestamp = useLogCacheTimestamp(filters.serviceIds || serviceIds);

  const refreshLogs = useRefreshLogs();

  // Extract logs from the query result
  const allLogs = useMemo(() => {
    if (!logsData) return [];

    // Handle both regular and infinite query results
    if ("logs" in logsData) {
      return logsData.logs;
    }

    return [];
  }, [logsData]);

  // Filter logs by selected pattern
  const logs = useFilterLogsByPattern(allLogs, selectedPattern);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refreshLogs(filters.serviceIds || serviceIds);
  }, [refreshLogs, filters.serviceIds, serviceIds]);

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: LogFilters) => {
      setFilters(newFilters);
      // Clear pattern selection when filters change
      if (selectedPattern) {
        clearSelection();
      }
    },
    [selectedPattern, clearSelection],
  );

  // Handle pattern selection
  const handlePatternSelect = useCallback(
    (pattern: LogPattern) => {
      if (selectedPattern?.id === pattern.id) {
        clearSelection();
      } else {
        selectPattern(pattern);
      }
    },
    [selectedPattern, selectPattern, clearSelection],
  );

  // Handle pattern toggle (currently unused but kept for future feature)
  // const handleTogglePatterns = useCallback(() => {
  //   setShowPatterns(!showPatterns);
  //   if (showPatterns && selectedPattern) {
  //     clearSelection();
  //   }
  // }, [showPatterns, selectedPattern, clearSelection]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <UniArrLoader size={80} centered />
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, marginTop: 16 }}
          >
            Loading Logs...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="text-box-outline"
          title="Failed to Load Logs"
          description={
            error instanceof Error ? error.message : "Unknown error occurred"
          }
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  // No services configured
  if (serviceIds.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="text-box-outline"
          title="No Services Configured"
          description="Add services to start viewing their logs."
          actionLabel="Add Service"
          onActionPress={() => router.push("/add-service")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          Service Logs
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Aggregated logs from all services
        </Text>
      </View>

      {/* Pattern Analysis Section */}
      {showPatterns && (
        <View style={styles.patternsSection}>
          <LogPatternList
            patterns={patterns || []}
            isLoading={isPatternsLoading}
            selectedPatternId={selectedPattern?.id}
            onPatternSelect={handlePatternSelect}
          />
        </View>
      )}

      {/* Log Viewer */}
      <LogViewer
        logs={logs}
        isLoading={isLoading}
        isRefreshing={isRefetching}
        onRefresh={handleRefresh}
        cacheTimestamp={cacheTimestamp}
        availableServices={availableServices}
        onFiltersChange={handleFiltersChange}
        initialFilters={filters}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  patternsSection: {
    maxHeight: 300,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
});

export default LogsScreen;
