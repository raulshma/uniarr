import { useState, useMemo, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  Pressable,
} from "react-native";
import { Text, useTheme, Card, Chip, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { UniArrLoader } from "@/components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/metrics/MetricCard";
import {
  useAggregatedHealth,
  useRefreshHealth,
} from "@/hooks/useAggregatedHealth";
import { useServiceLogs, useRefreshLogs } from "@/hooks/useServiceLogs";
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
import type { ServiceLog, ServiceLogLevel } from "@/models/logger.types";
import type { HealthStatus } from "@/services/health/HealthAggregationService";

/**
 * Monitoring Hub Screen
 *
 * Central monitoring dashboard providing quick overview of:
 * - Health status across all services
 * - Recent critical logs
 * - Key metrics summary
 * - Navigation to detailed screens
 *
 * Requirements: 1.1, 2.1, 5.1
 */
const MonitoringHubScreen = () => {
  const theme = useTheme<AppTheme>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get all configured services
  const allConnectors = useConnectorsStore(selectAllConnectorsArray);
  const serviceIds = useMemo(
    () => allConnectors.map((c) => c.config.id),
    [allConnectors],
  );

  // Fetch aggregated health
  const {
    data: health,
    isLoading: isHealthLoading,
    error: healthError,
  } = useAggregatedHealth({
    serviceIds,
    refetchInterval: 60000, // 60 seconds
  });

  // Fetch recent critical logs
  const {
    data: logsData,
    isLoading: isLogsLoading,
    error: logsError,
  } = useServiceLogs({
    serviceIds,
    level: ["error", "fatal"],
    limit: 10,
  });

  // Fetch metrics for 24h
  const timeRange = useTimeRangePreset("24h");
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    error: metricsError,
  } = useAggregatedMetrics({
    serviceIds,
    timeRange,
  });

  const refreshHealth = useRefreshHealth();
  const refreshLogs = useRefreshLogs();

  // Extract logs from query result
  const criticalLogs = useMemo(() => {
    if (!logsData) return [];
    if ("logs" in logsData) {
      return logsData.logs;
    }
    return [];
  }, [logsData]);

  // Handle refresh all data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshHealth(serviceIds), refreshLogs(serviceIds)]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshHealth, refreshLogs, serviceIds]);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    if (!health) {
      return { healthy: 0, degraded: 0, offline: 0, unknown: 0 };
    }

    return health.services.reduce(
      (acc, service) => {
        acc[service.status] = (acc[service.status] || 0) + 1;
        return acc;
      },
      { healthy: 0, degraded: 0, offline: 0, unknown: 0 } as Record<
        HealthStatus,
        number
      >,
    );
  }, [health]);

  // Get severity color
  const getSeverityColor = (level: ServiceLogLevel): string => {
    switch (level) {
      case "fatal":
      case "error":
        return theme.colors.error;
      case "warn":
        return theme.colors.tertiary;
      case "info":
        return theme.colors.primary;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  // Get status color
  const getStatusColor = (status: HealthStatus): string => {
    switch (status) {
      case "healthy":
        return theme.colors.tertiary;
      case "degraded":
        return theme.colors.tertiary;
      case "offline":
        return theme.colors.error;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  // Loading state
  const isLoading = isHealthLoading || isLogsLoading || isMetricsLoading;

  if (isLoading && !health && !logsData && !metrics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <UniArrLoader size={80} centered />
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, marginTop: 16 }}
          >
            Loading Monitoring Data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // No services configured
  if (serviceIds.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="monitor-dashboard"
          title="No Services Configured"
          description="Add services to start monitoring their health, logs, and metrics."
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Monitoring Hub
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Quick overview of your services
          </Text>
        </View>

        {/* Critical Issues Alert */}
        {health && health.criticalIssues.length > 0 && (
          <Pressable onPress={() => router.push("/health")}>
            <Card
              style={[
                styles.alertCard,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <Card.Content>
                <View style={styles.alertContent}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={24}
                    color={theme.colors.onErrorContainer}
                  />
                  <View style={styles.alertText}>
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.alertTitle,
                        { color: theme.colors.onErrorContainer },
                      ]}
                    >
                      {health.criticalIssues.length} Critical Issue
                      {health.criticalIssues.length > 1 ? "s" : ""}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onErrorContainer }}
                    >
                      Tap to view details
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={theme.colors.onErrorContainer}
                  />
                </View>
              </Card.Content>
            </Card>
          </Pressable>
        )}

        {/* Health Status Overview */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="heart-pulse"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text
                  variant="titleLarge"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Health Status
                </Text>
              </View>
              <Pressable onPress={() => router.push("/health")}>
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.primary }}
                >
                  View All
                </Text>
              </Pressable>
            </View>

            {healthError ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error, marginTop: spacing.sm }}
              >
                Failed to load health status
              </Text>
            ) : health ? (
              <>
                <View style={styles.statusGrid}>
                  <View style={styles.statusItem}>
                    <Text
                      variant="displaySmall"
                      style={[
                        styles.statusValue,
                        { color: getStatusColor("healthy") },
                      ]}
                    >
                      {statusCounts.healthy}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Healthy
                    </Text>
                  </View>

                  <View style={styles.statusItem}>
                    <Text
                      variant="displaySmall"
                      style={[
                        styles.statusValue,
                        { color: getStatusColor("degraded") },
                      ]}
                    >
                      {statusCounts.degraded}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Degraded
                    </Text>
                  </View>

                  <View style={styles.statusItem}>
                    <Text
                      variant="displaySmall"
                      style={[
                        styles.statusValue,
                        { color: getStatusColor("offline") },
                      ]}
                    >
                      {statusCounts.offline}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Offline
                    </Text>
                  </View>
                </View>

                {health.warnings.length > 0 && (
                  <View style={styles.warningsSection}>
                    <Text
                      variant="labelMedium"
                      style={[
                        styles.warningsTitle,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {health.warnings.length} Warning
                      {health.warnings.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <UniArrLoader size={40} centered />
            )}
          </Card.Content>
        </Card>

        {/* Recent Critical Logs */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="text-box-outline"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text
                  variant="titleLarge"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Recent Critical Logs
                </Text>
              </View>
              <Pressable onPress={() => router.push("/logs")}>
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.primary }}
                >
                  View All
                </Text>
              </Pressable>
            </View>

            {logsError ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error, marginTop: spacing.sm }}
              >
                Failed to load logs
              </Text>
            ) : criticalLogs.length > 0 ? (
              <View style={styles.logsList}>
                {criticalLogs
                  .slice(0, 5)
                  .map((log: ServiceLog, index: number) => (
                    <View key={log.id}>
                      {index > 0 && <Divider style={styles.logDivider} />}
                      <Pressable
                        onPress={() => router.push("/logs")}
                        style={styles.logItem}
                      >
                        <View style={styles.logHeader}>
                          <Chip
                            compact
                            style={[
                              styles.logLevelChip,
                              {
                                backgroundColor:
                                  getSeverityColor(log.level) + "20",
                              },
                            ]}
                            textStyle={{ color: getSeverityColor(log.level) }}
                          >
                            {log.level.toUpperCase()}
                          </Chip>
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            {log.serviceName}
                          </Text>
                        </View>
                        <Text
                          variant="bodyMedium"
                          numberOfLines={2}
                          style={[
                            styles.logMessage,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {log.message}
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {new Date(log.timestamp).toLocaleString()}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
              </View>
            ) : (
              <Text
                variant="bodyMedium"
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                No critical logs in the last 24 hours
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Key Metrics Summary */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="chart-line"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text
                  variant="titleLarge"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Key Metrics (24h)
                </Text>
              </View>
              <Pressable onPress={() => router.push("/metrics")}>
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.primary }}
                >
                  View All
                </Text>
              </Pressable>
            </View>

            {metricsError ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error, marginTop: spacing.sm }}
              >
                Failed to load metrics
              </Text>
            ) : metrics ? (
              <View style={styles.metricsGrid}>
                <MetricCard
                  title="Avg Uptime"
                  value={`${metrics.overall.averageUptime.toFixed(1)}%`}
                  metricType="uptime"
                  status={
                    metrics.overall.averageUptime >= 99
                      ? "good"
                      : metrics.overall.averageUptime >= 95
                        ? "warning"
                        : "error"
                  }
                  style={styles.metricCard}
                />

                <MetricCard
                  title="Total Errors"
                  value={metrics.overall.totalErrors}
                  metricType="errors"
                  status={
                    metrics.overall.totalErrors === 0
                      ? "good"
                      : metrics.overall.totalErrors < 10
                        ? "warning"
                        : "error"
                  }
                  style={styles.metricCard}
                />

                <MetricCard
                  title="Healthy"
                  value={metrics.overall.healthyServices}
                  icon="check-circle-outline"
                  status="good"
                  style={styles.metricCard}
                />

                <MetricCard
                  title="Degraded"
                  value={metrics.overall.degradedServices}
                  icon="alert-outline"
                  status={
                    metrics.overall.degradedServices > 0 ? "warning" : "good"
                  }
                  style={styles.metricCard}
                />
              </View>
            ) : (
              <UniArrLoader size={40} centered />
            )}
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text
            variant="titleMedium"
            style={[
              styles.quickActionsTitle,
              { color: theme.colors.onSurface },
            ]}
          >
            Quick Actions
          </Text>

          <View style={styles.actionButtons}>
            <Pressable
              onPress={() => router.push("/health")}
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="heart-pulse"
                size={32}
                color={theme.colors.onPrimaryContainer}
              />
              <Text
                variant="labelLarge"
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.onPrimaryContainer },
                ]}
              >
                Health Status
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/logs")}
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.secondaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="text-box-outline"
                size={32}
                color={theme.colors.onSecondaryContainer}
              />
              <Text
                variant="labelLarge"
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.onSecondaryContainer },
                ]}
              >
                Service Logs
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/metrics")}
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.tertiaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="chart-line"
                size={32}
                color={theme.colors.onTertiaryContainer}
              />
              <Text
                variant="labelLarge"
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.onTertiaryContainer },
                ]}
              >
                Metrics
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  alertCard: {
    marginBottom: spacing.sm,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  alertText: {
    flex: 1,
  },
  alertTitle: {
    fontWeight: "600",
    marginBottom: spacing.xs / 2,
  },
  sectionCard: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  statusGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: spacing.sm,
  },
  statusItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  statusValue: {
    fontWeight: "700",
  },
  warningsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  warningsTitle: {
    fontWeight: "500",
  },
  logsList: {
    marginTop: spacing.sm,
  },
  logItem: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logLevelChip: {
    height: 24,
  },
  logMessage: {
    lineHeight: 20,
  },
  logDivider: {
    marginVertical: spacing.xs,
  },
  emptyText: {
    marginTop: spacing.sm,
    textAlign: "center",
    fontStyle: "italic",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
  },
  quickActions: {
    marginTop: spacing.sm,
  },
  quickActionsTitle: {
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButtonText: {
    fontWeight: "600",
    textAlign: "center",
  },
});

export default MonitoringHubScreen;
