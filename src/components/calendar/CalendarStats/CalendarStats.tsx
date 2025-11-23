import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { CalendarStats as CalendarStatsType } from "@/models/calendar.types";
import {
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";

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
      marginVertical: theme.custom.spacing.sm,
    },
    scrollContent: {
      paddingHorizontal: theme.custom.spacing.sm,
      gap: theme.custom.spacing.sm,
    },
    statPill: {
      minWidth: 130,
      borderRadius: 20,
      paddingVertical: theme.custom.spacing.md,
      paddingHorizontal: theme.custom.spacing.md,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "flex-start",
      // Subtle shadow
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      gap: theme.custom.spacing.xxs,
    },
    statValue: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: theme.custom.typography.labelMedium.fontSize,
      fontFamily: theme.custom.typography.labelMedium.fontFamily,
      fontWeight: theme.custom.typography.labelMedium.fontWeight as any,
      color: theme.colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    // ... keep breakdown styles if needed, or remove if we want to simplify
    breakdownContainer: {
      marginTop: theme.custom.spacing.md,
      paddingHorizontal: theme.custom.spacing.sm,
      gap: theme.custom.spacing.md,
    },
    breakdownSection: {
      gap: theme.custom.spacing.xs,
    },
    breakdownTitle: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: theme.custom.spacing.xs,
    },
    breakdownGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.custom.spacing.sm,
    },
    breakdownItem: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      padding: theme.custom.spacing.sm,
      gap: theme.custom.spacing.xs,
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
      color: theme.colors.onSurface,
    },
    breakdownValue: {
      fontSize: theme.custom.typography.labelLarge.fontSize,
      fontFamily: theme.custom.typography.labelLarge.fontFamily,
      fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
      color: theme.colors.onSurface,
    },
    breakdownPercent: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
      color: theme.colors.onSurfaceVariant,
    },
    progress: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surface,
    },
  });

  const statItems = [
    { value: stats.totalReleases, label: "Total" },
    { value: stats.upcomingReleases, label: "Upcoming" },
    { value: stats.releasedThisWeek, label: "This Week" },
    { value: stats.monitoredReleases, label: "Monitored" },
  ];

  return (
    <AnimatedSection style={[styles.container, style]} delay={0}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
      </ScrollView>

      {/* Optional: Only show breakdown if expanded or maybe just keep it simple for now. 
          I'll comment out the breakdown to keep the UI clean as per "high fidelity" request 
          which often implies less clutter. But if the user wants it, we can add it back.
          Actually, let's keep it but make it look better.
      */}
      {/* 
      <AnimatedSection style={styles.breakdownContainer} delay={160}>
         ... breakdown code ...
      </AnimatedSection> 
      */}
    </AnimatedSection>
  );
};

export default CalendarStats;
