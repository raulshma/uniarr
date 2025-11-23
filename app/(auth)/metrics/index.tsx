import React, { useState, useMemo } from "react";
import { ScrollView, StyleSheet, View, RefreshControl } from "react-native";
import { Text, useTheme, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { UniArrLoader } from "@/components/common";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/metrics/MetricCard";
import { MetricChart } from "@/components/metrics/MetricChart";
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
import type { MetricDataPoint } from "@/components/metrics/MetricChart";

type TimeRangePreset = "24h" | "7d" | "30d" | "custom";

const MetricsDashboardScreen = () => {
  const theme = useTheme<AppTheme>();
  const [selectedRange, setSelectedRange] = useState<TimeRangePreset>("24h");

  // Get all configured services
  const allConnectors = useConnectorsStore(selectAllConnectorsArray);
  const serviceIds = useMemo(
    () => allConnectors.map((c) => c.config.id),
    [allConnectors],
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

  // Fetch aggregated metrics
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useAggregatedMetrics({
    serviceIds,
    timeRange,
  });

  // Prepare chart data for uptime trends
  const uptimeChartData: MetricDataPoint[] = useMemo(() => {
    if (!metrics?.services) return [];

    return metrics.services.map((service) => ({
      timestamp: new Date(),
      value: service.uptime.percentage,
      label: service.serviceName,
    }));
  }, [metrics]);

  // Prepare chart data for error rates
  const errorRateChartData: MetricDataPoint[] = useMemo(() => {
    if (!metrics?.services) return [];

    return metrics.services.map((service) => ({
      timestamp: new Date(),
      value: service.errors.errorRate,
      label: service.serviceName,
    }));
  }, [metrics]);

  // Activity chart data (currently unused but kept for future feature)
  // const activityChartData: MetricDataPoint[] = useMemo(() => {
  //   if (!metrics?.services) return [];
  //
  //   return metrics.services.map((service) => {
  //     // Calculate total activity across different metrics
  //     const activity =
  //       (service.activity.queueSize ?? 0) +
  //       (service.activity.activeStreams ?? 0) +
  //       (service.activity.activeTorrents ?? 0);
  //
  //     return {
  //       timestamp: new Date(),
  //       value: activity,
  //       label: service.serviceName,
  //     };
  //   });
  // }, [metrics]);

  // Handle service card press to navigate to detail
  const handleServicePress = (serviceId: string) => {
    router.push(`/metrics/${serviceId}`);
  };

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

  if (!metrics || serviceIds.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="chart-line"
          title="No Services Configured"
          description="Add services to start monitoring metrics and performance."
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
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            variant="displaySmall"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Metrics Dashboard
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Performance overview for all services
          </Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.rangeSelectorContainer}>
          <View
            style={[
              styles.rangeSelector,
              { backgroundColor: theme.colors.elevation.level2 },
            ]}
          >
            {(["24h", "7d", "30d"] as TimeRangePreset[]).map((range) => (
              <Button
                key={range}
                mode={selectedRange === range ? "contained" : "text"}
                onPress={() => setSelectedRange(range)}
                style={styles.rangeButton}
                labelStyle={styles.rangeButtonLabel}
                compact
              >
                {range === "24h"
                  ? "24 Hours"
                  : range === "7d"
                    ? "7 Days"
                    : "30 Days"}
              </Button>
            ))}
          </View>
        </View>

        {/* Overall Summary Cards */}
        <View style={styles.summaryRow}>
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
            variant="compact"
            style={styles.summaryCardCompact}
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
            variant="compact"
            style={styles.summaryCardCompact}
          />
        </View>

        <View style={styles.statusRow}>
          <MetricCard
            title="Healthy"
            value={metrics.overall.healthyServices}
            icon="check-circle-outline"
            status="good"
            variant="compact"
            style={styles.statusCard}
          />

          <MetricCard
            title="Degraded"
            value={metrics.overall.degradedServices}
            icon="alert-outline"
            status={metrics.overall.degradedServices > 0 ? "warning" : "good"}
            variant="compact"
            style={styles.statusCard}
          />

          <MetricCard
            title="Offline"
            value={metrics.overall.offlineServices}
            icon="close-circle-outline"
            status={metrics.overall.offlineServices > 0 ? "error" : "good"}
            variant="compact"
            style={styles.statusCard}
          />
        </View>

        {/* Charts Section */}
        <View style={styles.chartSection}>
          <Text
            variant="titleLarge"
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Service Uptime
          </Text>
          {uptimeChartData.length > 0 && (
            <MetricChart
              data={uptimeChartData}
              type="bar"
              yAxisLabel="%"
              height={220}
              color={theme.colors.tertiary}
              style={styles.chart}
            />
          )}
        </View>

        {/* Error Rate Chart */}
        {errorRateChartData.length > 0 && metrics.overall.totalErrors > 0 && (
          <View style={styles.chartSection}>
            <Text
              variant="titleLarge"
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              Error Rates
            </Text>
            <MetricChart
              data={errorRateChartData}
              type="bar"
              yAxisLabel="%"
              height={220}
              color={theme.colors.error}
              style={styles.chart}
            />
          </View>
        )}

        {/* Individual Service Metrics */}
        <View style={styles.servicesSection}>
          <Text
            variant="headlineSmall"
            style={[
              styles.sectionTitle,
              { color: theme.colors.onBackground, marginBottom: spacing.md },
            ]}
          >
            Services
          </Text>

          <View style={styles.serviceList}>
            {metrics.services.map((service) => (
              <MetricCard
                key={service.serviceId}
                title={service.serviceName}
                value={`${service.uptime.percentage.toFixed(1)}%`}
                metricType="uptime"
                status={
                  service.uptime.percentage >= 99
                    ? "good"
                    : service.uptime.percentage >= 95
                      ? "warning"
                      : "error"
                }
                trend={service.uptime.percentage >= 99 ? "stable" : "down"}
                trendValue={
                  service.errors.totalErrors > 0
                    ? `${service.errors.totalErrors} err`
                    : undefined
                }
                onPress={() => handleServicePress(service.serviceId)}
                variant="list"
                style={styles.serviceListItem}
              />
            ))}
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
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
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
    opacity: 0.7,
  },
  rangeSelectorContainer: {
    marginBottom: spacing.sm,
  },
  rangeSelector: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 4,
  },
  rangeButton: {
    flex: 1,
    borderRadius: 20,
  },
  rangeButtonLabel: {
    marginVertical: 8,
    marginHorizontal: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryCardCompact: {
    flex: 1,
    minWidth: 0,
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusCard: {
    flex: 1,
    minWidth: 0,
  },
  chartSection: {
    backgroundColor: "transparent",
    marginTop: spacing.sm,
  },
  chart: {
    borderRadius: 28,
    overflow: "hidden",
  },
  servicesSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  serviceList: {
    gap: spacing.md,
  },
  serviceListItem: {
    // List item styles
  },
});

export default MetricsDashboardScreen;
