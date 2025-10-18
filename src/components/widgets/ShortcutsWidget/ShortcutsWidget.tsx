import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";
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

  const [shortcuts, setShortcuts] = React.useState<Shortcut[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load shortcuts configuration
  React.useEffect(() => {
    loadShortcuts();
  }, [widget.id]);

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
      console.error("Failed to load shortcuts:", error);
      // Fallback to default shortcuts
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
    } finally {
      setLoading(false);
    }
  };

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
          columns: 3,
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
              size={20}
              color={theme.colors.onSurfaceVariant}
              onPress={onEdit}
            />
          )}
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons
            name="loading"
            size={24}
            color={theme.colors.primary}
          />
          <Text variant="bodySmall" style={styles.loadingText}>
            Loading shortcuts...
          </Text>
        </View>
      </View>
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
              size={20}
              color={theme.colors.onSurfaceVariant}
              onPress={onEdit}
            />
          )}
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="gesture-tap"
            size={32}
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
            size={20}
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

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: spacing.md,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    maxHeight: 100,
  },
  mediumScrollContainer: {
    maxHeight: 140,
  },
  largeScrollContainer: {
    maxHeight: 180,
  },
  scrollContent: {
    paddingBottom: spacing.xs,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    opacity: 0.7,
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
