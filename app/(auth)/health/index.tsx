import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { UniArrLoader } from "@/components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { HealthStatusList } from "@/components/health/HealthStatusList";
import {
  useAggregatedHealth,
  useRefreshHealth,
} from "@/hooks/useAggregatedHealth";
import {
  useAggregatedMetrics,
  useTimeRangePreset,
} from "@/hooks/useServiceMetrics";
import {
  useConnectorsStore,
  selectAllConnectorsArray,
} from "@/store/connectorsStore";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { HealthMessage } from "@/models/logger.types";

/**
 * Health Status Screen
 *
 * Displays aggregated health status for all configured services.
 *
 * Features:
 * - Display aggregated health status using HealthStatusList
 * - Support pull-to-refresh
 * - Show critical issues prominently
 * - Navigate to service detail on press
 * - Export health reports
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
const HealthStatusScreen = () => {
  const theme = useTheme<AppTheme>();

  // Get all configured services
  const allConnectors = useConnectorsStore(selectAllConnectorsArray);
  const serviceIds = React.useMemo(
    () => allConnectors.map((c) => c.config.id),
    [allConnectors],
  );

  // Fetch aggregated health
  const {
    data: health,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useAggregatedHealth({
    serviceIds,
    refetchInterval: 60000, // 60 seconds
  });

  // Fetch metrics for export (optional)
  const timeRange = useTimeRangePreset("24h");
  const { data: metrics } = useAggregatedMetrics({
    serviceIds,
    timeRange,
  });

  const refreshHealth = useRefreshHealth();

  // Sort services to show critical issues first
  const sortedServices = useMemo(() => {
    if (!health) return [];
    const services = [...health.services];

    // Sort by status priority: offline > degraded > healthy > unknown
    services.sort((a, b) => {
      const statusPriority = {
        offline: 0,
        degraded: 1,
        healthy: 2,
        unknown: 3,
      };

      const aPriority = statusPriority[a.status];
      const bPriority = statusPriority[b.status];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same status, sort by number of critical/error messages
      const aCriticalCount = a.messages.filter(
        (m) => m.severity === "critical" || m.severity === "error",
      ).length;
      const bCriticalCount = b.messages.filter(
        (m) => m.severity === "critical" || m.severity === "error",
      ).length;

      return bCriticalCount - aCriticalCount;
    });

    return services;
  }, [health]);

  // Handle refresh
  const handleRefresh = React.useCallback(async () => {
    await refreshHealth(serviceIds);
  }, [refreshHealth, serviceIds]);

  // Handle service press - navigate to detail
  const handleServicePress = React.useCallback((serviceId: string) => {
    router.push(`/health/${serviceId}`);
  }, []);

  // Handle message press - navigate to wiki URL if available
  const handleMessagePress = React.useCallback((message: HealthMessage) => {
    if (message.wikiUrl) {
      // TODO: Open wiki URL in browser
      console.log("Open wiki URL:", message.wikiUrl);
    }
  }, []);

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
            Loading Health Status...
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
          icon="heart-pulse"
          title="Failed to Load Health Status"
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
  if (!health || serviceIds.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="heart-pulse"
          title="No Services Configured"
          description="Add services to start monitoring their health status."
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
          Service Health
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Monitor the health status of all your services
        </Text>
      </View>

      {/* Critical Issues Banner */}
      {health.criticalIssues.length > 0 && (
        <View
          style={[
            styles.criticalBanner,
            { backgroundColor: theme.colors.errorContainer },
          ]}
        >
          <Text
            variant="titleMedium"
            style={[
              styles.criticalTitle,
              { color: theme.colors.onErrorContainer },
            ]}
          >
            ⚠️ {health.criticalIssues.length} Critical Issue
            {health.criticalIssues.length > 1 ? "s" : ""}
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.criticalSubtitle,
              { color: theme.colors.onErrorContainer },
            ]}
          >
            Tap a service below to view details
          </Text>
        </View>
      )}

      {/* Health Status List */}
      <HealthStatusList
        services={sortedServices}
        isRefreshing={isRefetching}
        onRefresh={handleRefresh}
        onServicePress={handleServicePress}
        onMessagePress={handleMessagePress}
        aggregatedHealth={health}
        metrics={metrics}
        showExport={true}
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
  criticalBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
  },
  criticalTitle: {
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  criticalSubtitle: {
    fontSize: 12,
  },
});

export default HealthStatusScreen;
