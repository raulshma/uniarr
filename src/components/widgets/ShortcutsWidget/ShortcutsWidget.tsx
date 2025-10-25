import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { getComponentElevation } from "@/constants/elevation";
import type { Widget } from "@/services/widgets/WidgetService";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { widgetService } from "@/services/widgets/WidgetService";
import {
  FadeIn,
  FadeOut,
  ANIMATION_DURATIONS,
  Animated,
} from "@/utils/animations.utils";
import ShortcutItem from "./ShortcutItem";
import type { Shortcut } from "./ShortcutsWidget.types";

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
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();
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
              route: "/discover",
              enabled: true,
            },
            {
              id: "search",
              label: "Search",
              icon: "magnify",
              route: "/dashboard/search",
              enabled: true,
            },
            {
              id: "calendar",
              label: "Calendar",
              icon: "calendar",
              route: "/calendar",
              enabled: true,
            },
            {
              id: "anime",
              label: "Anime Hub",
              icon: "play-circle",
              route: "/anime-hub",
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

    switch (size) {
      case "small":
        return {
          container: styles.smallContainer,
          scrollContainer: styles.smallScrollContainer,
          columns: 2,
        };
      case "large":
        return {
          container: styles.largeContainer,
          scrollContainer: styles.largeScrollContainer,
          columns: 2,
        };
      default: // medium
        return {
          container: styles.mediumContainer,
          scrollContainer: styles.mediumScrollContainer,
          columns: 2,
        };
    }
  };

  const gridLayout = getGridLayout();

  if (loading) {
    return (
      <Animated.View
        style={[
          styles.container,
          gridLayout.container,
          { backgroundColor: theme.colors.surface },
        ]}
        entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.NORMAL)}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            {widget.title}
          </Text>
          {onEdit && (
            <MaterialCommunityIcons
              name="cog"
              size={theme.custom.sizes.iconSizes.lg}
              color={theme.colors.onSurfaceVariant}
              onPress={onEdit}
            />
          )}
        </View>
        <View style={styles.loadingSkeleton}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonShortcut}>
              <View style={styles.skeletonIcon} />
              <SkeletonPlaceholder
                width="70%"
                height={12}
                borderRadius={4}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  const enabledShortcuts = shortcuts.filter((s) => s.enabled);

  if (enabledShortcuts.length === 0) {
    return (
      <View
        style={[
          styles.container,
          gridLayout.container,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            {widget.title}
          </Text>
          {onEdit && (
            <MaterialCommunityIcons
              name="cog"
              size={theme.custom.sizes.iconSizes.lg}
              color={theme.colors.onSurfaceVariant}
              onPress={onEdit}
            />
          )}
        </View>
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
    );
  }

  return (
    <View
      style={[
        styles.container,
        gridLayout.container,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>
          {widget.title}
        </Text>
        {onEdit && (
          <MaterialCommunityIcons
            name="cog"
            size={theme.custom.sizes.iconSizes.lg}
            color={theme.colors.onSurfaceVariant}
            onPress={onEdit}
          />
        )}
      </View>

      <ScrollView
        style={gridLayout.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          {enabledShortcuts.map((shortcut) => (
            <ShortcutItem
              key={shortcut.id}
              shortcut={shortcut}
              onPress={handleShortcutPress}
              size={widget.size}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const useStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      ...getComponentElevation("widget", theme),
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    title: {
      fontWeight: "600",
    },
    smallScrollContainer: {
      maxHeight: 160,
    },
    mediumScrollContainer: {
      maxHeight: 220,
    },
    largeScrollContainer: {
      maxHeight: 280,
    },
    scrollContent: {
      paddingBottom: spacing.md,
    },
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-around",
      alignItems: "flex-start",
      gap: spacing.md,
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
      alignItems: "center",
      justifyContent: "center",
      width: "48%",
      padding: spacing.md,
    },
    skeletonIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.surfaceVariant,
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
