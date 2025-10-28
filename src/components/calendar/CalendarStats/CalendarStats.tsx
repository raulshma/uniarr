import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { CalendarStats as CalendarStatsType } from "@/models/calendar.types";
import {
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";
import { Card } from "@/components/common/Card";

export type CalendarStatsProps = {
  stats: CalendarStatsType;
  style?: StyleProp<ViewStyle>;
  shouldAnimateLayout?: boolean; // Allow disabling animations during loading
};

const CalendarStats: React.FC<CalendarStatsProps> = ({
  stats,
  style,
  shouldAnimateLayout = true,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: theme.custom.spacing.md,
      marginVertical: theme.custom.spacing.sm,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    statItem: {
      width: "48%",
      marginBottom: theme.custom.spacing.sm,
    },
    statValue: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      lineHeight: theme.custom.typography.headlineSmall.lineHeight,
      letterSpacing: theme.custom.typography.headlineSmall.letterSpacing,
      color: theme.colors.primary,
      textAlign: "center",
    },
    statLabel: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginTop: theme.custom.spacing.xxs,
    },
    breakdownContainer: {
      marginTop: theme.custom.spacing.sm,
    },
    breakdownTitle: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
      lineHeight: theme.custom.typography.titleSmall.lineHeight,
      letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
      color: theme.colors.onSurface,
      marginBottom: theme.custom.spacing.xs,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.custom.spacing.xxs,
    },
    breakdownLabel: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
    },
    breakdownValue: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      color: theme.colors.onSurface,
    },
  });

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return "0%";
    return `${Math.round((value / total) * 100)}%`;
  };

  const statItems = [
    { value: stats.totalReleases, label: "Total Releases" },
    { value: stats.upcomingReleases, label: "Upcoming" },
    { value: stats.releasedThisWeek, label: "This Week" },
    { value: stats.monitoredReleases, label: "Monitored" },
  ];

  const breakdownByType = Object.entries(stats.byType);
  const breakdownByStatus = Object.entries(stats.byStatus);

  return (
    <AnimatedSection style={[styles.container, style]} delay={0}>
      <Card contentPadding="md">
        <View style={styles.grid}>
          {statItems.map((item, index) => (
            <AnimatedListItem
              key={item.label}
              index={index}
              totalItems={statItems.length}
              animated={shouldAnimateLayout}
              staggerDelay={50}
            >
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            </AnimatedListItem>
          ))}
        </View>

        <AnimatedSection style={styles.breakdownContainer} delay={200}>
          <Text style={styles.breakdownTitle}>By Type</Text>
          {breakdownByType.map(([type, count], index) => (
            <AnimatedListItem
              key={`type-${type}`}
              index={index}
              totalItems={breakdownByType.length}
              animated={shouldAnimateLayout}
              staggerDelay={30}
            >
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                </Text>
                <Text style={styles.breakdownValue}>
                  {count} ({formatPercentage(count, stats.totalReleases)})
                </Text>
              </View>
            </AnimatedListItem>
          ))}

          <Text
            style={[
              styles.breakdownTitle,
              { marginTop: theme.custom.spacing.sm },
            ]}
          >
            By Status
          </Text>
          {breakdownByStatus.map(([status, count], index) => (
            <AnimatedListItem
              key={`status-${status}`}
              index={index + breakdownByType.length}
              totalItems={breakdownByType.length + breakdownByStatus.length}
              animated={shouldAnimateLayout}
              staggerDelay={30}
            >
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                <Text style={styles.breakdownValue}>
                  {count} ({formatPercentage(count, stats.totalReleases)})
                </Text>
              </View>
            </AnimatedListItem>
          ))}
        </AnimatedSection>
      </Card>
    </AnimatedSection>
  );
};

export default CalendarStats;
