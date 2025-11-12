import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  StyleSheet,
  View,
  TextInput as RNTextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Text,
  useTheme,
  Button,
  Chip,
  Dialog,
  Portal,
  Icon,
  SegmentedButtons,
  Menu,
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedSection,
  UniArrLoader,
} from "@/components/common";
import { AiLogDetailsDrawer } from "@/components/common/CustomDialogs/AiLogDetailsDrawer";
import { alert } from "@/services/dialogService";
import { apiLogger } from "@/services/logger/ApiLoggerService";
import { logger } from "@/services/logger/LoggerService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import type {
  AiApiLogEntry,
  AiLogStats,
  AiHistogramData,
} from "@/models/apiLogger.types";
import * as Sharing from "expo-sharing";
import { PieChart, BarChart } from "react-native-chart-kit";
import { Buffer } from "buffer";

const AiApiLogsScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  shouldAnimateLayout(false, false);

  // State
  const [logs, setLogs] = useState<AiApiLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "duration">(
    "newest",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">(
    "all",
  );
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [showSortDialog, setShowSortDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [stats, setStats] = useState<AiLogStats | null>(null);
  const [providerHistogram] = useState<AiHistogramData[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [isSelectingMultiple, setIsSelectingMultiple] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] =
    useState<AiApiLogEntry | null>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);

  // Load logs on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        setIsLoading(true);
        const loadedLogs = await apiLogger.getAiLogs();
        setLogs(loadedLogs.reverse()); // Show newest first by default

        // Load stats
        const newStats = await apiLogger.getAiStats();
        setStats(newStats);

        setLastRefresh(new Date());
      } catch (error) {
        await alert(
          "Error Loading Logs",
          error instanceof Error ? error.message : "Failed to load AI logs",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadLogs();
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      try {
        const loadedLogs = await apiLogger.getAiLogs();
        setLogs(loadedLogs.reverse());
        const newStats = await apiLogger.getAiStats();
        setStats(newStats);
        setLastRefresh(new Date());
      } catch (error) {
        logger.error("Failed to auto-refresh AI logs", { error });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedLogs = await apiLogger.getAiLogs();
      setLogs(loadedLogs.reverse());
      const newStats = await apiLogger.getAiStats();
      setStats(newStats);
      setLastRefresh(new Date());
    } catch (error) {
      await alert(
        "Refresh Failed",
        error instanceof Error ? error.message : "Failed to refresh AI logs",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToggleLogSelection = useCallback((id: string) => {
    setSelectedLogIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleExportAsJson = useCallback(async () => {
    try {
      const logsToExport =
        selectedLogIds.size > 0
          ? logs.filter((log) => selectedLogIds.has(log.id))
          : logs;

      const jsonData = JSON.stringify(logsToExport, null, 2);
      const base64 = Buffer.from(jsonData).toString("base64");
      const dataUrl = `data:application/json;base64,${base64}`;

      await Sharing.shareAsync(dataUrl, {
        mimeType: "application/json",
        dialogTitle: "Export AI Logs",
        UTI: "public.json",
      });
    } catch (error) {
      await alert(
        "Export Failed",
        error instanceof Error
          ? error.message
          : "Failed to export logs as JSON",
      );
    }
  }, [logs, selectedLogIds]);

  const handleClearSelected = useCallback(async () => {
    if (selectedLogIds.size === 0) return;

    const selectedLogs = logs.filter((log) => selectedLogIds.has(log.id));
    await alert(
      "Clear Logs",
      `Delete ${selectedLogs.length} selected log(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiLogger.deleteAiLogs(Array.from(selectedLogIds));
              setLogs((prev) =>
                prev.filter((log) => !selectedLogIds.has(log.id)),
              );
              setSelectedLogIds(new Set());
              setIsSelectingMultiple(false);
            } catch (error) {
              await alert(
                "Delete Failed",
                error instanceof Error
                  ? error.message
                  : "Failed to delete logs",
              );
            }
          },
        },
      ],
    );
  }, [logs, selectedLogIds]);

  const handleClearAll = useCallback(() => {
    alert(
      "Clear All Logs",
      "This action cannot be undone. Clear all AI logs?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await apiLogger.clearAllAiLogs();
              setLogs([]);
              setSelectedLogIds(new Set());
              setIsSelectingMultiple(false);
              setStats({
                total: 0,
                success: 0,
                failure: 0,
                byProvider: new Map(),
                byModel: new Map(),
                byOperation: new Map(),
                tokenUsage: {
                  prompt: 0,
                  completion: 0,
                  total: 0,
                },
              });
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

  // Filter and sort
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((log) =>
        statusFilter === "success"
          ? log.status === "success"
          : log.status === "error",
      );
    }

    // Filter by provider
    if (providerFilter) {
      filtered = filtered.filter((log) => log.provider === providerFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.provider.toLowerCase().includes(query) ||
          log.model?.toLowerCase().includes(query) ||
          log.operation.toLowerCase().includes(query) ||
          log.errorMessage?.toLowerCase().includes(query),
      );
    }

    // Sort
    if (sortBy === "newest") {
      filtered.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    } else if (sortBy === "oldest") {
      filtered.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    } else if (sortBy === "duration") {
      filtered.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
    }

    return filtered;
  }, [logs, statusFilter, providerFilter, searchQuery, sortBy]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
    },
    searchContainer: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
      alignItems: "center",
    },
    searchInput: {
      flex: 1,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: spacing.md,
      height: 40,
      color: theme.colors.onSurface,
    },
    filterChipContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statsCard: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    statsText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      fontWeight: "500",
    },
    statsNumber: {
      color: theme.colors.onSurface,
      fontSize: 24,
      fontWeight: "700",
      marginTop: spacing.xs,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    logItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
    },
    logItemSuccess: {
      borderLeftColor: theme.colors.primary,
    },
    logItemError: {
      borderLeftColor: theme.colors.error,
    },
    logProvider: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      fontSize: 14,
    },
    logModel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    logMeta: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
      marginTop: spacing.xs,
    },
    logListContainer: {
      flex: 1,
      marginBottom: spacing.lg,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: spacing.xxxl,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      marginTop: spacing.md,
      fontSize: 14,
    },
    chartContainer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    chartTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      fontSize: 14,
      marginBottom: spacing.md,
    },
    refreshContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    lastRefreshText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
    },
    checkboxContainer: {
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <TabHeader
          title="AI API Logs"
          showBackButton
          onBackPress={router.back}
        />
        <View style={styles.content}>
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <UniArrLoader size={60} />
            <Text
              style={{
                marginTop: spacing.md,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              Loading AI logs...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.md * 2 - spacing.md;

  const pieData =
    stats && stats.byProvider.size > 0
      ? Array.from(stats.byProvider.entries())
          .slice(0, 5)
          .map(([provider, count]) => ({
            name: `${provider} (${count})`,
            value: count,
            color: theme.colors.primary,
            legendFontColor: theme.colors.onSurface,
            legendFontSize: 12,
          }))
      : [];

  const barData =
    providerHistogram.length > 0
      ? {
          labels: providerHistogram
            .slice(0, 5)
            .map((item) => item.label.substring(0, 8)),
          datasets: [
            {
              data: providerHistogram.slice(0, 5).map((item) => item.value),
              fillShadowGradient: theme.colors.primary,
              fillShadowGradientOpacity: 1,
              strokeWidth: 0,
              color: () => theme.colors.primary,
            },
          ],
        }
      : { labels: [], datasets: [{ data: [0] }] };

  const chartConfig = {
    backgroundColor: theme.colors.surfaceVariant,
    backgroundGradientFrom: theme.colors.surfaceVariant,
    backgroundGradientTo: theme.colors.surface,
    color: () => theme.colors.onSurfaceVariant,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
  };

  const renderLogItem = (item: AiApiLogEntry) => {
    const isSelected = selectedLogIds.has(item.id);
    const isSuccess = item.status === "success";

    return (
      <AnimatedListItem key={item.id}>
        <TouchableOpacity
          style={[
            styles.logItem,
            isSuccess ? styles.logItemSuccess : styles.logItemError,
          ]}
          onPress={() => {
            if (isSelectingMultiple) {
              handleToggleLogSelection(item.id);
            } else {
              setSelectedLogDetail(item);
              setShowLogDetails(true);
            }
          }}
          onLongPress={() => {
            if (!isSelectingMultiple) {
              setIsSelectingMultiple(true);
              handleToggleLogSelection(item.id);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {isSelectingMultiple && (
              <TouchableOpacity
                onPress={() => handleToggleLogSelection(item.id)}
                style={styles.checkboxContainer}
              >
                <Icon
                  source={
                    isSelected ? "checkbox-marked" : "checkbox-blank-outline"
                  }
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.logProvider}>{item.provider}</Text>
              {item.model && (
                <Text style={styles.logModel}>Model: {item.model}</Text>
              )}
              <Text style={styles.logModel}>Op: {item.operation}</Text>
              <Text style={styles.logMeta}>
                {new Date(item.timestamp).toLocaleString()} •{" "}
                {item.durationMs ? `${item.durationMs}ms` : "N/A"} • Status:{" "}
                {item.status}
                {item.errorMessage && ` • Error: ${item.errorMessage}`}
              </Text>
            </View>
            <Icon
              source={isSuccess ? "check-circle" : "alert-circle"}
              size={24}
              color={isSuccess ? theme.colors.primary : theme.colors.error}
            />
          </View>
        </TouchableOpacity>
      </AnimatedListItem>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <TabHeader title="AI API Logs" showBackButton onBackPress={router.back} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Stats */}
        {stats && (
          <AnimatedSection>
            <View style={styles.statsCard}>
              <Text style={styles.statsText}>Total Calls</Text>
              <Text style={styles.statsNumber}>{stats.total}</Text>
              <View style={styles.statsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Success</Text>
                  <Text
                    style={{
                      ...styles.statsNumber,
                      color: theme.colors.primary,
                      fontSize: 18,
                    }}
                  >
                    {stats.success}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Failed</Text>
                  <Text
                    style={{
                      ...styles.statsNumber,
                      color: theme.colors.error,
                      fontSize: 18,
                    }}
                  >
                    {stats.failure}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Success Rate</Text>
                  <Text
                    style={{
                      ...styles.statsNumber,
                      color: theme.colors.secondary,
                      fontSize: 18,
                    }}
                  >
                    {stats.total > 0
                      ? Math.round((stats.success / stats.total) * 100)
                      : 0}
                    %
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedSection>
        )}

        {/* Token Usage */}
        {stats && stats.tokenUsage.total > 0 && (
          <AnimatedSection>
            <View style={styles.statsCard}>
              <Text style={styles.statsText}>Token Usage</Text>
              <View style={styles.statsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Prompt</Text>
                  <Text style={styles.statsNumber}>
                    {stats.tokenUsage.prompt}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Completion</Text>
                  <Text style={styles.statsNumber}>
                    {stats.tokenUsage.completion}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Total</Text>
                  <Text style={styles.statsNumber}>
                    {stats.tokenUsage.total}
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedSection>
        )}

        {/* Insights Toggle */}
        <Button
          mode="outlined"
          onPress={() => setShowInsights(!showInsights)}
          icon={showInsights ? "chevron-up" : "chevron-down"}
          style={{ marginBottom: spacing.md }}
        >
          {showInsights ? "Hide Insights" : "Show Insights"}
        </Button>

        {/* Charts */}
        {showInsights && (
          <>
            {/* Pie Chart - Provider Distribution */}
            {pieData.length > 0 && (
              <AnimatedSection>
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Calls by Provider</Text>
                  <PieChart
                    data={pieData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    accessor="value"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              </AnimatedSection>
            )}

            {/* Bar Chart - Calls by Provider */}
            {barData.datasets?.[0]?.data &&
              barData.datasets[0].data.length > 0 && (
                <AnimatedSection>
                  <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>
                      Top Providers by Calls
                    </Text>
                    <BarChart
                      data={barData}
                      width={chartWidth}
                      height={220}
                      chartConfig={chartConfig}
                      verticalLabelRotation={30}
                      fromZero
                      yAxisLabel=""
                      yAxisSuffix=""
                    />
                  </View>
                </AnimatedSection>
              )}
          </>
        )}

        {/* Refresh Controls */}
        <View style={styles.refreshContainer}>
          <Button
            mode="outlined"
            onPress={handleRefresh}
            icon="refresh"
            loading={isLoading}
          >
            Refresh
          </Button>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Text style={styles.lastRefreshText}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Text>
            <TouchableOpacity
              onPress={() => setAutoRefresh(!autoRefresh)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Icon
                source={autoRefresh ? "timer" : "timer-off"}
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}
              >
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search and Filters */}
        <View style={styles.searchContainer}>
          <RNTextInput
            style={styles.searchInput}
            placeholder="Search logs..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity onPress={() => setShowFilterDialog(true)}>
            <Icon
              source="filter-variant"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        {(statusFilter !== "all" || providerFilter || sortBy !== "newest") && (
          <View style={styles.filterChipContainer}>
            {statusFilter !== "all" && (
              <Chip icon="close" onClose={() => setStatusFilter("all")}>
                Status: {statusFilter}
              </Chip>
            )}
            {providerFilter && (
              <Chip icon="close" onClose={() => setProviderFilter(null)}>
                Provider: {providerFilter}
              </Chip>
            )}
            {sortBy !== "newest" && (
              <Chip icon="close" onClose={() => setSortBy("newest")}>
                Sort: {sortBy}
              </Chip>
            )}
          </View>
        )}

        {/* Sort & Filter Controls */}
        {!isSelectingMultiple && (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Button
              mode="outlined"
              onPress={() => setShowSortDialog(true)}
              icon="sort"
            >
              Sort
            </Button>
            <Menu
              visible={showExportMenu}
              onDismiss={() => setShowExportMenu(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setShowExportMenu(true)}
                  icon="export"
                >
                  Export
                </Button>
              }
            >
              <Menu.Item
                onPress={() => {
                  void handleExportAsJson();
                  setShowExportMenu(false);
                }}
                title="Export as JSON"
              />
            </Menu>
          </View>
        )}

        {/* Multiple Selection Actions */}
        {isSelectingMultiple && (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Button
              mode="outlined"
              onPress={() => setIsSelectingMultiple(false)}
              icon="close"
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              mode="outlined"
              onPress={handleClearSelected}
              icon="trash-can-outline"
              style={{ flex: 1 }}
            >
              Delete
            </Button>
          </View>
        )}

        {/* Clear All Button */}
        {!isSelectingMultiple && logs.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Button
              mode="text"
              onPress={() => setIsSelectingMultiple(true)}
              icon="checkbox-multiple-marked-outline"
            >
              Select
            </Button>
            <Button
              mode="outlined"
              onPress={handleClearAll}
              icon="trash-can-outline"
            >
              Clear All
            </Button>
          </View>
        )}

        {/* Log List */}
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              source="inbox"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.emptyText}>No AI logs found</Text>
          </View>
        ) : (
          <View style={styles.logListContainer}>
            <FlashList
              data={filteredLogs}
              renderItem={({ item }: { item: AiApiLogEntry }) =>
                renderLogItem(item)
              }
              keyExtractor={(item: AiApiLogEntry) => item.id}
              estimatedItemSize={100}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Sort Dialog */}
      <Portal>
        <Dialog
          visible={showSortDialog}
          onDismiss={() => setShowSortDialog(false)}
        >
          <Dialog.Title>Sort By</Dialog.Title>
          <Dialog.Content>
            <SegmentedButtons
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value as typeof sortBy);
                setShowSortDialog(false);
              }}
              buttons={[
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "duration", label: "Duration" },
              ]}
            />
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Filter Dialog */}
      <Portal>
        <Dialog
          visible={showFilterDialog}
          onDismiss={() => setShowFilterDialog(false)}
        >
          <Dialog.Title>Filters</Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: theme.colors.onSurface,
                fontWeight: "600",
                marginBottom: spacing.md,
              }}
            >
              Status
            </Text>
            <SegmentedButtons
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as typeof statusFilter)
              }
              buttons={[
                { value: "all", label: "All" },
                { value: "success", label: "Success" },
                { value: "error", label: "Error" },
              ]}
              style={{ marginBottom: spacing.lg }}
            />

            <Text
              style={{
                color: theme.colors.onSurface,
                fontWeight: "600",
                marginBottom: spacing.md,
              }}
            >
              Provider
            </Text>
            <SegmentedButtons
              value={providerFilter ?? "all"}
              onValueChange={(value) =>
                setProviderFilter(value === "all" ? null : value)
              }
              buttons={
                stats
                  ? [
                      { value: "all", label: "All" },
                      ...Array.from(stats.byProvider.keys()).map(
                        (provider) => ({
                          value: provider,
                          label: provider,
                        }),
                      ),
                    ]
                  : [{ value: "all", label: "All" }]
              }
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowFilterDialog(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Log Details Drawer */}
      <AiLogDetailsDrawer
        visible={showLogDetails}
        log={selectedLogDetail}
        onDismiss={() => {
          setShowLogDetails(false);
          setSelectedLogDetail(null);
        }}
      />
    </SafeAreaView>
  );
};

export default AiApiLogsScreen;
