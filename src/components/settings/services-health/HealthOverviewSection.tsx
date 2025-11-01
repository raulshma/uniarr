import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, Card, Chip, IconButton } from "react-native-paper";
import { format } from "date-fns";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { ServicesHealthOverview } from "@/hooks/useServicesHealth";

interface HealthOverviewSectionProps {
  overview: ServicesHealthOverview;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}

export const HealthOverviewSection: React.FC<HealthOverviewSectionProps> = ({
  overview,
  isLoading,
  isError,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();

  const healthStats = useMemo(
    () => [
      {
        label: "Active",
        value: overview.online,
        color: theme.colors.primary,
        icon: "check-circle",
      },
      {
        label: "Offline",
        value: overview.offline - overview.pendingConfigs, // Exclude pending configs from offline
        color: theme.colors.error,
        icon: "close-circle",
      },
      {
        label: "Degraded",
        value: overview.degraded,
        color: theme.colors.secondary,
        icon: "alert",
      },
      {
        label: "Disabled",
        value: overview.disabled,
        color: theme.colors.outline,
        icon: "pause-circle",
      },
    ],
    [overview, theme.colors],
  );

  const lastUpdatedText = useMemo(() => {
    if (!overview.lastUpdated) {
      return "Never updated";
    }
    return `Last updated: ${format(overview.lastUpdated, "MMM d, h:mm a")}`;
  }, [overview.lastUpdated]);

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: spacing.xs,
    },
    overviewCard: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.xxl,
      marginBottom: spacing.sm,
    },
    cardContent: {
      padding: spacing.md,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
    },
    refreshButton: {
      borderColor: theme.colors.outline,
    },
    statsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    statChip: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.lg,
    },
    statChipText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.md,
    },
    lastUpdated: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      flex: 1,
    },
    pendingConfigsChip: {
      backgroundColor: theme.colors.errorContainer,
    },
    pendingConfigsText: {
      color: theme.colors.onErrorContainer,
    },
  });

  return (
    <View style={styles.container}>
      <Card style={styles.overviewCard}>
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Service Health Overview</Text>
            <IconButton
              mode="contained-tonal"
              onPress={onRefresh}
              loading={isLoading}
              disabled={isLoading}
              style={styles.refreshButton}
              icon="refresh"
            />
          </View>

          <View style={styles.statsContainer}>
            {healthStats.map((stat) => (
              <Chip
                key={stat.label}
                mode="flat"
                style={styles.statChip}
                textStyle={[styles.statChipText, { color: stat.color }]}
                icon={stat.icon}
              >
                {stat.label}: {stat.value}
              </Chip>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.lastUpdated}>{lastUpdatedText}</Text>
            {overview.pendingConfigs > 0 && (
              <Chip
                mode="flat"
                style={styles.pendingConfigsChip}
                textStyle={styles.pendingConfigsText}
                icon="alert-circle"
              >
                {overview.pendingConfigs} Configuration
                {overview.pendingConfigs !== 1 ? "s" : ""} Pending
              </Chip>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
};
