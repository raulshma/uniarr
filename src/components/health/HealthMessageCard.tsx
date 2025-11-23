import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Linking,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text, useTheme, Icon, IconButton } from "react-native-paper";
import Card from "@/components/common/Card/Card";
import type { AppTheme } from "@/constants/theme";
import type { HealthMessage } from "@/models/logger.types";

export interface HealthMessageCardProps {
  /**
   * Health message to display
   */
  message: HealthMessage;

  /**
   * Whether to show the service name
   */
  showServiceName?: boolean;

  /**
   * Service name to display (if showServiceName is true)
   */
  serviceName?: string;

  /**
   * Callback when the card is pressed
   */
  onPress?: () => void;

  /**
   * Custom style for the card
   */
  style?: StyleProp<ViewStyle>;
}

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
 * Get severity label based on message severity
 */
const getSeverityLabel = (severity: HealthMessage["severity"]): string => {
  return severity.toUpperCase();
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
 * HealthMessageCard component displays individual health message with severity, timestamp, and message text
 *
 * Features:
 * - Display severity indicator with icon and color
 * - Show timestamp in relative format
 * - Support navigation to wiki URLs for more information
 * - Optional service name display
 *
 * @example
 * ```tsx
 * <HealthMessageCard
 *   message={healthMessage}
 *   showServiceName
 *   serviceName="Sonarr"
 *   onPress={() => console.log('Message pressed')}
 * />
 * ```
 */
export const HealthMessageCard: React.FC<HealthMessageCardProps> = ({
  message,
  showServiceName = false,
  serviceName,
  onPress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const severityColor = getSeverityColor(message.severity, theme);
  const severityIcon = getSeverityIcon(message.severity);
  const severityLabel = getSeverityLabel(message.severity);
  const timestamp = formatTimestamp(message.timestamp);

  const handleWikiPress = useCallback(async () => {
    if (message.wikiUrl) {
      try {
        const canOpen = await Linking.canOpenURL(message.wikiUrl);
        if (canOpen) {
          await Linking.openURL(message.wikiUrl);
        }
      } catch (error) {
        console.error("Failed to open wiki URL:", error);
      }
    }
  }, [message.wikiUrl]);

  return (
    <Card
      variant="default"
      elevation="low"
      contentPadding="md"
      onPress={onPress}
      style={[styles.card, style]}
      accessibilityLabel={`${severityLabel} message: ${message.message}`}
      accessibilityHint={
        message.wikiUrl ? "Tap to view more information" : undefined
      }
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.container}>
        {/* Header with severity and timestamp */}
        <View style={styles.header}>
          <View style={styles.severityContainer}>
            <Icon source={severityIcon} size={20} color={severityColor} />
            <Text
              variant="labelMedium"
              style={[styles.severityLabel, { color: severityColor }]}
            >
              {severityLabel}
            </Text>
          </View>

          <Text
            variant="bodySmall"
            style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}
          >
            {timestamp}
          </Text>
        </View>

        {/* Service name (optional) */}
        {showServiceName && serviceName && (
          <Text
            variant="bodySmall"
            style={[
              styles.serviceName,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {serviceName}
          </Text>
        )}

        {/* Message text */}
        <Text
          variant="bodyMedium"
          style={[styles.message, { color: theme.colors.onSurface }]}
        >
          {message.message}
        </Text>

        {/* Source (optional) */}
        {message.source && (
          <Text
            variant="bodySmall"
            style={[styles.source, { color: theme.colors.onSurfaceVariant }]}
          >
            Source: {message.source}
          </Text>
        )}

        {/* Wiki link button */}
        {message.wikiUrl && (
          <View style={styles.wikiContainer}>
            <IconButton
              icon="open-in-new"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleWikiPress}
              accessibilityLabel="Open documentation"
              accessibilityHint="Opens wiki page with more information"
            />
            <Text
              variant="bodySmall"
              style={[styles.wikiText, { color: theme.colors.primary }]}
              onPress={handleWikiPress}
            >
              Learn more
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
  },
  container: {
    gap: 8,
  },
  header: {
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
    fontSize: 12,
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 12,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -4,
  },
  message: {
    lineHeight: 20,
  },
  source: {
    fontSize: 11,
    fontStyle: "italic",
  },
  wikiContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginLeft: -8,
  },
  wikiText: {
    fontWeight: "500",
    marginLeft: -4,
  },
});
