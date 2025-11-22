import React, { useState, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  Pressable,
} from "react-native";
import { Text, useTheme, Chip, Divider, Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { UniArrLoader } from "@/components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/metrics/MetricCard";
import { MetricChart } from "@/components/metrics/MetricChart";
import {
  useServiceMetrics,
  useMetricHistory,
  useTimeRangePreset,
  useFormatMetric,
} from "@/hooks/useServiceMetrics";
import { useConnectorsStore } from "@/store/connectorsStore";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { MetricDataPoint } from "@/components/metrics/MetricChart";
import type { MetricType } from "@/services/metrics/MetricsEngine";

type TimeRangePreset = "24h" | "7d" | "30d";

const ServiceMetricsScreen = () => {
  const theme = useTheme<AppTheme>();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const [selectedRange, setSelectedRange] = useState<TimeRangePreset>("24h");
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("errors");

  // Get service connector
  const connector = useConnectorsStore((state) =>
    serviceId ? state.getConnector(serviceId) : undefined,
  );

  // Get time range based on selection
  const timeRange24h = useTimeRangePreset("24h");
  const timeRange7d = useTimeRangePreset("7d");
  const timeRange30d = useTimeRangePreset("30d");

  const timeRange = useMemo(() => {
    switch (selectedRange) {
      case "24h":
        return timeRange24h;
      case "7d":
        return timeRange7d;
      case "30d":
        return timeRange30d;
      default:
        return timeRange24h;
    }
  }, [selectedRange, timeRange24h, timeRange7d, timeRange30d]);

  // Fetch service metrics
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useServiceMetrics(serviceId ?? "", {
    timeRange,
    enabled: !!serviceId,
  });

  // Fetch metric history for selected metric
  const { data: metricHistory, isLoading: isLoadingHistory } = useMetricHistory(
    serviceId ?? "",
    {
      metric: selectedMetric,
      timeRange,
      enabled: !!serviceId,
    },
  );

  // Format metric values
  const formattedUptime = useFormatMetric(
    metrics?.uptime.percentage,
    "percentage",
  );
  const formattedErrorRate = useFormatMetric(
    metrics?.errors.errorRate,
    "percentage",
  );

  // Prepare chart data for metric history
  const historyChartData: MetricDataPoint[] = useMemo(() => {
    if (!metricHistory) return [];
    return metricHistory;
  }, [metricHistory]);

  // Handle drill-down to logs
  const handleDrillDownToLogs = () => {
    if (!serviceId) return;
    router.push(`/logs?serviceId=${serviceId}`);
  };

  // Render service-specific activity metrics
  const ActivityMetrics = useMemo(() => {
    if (!metrics) return null;

    const { activity, serviceType } = metrics;

    // Arr services (Sonarr, Radarr, Lidarr, etc.)
    if (
      serviceType === "sonarr" ||
      serviceType === "radarr" ||
      serviceType === "lidarr" ||
      serviceType === "prowlarr" ||
      serviceType === "bazarr"
    ) {
      return (
        <View style={styles.activityMetrics}>
          <View style={styles.metricRow}>
            <MetricCard
              title="Queue Size"
              value={activity.queueSize ?? 0}
              metricType="activity"
              variant="compact"
              style={styles.activityCard}
            />
            <MetricCard
              title="Processed Items"
              value={activity.processedItems ?? 0}
              metricType="activity"
              variant="compact"
              style={styles.activityCard}
            />
          </View>
          <MetricCard
            title="Failed Imports"
            value={activity.failedImports ?? 0}
            metricType="errors"
            status={
              (activity.failedImports ?? 0) === 0
                ? "good"
                : (activity.failedImports ?? 0) < 5
                  ? "warning"
                  : "error"
            }
            variant="compact"
            style={styles.activityCardFull}
          />
        </View>
      );
    }

    // Jellyfin
    if (serviceType === "jellyfin") {
      return (
        <View style={styles.activityMetrics}>
          <View style={styles.metricRow}>
            <MetricCard
              title="Active Streams"
              value={activity.activeStreams ?? 0}
              metricType="activity"
              variant="compact"
              style={styles.activityCard}
            />
            <MetricCard
              title="Transcoding Sessions"
              value={activity.transcodingSessions ?? 0}
              metricType="activity"
              variant="compact"
              style={styles.activityCard}
            />
          </View>
        </View>
      );
    }

    // Download clients (qBittorrent, Transmission, Deluge)
    if (
      serviceType === "qbittorrent" ||
      serviceType === "transmission" ||
      serviceType === "deluge"
    ) {
      // Format metrics outside of JSX
      const downloadSpeed = activity.downloadSpeed
        ? `${(activity.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s`
        : "0 MB/s";
      const uploadSpeed = activity.uploadSpeed
        ? `${(activity.uploadSpeed / 1024 / 1024).toFixed(1)} MB/s`
        : "0 MB/s";
      const completionRate = activity.completionRate
        ? `${activity.completionRate.toFixed(1)}%`
        : "0%";

      return (
        <View style={styles.activityMetrics}>
          <View style={styles.metricRow}>
            <MetricCard
              title="Active Torrents"
              value={activity.activeTorrents ?? 0}
              metricType="activity"
              variant="compact"
              style={styles.activityCard}
            />
            <MetricCard
              title="Download Speed"
              value={downloadSpeed}
              metricType="performance"
              variant="compact"
              style={styles.activityCard}
            />
          </View>
          <View style={styles.metricRow}>
            <MetricCard
              title="Upload Speed"
              value={uploadSpeed}
              metricType="performance"
              variant="compact"
              style={styles.activityCard}
            />
            <MetricCard
              title="Completion Rate"
              value={completionRate}
              metricType="activity"
              variant="compact"
              style={styles.activityCard}
            />
          </View>
        </View>
      );
    }

    return null;
  }, [metrics]);

  if (!serviceId) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Invalid Service"
          description="No service ID provided"
          actionLabel="Go Back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <UniArrLoader size={80} centered />
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, marginTop: 16 }}
          >
            Loading Metrics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="chart-line"
          title="Failed to Load Metrics"
          description={
            error instanceof Error ? error.message : "Unknown error occurred"
          }
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!metrics || !connector) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Service Not Found"
          description="The requested service could not be found"
          actionLabel="Go Back"
          onActionPress={() => router.back()}
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
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon
              source="arrow-left"
              size={24}
              color={theme.colors.onBackground}
            />
          </Pressable>
          <View style={styles.headerText}>
            <Text
              variant="headlineMedium"
              style={[styles.title, { color: theme.colors.onBackground }]}
            >
              {metrics.serviceName}
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.subtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {metrics.serviceType.charAt(0).toUpperCase() +
                metrics.serviceType.slice(1)}{" "}
              Metrics
            </Text>
          </View>
        </View>

        {/* Time Range Selector */}
        <View style={styles.rangeSelector}>
          {(["24h", "7d", "30d"] as TimeRangePreset[]).map((range) => (
            <Chip
              key={range}
              selected={selectedRange === range}
              onPress={() => setSelectedRange(range)}
              style={[
                styles.rangeChip,
                selectedRange === range && {
                  backgroundColor: theme.colors.primaryContainer,
                },
              ]}
            >
              {range === "24h"
                ? "24 Hours"
                : range === "7d"
                  ? "7 Days"
                  : "30 Days"}
            </Chip>
          ))}
        </View>

        {/* Core Metrics */}
        <View style={styles.section}>
          <Text
            variant="titleLarge"
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Core Metrics
          </Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricRow}>
              <MetricCard
                title="Uptime"
                value={formattedUptime}
                metricType="uptime"
                status={
                  metrics.uptime.percentage >= 99
                    ? "good"
                    : metrics.uptime.percentage >= 95
                      ? "warning"
                      : "error"
                }
                variant="compact"
                style={styles.metricCard}
              />

              <MetricCard
                title="Total Errors"
                value={metrics.errors.totalErrors}
                metricType="errors"
                status={
                  metrics.errors.totalErrors === 0
                    ? "good"
                    : metrics.errors.totalErrors < 10
                      ? "warning"
                      : "error"
                }
                variant="compact"
                style={styles.metricCard}
              />
            </View>

            <View style={styles.metricRow}>
              <MetricCard
                title="Error Rate"
                value={formattedErrorRate}
                metricType="errors"
                status={
                  metrics.errors.errorRate < 1
                    ? "good"
                    : metrics.errors.errorRate < 5
                      ? "warning"
                      : "error"
                }
                variant="compact"
                style={styles.metricCard}
              />

              <MetricCard
                title="Successful Checks"
                value={metrics.uptime.successfulChecks}
                metricType="uptime"
                variant="compact"
                style={styles.metricCard}
              />
            </View>

            <View style={styles.metricRow}>
              <MetricCard
                title="Failed Checks"
                value={metrics.uptime.failedChecks}
                metricType="errors"
                status={
                  metrics.uptime.failedChecks === 0
                    ? "good"
                    : metrics.uptime.failedChecks < 5
                      ? "warning"
                      : "error"
                }
                variant="compact"
                style={styles.metricCard}
              />

              <MetricCard
                title="Request Count"
                value={metrics.performance.requestCount}
                metricType="activity"
                variant="compact"
                style={styles.metricCard}
              />
            </View>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Service-Specific Activity Metrics */}
        <View style={styles.section}>
          <Text
            variant="titleLarge"
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Activity Metrics
          </Text>
          {ActivityMetrics}
        </View>

        <Divider style={styles.divider} />

        {/* Metric History Chart */}
        <View style={styles.section}>
          <Text
            variant="titleLarge"
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Metric History
          </Text>

          {/* Metric Type Selector */}
          <View style={styles.metricSelector}>
            {(["errors", "uptime", "activity"] as MetricType[]).map(
              (metric) => (
                <Chip
                  key={metric}
                  selected={selectedMetric === metric}
                  onPress={() => setSelectedMetric(metric)}
                  style={[
                    styles.metricChip,
                    selectedMetric === metric && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                >
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </Chip>
              ),
            )}
          </View>

          {isLoadingHistory ? (
            <View style={styles.chartLoading}>
              <UniArrLoader size={40} centered />
            </View>
          ) : (
            <MetricChart
              data={historyChartData}
              type="line"
              title={`${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Over Time`}
              height={220}
              color={
                selectedMetric === "errors"
                  ? theme.colors.error
                  : selectedMetric === "uptime"
                    ? theme.colors.tertiary
                    : theme.colors.primary
              }
            />
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Top Errors */}
        {metrics.errors.topErrors.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="titleLarge"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              Top Errors
            </Text>

            <View style={styles.errorsList}>
              {metrics.errors.topErrors.map((error, index) => (
                <View
                  key={index}
                  style={[
                    styles.errorItem,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <View style={styles.errorHeader}>
                    <Icon
                      source="alert-circle"
                      size={20}
                      color={theme.colors.error}
                    />
                    <Text
                      variant="titleSmall"
                      style={[styles.errorCount, { color: theme.colors.error }]}
                    >
                      {error.count}x
                    </Text>
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.errorMessage,
                      { color: theme.colors.onSurface },
                    ]}
                    numberOfLines={2}
                  >
                    {error.message}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Drill-down to Logs */}
        <Pressable
          onPress={handleDrillDownToLogs}
          style={[
            styles.drillDownButton,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View detailed logs"
        >
          <Icon
            source="text-box-search-outline"
            size={24}
            color={theme.colors.onPrimaryContainer}
          />
          <Text
            variant="titleMedium"
            style={[
              styles.drillDownText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            View Detailed Logs
          </Text>
          <Icon
            source="chevron-right"
            size={24}
            color={theme.colors.onPrimaryContainer}
          />
        </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  rangeSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginBottom: spacing.md,
  },
  rangeChip: {
    margin: 0,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  metricsGrid: {
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
  },
  activityMetrics: {
    gap: spacing.md,
  },
  activityCard: {
    flex: 1,
  },
  activityCardFull: {
    width: "100%",
  },
  divider: {
    marginVertical: spacing.md,
  },
  metricSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  metricChip: {
    margin: 0,
  },
  chartLoading: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  errorsList: {
    gap: spacing.sm,
  },
  errorItem: {
    padding: spacing.md,
    borderRadius: 20,
    gap: spacing.sm,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  errorCount: {
    fontWeight: "600",
  },
  errorMessage: {
    lineHeight: 20,
  },
  drillDownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 24,
    marginTop: spacing.md,
  },
  drillDownText: {
    fontWeight: "600",
  },
});

export default ServiceMetricsScreen;
