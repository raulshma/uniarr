import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  StyleSheet,
  View,
  TextInput as RNTextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
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
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import { AnimatedListItem, AnimatedSection } from "@/components/common";
import { ErrorDetailModal } from "@/components/common/ErrorDetailModal";
import { alert } from "@/services/dialogService";
import { apiErrorLogger } from "@/services/logger/ApiErrorLoggerService";
import { logger } from "@/services/logger/LoggerService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import type {
  ApiErrorLogEntry,
  HistogramData,
  GroupedErrorStats,
} from "@/models/apiErrorLog.types";
import * as Sharing from "expo-sharing";
import { BarChart, PieChart } from "react-native-chart-kit";

const ApiErrorLogsScreen = () => {
  const theme = useTheme<AppTheme>();
  shouldAnimateLayout(false, false);

  // State
  const [errors, setErrors] = useState<ApiErrorLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "statusCode">(
    "newest",
  );
  const [groupBy, setGroupBy] = useState<
    "none" | "service" | "serviceType" | "endpoint"
  >("none");
  const [isSelectingMultiple, setIsSelectingMultiple] = useState(false);
  const [selectedErrorIds, setSelectedErrorIds] = useState<Set<string>>(
    new Set(),
  );
  const [showSortDialog, setShowSortDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [stats, setStats] = useState<GroupedErrorStats | null>(null);
  const [serviceHistogram, setServiceHistogram] = useState<HistogramData[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [selectedErrorForDetail, setSelectedErrorForDetail] =
    useState<ApiErrorLogEntry | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Load errors on mount
  useEffect(() => {
    const loadErrors = async () => {
      try {
        setIsLoading(true);
        const loadedErrors = await apiErrorLogger.getErrors();
        setErrors(loadedErrors.reverse()); // Show newest first by default

        // Load stats
        const newStats = await apiErrorLogger.getGroupedStats();
        setStats(newStats);

        const serviceHist = await apiErrorLogger.getServiceHistogram();
        setServiceHistogram(serviceHist);
      } catch (error) {
        await alert(
          "Error Loading Logs",
          error instanceof Error ? error.message : "Failed to load error logs",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadErrors();
  }, []);

  // Filter and sort errors
  const filteredErrors = useMemo(() => {
    let filtered = errors;

    // Search filter
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.message.toLowerCase().includes(search) ||
          e.endpoint.toLowerCase().includes(search) ||
          e.operation?.toLowerCase().includes(search),
      );
    }

    // Sort
    if (sortBy === "oldest") {
      filtered = [...filtered].reverse();
    } else if (sortBy === "statusCode") {
      filtered = [...filtered].sort((a, b) => {
        const aStatus = a.statusCode ?? 0;
        const bStatus = b.statusCode ?? 0;
        return bStatus - aStatus;
      });
    }

    return filtered;
  }, [errors, searchQuery, sortBy]);

  // Group errors
  const groupedErrors = useMemo(() => {
    if (groupBy === "none") {
      return filteredErrors.map((e) => ({ header: null, items: [e] }));
    }

    const groups = new Map<string, ApiErrorLogEntry[]>();

    for (const error of filteredErrors) {
      let key: string;

      if (groupBy === "service") {
        key = error.serviceId;
      } else if (groupBy === "serviceType") {
        key = error.serviceType || "Unknown";
      } else {
        // endpoint
        key = error.endpoint;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(error);
    }

    return Array.from(groups.entries()).map(([header, items]) => ({
      header,
      items,
    }));
  }, [filteredErrors, groupBy]);

  const handleToggleErrorSelection = useCallback((id: string) => {
    setSelectedErrorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedErrorIds.size === filteredErrors.length) {
      setSelectedErrorIds(new Set());
    } else {
      setSelectedErrorIds(new Set(filteredErrors.map((e) => e.id)));
    }
  }, [filteredErrors, selectedErrorIds.size]);

  const handleDeleteSelected = useCallback(async () => {
    try {
      await apiErrorLogger.deleteErrors(Array.from(selectedErrorIds));
      setSelectedErrorIds(new Set());
      setIsSelectingMultiple(false);

      // Reload
      const loadedErrors = await apiErrorLogger.getErrors();
      setErrors(loadedErrors.reverse());

      const newStats = await apiErrorLogger.getGroupedStats();
      setStats(newStats);
    } catch (error) {
      await alert(
        "Delete Failed",
        error instanceof Error ? error.message : "Failed to delete errors",
      );
    }
  }, [selectedErrorIds]);

  const handleExportSelected = useCallback(async () => {
    try {
      const selectedErrors = filteredErrors.filter((e) =>
        selectedErrorIds.has(e.id),
      );
      const json = JSON.stringify(selectedErrors, null, 2);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(
          `data:application/json;base64,${Buffer.from(json).toString("base64")}`,
          {
            mimeType: "application/json",
            dialogTitle: "Export Error Logs",
            UTI: "public.json",
          },
        );
      } else {
        await alert("Export Failed", "Sharing is not available on this device");
      }
    } catch (error) {
      await alert(
        "Export Failed",
        error instanceof Error ? error.message : "Failed to export logs",
      );
    }
  }, [filteredErrors, selectedErrorIds]);

  const handleClearAll = useCallback(async () => {
    await alert(
      "Clear All Logs",
      "Are you sure you want to delete all error logs? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await apiErrorLogger.clearAll();
              setErrors([]);
              setSelectedErrorIds(new Set());
              setIsSelectingMultiple(false);
              setStats({
                byService: new Map(),
                byStatusCode: new Map(),
                byEndpoint: new Map(),
                byDate: new Map(),
                byErrorType: {
                  network: 0,
                  server: 0,
                  client: 0,
                  other: 0,
                },
                total: 0,
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

  const handleViewErrorDetail = useCallback(
    async (error: ApiErrorLogEntry) => {
      if (isSelectingMultiple) return;
      setSelectedErrorForDetail(error);
      setIsLoadingDetails(true);
      try {
        const details = await apiErrorLogger.getErrorDetails(error.id);
        setErrorDetails(details);
      } catch (err) {
        await logger.error("Failed to load error details", { error: err });
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [isSelectingMultiple],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    searchContainer: {
      marginBottom: spacing.md,
    },
    searchInput: {
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      fontFamily: "System",
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
    errorListContainer: {
      flex: 1,
      minHeight: 300,
    },
    errorItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
    },
    errorItemNetwork: {
      borderLeftColor: theme.colors.error,
    },
    errorItemServer: {
      borderLeftColor: theme.colors.error,
    },
    errorItemClient: {
      borderLeftColor: theme.colors.tertiary,
    },
    errorItemOther: {
      borderLeftColor: theme.colors.outline,
    },
    errorEndpoint: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      fontFamily: "Courier New",
    },
    errorMessage: {
      fontSize: 13,
      color: theme.colors.onSurface,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
    errorMeta: {
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
    groupHeader: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      paddingLeft: spacing.sm,
    },
    checkboxContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginRight: spacing.md,
    },
    chartContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderColor: theme.colors.outlineVariant,
      borderWidth: 1,
    },
    chartTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: spacing.md,
    },
  });

  // Chart colors
  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: () => theme.colors.outline,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    style: {
      borderRadius: 8,
    },
  };

  const pieData = stats
    ? [
        {
          name: `Server (${stats.byErrorType.server})`,
          value: stats.byErrorType.server,
          color: theme.colors.error,
          legendFontColor: theme.colors.onSurface,
          legendFontSize: 12,
        },
        {
          name: `Client (${stats.byErrorType.client})`,
          value: stats.byErrorType.client,
          color: theme.colors.tertiary,
          legendFontColor: theme.colors.onSurface,
          legendFontSize: 12,
        },
        {
          name: `Network (${stats.byErrorType.network})`,
          value: stats.byErrorType.network,
          color: theme.colors.secondary,
          legendFontColor: theme.colors.onSurface,
          legendFontSize: 12,
        },
        {
          name: `Other (${stats.byErrorType.other})`,
          value: stats.byErrorType.other,
          color: theme.colors.outline,
          legendFontColor: theme.colors.onSurface,
          legendFontSize: 12,
        },
      ].filter((d) => d.value > 0)
    : [];

  const barData = {
    labels: serviceHistogram
      .slice(0, 4)
      .map((item) => item.label.substring(0, 8)),
    datasets: [
      {
        data: serviceHistogram.slice(0, 4).map((item) => item.value),
        fillShadowGradient: theme.colors.primary,
        fillShadowGradientOpacity: 1,
        strokeWidth: 0,
        color: () => theme.colors.primary,
      },
    ],
  };

  const renderErrorItem = (item: ApiErrorLogEntry) => {
    const isSelected = selectedErrorIds.has(item.id);
    const isNetwork = item.isNetworkError;
    const statusCode = item.statusCode ?? "N/A";
    const statusNum = typeof statusCode === "number" ? statusCode : 0;
    const errorType = isNetwork
      ? "network"
      : statusNum < 400
        ? "other"
        : statusNum < 500
          ? "client"
          : "server";

    let colorStyle = {};
    if (errorType === "network") colorStyle = styles.errorItemNetwork;
    else if (errorType === "server") colorStyle = styles.errorItemServer;
    else if (errorType === "client") colorStyle = styles.errorItemClient;
    else colorStyle = styles.errorItemOther;

    return (
      <AnimatedListItem key={item.id}>
        <TouchableOpacity
          style={[styles.errorItem, colorStyle]}
          onPress={() => {
            if (isSelectingMultiple) {
              handleToggleErrorSelection(item.id);
            } else {
              void handleViewErrorDetail(item);
            }
          }}
          onLongPress={() => {
            if (!isSelectingMultiple) {
              setIsSelectingMultiple(true);
              handleToggleErrorSelection(item.id);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {isSelectingMultiple && (
              <TouchableOpacity
                onPress={() => handleToggleErrorSelection(item.id)}
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
              <Text style={styles.errorEndpoint}>{item.endpoint}</Text>
              <Text style={styles.errorMessage} numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={styles.errorMeta}>
                {item.method} • {new Date(item.timestamp).toLocaleString()} •
                Status: {statusCode}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </AnimatedListItem>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <TabHeader title="API Error Logs" showBackButton />
        <View style={styles.content}>
          <Text>Loading error logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.md * 2 - spacing.md;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <TabHeader title="API Error Logs" showBackButton />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Stats */}
        {stats && (
          <AnimatedSection>
            <View style={styles.statsCard}>
              <Text style={styles.statsText}>Total Errors</Text>
              <Text style={styles.statsNumber}>{stats.total}</Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.md,
                  marginTop: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Server 5xx</Text>
                  <Text
                    style={{
                      ...styles.statsNumber,
                      color: theme.colors.error,
                    }}
                  >
                    {stats.byErrorType.server}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Client 4xx</Text>
                  <Text
                    style={{
                      ...styles.statsNumber,
                      color: theme.colors.tertiary,
                    }}
                  >
                    {stats.byErrorType.client}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsText}>Network</Text>
                  <Text
                    style={{
                      ...styles.statsNumber,
                      color: theme.colors.secondary,
                    }}
                  >
                    {stats.byErrorType.network}
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
        >
          {showInsights ? "Hide Insights" : "Show Insights"}
        </Button>

        {/* Charts */}
        {showInsights && (
          <>
            {/* Pie Chart - Error Type Distribution */}
            {pieData.length > 0 && (
              <AnimatedSection>
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Error Type Distribution</Text>
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

            {/* Bar Chart - Errors by Service */}
            {barData.datasets?.[0]?.data &&
              barData.datasets[0].data.length > 0 && (
                <AnimatedSection>
                  <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>
                      Top Services by Errors
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

        {/* Search */}
        <View style={styles.searchContainer}>
          <RNTextInput
            style={styles.searchInput}
            placeholder="Search errors..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

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
              {sortBy === "newest"
                ? "Newest"
                : sortBy === "oldest"
                  ? "Oldest"
                  : "By Status"}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.onSurfaceVariant,
                marginBottom: spacing.xs,
              }}
            >
              Group
            </Text>
            <Button
              mode="outlined"
              onPress={() => setShowGroupDialog(true)}
              icon="folder-group"
            >
              {groupBy === "none"
                ? "None"
                : groupBy === "service"
                  ? "Service"
                  : groupBy === "serviceType"
                    ? "Type"
                    : "Endpoint"}
            </Button>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonContainer}>
          {isSelectingMultiple && (
            <>
              <Button mode="text" onPress={handleSelectAll}>
                {selectedErrorIds.size === filteredErrors.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              {selectedErrorIds.size > 0 && (
                <>
                  <Button
                    mode="outlined"
                    onPress={handleExportSelected}
                    icon="download"
                  >
                    Export
                  </Button>
                  <Button
                    mode="contained"
                    buttonColor={theme.colors.error}
                    onPress={() => setShowDeleteDialog(true)}
                    icon="trash-can"
                  >
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
          {!isSelectingMultiple && (
            <>
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
            </>
          )}
        </View>

        {/* Error List */}
        {filteredErrors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              source="inbox"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.emptyText}>No error logs found</Text>
          </View>
        ) : (
          <View style={styles.errorListContainer}>
            {groupBy === "none" ? (
              <FlashList
                data={filteredErrors}
                renderItem={({ item }: { item: ApiErrorLogEntry }) =>
                  renderErrorItem(item)
                }
                keyExtractor={(item: ApiErrorLogEntry) => item.id}
                estimatedItemSize={100}
                scrollEnabled={false}
              />
            ) : (
              <View>
                {groupedErrors.map((group, idx) => (
                  <View key={`group-${idx}`}>
                    {group.header && (
                      <Text style={styles.groupHeader}>{group.header}</Text>
                    )}
                    <FlashList
                      data={group.items}
                      renderItem={({ item }: { item: ApiErrorLogEntry }) =>
                        renderErrorItem(item)
                      }
                      keyExtractor={(item: ApiErrorLogEntry) => item.id}
                      estimatedItemSize={100}
                      scrollEnabled={false}
                    />
                  </View>
                ))}
              </View>
            )}
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
              <Chip
                selected={sortBy === "statusCode"}
                onPress={() => {
                  setSortBy("statusCode");
                  setShowSortDialog(false);
                }}
              >
                By Status Code
              </Chip>
            </View>
          </Dialog.Content>
        </Dialog>

        {/* Group Dialog */}
        <Dialog
          visible={showGroupDialog}
          onDismiss={() => setShowGroupDialog(false)}
        >
          <Dialog.Title>Group By</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: spacing.sm }}>
              <Chip
                selected={groupBy === "none"}
                onPress={() => {
                  setGroupBy("none");
                  setShowGroupDialog(false);
                }}
              >
                None
              </Chip>
              <Chip
                selected={groupBy === "service"}
                onPress={() => {
                  setGroupBy("service");
                  setShowGroupDialog(false);
                }}
              >
                By Service
              </Chip>
              <Chip
                selected={groupBy === "serviceType"}
                onPress={() => {
                  setGroupBy("serviceType");
                  setShowGroupDialog(false);
                }}
              >
                By Service Type
              </Chip>
              <Chip
                selected={groupBy === "endpoint"}
                onPress={() => {
                  setGroupBy("endpoint");
                  setShowGroupDialog(false);
                }}
              >
                By Endpoint
              </Chip>
            </View>
          </Dialog.Content>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          visible={showDeleteDialog}
          onDismiss={() => setShowDeleteDialog(false)}
        >
          <Dialog.Title>Delete Errors?</Dialog.Title>
          <Dialog.Content>
            <Text>
              This will permanently delete {selectedErrorIds.size} selected
              error log{selectedErrorIds.size !== 1 ? "s" : ""}.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              onPress={async () => {
                setShowDeleteDialog(false);
                await handleDeleteSelected();
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Error Detail Modal */}
      {selectedErrorForDetail && (
        <Modal
          visible={!!selectedErrorForDetail}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            setSelectedErrorForDetail(null);
            setErrorDetails(null);
          }}
        >
          <ErrorDetailModal
            error={selectedErrorForDetail}
            details={errorDetails}
            isLoading={isLoadingDetails}
            onClose={() => {
              setSelectedErrorForDetail(null);
              setErrorDetails(null);
            }}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
};

export default ApiErrorLogsScreen;
