import React, { useMemo } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Text, useTheme, Icon } from "react-native-paper";
import Card from "@/components/common/Card/Card";
import {
  useHighContrast,
  adjustColorForHighContrast,
} from "@/utils/accessibility/highContrast.utils";
import type { AppTheme } from "@/constants/theme";

export type MetricType = "uptime" | "errors" | "activity" | "performance";
export type TrendDirection = "up" | "down" | "stable";
export type MetricStatus = "good" | "warning" | "error";

export interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  icon?: string;
  status?: MetricStatus;
  metricType?: MetricType;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "compact" | "list";
}

/**
 * Get icon name based on metric type
 */
const getMetricIcon = (metricType?: MetricType): string => {
  switch (metricType) {
    case "uptime":
      return "clock-check-outline";
    case "errors":
      return "alert-circle-outline";
    case "activity":
      return "chart-line";
    case "performance":
      return "speedometer";
    default:
      return "chart-box-outline";
  }
};

/**
 * Get trend icon based on direction
 */
const getTrendIcon = (trend: TrendDirection): string => {
  switch (trend) {
    case "up":
      return "trending-up";
    case "down":
      return "trending-down";
    case "stable":
      return "minus";
  }
};

/**
 * Get status color based on metric status and trend
 */
const getStatusColor = (
  status: MetricStatus | undefined,
  trend: TrendDirection | undefined,
  metricType: MetricType | undefined,
  theme: AppTheme,
): string => {
  // Explicit status takes precedence
  if (status === "good") return theme.colors.tertiary;
  if (status === "warning") return "#f59e0b"; // amber-500
  if (status === "error") return theme.colors.error;

  // Infer status from trend and metric type
  if (trend && metricType) {
    // For errors, down trend is good
    if (metricType === "errors") {
      if (trend === "down") return theme.colors.tertiary;
      if (trend === "up") return theme.colors.error;
    }

    // For uptime, activity, and performance, up trend is good
    if (
      metricType === "uptime" ||
      metricType === "activity" ||
      metricType === "performance"
    ) {
      if (trend === "up") return theme.colors.tertiary;
      if (trend === "down") return theme.colors.error;
    }
  }

  // Default to primary color
  return theme.colors.primary;
};

/**
 * Get trend color based on direction and metric type
 */
const getTrendColor = (
  trend: TrendDirection,
  metricType: MetricType | undefined,
  theme: AppTheme,
): string => {
  // For errors, down is good (green), up is bad (red)
  if (metricType === "errors") {
    if (trend === "down") return theme.colors.tertiary;
    if (trend === "up") return theme.colors.error;
    return theme.colors.onSurfaceVariant;
  }

  // For other metrics, up is good (green), down is bad (red)
  if (trend === "up") return theme.colors.tertiary;
  if (trend === "down") return theme.colors.error;
  return theme.colors.onSurfaceVariant;
};

