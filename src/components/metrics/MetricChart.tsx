import React, { useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import {
  useHighContrast,
  getHighContrastChartColors,
  adjustColorForHighContrast,
} from "@/utils/accessibility/highContrast.utils";
import type { AppTheme } from "@/constants/theme";

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export type ChartType = "line" | "bar" | "pie" | "area";

export interface MetricChartProps {
  data: MetricDataPoint[];
  type?: ChartType;
  title?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  color?: string;
  onDataPointPress?: (point: MetricDataPoint) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const DEFAULT_CHART_HEIGHT = 220;
const MAX_DATA_POINTS = 50; // Maximum data points before sampling
const MIN_BAR_WIDTH = 80; // Minimum width per bar for readability (increased for better scrolling)
const Y_AXIS_WIDTH = 50; // Width reserved for Y-axis labels

/**
 * Selects appropriate chart type based on data characteristics
 */
const selectChartType = (data: MetricDataPoint[]): ChartType => {
  if (data.length === 0) return "line";

  // If data has labels and few points, use pie chart for distribution
  if (data.length <= 6 && data.every((d) => d.label)) {
    return "pie";
  }

  // If data is time-series with many points, use line chart for trends
  if (data.length > 10) {
    return "line";
  }

  // Default to bar chart for comparisons
  return "bar";
};

/**
 * Sample data points for large datasets to improve performance
 * Uses a simple sampling algorithm that preserves the shape of the data
 */
const sampleDataPoints = (
  data: MetricDataPoint[],
  maxPoints: number,
): MetricDataPoint[] => {
  if (data.length <= maxPoints) {
    return data;
  }

  const sampledData: MetricDataPoint[] = [];
  const step = data.length / maxPoints;

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.floor(i * step);
    const point = data[index];
    if (point) {
      sampledData.push(point);
    }
  }

  // Always include the last point
  const lastPoint = data[data.length - 1];
  if (lastPoint && sampledData[sampledData.length - 1] !== lastPoint) {
    sampledData.push(lastPoint);
  }

  return sampledData;
};

/**
 * MetricChart component for visualizing service metrics
 * Supports line, bar, pie, and area chart types with automatic type selection
 */
export const MetricChart: React.FC<MetricChartProps> = ({
  data,
  type,
  title,
  yAxisLabel,
  xAxisLabel,
  color,
  onDataPointPress,
  style,
  height = DEFAULT_CHART_HEIGHT,
}) => {
  const theme = useTheme<AppTheme>();
  const isHighContrast = useHighContrast();

  // Sample data for large datasets (memoized)
  const sampledData = useMemo(() => {
    return sampleDataPoints(data, MAX_DATA_POINTS);
  }, [data]);

  // Auto-select chart type if not specified (memoized)
  const chartType = useMemo(() => {
    return type ?? selectChartType(sampledData);
  }, [type, sampledData]);

  // Prepare chart configuration
  const chartConfig = useMemo(() => {
    // Get high contrast colors if needed
    const highContrastColors = isHighContrast
      ? getHighContrastChartColors(theme.dark)
      : [];
    const primaryColor = isHighContrast
      ? highContrastColors[0]
      : (color ?? theme.colors.primary);

    // Adjust colors for high contrast
    const adjustedColor = adjustColorForHighContrast(
      primaryColor ?? theme.colors.primary,
      theme.dark,
      isHighContrast,
    );
    const labelColor = isHighContrast
      ? theme.dark
        ? "#FFFFFF"
        : "#000000"
      : theme.colors.onSurface;

    return {
      backgroundColor: theme.colors.surface,
      backgroundGradientFrom: theme.colors.surface,
      backgroundGradientTo: theme.colors.surface,
      decimalPlaces: 0,
      color: (opacity = 1) => {
        if (isHighContrast) {
          return adjustedColor;
        }
        return (
          color ??
          `rgba(${theme.dark ? "147, 197, 253" : "59, 130, 246"}, ${opacity})`
        );
      },
      labelColor: (opacity = 1) => {
        if (isHighContrast) {
          return labelColor;
        }
        return `rgba(${theme.dark ? "229, 231, 235" : "55, 65, 81"}, ${opacity})`;
      },
      style: {
        borderRadius: 26, // One UI 8 style
      },
      propsForDots: {
        r: isHighContrast ? "6" : "4", // Larger dots in high contrast
        strokeWidth: isHighContrast ? "3" : "2",
        stroke: adjustedColor,
      },
      propsForBackgroundLines: {
        strokeDasharray: "", // solid lines
        stroke: isHighContrast
          ? theme.dark
            ? "rgba(255, 255, 255, 0.3)"
            : "rgba(0, 0, 0, 0.3)"
          : theme.dark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
        strokeWidth: isHighContrast ? "2" : "1",
      },
    };
  }, [theme, color, isHighContrast]);

  // Transform data for chart libraries (memoized with sampled data)
  const chartData = useMemo(() => {
    if (sampledData.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [{ data: [0] }],
      };
    }

    if (chartType === "pie") {
      // Get high contrast colors for pie chart segments
      const highContrastColors = isHighContrast
        ? getHighContrastChartColors(theme.dark)
        : [];

      return sampledData.map((point, index) => {
        const segmentColor = isHighContrast
          ? highContrastColors[index % highContrastColors.length]
          : (color ?? theme.colors.primary);

        return {
          name: point.label ?? `Item ${index + 1}`,
          value: point.value,
          color: adjustColorForHighContrast(
            segmentColor ?? theme.colors.primary,
            theme.dark,
            isHighContrast,
          ),
          legendFontColor: isHighContrast
            ? theme.dark
              ? "#FFFFFF"
              : "#000000"
            : theme.colors.onSurface,
          legendFontSize: isHighContrast ? 14 : 12,
        };
      });
    }

    // For line, bar, and area charts
    const labels = sampledData.map((point) => {
      if (point.label) return point.label;

      // Format timestamp for x-axis
      const date = point.timestamp;
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    });

    // For scrollable charts, show all labels; otherwise reduce for space
    const finalLabels = labels.map((label) => {
      // Truncate label if too long
      return label.length > 12 ? label.substring(0, 10) + ".." : label;
    });

    return {
      labels: finalLabels,
      datasets: [
        {
          data: sampledData.map((point) => point.value),
        },
      ],
    };
  }, [sampledData, chartType, color, theme, isHighContrast]);

  // Handle data point press (memoized)
  const handleDataPointClick = useCallback(
    (dataPoint: any) => {
      if (!onDataPointPress) return;

      const index = dataPoint.index ?? 0;
      // Map back to original data if sampled
      const actualIndex =
        data.length > MAX_DATA_POINTS
          ? Math.floor((index / sampledData.length) * data.length)
          : index;

      const point = data[actualIndex];
      if (point && actualIndex >= 0 && actualIndex < data.length) {
        onDataPointPress(point);
      }
    },
    [onDataPointPress, data, sampledData.length],
  );

  // Calculate dynamic chart width based on data points
  const chartWidth = useMemo(() => {
    if (chartType === "pie") {
      return SCREEN_WIDTH - 32;
    }

    // For bar and line charts, calculate width based on data points
    const dataPointCount = sampledData.length;
    const availableWidth = SCREEN_WIDTH - 32 - Y_AXIS_WIDTH;
    const calculatedWidth = Math.max(
      availableWidth,
      dataPointCount * MIN_BAR_WIDTH,
    );

    return calculatedWidth;
  }, [chartType, sampledData.length]);

  // Determine if chart should be scrollable
  const isScrollable = useMemo(() => {
    const availableWidth = SCREEN_WIDTH - 32 - Y_AXIS_WIDTH;
    return chartWidth > availableWidth;
  }, [chartWidth]);

  // Generate accessibility label for chart (memoized)
  const chartAccessibilityLabel = useMemo(() => {
    const dataPoints = data.length;
    const values = data.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;

    const samplingNote =
      data.length > MAX_DATA_POINTS
        ? ` Showing ${sampledData.length} sampled points from ${dataPoints} total.`
        : "";

    return (
      `${title || "Chart"}: ${chartType} chart with ${dataPoints} data points.${samplingNote} ` +
      `Range from ${minValue.toFixed(1)} to ${maxValue.toFixed(1)}, ` +
      `average ${avgValue.toFixed(1)}. ${onDataPointPress ? "Tap data points for details." : ""}`
    );
  }, [title, chartType, data, sampledData.length, onDataPointPress]);

  // Render empty state
  if (data.length === 0) {
    return (
      <View
        style={[styles.container, style]}
        accessible
        accessibilityLabel={`${title || "Chart"}: No data available`}
        accessibilityRole="image"
      >
        {title && (
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
        )}
        <View style={[styles.emptyState, { height }]}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            No data available
          </Text>
        </View>
      </View>
    );
  }

  const renderChart = () => {
    if (chartType === "pie") {
      return (
        <PieChart
          data={chartData as any}
          width={chartWidth}
          height={height}
          chartConfig={chartConfig}
          accessor="value"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute={false}
          hasLegend={true}
        />
      );
    }

    if (chartType === "bar") {
      return (
        <BarChart
          data={chartData as any}
          width={chartWidth}
          height={height}
          chartConfig={chartConfig}
          yAxisLabel={yAxisLabel ?? ""}
          yAxisSuffix=""
          fromZero
          showBarTops={false}
          withInnerLines={true}
          style={styles.chart}
          segments={4}
        />
      );
    }

    // Line chart (also used for area type with bezier curve)
    return (
      <LineChart
        data={chartData as any}
        width={chartWidth}
        height={height}
        chartConfig={chartConfig}
        yAxisLabel={yAxisLabel ?? ""}
        yAxisSuffix=""
        bezier={chartType === "area"}
        withDots={sampledData.length <= 20}
        withInnerLines={true}
        withOuterLines={true}
        withVerticalLines={false}
        withHorizontalLines={true}
        style={styles.chart}
        onDataPointClick={handleDataPointClick}
        segments={4}
      />
    );
  };

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityLabel={chartAccessibilityLabel}
      accessibilityRole="image"
      accessibilityHint={
        onDataPointPress
          ? "Double tap on data points to view details"
          : undefined
      }
    >
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      {isScrollable && chartType !== "pie" ? (
        <View style={styles.scrollableChartContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
          >
            {renderChart()}
          </ScrollView>
        </View>
      ) : (
        renderChart()
      )}

      {xAxisLabel && (
        <Text
          variant="bodySmall"
          style={[styles.axisLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          {xAxisLabel}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  title: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  scrollableChartContainer: {
    width: "100%",
    flexDirection: "row",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingRight: 16,
  },
  chart: {
    borderRadius: 26,
    marginLeft: -10,
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 26,
  },
  axisLabel: {
    textAlign: "center",
    marginTop: 4,
  },
});
