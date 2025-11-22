import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  useTheme,
  Icon,
  ActivityIndicator,
  IconButton,
} from "react-native-paper";
import * as Sharing from "expo-sharing";
import Card from "@/components/common/Card/Card";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  MONITORING_SHORTCUTS,
  announceForAccessibility,
} from "@/utils/accessibility/keyboardNavigation.utils";
import type { AppTheme } from "@/constants/theme";
import type {
  ServiceHealthSummary,
  HealthStatus,
  AggregatedHealth,
} from "@/services/health/HealthAggregationService";
import type { HealthMessage } from "@/models/logger.types";
import type { AggregatedMetrics } from "@/services/metrics/MetricsEngine";
import {
  generateHealthReport,
  formatFileSize,
} from "@/utils/reports/reportGenerator.utils";

export interface HealthStatusListProps {
  /**
   * Array of service health summaries to display
   */
  services: ServiceHealthSummary[];

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
   * Callback when a service is pressed
   */
  onServicePress?: (serviceId: string) => void;

  /**
   * Callback when a health message is pressed
   */
  onMessagePress?: (message: HealthMessage) => void;

  /**
   * Full aggregated health data for export
   */
  aggregatedHealth?: AggregatedHealth;

  /**
   * Optional metrics data for export
   */
  metrics?: AggregatedMetrics;

  /**
   * Whether to show export button
   */
  showExport?: boolean;
}

/**
 * Get status icon based on health status
 */
const getStatusIcon = (status: HealthStatus): string => {
  switch (status) {
    case "healthy":
      return "check-circle";
    case "degraded":
      return "alert-circle";
    case "offline":
      return "close-circle";
    case "unknown":
    default:
      return "help-circle";
  }
};

/**
 * Get status color based on health status
 */
const getStatusColor = (status: HealthStatus, theme: AppTheme): string => {
  switch (status) {
    case "healthy":
      return theme.colors.tertiary; // Green
    case "degraded":
      return "#f59e0b"; // Amber
    case "offline":
      return theme.colors.error; // Red
    case "unknown":
    default:
      return theme.colors.onSurfaceVariant; // Gray
  }
};

/**
 * Get severity icon based on message severity
 */
const getSeverityIcon = (severity: HealthMessage["severity"]): string => {
  switch (severity) {
    case "critical":
      return "alert-octagon";
    case "error":
      return "alert-circle";
    case "warning":
      return "alert";
    case "info":
    default:
      return "information";
  }
};

/**
 * Get severity color based on message severity
 */
const getSeverityColor = (
  severity: HealthMessage["severity"],
  theme: AppTheme,
): string => {
  switch (severity) {
    case "critical":
      return theme.colors.error;
    case "error":
      return theme.colors.error;
    case "warning":
      return "#f59e0b"; // Amber
    case "info":
    default:
      return theme.colors.primary;
  }
};

/**
 * HealthStatusList component displays aggregated health status for all services
 *
 * Features:
 * - Display service name, status indicator, and health messages
 * - Support pull-to-refresh
 * - Interactive service cards
 * - Visual severity indicators
 *
 * @example
 * ```tsx
 * <HealthStatusList
 *   services={healthData.services}
 *   isRefreshing={isRefreshing}
 *   onRefresh={handleRefresh}
 *   onServicePress={(id) => navigation.navigate('ServiceHealth', { serviceId: id })}
 * />
 * ```
 */
