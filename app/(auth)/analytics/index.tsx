import React, { useState, useMemo } from "react";
import { ScrollView, StyleSheet, View, RefreshControl } from "react-native";
import {
  Text,
  useTheme,
  Card,
  Button,
  Chip,
  Portal,
  Modal,
} from "react-native-paper";
import { SkiaLoader } from "@/components/common/SkiaLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";

import { AnalyticsChart } from "@/components/analytics/AnalyticsChart";
import { EmptyState } from "@/components/common/EmptyState";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { ChartData } from "@/models/analytics.types";
import * as FileSystem from "expo-file-system";
import { writeAsStringAsync } from "expo-file-system";
import * as Sharing from "expo-sharing";

type DateRange = "7d" | "30d" | "90d" | "1y";

const AnalyticsScreen = () => {
  const theme = useTheme<AppTheme>();
  const [selectedRange, setSelectedRange] = useState<DateRange>("30d");
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const analyticsService = AnalyticsService.getInstance();

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const endDate = new Date();
    let startDate: Date;

    switch (selectedRange) {
      case "7d":
        startDate = subDays(endDate, 7);
        break;
      case "90d":
        startDate = subDays(endDate, 90);
        break;
      case "1y":
        startDate = subDays(endDate, 365);
        break;
      default:
        startDate = subDays(endDate, 30);
    }

    return { startDate, endDate };
  }, [selectedRange]);

  // Query for analytics data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["analytics", selectedRange],
    queryFn: () =>
      analyticsService.generateAnalyticsSummary(
        dateRange.startDate,
        dateRange.endDate,
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Prepare chart data for library growth
  const libraryGrowthChartData: ChartData = useMemo(() => {
    if (!analyticsData?.libraryGrowth) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    const recentData = analyticsData.libraryGrowth.slice(-14); // Last 14 days for better readability

    return {
      labels: recentData.map((item) => format(new Date(item.date), "MMM dd")),
      datasets: [
        {
          data: recentData.map((item) => item.totalMedia),
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [analyticsData?.libraryGrowth]);

  // Prepare chart data for download statistics
  const downloadStatsChartData: ChartData = useMemo(() => {
    if (!analyticsData?.downloadStats) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    const recentData = analyticsData.downloadStats.slice(-14);

    return {
      labels: recentData.map((item) => format(new Date(item.date), "MMM dd")),
      datasets: [
        {
          data: recentData.map((item) => item.completed),
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [analyticsData?.downloadStats]);

  // Prepare chart data for quality distribution
  const qualityDistributionChartData: ChartData = useMemo(() => {
    if (!analyticsData?.qualityDistribution) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    return {
      labels: analyticsData.qualityDistribution.map(
        (item) => item.qualityProfile,
      ),
      datasets: [
        {
          data: analyticsData.qualityDistribution.map((item) => item.count),
          color: (opacity = 1) => `rgba(255, 193, 7, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [analyticsData?.qualityDistribution]);

  // Prepare chart data for indexer performance
  const indexerPerformanceChartData: ChartData = useMemo(() => {
    if (!analyticsData?.indexerPerformance) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    return {
      labels: analyticsData.indexerPerformance.map((item) => item.indexerName),
      datasets: [
        {
          data: analyticsData.indexerPerformance.map(
            (item) => item.successRate,
          ),
          color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [analyticsData?.indexerPerformance]);

  // Prepare chart data for activity times
  const activityTimesChartData: ChartData = useMemo(() => {
    if (!analyticsData?.activityTimes) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    return {
      labels: analyticsData.activityTimes.map(
        (item) => `${item.hour.toString().padStart(2, "0")}:00`,
      ),
      datasets: [
        {
          data: analyticsData.activityTimes.map(
            (item) => item.downloads + item.requests,
          ),
          color: (opacity = 1) => `rgba(255, 87, 34, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [analyticsData?.activityTimes]);

  const handleExportCSV = async () => {
    if (!analyticsData) return;

    setIsExporting(true);
    try {
      const csvContent = await analyticsService.exportToCSV(analyticsData);
      const fileName = `uniarr-analytics-${format(
        new Date(),
        "yyyy-MM-dd",
      )}.csv`;
      const docDir = (FileSystem as any).documentDirectory ?? "";
      const fileUri = `${docDir}${fileName}`;

      await writeAsStringAsync(fileUri, csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Analytics Data",
        });
      }
    } catch (error) {
      console.error("Failed to export CSV:", error);
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <SkiaLoader size={80} centered />
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, marginTop: 16 }}
          >
            Loading Analytics...
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
          title="Failed to Load Analytics"
          description={
            error instanceof Error ? error.message : "Unknown error occurred"
          }
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!analyticsData) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="chart-line"
          title="No Analytics Data"
          description="Analytics data will be available once you start using the app with connected services."
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
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Analytics Dashboard
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Insights from your media management setup
          </Text>
        </View>

        {/* Date Range Selector */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.cardTitle, { color: theme.colors.onSurface }]}
            >
              Time Range
            </Text>
            <View style={styles.rangeSelector}>
              {(["7d", "30d", "90d", "1y"] as DateRange[]).map((range) => (
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
                  {range === "7d"
                    ? "7 Days"
                    : range === "30d"
                      ? "30 Days"
                      : range === "90d"
                        ? "90 Days"
                        : "1 Year"}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Summary Cards */}
        <View style={styles.summaryCards}>
          <Card
            style={[
              styles.summaryCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Card.Content style={styles.summaryContent}>
              <Text
                variant="titleSmall"
                style={[
                  styles.summaryLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Total Media
              </Text>
              <Text
                variant="headlineMedium"
                style={[styles.summaryValue, { color: theme.colors.primary }]}
              >
                {analyticsData.libraryGrowth[
                  analyticsData.libraryGrowth.length - 1
                ]?.totalMedia || 0}
              </Text>
            </Card.Content>
          </Card>

          <Card
            style={[
              styles.summaryCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Card.Content style={styles.summaryContent}>
              <Text
                variant="titleSmall"
                style={[
                  styles.summaryLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Downloads (30d)
              </Text>
              <Text
                variant="headlineMedium"
                style={[styles.summaryValue, { color: theme.colors.secondary }]}
              >
                {analyticsData.downloadStats.reduce(
                  (sum, stat) => sum + stat.completed,
                  0,
                )}
              </Text>
            </Card.Content>
          </Card>

          <Card
            style={[
              styles.summaryCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Card.Content style={styles.summaryContent}>
              <Text
                variant="titleSmall"
                style={[
                  styles.summaryLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Active Indexers
              </Text>
              <Text
                variant="headlineMedium"
                style={[styles.summaryValue, { color: theme.colors.tertiary }]}
              >
                {analyticsData.indexerPerformance.length}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Charts */}
        <AnalyticsChart
          title="Library Growth Trend"
          type="line"
          data={libraryGrowthChartData}
          height={220}
        />

        <AnalyticsChart
          title="Download Activity"
          type="bar"
          data={downloadStatsChartData}
          height={220}
        />

        <AnalyticsChart
          title="Quality Distribution"
          type="pie"
          data={qualityDistributionChartData}
          height={220}
        />

        <AnalyticsChart
          title="Indexer Success Rate"
          type="bar"
          data={indexerPerformanceChartData}
          height={220}
        />

        <AnalyticsChart
          title="Activity by Hour"
          type="line"
          data={activityTimesChartData}
          height={220}
        />

        {/* Export Section */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text
              variant="titleMedium"
              style={[styles.cardTitle, { color: theme.colors.onSurface }]}
            >
              Export Data
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.cardSubtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Export your analytics data as a CSV file for further analysis.
            </Text>
            <Button
              mode="contained"
              onPress={() => setShowExportModal(true)}
              style={styles.exportButton}
              loading={isExporting}
            >
              Export to CSV
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Export Modal */}
      <Portal>
        <Modal
          visible={showExportModal}
          onDismiss={() => setShowExportModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text
            variant="titleMedium"
            style={[styles.modalTitle, { color: theme.colors.onSurface }]}
          >
            Export Analytics Data
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.modalText, { color: theme.colors.onSurfaceVariant }]}
          >
            This will export all analytics data including library growth,
            download statistics, and indexer performance to a CSV file.
          </Text>
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowExportModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleExportCSV}
              style={styles.modalButton}
              loading={isExporting}
            >
              Export
            </Button>
          </View>
        </Modal>
      </Portal>
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
    marginBottom: spacing.md,
  },
  title: {
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    elevation: 2,
  },
  cardContent: {
    gap: spacing.md,
  },
  cardTitle: {
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 14,
  },
  rangeSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  rangeChip: {
    margin: 0,
  },
  summaryCards: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    elevation: 1,
  },
  summaryContent: {
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryLabel: {
    textAlign: "center",
  },
  summaryValue: {
    fontWeight: "700",
    textAlign: "center",
  },
  exportButton: {
    marginTop: spacing.sm,
  },
  modal: {
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: 8,
  },
  modalTitle: {
    fontWeight: "600",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalText: {
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-end",
  },
  modalButton: {
    flex: 1,
  },
});

export default AnalyticsScreen;
