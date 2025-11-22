import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Text, useTheme, Icon } from "react-native-paper";
import Card from "@/components/common/Card/Card";
import type { AppTheme } from "@/constants/theme";
import type { ServiceLog, ServiceLogLevel } from "@/models/logger.types";

export interface LogEntryProps {
  /**
   * Log entry to display
   */
  log: ServiceLog;

  /**
   * Callback when the entry is pressed
   */
  onPress?: () => void;

  /**
   * Search query for highlighting matches
   */
  searchQuery?: string;

  /**
   * Custom style for the card
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Maximum number of lines to show when collapsed
   */
  collapsedLines?: number;
}

/**
 * Get log level icon
 */
const getLogLevelIcon = (level: ServiceLogLevel): string => {
  switch (level) {
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
 * Get log level color
 */
const getLogLevelColor = (level: ServiceLogLevel, theme: AppTheme): string => {
  switch (level) {
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
    return date.toLocaleString();
  }
};

/**
 * Highlight search matches in text
 */
const highlightText = (
  text: string,
  query: string,
  theme: AppTheme,
): React.ReactNode => {
  if (!query.trim()) {
    return text;
  }

  const parts = text.split(new RegExp(`(${query})`, "gi"));

  return (
    <Text>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return (
          <Text
            key={index}
            style={
              isMatch
                ? {
                    backgroundColor: theme.colors.primaryContainer,
                    color: theme.colors.onPrimaryContainer,
                    fontWeight: "600",
                  }
                : undefined
            }
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
};

/**
 * LogEntry component displays individual log entry with timestamp, service, level, and message
 *
 * Features:
 * - Display timestamp, service, level, and message
 * - Support text highlighting for search matches
 * - Support expand/collapse for long messages
 * - Visual severity indicators
 *
 * @example
 * ```tsx
 * <LogEntry
 *   log={logEntry}
 *   onPress={() => console.log('Log pressed')}
 *   searchQuery="error"
 * />
 * ```
 */
export const LogEntry: React.FC<LogEntryProps> = ({
  log,
  onPress,
  searchQuery = "",
  style,
  collapsedLines = 3,
}) => {
  const theme = useTheme<AppTheme>();
  const [isExpanded, setIsExpanded] = useState(false);

  const levelColor = getLogLevelColor(log.level, theme);
  const levelIcon = getLogLevelIcon(log.level);
  const timestamp = formatTimestamp(log.timestamp);

  // Check if message is long enough to need expansion
  const messageLines = log.message.split("\n").length;
  const needsExpansion =
    messageLines > collapsedLines || log.message.length > 200;

  // Handle expand/collapse
  const handleToggleExpand = useCallback(() => {
    if (needsExpansion) {
      setIsExpanded((prev) => !prev);
    }
  }, [needsExpansion]);

  // Combine press handlers
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else if (needsExpansion) {
      handleToggleExpand();
    }
  }, [onPress, needsExpansion, handleToggleExpand]);

  // Render message with highlighting
  const messageContent = useMemo(() => {
    return highlightText(log.message, searchQuery, theme);
  }, [log.message, searchQuery, theme]);

  return (
    <Card
      variant="default"
      elevation="low"
      contentPadding="sm"
      onPress={handlePress}
      style={[styles.card, style]}
      accessibilityLabel={`${log.level} log from ${log.serviceName}: ${log.message}`}
      accessibilityHint={
        needsExpansion ? "Tap to expand or collapse" : undefined
      }
      accessibilityRole="button"
    >
      <View style={styles.container}>
        {/* Header with level, service, and timestamp */}
        <View style={styles.header}>
          <View
            style={[
              styles.levelContainer,
              { backgroundColor: levelColor + "15" },
            ]}
          >
            <Icon source={levelIcon} size={14} color={levelColor} />
            <Text
              variant="labelSmall"
              style={[styles.levelLabel, { color: levelColor }]}
            >
              {log.level.toUpperCase()}
            </Text>
          </View>

          <View style={styles.metaContainer}>
            <Text
              variant="bodySmall"
              style={[
                styles.serviceName,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {log.serviceName}
            </Text>
            <Text
              variant="bodySmall"
              style={[
                styles.timestamp,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {timestamp}
            </Text>
          </View>
        </View>

        {/* Message */}
        <Text
          variant="bodyMedium"
          style={[styles.message, { color: theme.colors.onSurface }]}
          numberOfLines={isExpanded ? undefined : collapsedLines}
        >
          {messageContent}
        </Text>

        {/* Expand/collapse indicator */}
        {needsExpansion && (
          <Text
            variant="bodySmall"
            style={[styles.expandIndicator, { color: theme.colors.primary }]}
            onPress={handleToggleExpand}
          >
            {isExpanded ? "Show less" : "Show more"}
          </Text>
        )}

        {/* Additional metadata (logger, method) */}
        {(log.logger || log.method) && isExpanded && (
          <View style={styles.metadata}>
            {log.logger && (
              <Text
                variant="bodySmall"
                style={[
                  styles.metadataText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                Logger: {log.logger}
              </Text>
            )}
            {log.method && (
              <Text
                variant="bodySmall"
                style={[
                  styles.metadataText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                Method: {log.method}
              </Text>
            )}
          </View>
        )}

        {/* Exception (if present) */}
        {log.exception && isExpanded && (
          <View
            style={[
              styles.exceptionContainer,
              { backgroundColor: theme.colors.errorContainer },
            ]}
          >
            <Text
              variant="bodySmall"
              style={[
                styles.exceptionLabel,
                { color: theme.colors.onErrorContainer },
              ]}
            >
              Exception:
            </Text>
            <Text
              variant="bodySmall"
              style={[
                styles.exceptionText,
                { color: theme.colors.onErrorContainer },
              ]}
            >
              {log.exception}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 22,
  },
  container: {
    gap: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  levelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  levelLabel: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  serviceName: {
    fontSize: 11,
    fontWeight: "600",
  },
  separator: {
    fontSize: 11,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  message: {
    lineHeight: 18,
    fontSize: 13,
  },
  expandIndicator: {
    fontWeight: "600",
    fontSize: 11,
    marginTop: 2,
  },
  metadata: {
    gap: 2,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  metadataText: {
    fontSize: 10,
    fontStyle: "italic",
  },
  exceptionContainer: {
    padding: 8,
    borderRadius: 12,
    marginTop: 6,
  },
  exceptionLabel: {
    fontWeight: "700",
    fontSize: 10,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  exceptionText: {
    fontSize: 10,
    fontFamily: "monospace",
    lineHeight: 14,
  },
});
