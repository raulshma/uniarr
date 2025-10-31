import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { ProgressBar, Text, useTheme } from "react-native-paper";

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
      marginHorizontal: theme.custom.spacing.xs,
      marginVertical: theme.custom.spacing.sm,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.custom.spacing.sm,
      flexWrap: "wrap",
    },
    statPill: {
      flexGrow: 1,
      flexBasis: "48%",
      minWidth: 140,
      borderRadius: 16,
      paddingVertical: theme.custom.spacing.sm,
      paddingHorizontal: theme.custom.spacing.sm,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "flex-start",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outlineVariant,
      gap: theme.custom.spacing.xxs,
    },
    statValue: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
    },
    breakdownContainer: {
      marginTop: theme.custom.spacing.md,
      gap: theme.custom.spacing.md,
    },
    breakdownSection: {
      gap: theme.custom.spacing.xs,
    },
    breakdownTitle: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
      lineHeight: theme.custom.typography.titleSmall.lineHeight,
      letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
      color: theme.colors.onSurface,
    },
    breakdownGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.custom.spacing.sm,
      justifyContent: "space-between",
    },
    breakdownItem: {
      width: "48%",
      minWidth: 140,
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: theme.custom.spacing.sm,
      gap: theme.custom.spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outlineVariant,
    },
    breakdownHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakdownLabel: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      color: theme.colors.onSurface,
    },
    breakdownValue: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
      color: theme.colors.onSurface,
    },
    breakdownPercent: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
    },
    progress: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
  });

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return "0%";
    return `${Math.round((value / total) * 100)}%`;
  };

  const statItems = [
    { value: stats.totalReleases, label: "Total" },
    { value: stats.upcomingReleases, label: "Upcoming" },
    { value: stats.releasedThisWeek, label: "This Week" },
    { value: stats.monitoredReleases, label: "Monitored" },
  ];

  const breakdownByType = Object.entries(stats.byType);
  const breakdownByStatus = Object.entries(stats.byStatus);

  const total = stats.totalReleases || 1;

  return (
    <AnimatedSection style={[styles.container, style]} delay={0}>
      <Card contentPadding="md">
        <View style={styles.summaryRow}>
          {statItems.map((item, index) => (
            <AnimatedListItem
              key={item.label}
              index={index}
              totalItems={statItems.length}
              animated={shouldAnimateLayout}
              staggerDelay={40}
            >
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            </AnimatedListItem>
          ))}
        </View>

        <AnimatedSection style={styles.breakdownContainer} delay={160}>
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>By Type</Text>
            <View style={styles.breakdownGrid}>
              {breakdownByType.map(([type, count], index) => (
                <AnimatedListItem
                  key={`type-${type}`}
                  index={index}
                  totalItems={breakdownByType.length}
                  animated={shouldAnimateLayout}
                  staggerDelay={30}
                >
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownHeader}>
                      <Text style={styles.breakdownLabel} numberOfLines={1}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}s
                      </Text>
                      <Text style={styles.breakdownValue}>{count}</Text>
                    </View>
                    <ProgressBar
                      progress={count / total}
                      color={theme.colors.primary}
                      style={styles.progress}
                    />
                    <Text style={styles.breakdownPercent} numberOfLines={1}>
                      {formatPercentage(count, stats.totalReleases)} of total
                    </Text>
                  </View>
                </AnimatedListItem>
              ))}
            </View>
          </View>

          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>By Status</Text>
            <View style={styles.breakdownGrid}>
              {breakdownByStatus.map(([status, count], index) => (
                <AnimatedListItem
                  key={`status-${status}`}
                  index={index + breakdownByType.length}
                  totalItems={breakdownByType.length + breakdownByStatus.length}
                  animated={shouldAnimateLayout}
                  staggerDelay={30}
                >
                  <View style={styles.breakdownItem}>
                    <View style={styles.breakdownHeader}>
                      <Text style={styles.breakdownLabel} numberOfLines={1}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                      <Text style={styles.breakdownValue}>{count}</Text>
                    </View>
                    <ProgressBar
                      progress={count / total}
                      color={theme.colors.secondary}
                      style={styles.progress}
                    />
                    <Text style={styles.breakdownPercent} numberOfLines={1}>
                      {formatPercentage(count, stats.totalReleases)} of total
                    </Text>
                  </View>
                </AnimatedListItem>
              ))}
            </View>
          </View>
        </AnimatedSection>
      </Card>
    </AnimatedSection>
  );
};

export default CalendarStats;
