import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Card, Chip, Text, Surface, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppTheme } from "@/constants/theme";

interface SonarrQueueStatsProps {
  total: number;
  downloading: number;
  completed: number;
  paused: number;
  failed: number;
  warning: number;
  queued: number;
  onStatusFilter?: (status: string) => void;
}

const SonarrQueueStatsComponent = ({
  total,
  downloading,
  completed,
  paused,
  failed,
  warning,
  queued,
  onStatusFilter,
}: SonarrQueueStatsProps) => {
  const theme = useTheme<AppTheme>();

  const stats = useMemo(
    () => [
      {
        key: "all",
        label: "All",
        count: total,
        icon: "format-list-bulleted",
        color: theme.colors.onSurfaceVariant,
      },
      {
        key: "downloading",
        label: "Downloading",
        count: downloading,
        icon: "download",
        color: theme.colors.primary,
      },
      {
        key: "completed",
        label: "Completed",
        count: completed,
        icon: "check-circle",
        color: theme.colors.tertiary,
      },
      {
        key: "paused",
        label: "Paused",
        count: paused,
        icon: "pause",
        color: theme.colors.secondary,
      },
      {
        key: "failed",
        label: "Failed",
        count: failed,
        icon: "alert-circle",
        color: theme.colors.error,
      },
      {
        key: "warning",
        label: "Warnings",
        count: warning,
        icon: "alert",
        color: "#FF9800",
      },
      {
        key: "queued",
        label: "Queued",
        count: queued,
        icon: "clock",
        color: theme.colors.onSurfaceVariant,
      },
    ],
    [total, downloading, completed, paused, failed, warning, queued, theme],
  );

  const handlePressStatusChip = (statusKey: string) => {
    if (onStatusFilter) {
      onStatusFilter(statusKey);
    }
  };

  return (
    <Surface
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.onSurfaceVariant }]}
      >
        Queue Overview
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsContainer}
      >
        {stats.map(({ key, label, count, icon, color }) => (
          <View key={key} style={styles.statItem}>
            <Chip
              mode={count === 0 ? "flat" : "outlined"}
              onPress={() => handlePressStatusChip(key)}
              style={styles.statChip}
              disabled={count === 0}
            >
              <View style={styles.statChipContent}>
                <MaterialCommunityIcons
                  name={icon as any}
                  size={16}
                  color={color}
                />
                <Text variant="labelMedium" style={{ color }}>
                  {count}
                </Text>
                <Text
                  variant="labelSmall"
                  style={[styles.statLabel, { color }]}
                >
                  {label}
                </Text>
              </View>
            </Chip>
          </View>
        ))}
      </ScrollView>
    </Surface>
  );
};

export const SonarrQueueStats = React.memo(SonarrQueueStatsComponent);

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
  },
  title: {
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    marginRight: 8,
  },
  statChip: {
    paddingHorizontal: 8,
  },
  statChipContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  statLabel: {
    marginLeft: 4,
  },
});
