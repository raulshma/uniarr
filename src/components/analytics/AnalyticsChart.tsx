import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { ChartType, ChartData, ChartConfig } from '@/models/analytics.types';

const { width: screenWidth } = Dimensions.get('window');

interface AnalyticsChartProps {
  title: string;
  type: ChartType;
  data: ChartData;
  config?: ChartConfig;
  height?: number;
  showLegend?: boolean;
}

const defaultChartConfig: ChartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  strokeColor: '#ffa726',
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#ffa726'
  },
  propsForBackgroundLines: {
    stroke: '#e3e3e3',
    strokeDasharray: '0'
  },
  propsForLabels: {
    fontSize: 12,
    fontWeight: '500'
  }
};

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  title,
  type,
  data,
  config = {},
  height = 220,
  showLegend = true
}) => {
  const theme = useTheme<AppTheme>();
  const chartConfig = { ...defaultChartConfig, ...config };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart
            data={data}
            width={screenWidth - 32}
            height={height}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            withDots={true}
            withShadow={false}
            withInnerLines={true}
            withOuterLines={false}
          />
        );

      case 'bar':
        return (
          <BarChart
            data={data}
            width={screenWidth - 32}
            height={height}
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            withHorizontalLabels={true}
            withVerticalLabels={true}
            withInnerLines={true}
            yAxisLabel=""
            yAxisSuffix=""
          />
        );

      case 'pie':
      case 'doughnut':
        return (
          <PieChart
            data={data.datasets[0]?.data.map((value, index) => ({
              name: data.labels[index] || `Item ${index + 1}`,
              value,
              color: data.datasets[0]?.color ?
                data.datasets[0].color(1) :
                `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
              legendFontColor: theme.colors.onSurface,
              legendFontSize: 12
            })) || []}
            width={screenWidth - 32}
            height={height}
            chartConfig={chartConfig}
            accessor="value"
            backgroundColor="transparent"
            paddingLeft="15"
            center={[10, 10]}
            style={styles.chart}
            hasLegend={showLegend}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      {renderChart()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
});
