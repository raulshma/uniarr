import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Modal } from "react-native";
import { Text, FAB, useTheme, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { gapSizes } from "@/constants/sizes";
import { createFlexLayout } from "@/utils/style.utils";

import ServiceStatusWidget from "../ServiceStatusWidget/ServiceStatusWidget";
import DownloadProgressWidget from "../DownloadProgressWidget/DownloadProgressWidget";
import RecentActivityWidget from "../RecentActivityWidget/RecentActivityWidget";
import StatisticsWidget from "../StatisticsWidget/StatisticsWidget";
import CalendarPreviewWidget from "../CalendarPreviewWidget/CalendarPreviewWidget";
import ShortcutsWidget from "../ShortcutsWidget/ShortcutsWidget";
import BookmarksWidget from "../BookmarksWidget/BookmarksWidget";

export interface WidgetContainerProps {
  /**
   * Enable widget editing
   * @default false
   */
  editable?: boolean;
  /**
   * Custom style for the container
   */
  style?: any;
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
  editable = false,
  style,
}) => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadWidgets = async () => {
    try {
      setIsLoading(true);
      await widgetService.initialize();
      const availableWidgets = await widgetService.getWidgets();
      const enabledWidgets = availableWidgets.filter((w) => w.enabled);
      setWidgets(enabledWidgets);
    } catch (error) {
      console.error("Failed to load widgets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  // Reload widgets when the screen gains focus (after returning from settings)
  useFocusEffect(
    React.useCallback(() => {
      // Refresh widgets from storage in case they were reordered
      void (async () => {
        await widgetService.refreshWidgetsFromStorage();
        await loadWidgets();
      })();
      return () => {
        // Cleanup function (optional)
      };
    }, []),
  );

  const handleGlobalRefresh = async () => {
    onPress();
    await loadWidgets();
  };

  // No-op refresh callback - widgets handle their own refresh internally
  const handleWidgetRefresh = () => {
    onPress();
  };

  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case "service-status":
        return (
          <ServiceStatusWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "shortcuts":
        return (
          <ShortcutsWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "download-progress":
        return (
          <DownloadProgressWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "recent-activity":
        return (
          <RecentActivityWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "statistics":
        return (
          <StatisticsWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "calendar-preview":
        return (
          <CalendarPreviewWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "bookmarks":
        return (
          <BookmarksWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleWidgetRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      default:
        return (
          <View key={widget.id} style={styles.placeholderWidget}>
            <Text variant="titleMedium">{widget.title}</Text>
            <Text variant="bodySmall">Widget not implemented</Text>
          </View>
        );
    }
  };

  const handleEditWidget = (widget: Widget) => {
    onPress();
    // Navigate to widget-specific settings if available
    switch (widget.type) {
      case "service-status":
        // Navigate to service connections settings
        router.push("/(auth)/settings/connections");
        break;
      case "shortcuts":
        // Navigate to shortcuts settings
        router.push("/(auth)/settings/shortcuts");
        break;
      case "bookmarks":
        // Navigate to bookmarks settings
        router.push({
          pathname: "/(auth)/settings/bookmarks",
          params: { widgetId: widget.id },
        });
        break;
      case "download-progress":
        // Navigate to download settings
        router.push("/(auth)/settings/downloads");
        break;
      default:
        // For widgets without specific settings, go to general widget settings
        router.push("/(auth)/settings/widgets");
        break;
    }
  };

  const handleToggleWidget = async (widgetId: string) => {
    onPress();
    await widgetService.toggleWidget(widgetId);
    await loadWidgets();
  };

  // widget size helper removed (unused)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        widgetsContainer: {
          flex: 1,
          gap: theme.custom.spacing.lg,
        },
        widgetWrapper: {
          // Each widget handles its own styling
        },
        emptyState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: theme.custom.spacing.xxxxl, // 64 -> xxxxl
        },
        emptyTitle: {
          marginTop: theme.custom.spacing.md,
          fontWeight: "600",
        },
        emptyText: {
          marginTop: theme.custom.spacing.sm,
          textAlign: "center",
          opacity: 0.7,
        },
        setupButton: {
          marginTop: theme.custom.spacing.lg,
        },
        placeholderWidget: {
          padding: theme.custom.spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.05)",
          borderRadius: theme.custom.sizes.borderRadius.md,
          minHeight: theme.custom.spacing.xxxxl + theme.custom.spacing.lg, // 200 -> centralized spacing
        },
        fab: {
          position: "absolute",
          margin: theme.custom.spacing.md,
          right: 0,
          bottom: 0,
        },
        widgetList: {
          marginVertical: theme.custom.spacing.lg,
        },
        widgetListItem: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: theme.custom.spacing.lg,
          paddingHorizontal: theme.custom.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.08)",
        },
        widgetInfo: {
          flex: 1,
        },
        widgetActions: {
          flexDirection: "row",
          gap: gapSizes.lg,
        },
        emptyModalState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: theme.custom.spacing.xxl,
        },
        fullScreenModal: {
          flex: 1,
        },
        modalHeader: {
          ...createFlexLayout("row", "lg", {
            justify: "space-between",
            align: "center",
          }),
          paddingVertical: theme.custom.spacing.lg, // 20 -> lg
          borderBottomWidth: 1,
        },
        modalScrollContent: {
          flex: 1,
          paddingHorizontal: theme.custom.spacing.lg, // 24 -> lg
          paddingTop: theme.custom.spacing.xs, // 8 -> xs
          paddingBottom: theme.custom.spacing.lg, // 24 -> lg
        },
      }),
    [theme],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="loading"
            size={theme.custom.sizes.iconSizes.xxxl}
            color={theme.colors.primary}
          />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Loading widgets...
          </Text>
        </View>
      </View>
    );
  }

  if (widgets.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="widgets"
            size={theme.custom.sizes.iconSizes.xxxl}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No widgets enabled
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Add widgets to see your service status and activity at a glance
          </Text>
          <Button
            mode="outlined"
            onPress={() => {
              router.push("/(auth)/settings/widgets");
            }}
            style={styles.setupButton}
          >
            Set Up Widgets
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.widgetsContainer}>
        {widgets.map((widget) => (
          <View key={widget.id} style={styles.widgetWrapper}>
            {renderWidget(widget)}
          </View>
        ))}
      </View>

      {editable && (
        <FAB
          icon="cog"
          size="small"
          style={styles.fab}
          onPress={() => {
            onPress();
            setEditing(true);
          }}
        />
      )}

      {/* Widget Settings Modal */}
      <Modal
        visible={editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: theme.colors.outline },
            ]}
          >
            <Text
              variant="headlineLarge"
              style={{ color: theme.colors.onBackground }}
            >
              Widget Settings
            </Text>
            <Button
              mode="text"
              onPress={() => setEditing(false)}
              textColor={theme.colors.primary}
              labelStyle={{ fontWeight: "600" }}
            >
              Done
            </Button>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {widgets.length > 0 ? (
              widgets.map((widget) => (
                <View
                  key={widget.id}
                  style={[
                    styles.widgetListItem,
                    { borderBottomColor: theme.colors.outline },
                  ]}
                >
                  <View style={styles.widgetInfo}>
                    <Text
                      variant="titleLarge"
                      style={{ color: theme.colors.onBackground }}
                    >
                      {widget.title}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {widget.type}
                    </Text>
                  </View>
                  <View style={styles.widgetActions}>
                    <Button
                      mode={widget.enabled ? "outlined" : "contained"}
                      onPress={() => handleToggleWidget(widget.id)}
                    >
                      {widget.enabled ? "Disable" : "Enable"}
                    </Button>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyModalState}>
                <MaterialCommunityIcons
                  name="widgets-outline"
                  size={theme.custom.sizes.iconSizes.xxxl}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: theme.custom.spacing.md,
                  }}
                >
                  No widgets available
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: theme.custom.spacing.sm,
                    textAlign: "center",
                  }}
                >
                  Please check your widget configuration
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default WidgetContainer;
