import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text, useTheme, Icon, SegmentedButtons } from "react-native-paper";
import Card from "@/components/common/Card/Card";
import { HealthMessageCard } from "./HealthMessageCard";
import type { AppTheme } from "@/constants/theme";
import type {
  ServiceHealthDetail as ServiceHealthDetailType,
  HealthStatus,
} from "@/services/health/HealthAggregationService";
import type { HealthMessage } from "@/models/logger.types";

export interface ServiceHealthDetailProps {
  /**
   * Service health detail data
   */
  healthDetail: ServiceHealthDetailType;

  /**
   * Custom style for the container
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Callback when a health message is pressed
   */
  onMessagePress?: (message: HealthMessage) => void;
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
 * Get status label based on health status
 */
const getStatusLabel = (status: HealthStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

type SeverityFilter = "all" | "critical" | "error" | "warning" | "info";

/**
 * ServiceHealthDetail component shows detailed health information for a single service
 *
 * Features:
 * - Display service status with visual indicator
 * - Show all health messages with filtering by severity
 * - Support message interaction
 * - Display service metadata (type, last checked)
 *
 * @example
 * ```tsx
 * <ServiceHealthDetail
 *   healthDetail={serviceHealth}
 *   onMessagePress={(message) => console.log('Message pressed:', message)}
 * />
 * ```
 */
export const ServiceHealthDetail: React.FC<ServiceHealthDetailProps> = ({
  healthDetail,
  style,
  onMessagePress,
}) => {
  const theme = useTheme<AppTheme>();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const statusColor = getStatusColor(healthDetail.status, theme);
  const statusIcon = getStatusIcon(healthDetail.status);
  const statusLabel = getStatusLabel(healthDetail.status);

  // Count messages by severity
  const messageCounts = useMemo(() => {
    const counts = {
      all: healthDetail.messages.length,
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    healthDetail.messages.forEach((message) => {
      if (message.severity === "critical") {
        counts.critical++;
      } else if (message.severity === "error") {
        counts.error++;
      } else if (message.severity === "warning") {
        counts.warning++;
      } else if (message.severity === "info") {
        counts.info++;
      }
    });

    return counts;
  }, [healthDetail.messages]);

  // Filter messages based on selected severity
  const filteredMessages = useMemo(() => {
    if (severityFilter === "all") {
      return healthDetail.messages;
    }

    return healthDetail.messages.filter((message) => {
      if (severityFilter === "critical") {
        return message.severity === "critical";
      } else if (severityFilter === "error") {
        return message.severity === "error";
      } else if (severityFilter === "warning") {
        return message.severity === "warning";
      } else if (severityFilter === "info") {
        return message.severity === "info";
      }
      return true;
    });
  }, [healthDetail.messages, severityFilter]);

  const handleMessagePress = useCallback(
    (message: HealthMessage) => {
      onMessagePress?.(message);
    },
    [onMessagePress],
  );

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Service status card */}
      <Card
        variant="default"
        elevation="medium"
        contentPadding="lg"
        style={styles.statusCard}
        accessible
        accessibilityLabel={`${healthDetail.serviceName} service status: ${statusLabel}${healthDetail.uptime !== undefined ? `, uptime ${healthDetail.uptime.toFixed(1)} percent` : ""}`}
        accessibilityRole="summary"
      >
        <View style={styles.statusHeader}>
          <Icon source={statusIcon} size={48} color={statusColor} />
          <View style={styles.statusInfo}>
            <Text
              variant="headlineSmall"
              style={[styles.serviceName, { color: theme.colors.onSurface }]}
              accessibilityRole="header"
            >
              {healthDetail.serviceName}
            </Text>
            <Text
              variant="titleMedium"
              style={[styles.statusLabel, { color: statusColor }]}
              accessibilityLabel={`Service status: ${statusLabel}`}
            >
              {statusLabel}
            </Text>
            <Text
              variant="bodySmall"
              style={[
                styles.serviceType,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {healthDetail.serviceType.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Last checked */}
        <View
          style={styles.metadataRow}
          accessible
          accessibilityLabel={`Last checked: ${new Date(healthDetail.lastChecked).toLocaleString()}`}
          accessibilityRole="text"
        >
          <Icon
            source="clock-outline"
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="bodySmall"
            style={[
              styles.metadataText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Last checked: {new Date(healthDetail.lastChecked).toLocaleString()}
          </Text>
        </View>

        {/* Uptime (if available) */}
        {healthDetail.uptime !== undefined && (
          <View
            style={styles.metadataRow}
            accessible
            accessibilityLabel={`Uptime: ${healthDetail.uptime.toFixed(1)} percent`}
            accessibilityRole="text"
          >
            <Icon
              source="timer-outline"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="bodySmall"
              style={[
                styles.metadataText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Uptime: {healthDetail.uptime.toFixed(1)}%
            </Text>
          </View>
        )}
      </Card>

      {/* Messages section */}
      <View style={styles.messagesSection}>
        <Text
          variant="titleMedium"
          style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
        >
          Health Messages ({messageCounts.all})
        </Text>

        {/* Severity filter */}
        {messageCounts.all > 0 && (
          <SegmentedButtons
            value={severityFilter}
            onValueChange={(value) =>
              setSeverityFilter(value as SeverityFilter)
            }
            buttons={[
              {
                value: "all",
                label: `All (${messageCounts.all})`,
                style:
                  severityFilter === "all" ? styles.activeButton : undefined,
              },
              {
                value: "critical",
                label: `Critical (${messageCounts.critical})`,
                disabled: messageCounts.critical === 0,
                style:
                  severityFilter === "critical"
                    ? styles.activeButton
                    : undefined,
              },
              {
                value: "error",
                label: `Error (${messageCounts.error})`,
                disabled: messageCounts.error === 0,
                style:
                  severityFilter === "error" ? styles.activeButton : undefined,
              },
              {
                value: "warning",
                label: `Warning (${messageCounts.warning})`,
                disabled: messageCounts.warning === 0,
                style:
                  severityFilter === "warning"
                    ? styles.activeButton
                    : undefined,
              },
              {
                value: "info",
                label: `Info (${messageCounts.info})`,
                disabled: messageCounts.info === 0,
                style:
                  severityFilter === "info" ? styles.activeButton : undefined,
              },
            ]}
            style={styles.segmentedButtons}
          />
        )}

        {/* Messages list */}
        {filteredMessages.length > 0 ? (
          <View style={styles.messagesList}>
            {filteredMessages.map((message) => (
              <HealthMessageCard
                key={message.id}
                message={message}
                onPress={() => handleMessagePress(message)}
                style={styles.messageCard}
              />
            ))}
          </View>
        ) : messageCounts.all > 0 ? (
          <View
            style={styles.emptyState}
            accessible
            accessibilityLabel="No messages match the selected filter"
            accessibilityRole="text"
          >
            <Icon
              source="filter-off"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="bodyLarge"
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No messages match the selected filter
            </Text>
          </View>
        ) : (
          <View
            style={styles.emptyState}
            accessible
            accessibilityLabel="No health messages. This service is operating normally"
            accessibilityRole="text"
          >
            <Icon
              source="check-circle"
              size={48}
              color={theme.colors.tertiary}
            />
            <Text
              variant="bodyLarge"
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No health messages
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.emptySubtext,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              This service is operating normally
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  statusCard: {
    marginBottom: 0,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  statusInfo: {
    flex: 1,
  },
  serviceName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  statusLabel: {
    fontWeight: "600",
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  metadataText: {
    fontSize: 12,
  },
  messagesSection: {
    gap: 12,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  segmentedButtons: {
    marginBottom: 4,
  },
  activeButton: {
    // Active button styling handled by SegmentedButtons
  },
  messagesList: {
    gap: 12,
  },
  messageCard: {
    marginBottom: 0,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyText: {
    textAlign: "center",
  },
  emptySubtext: {
    textAlign: "center",
    fontSize: 14,
  },
});