export const HealthStatusList: React.FC<HealthStatusListProps> = ({
  services,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onServicePress,
  onMessagePress,
  aggregatedHealth,
  metrics,
  showExport = true,
}) => {
  const theme = useTheme<AppTheme>();
  const [isExporting, setIsExporting] = useState(false);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!aggregatedHealth) {
      Alert.alert("No Data", "There is no health data to export.");
      return;
    }

    setIsExporting(true);
    announceForAccessibility("Exporting health report");

    try {
      const result = await generateHealthReport(aggregatedHealth, metrics, {
        format: "html",
        title: "Service Health Report",
        includeMetrics: !!metrics,
        includeHealthMessages: true,
      });

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "text/html",
          dialogTitle: "Export Health Report",
        });
        announceForAccessibility("Health report exported successfully");
      } else {
        Alert.alert(
          "Export Complete",
          `Health report exported successfully (${formatFileSize(result.size)}). File saved to: ${result.uri}`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Export Failed",
        `Failed to export health report: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      announceForAccessibility("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [aggregatedHealth, metrics]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: {
      refresh: {
        ...MONITORING_SHORTCUTS.REFRESH,
        action: () => {
          if (onRefresh && !isRefreshing) {
            onRefresh();
            announceForAccessibility("Refreshing health status");
          }
        },
      },
      export: {
        ...MONITORING_SHORTCUTS.EXPORT,
        action: () => {
          if (aggregatedHealth && !isExporting && services.length > 0) {
            handleExport();
          }
        },
      },
    },
  });

  const renderServiceItem = useCallback(
    ({ item }: { item: ServiceHealthSummary }) => {
      const statusColor = getStatusColor(item.status, theme);
      const statusIcon = getStatusIcon(item.status);

      // Count messages by severity
      const criticalCount = item.messages.filter(
        (m) => m.severity === "critical" || m.severity === "error",
      ).length;
      const warningCount = item.messages.filter(
        (m) => m.severity === "warning",
      ).length;

      return (
        <Card
          variant="default"
          elevation="low"
          contentPadding="sm"
          onPress={() => onServicePress?.(item.serviceId)}
          style={styles.serviceCard}
          accessibilityLabel={`${item.serviceName} - ${item.status}`}
          accessibilityHint="Tap to view detailed health information"
          accessibilityRole="button"
        >
          <View style={styles.serviceHeader}>
            {/* Status indicator */}
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: statusColor + "15" },
              ]}
            >
              <Icon source={statusIcon} size={20} color={statusColor} />
            </View>

            {/* Service info */}
            <View style={styles.serviceInfo}>
              <Text
                variant="titleMedium"
                style={[styles.serviceName, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {item.serviceName}
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.serviceType,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {item.serviceType.toUpperCase()} • {item.status.toUpperCase()}
              </Text>
            </View>

            {/* Message counts */}
            {(criticalCount > 0 || warningCount > 0) && (
              <View style={styles.messageCounts}>
                {criticalCount > 0 && (
                  <View
                    style={[
                      styles.messageCount,
                      { backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.countText,
                        { color: theme.colors.onErrorContainer },
                      ]}
                    >
                      {criticalCount}
                    </Text>
                  </View>
                )}
                {warningCount > 0 && (
                  <View
                    style={[
                      styles.messageCount,
                      { backgroundColor: "#f59e0b20" },
                    ]}
                  >
                    <Text
                      variant="bodySmall"
                      style={[styles.countText, { color: "#f59e0b" }]}
                    >
                      {warningCount}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Health messages preview */}
          {item.messages.length > 0 && (
            <View style={styles.messagesPreview}>
              {item.messages.slice(0, 1).map((message) => (
                <View key={message.id} style={styles.messagePreview}>
                  <Icon
                    source={getSeverityIcon(message.severity)}
                    size={14}
                    color={getSeverityColor(message.severity, theme)}
                  />
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.messageText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {message.message}
                  </Text>
                </View>
              ))}
              {item.messages.length > 1 && (
                <Text
                  variant="bodySmall"
                  style={[styles.moreMessages, { color: theme.colors.primary }]}
                >
                  +{item.messages.length - 1} more issues
                </Text>
              )}
            </View>
          )}
        </Card>
      );
    },
    [theme, onServicePress],
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" />
          <Text
            variant="bodyLarge"
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            Loading health status...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Icon
          source="heart-pulse"
          size={64}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          variant="titleLarge"
          style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
        >
          No Services
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
        >
          Add services to monitor their health status
        </Text>
      </View>
    );
  }, [isLoading, theme]);

  const keyExtractor = useCallback(
    (item: ServiceHealthSummary) => item.serviceId,
    [],
  );

  const renderHeader = useCallback(() => {
    if (!showExport || !aggregatedHealth) {
      return null;
    }

    return (
      <View style={styles.headerActions}>
        <IconButton
          icon="file-export"
          mode="outlined"
          onPress={handleExport}
          disabled={isExporting || services.length === 0}
          accessibilityLabel="Export health report"
          accessibilityHint="Export health status and metrics. Keyboard shortcut: Control+E"
          accessibilityRole="button"
        />
      </View>
    );
  }, [
    showExport,
    aggregatedHealth,
    handleExport,
    isExporting,
    services.length,
  ]);

  return (
    <FlatList
      data={services}
      renderItem={renderServiceItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={[
        styles.listContent,
        services.length === 0 && styles.emptyListContent,
      ]}
      ListEmptyComponent={renderEmptyState}
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
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 12,
    gap: 8,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  serviceCard: {
    marginBottom: 0,
    borderRadius: 26,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusIndicator: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontWeight: "600",
    marginBottom: 0,
    fontSize: 15,
  },
  serviceType: {
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  messageCounts: {
    flexDirection: "row",
    gap: 8,
  },
  messageCount: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  countText: {
    fontWeight: "700",
    fontSize: 11,
  },
  messagesPreview: {
    marginTop: 4,
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  messagePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  messageText: {
    flex: 1,
    fontSize: 12,
  },
  moreMessages: {
    fontWeight: "600",
    fontSize: 11,
    marginTop: 2,
  },
  lastChecked: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
  },
});
