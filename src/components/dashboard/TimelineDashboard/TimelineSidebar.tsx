import React, { memo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Text, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useHaptics } from "@/hooks/useHaptics";

interface SidebarShortcut {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

interface TimelineSidebarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stats: {
    downloading: number;
    queued: number;
    completed: number;
    failed: number;
    upcoming: number;
    offline: number;
    pendingRequests: number;
    subtitles: number;
    lowDisk: number;
  };
}

const shortcuts: SidebarShortcut[] = [
  { icon: "calendar", label: "Calendar", route: "/(auth)/calendar" },
  { icon: "magnify", label: "Search", route: "/(auth)/discover" },
  {
    icon: "download",
    label: "Downloads",
    route: "/(auth)/(tabs)/downloads",
  },
  { icon: "server", label: "Services", route: "/(auth)/(tabs)/services" },
  {
    icon: "clock-outline",
    label: "Recent",
    route: "/(auth)/recently-added",
  },
  {
    icon: "monitor-dashboard",
    label: "Monitor",
    route: "/(auth)/monitoring",
  },
  { icon: "chart-line", label: "Analytics", route: "/(auth)/analytics" },
  { icon: "cog", label: "Settings", route: "/(auth)/settings" },
];

const filterItems = [
  { key: "all", icon: "filter-variant", label: "All" },
  { key: "downloads", icon: "download", label: "Downloads" },
  { key: "library", icon: "bookshelf", label: "Library" },
  { key: "schedule", icon: "calendar-clock", label: "Schedule" },
  { key: "requests", icon: "clock-plus-outline", label: "Requests" },
  { key: "system", icon: "server-security", label: "System" },
] as const;

const TimelineSidebar = memo(
  ({ activeFilter, onFilterChange, stats }: TimelineSidebarProps) => {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { onPress } = useHaptics();

    const handleShortcutPress = useCallback(
      (route: string) => {
        onPress();
        router.push(route as any);
      },
      [onPress, router],
    );

    const handleFilterPress = useCallback(
      (key: string) => {
        onPress();
        onFilterChange(key);
      },
      [onPress, onFilterChange],
    );

    const styles = StyleSheet.create({
      container: {
        width: 72,
        backgroundColor: theme.colors.elevation.level1,
        borderRightWidth: 1,
        borderRightColor: theme.colors.outlineVariant,
        paddingTop: insets.top,
      },
      scrollContent: {
        paddingBottom: theme.custom.spacing.xl + insets.bottom,
      },
      sectionLabel: {
        fontSize: 9,
        fontWeight: "700",
        color: theme.colors.onSurfaceVariant,
        textTransform: "uppercase",
        textAlign: "center",
        marginTop: theme.custom.spacing.md,
        marginBottom: theme.custom.spacing.xs,
        letterSpacing: 1,
      },
      filterButton: {
        alignItems: "center",
        paddingVertical: theme.custom.spacing.xs,
        marginHorizontal: theme.custom.spacing.xxs,
        borderRadius: theme.custom.sizes.borderRadius.lg,
        marginBottom: 2,
      },
      filterButtonActive: {
        backgroundColor: theme.colors.primaryContainer,
      },
      filterIcon: {
        width: 36,
        height: 36,
        borderRadius: theme.custom.sizes.borderRadius.md,
        justifyContent: "center",
        alignItems: "center",
      },
      filterIconActive: {
        backgroundColor: theme.colors.primary,
      },
      filterIconInactive: {
        backgroundColor: "transparent",
      },
      filterLabel: {
        fontSize: 9,
        fontWeight: "500",
        color: theme.colors.onSurfaceVariant,
        marginTop: 2,
      },
      filterLabelActive: {
        color: theme.colors.primary,
        fontWeight: "700",
      },
      divider: {
        height: 1,
        backgroundColor: theme.colors.outlineVariant,
        marginVertical: theme.custom.spacing.sm,
        marginHorizontal: theme.custom.spacing.sm,
        opacity: 0.5,
      },
      shortcutButton: {
        alignItems: "center",
        paddingVertical: theme.custom.spacing.xs,
        marginHorizontal: theme.custom.spacing.xxs,
        borderRadius: theme.custom.sizes.borderRadius.lg,
        marginBottom: 2,
      },
      shortcutIcon: {
        width: 36,
        height: 36,
        borderRadius: theme.custom.sizes.borderRadius.md,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.surfaceVariant,
      },
      shortcutLabel: {
        fontSize: 9,
        fontWeight: "500",
        color: theme.colors.onSurfaceVariant,
        marginTop: 2,
        textAlign: "center",
      },
      badge: {
        position: "absolute",
        top: 0,
        right: 4,
        backgroundColor: theme.colors.error,
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
      },
      badgeText: {
        fontSize: 9,
        fontWeight: "700",
        color: theme.colors.onError,
      },
      statBadge: {
        position: "absolute",
        top: -2,
        right: 2,
        backgroundColor: theme.colors.tertiary,
        borderRadius: 7,
        minWidth: 14,
        height: 14,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 3,
      },
      statBadgeText: {
        fontSize: 8,
        fontWeight: "700",
        color: theme.colors.onTertiary,
      },
    });

    const getFilterBadge = (key: string): number => {
      switch (key) {
        case "downloads":
          return stats.downloading + stats.queued;
        case "schedule":
          return stats.upcoming;
        case "requests":
          return stats.pendingRequests;
        case "system":
          return stats.offline + stats.lowDisk;
        default:
          return 0;
      }
    };

    return (
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionLabel}>Filter</Text>
          {filterItems.map((item) => {
            const isActive = activeFilter === item.key;
            const badge = getFilterBadge(item.key);

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterPress(item.key)}
                activeOpacity={0.7}
              >
                <View style={styles.shortcutIcon}>
                  <View
                    style={[
                      styles.filterIcon,
                      isActive
                        ? styles.filterIconActive
                        : styles.filterIconInactive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={18}
                      color={
                        isActive
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </View>
                  {badge > 0 && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>
                        {badge > 9 ? "9+" : badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.filterLabel,
                    isActive && styles.filterLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Go To</Text>
          {shortcuts.map((shortcut) => (
            <TouchableOpacity
              key={shortcut.route}
              style={styles.shortcutButton}
              onPress={() => handleShortcutPress(shortcut.route)}
              activeOpacity={0.7}
            >
              <View style={styles.shortcutIcon}>
                <MaterialCommunityIcons
                  name={shortcut.icon as any}
                  size={18}
                  color={theme.colors.onSurfaceVariant}
                />
                {shortcut.badge != null && shortcut.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{shortcut.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  },
);

TimelineSidebar.displayName = "TimelineSidebar";

export default TimelineSidebar;
