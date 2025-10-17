import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Text, FAB, useTheme, Portal, Modal, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { ResponsiveGrid } from "@/components/common/ResponsiveGrid";
import ServiceStatusWidget from "../ServiceStatusWidget/ServiceStatusWidget";
import DownloadProgressWidget from "../DownloadProgressWidget/DownloadProgressWidget";

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
  const theme = useTheme<AppTheme>();
  const { spacing } = useResponsiveLayout();
  const { onPress } = useHaptics();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWidgets();
  }, []);

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

  const handleRefresh = async () => {
    onPress();
    setRefreshing(true);
    await loadWidgets();
    setRefreshing(false);
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
      case "download-progress":
        return (
          <DownloadProgressWidget
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

  const getWidgetSize = (size: "small" | "medium" | "large") => {
    switch (size) {
      case "small":
        return 160;
      case "medium":
        return 240;
      case "large":
        return 320;
      default:
        return 240;
    }
  };

  const renderGridItem = (widget: Widget) => {
    const itemWidth = getWidgetSize(widget.size);
    return (
      <View style={[styles.gridItem, { width: itemWidth }]}>
        {renderWidget(widget)}
      </View>
    );
  };

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
              /* TODO: Open widget settings */
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: spacing.medium },
        ]}
      >
        <ResponsiveGrid
          data={widgets}
          renderItem={renderGridItem}
          keyExtractor={(widget) => widget.id}
          itemWidth={240} // Default width, widgets will override this
          spacing={spacing.medium}
        />
      </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
  },
  gridItem: {
    // Width is set dynamically
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
