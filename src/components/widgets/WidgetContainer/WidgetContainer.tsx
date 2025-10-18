import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, FAB, useTheme, Portal, Modal, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { spacing } from "@/theme/spacing";
import ServiceStatusWidget from "../ServiceStatusWidget/ServiceStatusWidget";
import DownloadProgressWidget from "../DownloadProgressWidget/DownloadProgressWidget";
import RecentActivityWidget from "../RecentActivityWidget/RecentActivityWidget";
import StatisticsWidget from "../StatisticsWidget/StatisticsWidget";
import CalendarPreviewWidget from "../CalendarPreviewWidget/CalendarPreviewWidget";
import ShortcutsWidget from "../ShortcutsWidget/ShortcutsWidget";

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

  const loadWidgets = async () => {
    try {
      await widgetService.initialize();
      const availableWidgets = await widgetService.getWidgets();
      const enabledWidgets = availableWidgets.filter((w) => w.enabled);
      setWidgets(enabledWidgets);
    } catch (error) {
      console.error("Failed to load widgets:", error);
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

  const handleRefresh = async () => {
    onPress();
    await loadWidgets();
  };

  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case "service-status":
        return (
          <ServiceStatusWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "shortcuts":
        return (
          <ShortcutsWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "download-progress":
        return (
          <DownloadProgressWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "recent-activity":
        return (
          <RecentActivityWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "statistics":
        return (
          <StatisticsWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleRefresh}
            onEdit={editing ? () => handleEditWidget(widget) : undefined}
          />
        );
      case "calendar-preview":
        return (
          <CalendarPreviewWidget
            key={widget.id}
            widget={widget}
            onRefresh={handleRefresh}
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
    // TODO: Open widget configuration modal
    console.log("Edit widget:", widget);
  };

  const handleToggleWidget = async (widgetId: string) => {
    onPress();
    await widgetService.toggleWidget(widgetId);
    await loadWidgets();
  };

  // widget size helper removed (unused)

  if (widgets.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="widgets"
            size={64}
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
        <FAB icon="cog" style={styles.fab} onPress={() => setEditing(true)} />
      )}

      {/* Widget Settings Modal */}
      <Portal>
        <Modal
          visible={editing}
          onDismiss={() => setEditing(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalContent}>
            <Text variant="headlineMedium">Widget Settings</Text>

            <ScrollView style={styles.widgetList}>
              {widgets.map((widget) => (
                <View key={widget.id} style={styles.widgetListItem}>
                  <View style={styles.widgetInfo}>
                    <Text variant="titleMedium">{widget.title}</Text>
                    <Text variant="bodySmall">{widget.type}</Text>
                  </View>
                  <View style={styles.widgetActions}>
                    <Button
                      mode={widget.enabled ? "outlined" : "contained"}
                      onPress={() => handleToggleWidget(widget.id)}
                      compact
                    >
                      {widget.enabled ? "Disable" : "Enable"}
                    </Button>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={() => setEditing(false)}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button mode="contained" onPress={() => setEditing(false)}>
                Done
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  widgetsContainer: {
    flex: 1,
    gap: spacing.lg,
  },
  widgetWrapper: {
    // Each widget handles its own styling
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    opacity: 0.7,
  },
  setupButton: {
    marginTop: 24,
  },
  placeholderWidget: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    minHeight: 200,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: "80%",
  },
  modalContent: {
    flex: 1,
  },
  widgetList: {
    marginVertical: 20,
  },
  widgetListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  widgetInfo: {
    flex: 1,
  },
  widgetActions: {
    flexDirection: "row",
    gap: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    marginRight: "auto",
  },
});

export default WidgetContainer;