/**
 * MetricCard component for displaying individual metrics
 * Supports uptime, errors, activity, and performance metric types
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  trendValue,
  icon,
  status,
  metricType,
  onPress,
  style,
  variant = "default",
}) => {
  const theme = useTheme<AppTheme>();
  const isHighContrast = useHighContrast();

  const iconName = icon ?? getMetricIcon(metricType);
  const statusColor = useMemo(() => {
    const baseColor = getStatusColor(status, trend, metricType, theme);
    return adjustColorForHighContrast(baseColor, theme.dark, isHighContrast);
  }, [status, trend, metricType, theme, isHighContrast]);

  const trendColor = useMemo(() => {
    if (!trend) return undefined;
    const baseColor = getTrendColor(trend, metricType, theme);
    return adjustColorForHighContrast(baseColor, theme.dark, isHighContrast);
  }, [trend, metricType, theme, isHighContrast]);

  // Format value for display
  const displayValue = useMemo(() => {
    if (typeof value === "number") {
      // Format large numbers with commas
      if (value >= 1000) {
        return value.toLocaleString();
      }
      // Format percentages
      if (metricType === "uptime" && value <= 100) {
        return `${value.toFixed(1)}%`;
      }
      return value.toString();
    }
    return value;
  }, [value, metricType]);

  const containerStyle = useMemo(() => {
    if (variant === "compact") {
      return {
        borderRadius: 26, // One UI 8 style squircle-ish
        backgroundColor: theme.colors.elevation.level2,
        padding: 16,
        minHeight: 120,
        justifyContent: "space-between" as const,
      };
    }
    if (variant === "list") {
      return {
        borderRadius: 20,
        backgroundColor: theme.colors.elevation.level1,
        padding: 16,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        minHeight: 72,
      };
    }
    return {
      borderRadius: 26, // One UI 8 style squircle-ish
      backgroundColor: theme.colors.elevation.level2,
      padding: 20,
      minHeight: 140,
    };
  }, [variant, theme]);

  if (variant === "compact") {
    return (
      <Card
        variant="default"
        elevation="low"
        onPress={onPress}
        style={[containerStyle, style]}
        accessibilityLabel={`${title}: ${displayValue}`}
      >
        <View style={styles.compactHeader}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: statusColor + "15",
                padding: 8,
                borderRadius: 14,
              },
            ]}
          >
            <Icon source={iconName} size={20} color={statusColor} />
          </View>
          {trend && (
            <Icon source={getTrendIcon(trend)} size={16} color={trendColor} />
          )}
        </View>
        <View style={styles.compactContent}>
          <Text
            variant="displaySmall"
            style={[styles.compactValue, { color: theme.colors.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayValue}
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.compactTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </Card>
    );
  }

  if (variant === "list") {
    return (
      <Card
        variant="default"
        elevation="low"
        onPress={onPress}
        style={[containerStyle, style]}
        accessibilityLabel={`${title}: ${displayValue}`}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: statusColor + "20", marginRight: 16 },
          ]}
        >
          <Icon source={iconName} size={26} color={statusColor} />
        </View>
        <View style={styles.listContent}>
          <Text
            variant="bodyLarge"
            style={[styles.listTitle, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            variant="headlineSmall"
            style={[styles.listValue, { color: theme.colors.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayValue}
          </Text>
        </View>
        {trend && (
          <View style={styles.trendContainer}>
            <Icon source={getTrendIcon(trend)} size={18} color={trendColor} />
            {trendValue && (
              <Text variant="bodySmall" style={{ color: trendColor }}>
                {trendValue}
              </Text>
            )}
          </View>
        )}
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      elevation="low"
      contentPadding="md"
      onPress={onPress}
      style={[styles.card, containerStyle, style]}
      accessibilityLabel={`${title}: ${displayValue}${
        trendValue ? `, trend: ${trendValue}` : ""
      }`}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.container}>
        {/* Header with icon and title */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: statusColor + "20" },
            ]}
          >
            <Icon source={iconName} size={24} color={statusColor} />
          </View>
          <Text
            variant="titleMedium"
            style={[styles.title, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        {/* Value display */}
        <View style={styles.valueContainer}>
          <Text
            variant="displayMedium"
            style={[styles.value, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        </View>

        {/* Trend indicator */}
        {trend && (
          <View style={styles.trendContainer}>
            <Icon source={getTrendIcon(trend)} size={20} color={trendColor} />
            {trendValue && (
              <Text
                variant="bodyMedium"
                style={[styles.trendValue, { color: trendColor }]}
              >
                {trendValue}
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 160,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  compactContent: {
    flex: 1,
    justifyContent: "flex-end",
    gap: 4,
  },
  iconContainer: {
    padding: 10,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  title: {
    flex: 1,
  },
  valueContainer: {
    flex: 1,
    justifyContent: "center",
    marginVertical: 8,
  },
  value: {
    fontWeight: "700",
  },
  compactValue: {
    fontWeight: "700",
    fontSize: 28,
    lineHeight: 34,
  },
  compactTitle: {
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  listTitle: {
    fontWeight: "500",
  },
  listValue: {
    fontWeight: "700",
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  trendValue: {
    fontWeight: "600",
  },
});
