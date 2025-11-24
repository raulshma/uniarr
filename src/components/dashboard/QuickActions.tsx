import React, { memo } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Text, Surface, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface QuickActionsProps {
  activeDownloadsCount: number;
}

const QuickActions = memo(({ activeDownloadsCount }: QuickActionsProps) => {
  const theme = useTheme();
  const router = useRouter();

  const styles = StyleSheet.create({
    section: {
      paddingHorizontal: theme.custom.spacing.xs,
      marginBottom: theme.custom.spacing.md,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.custom.spacing.sm,
      paddingHorizontal: theme.custom.spacing.xs,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontWeight: "600",
      marginBottom: theme.custom.spacing.sm,
      color: theme.colors.onBackground,
      paddingHorizontal: theme.custom.spacing.xs,
    },
    editButton: {
      margin: 0,
    },
    quickActions: {
      flexDirection: "row",
      gap: theme.custom.spacing.sm,
      paddingHorizontal: theme.custom.spacing.xs,
    },
    quickActionCard: {
      minWidth: 85,
      borderRadius: theme.custom.sizes.borderRadius.xl,
      overflow: "hidden",
      backgroundColor: theme.colors.elevation.level1,
    },
    quickActionContent: {
      paddingVertical: theme.custom.spacing.md,
      paddingHorizontal: theme.custom.spacing.sm,
      alignItems: "center",
      gap: theme.custom.spacing.xs,
    },
    quickActionIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.custom.sizes.borderRadius.lg,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.primaryContainer,
    },
    quickActionLabel: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontWeight: "600",
      color: theme.colors.onSurface,
      textAlign: "center",
    },
    quickActionBadge: {
      position: "absolute",
      top: theme.custom.spacing.xs,
      right: theme.custom.spacing.xs,
      backgroundColor: theme.colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.custom.spacing.xxs,
    },
    quickActionBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.onError,
    },
  });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <IconButton
          icon="pencil"
          size={18}
          iconColor={theme.colors.onSurfaceVariant}
          style={styles.editButton}
          onPress={() => router.push("/(auth)/settings/quick-actions")}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActions}
      >
        <TouchableOpacity
          onPress={() => router.push("/(auth)/(tabs)/services")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Search</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/calendar")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Calendar</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/(tabs)/downloads")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            {activeDownloadsCount > 0 && (
              <View style={styles.quickActionBadge}>
                <Text style={styles.quickActionBadgeText}>
                  {activeDownloadsCount}
                </Text>
              </View>
            )}
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="download"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Downloads</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/monitoring")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="monitor-dashboard"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Monitor</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/recently-added")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Recent</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/discover")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="compass-outline"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Discover</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/(tabs)/settings")}
          activeOpacity={0.7}
        >
          <Surface style={styles.quickActionCard} elevation={0}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <MaterialCommunityIcons
                  name="cog"
                  size={22}
                  color={theme.colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.quickActionLabel}>Settings</Text>
            </View>
          </Surface>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
});

export default QuickActions;
