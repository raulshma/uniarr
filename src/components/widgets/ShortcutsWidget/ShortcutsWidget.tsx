import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { Widget } from "@/services/widgets/WidgetService";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { widgetService } from "@/services/widgets/WidgetService";
import {
  FadeIn,
  FadeOut,
  ANIMATION_DURATIONS,
  Animated,
} from "@/utils/animations.utils";
import { Card } from "@/components/common";
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import ShortcutItem from "./ShortcutItem";
import type { Shortcut } from "./ShortcutsWidget.types";
import { useSettingsStore } from "@/store/settingsStore";

interface ShortcutsWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

const ShortcutsWidget: React.FC<ShortcutsWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const router = useRouter();
  const theme = useTheme();
  const { onPress: hapticPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const styles = useStyles(theme);

  const [shortcuts, setShortcuts] = React.useState<Shortcut[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load shortcuts configuration
  React.useEffect(() => {
    const loadShortcuts = async () => {
      try {
        await widgetService.initialize();
        const widgetConfig = await widgetService.getWidget(widget.id);

        if (widgetConfig?.config?.shortcuts) {
          setShortcuts(
            widgetConfig.config.shortcuts.filter((s: Shortcut) => s.enabled),
          );
        } else {
          // Use default shortcuts if none configured
          setShortcuts([
            {
              id: "discover",
              label: "Discover",
              icon: "compass",
              route: "/(auth)/discover",
              enabled: true,
            },
            {
              id: "search",
              label: "Search",
              icon: "magnify",
              route: "/(auth)/dashboard/search",
              enabled: true,
            },
            {
              id: "calendar",
              label: "Calendar",
              icon: "calendar",
              route: "/(auth)/calendar",
              enabled: true,
            },
            {
              id: "anime",
              label: "Anime Hub",
              icon: "play-circle",
              route: "/(auth)/anime-hub",
              enabled: true,
            },
            {
              id: "jellyfin-downloads",
              label: "Downloads",
              icon: "download",
              route: "/(auth)/jellyfin-downloads",
              enabled: true,
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to load shortcuts configuration:", error);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    };

    loadShortcuts();
  }, [widget.id]);

  const handleShortcutPress = (shortcut: Shortcut) => {
    hapticPress();

    try {
      // Navigate to the shortcut's route
      router.push(shortcut.route);
    } catch (error) {
      console.error(`Failed to navigate to ${shortcut.route}:`, error);
    }
  };

  const getGridLayout = () => {
    const { size } = widget;
    const shortcutCount = shortcuts.filter((s) => s.enabled).length;

    // Determine layout based on shortcut count
    let columns = 2;
    let compact = false;

    if (shortcutCount > 6) {
      columns = 4;
      compact = true;
    } else if (shortcutCount > 4) {
      columns = 3;
      compact = true;
    }

    switch (size) {
      case "small":
        return {
          container: styles.smallContainer,
          scrollContainer: styles.smallScrollContainer,
          columns,
          compact,
        };
      case "large":
        return {
          container: styles.largeContainer,
          scrollContainer: styles.largeScrollContainer,
          columns,
          compact,
        };
      default: // medium
        return {
          container: styles.mediumContainer,
          scrollContainer: styles.mediumScrollContainer,
          columns,
          compact,
        };
    }
  };

  const gridLayout = getGridLayout();

  const getSkeletonSizeStyles = (size: string) => {
    switch (size) {
      case "small":
        return styles.smallSkeletonShortcut;
      case "large":
        return styles.largeSkeletonShortcut;
      default: // medium
        return styles.mediumSkeletonShortcut;
    }
  };

  const getSkeletonIconSize = (size: string) => {
    switch (size) {
      case "small":
        return styles.smallSkeletonIcon;
      case "large":
        return styles.largeSkeletonIcon;
      default: // medium
        return styles.mediumSkeletonIcon;
    }
  };

  const getSkeletonTextWidth = (size: string): number => {
    switch (size) {
      case "small":
        return 45;
      case "large":
        return 80;
      default: // medium
        return 60;
    }
  };

  const getSkeletonTextHeight = (size: string): number => {
    switch (size) {
      case "small":
        return 12;
      case "large":
        return 18;
      default: // medium
        return 14;
    }
  };

  if (loading) {
    return (
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
        <Animated.View
          style={[styles.container, gridLayout.container]}
          entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
          exiting={FadeOut.duration(ANIMATION_DURATIONS.NORMAL)}
        >
          <WidgetHeader
            title={widget.title}
            icon="gesture-tap"
            onEdit={onEdit}
          />
          <View style={styles.loadingSkeleton}>
            {Array.from({ length: gridLayout.columns * 2 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.skeletonShortcut,
                  getSkeletonSizeStyles(widget.size),
                ]}
              >
                <View
                  style={[
                    styles.skeletonIcon,
                    getSkeletonIconSize(widget.size),
                  ]}
                />
                <SkeletonPlaceholder
                  width={getSkeletonTextWidth(widget.size)}
                  height={getSkeletonTextHeight(widget.size)}
                  borderRadius={4}
                  style={{ marginLeft: spacing.sm }}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      </Card>
    );
  }

  const enabledShortcuts = shortcuts.filter((s) => s.enabled);

  if (enabledShortcuts.length === 0) {
    return (
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
        <View style={[styles.container, gridLayout.container]}>
          <WidgetHeader
            title={widget.title}
            icon="gesture-tap"
            onEdit={onEdit}
          />
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="gesture-tap"
              size={theme.custom.sizes.iconSizes.xxl}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="bodySmall" style={styles.emptyText}>
              No shortcuts configured
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
      <View style={[styles.container, gridLayout.container]}>
        <WidgetHeader title={widget.title} icon="gesture-tap" onEdit={onEdit} />

        <ScrollView
          style={gridLayout.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.gridContainer,
              gridLayout.compact && styles.compactGridContainer,
            ]}
          >
            {enabledShortcuts.map((shortcut) => (
              <ShortcutItem
                key={shortcut.id}
                shortcut={shortcut}
                onPress={handleShortcutPress}
                size={widget.size}
                compact={gridLayout.compact}
                columns={gridLayout.columns}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </Card>
  );
};

const useStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xl,
    },
    container: {
      borderRadius: borderRadius.xl,
      width: "100%",
    },
    smallContainer: {
      minHeight: 140,
    },
    mediumContainer: {
      minHeight: 180,
    },
    largeContainer: {
      minHeight: 220,
    },
    smallScrollContainer: {
      maxHeight: 160,
      width: "100%",
    },
    mediumScrollContainer: {
      maxHeight: 220,
      width: "100%",
    },
    largeScrollContainer: {
      maxHeight: 280,
      width: "100%",
    },
    scrollContent: {
      paddingBottom: spacing.md,
      width: "100%",
    },
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.md,
      width: "100%",
      flex: 1,
    },
    compactGridContainer: {
      justifyContent: "flex-start",
      gap: spacing.sm,
    },
    loadingSkeleton: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-around",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    skeletonShortcut: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      borderRadius: borderRadius.xxl,
      paddingVertical: spacing.xs,
      minHeight: 48,
      backgroundColor: "rgba(255, 255, 255, 0.03)", // Subtle frosted skeleton
      width: "47%",
    },
    smallSkeletonShortcut: {
      minHeight: 44,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    mediumSkeletonShortcut: {
      minHeight: 48,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    largeSkeletonShortcut: {
      minHeight: 56,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    skeletonIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.onSurfaceVariant,
      opacity: 0.3,
    },
    smallSkeletonIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    mediumSkeletonIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    largeSkeletonIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.lg,
    },
    emptyText: {
      marginTop: spacing.sm,
      opacity: 0.7,
    },
  });

export default ShortcutsWidget;
