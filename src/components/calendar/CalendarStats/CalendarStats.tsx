import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { CalendarStats as CalendarStatsType } from "@/models/calendar.types";
import { Card } from "@/components/common/Card";

export type CalendarStatsProps = {
  stats: CalendarStatsType;
  style?: StyleProp<ViewStyle>;
};

const CalendarStats: React.FC<CalendarStatsProps> = ({ stats, style }) => {
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

  return (
    <Card style={[styles.container, style]} contentPadding="md">
      <View style={styles.grid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalReleases}</Text>
          <Text style={styles.statLabel}>Total Releases</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.upcomingReleases}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.releasedThisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.monitoredReleases}</Text>
          <Text style={styles.statLabel}>Monitored</Text>
        </View>
      </View>

      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>By Type</Text>
        {Object.entries(stats.byType).map(([type, count]) => (
          <View key={type} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </Text>
            <Text style={styles.breakdownValue}>
              {count} ({formatPercentage(count, stats.totalReleases)})
            </Text>
          </View>
        ))}

        <Text
          style={[
            styles.breakdownTitle,
            { marginTop: theme.custom.spacing.sm },
          ]}
        >
          By Status
        </Text>
        {Object.entries(stats.byStatus).map(([status, count]) => (
          <View key={status} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
            <Text style={styles.breakdownValue}>
              {count} ({formatPercentage(count, stats.totalReleases)})
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
};

export default CalendarStats;
