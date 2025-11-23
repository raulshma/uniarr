import React, { useCallback } from "react";
import { View, StyleSheet, type ListRenderItemInfo } from "react-native";
import { Text, useTheme, Icon, ActivityIndicator } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import Card from "@/components/common/Card/Card";
import EmptyState from "@/components/common/EmptyState/EmptyState";
import type { AppTheme } from "@/constants/theme";
import type { LogPattern } from "@/services/logs/LogAggregationService";
import type { ServiceLogLevel } from "@/models/logger.types";

export interface LogPatternListProps {
  /**
   * Array of detected patterns to display
   */
  patterns: LogPattern[];

  /**
   * Whether data is currently loading
   */
  isLoading?: boolean;

  /**
   * Callback when a pattern is selected
   */
  onPatternSelect?: (pattern: LogPattern) => void;

  /**
   * Currently selected pattern ID
   */
  selectedPatternId?: string | null;

  /**
   * Maximum number of patterns to display
   */
  maxPatterns?: number;
}

/**
 * Get severity icon based on log level
 */
const getSeverityIcon = (severity: ServiceLogLevel): string => {
  switch (severity) {
    case "fatal":
      return "alert-octagon";
    case "error":
      return "alert-circle";
    case "warn":
      return "alert";
    case "info":
      return "information";
    case "debug":
      return "bug";
    case "trace":
    default:
      return "text-box-outline";
  }
};

/**
 * Get severity color based on log level
 */
const getSeverityColor = (
  severity: ServiceLogLevel,
  theme: AppTheme,
): string => {
  switch (severity) {
    case "fatal":
      return theme.colors.error;
    case "error":
      return theme.colors.error;
    case "warn":
      return "#f59e0b"; // Amber
    case "info":
      return theme.colors.primary;
    case "debug":
      return theme.colors.tertiary;
    case "trace":
    default:
      return theme.colors.onSurfaceVariant;
  }
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (timestamp: Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * LogPatternList component displays detected log patterns with frequency and timestamps
 *
 * Features:
 * - Display pattern text, frequency count, and timestamps
 * - Support pattern selection to filter logs
 * - Visual severity indicators
 * - Show affected services
 *
 * @example
 * ```tsx
 * <LogPatternList
 *   patterns={patterns}
 *   onPatternSelect={handlePatternSelect}
 *   selectedPatternId={selectedPattern?.id}
 * />
 * ```
 */
export const LogPatternList: React.FC<LogPatternListProps> = ({
  patterns,
  isLoading = false,
  onPatternSelect,
  selectedPatternId = null,
  maxPatterns,
}) => {
  const theme = useTheme<AppTheme>();

  // Limit patterns if maxPatterns is specified
  const displayPatterns = maxPatterns
    ? patterns.slice(0, maxPatterns)
    : patterns;

  const renderPatternItem = useCallback(
    ({ item }: ListRenderItemInfo<LogPattern>) => {
      const severityColor = getSeverityColor(item.severity, theme);
      const severityIcon = getSeverityIcon(item.severity);
      const isSelected = item.id === selectedPatternId;
      const firstOccurrence = formatTimestamp(item.firstOccurrence);
      const lastOccurrence = formatTimestamp(item.lastOccurrence);

      return (
        <Card
          variant="default"
          elevation={isSelected ? "medium" : "low"}
          contentPadding="md"
          onPress={() => onPatternSelect?.(item)}
          style={[
            styles.patternCard,
            isSelected && {
              borderWidth: 2,
              borderColor: theme.colors.primary,
            },
          ]}
          accessibilityLabel={`Pattern: ${item.pattern}, occurred ${item.count} times`}
          accessibilityHint="Tap to filter logs by this pattern"
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
        >
          <View style={styles.patternContainer}>
            {/* Header with severity and count */}
            <View style={styles.patternHeader}>
              <View style={styles.severityContainer}>
                <Icon source={severityIcon} size={20} color={severityColor} />
                <Text
                  variant="labelMedium"
                  style={[styles.severityLabel, { color: severityColor }]}
                >
                  {item.severity.toUpperCase()}
                </Text>
              </View>

              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Text
                  variant="labelMedium"
                  style={[
                    styles.countText,
                    { color: theme.colors.onPrimaryContainer },
                  ]}
                >
                  {item.count}×
                </Text>
              </View>
            </View>

            {/* Pattern text */}
            <Text
              variant="bodyMedium"
              style={[styles.patternText, { color: theme.colors.onSurface }]}
              numberOfLines={3}
            >
              {item.pattern}
            </Text>

            {/* Timestamps */}
            <View style={styles.timestampContainer}>
              <View style={styles.timestampRow}>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.timestampLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  First:
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.timestampValue,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {firstOccurrence}
                </Text>
              </View>
              <View style={styles.timestampRow}>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.timestampLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Last:
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.timestampValue,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {lastOccurrence}
                </Text>
              </View>
            </View>

            {/* Affected services */}
            {item.affectedServices.length > 0 && (
              <View style={styles.servicesContainer}>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.servicesLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Affected services:
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.servicesText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                >
                  {item.affectedServices.join(", ")}
                </Text>
              </View>
            )}

            {/* Selection indicator */}
            {isSelected && (
              <View style={styles.selectedIndicator}>
                <Icon
                  source="check-circle"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text
                  variant="labelSmall"
                  style={[styles.selectedText, { color: theme.colors.primary }]}
                >
                  FILTERING BY THIS PATTERN
                </Text>
              </View>
            )}
          </View>
        </Card>
      );
    },
    [theme, selectedPatternId, onPatternSelect],
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
            Analyzing patterns...
          </Text>
        </View>
      );
    }

    return (
      <EmptyState
        icon="chart-timeline-variant"
        title="No Patterns Detected"
        description="Patterns will appear here once enough similar log entries are found"
      />
    );
  }, [isLoading, theme]);

  const keyExtractor = useCallback((item: LogPattern) => item.id, []);

  return (
    <FlashList
      data={displayPatterns}
      renderItem={renderPatternItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={180}
      contentContainerStyle={[
        styles.listContent,
        displayPatterns.length === 0 && styles.emptyListContent,
      ]}
      ListEmptyComponent={renderEmptyState}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  patternCard: {
    marginBottom: 0,
  },
  patternContainer: {
    gap: 12,
  },
  patternHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  severityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  severityLabel: {
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontWeight: "700",
    fontSize: 13,
  },
  patternText: {
    lineHeight: 20,
    fontFamily: "monospace",
  },
  timestampContainer: {
    flexDirection: "row",
    gap: 16,
  },
  timestampRow: {
    flexDirection: "row",
    gap: 6,
  },
  timestampLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  timestampValue: {
    fontSize: 12,
  },
  servicesContainer: {
    gap: 4,
  },
  servicesLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  servicesText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  selectedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  selectedText: {
    fontWeight: "600",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    marginTop: 16,
    textAlign: "center",
  },
});
