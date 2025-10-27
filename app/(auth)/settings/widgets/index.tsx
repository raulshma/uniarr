import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Text,
  useTheme,
  Switch,
  Button,
  Portal,
  Dialog,
} from "react-native-paper";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TabHeader } from "@/components/common/TabHeader";
import { Card } from "@/components/common/Card";
import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

const WidgetSettingsScreen = () => {
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [sizeDialogVisible, setSizeDialogVisible] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [reorderingEnabled, setReorderingEnabled] = useState(false);
  const [localWidgets, setLocalWidgets] = useState<Widget[]>([]);

  useEffect(() => {
    loadWidgets();
  }, []);

  const loadWidgets = async () => {
    try {
      setLoading(true);
      await widgetService.initialize();
      const availableWidgets = await widgetService.getWidgets();
      setWidgets(availableWidgets);
      setLocalWidgets(availableWidgets);
    } catch (error) {
      console.error("Failed to load widgets:", error);
    } finally {
      setLoading(false);
    }
  };

  const moveWidget = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localWidgets.length) return;

    onPress();
    const newWidgets = [...localWidgets];
    const movedWidget = newWidgets[fromIndex];
    if (!movedWidget) return;

    newWidgets.splice(fromIndex, 1);
    newWidgets.splice(toIndex, 0, movedWidget);
    setLocalWidgets(newWidgets);
  };

  const saveReorder = async () => {
    try {
      const widgetIds = localWidgets.map((w) => w.id);
      await widgetService.reorderWidgets(widgetIds);
      // Refresh widgets without triggering the loading state
      const availableWidgets = await widgetService.getWidgets();
      setWidgets(availableWidgets);
      setLocalWidgets(availableWidgets);
      setReorderingEnabled(false);
    } catch (error) {
      console.error("Failed to save widget order:", error);
    }
  };

  const cancelReorder = async () => {
    // Just reset to current state without reloading
    const availableWidgets = await widgetService.getWidgets();
    setLocalWidgets(availableWidgets);
    setReorderingEnabled(false);
  };

  const handleToggleWidget = async (widgetId: string) => {
    onPress();
    try {
      await widgetService.toggleWidget(widgetId);
      await loadWidgets();
    } catch (error) {
      console.error("Failed to toggle widget:", error);
    }
  };

  const handleWidgetSizePress = (widget: Widget) => {
    onPress();
    setSelectedWidget(widget);
    setSizeDialogVisible(true);
  };

  const router = useRouter();

  const handleConfigure = async (widget: Widget) => {
    onPress();
    // For now we only have a settings page for recent activity widget
    if (widget.type === "recent-activity") {
      router.push("/(auth)/settings/recent-activity-sources");
    }
  };

  const handleWidgetSizeChange = async (size: "small" | "medium" | "large") => {
    if (!selectedWidget) return;

    try {
      await widgetService.updateWidget(selectedWidget.id, { size });
      await loadWidgets();
      setSizeDialogVisible(false);
      setSelectedWidget(null);
    } catch (error) {
      console.error("Failed to update widget size:", error);
    }
  };

  const handleResetToDefaults = async () => {
    onPress();
    try {
      await widgetService.resetToDefaults();
      await loadWidgets();
    } catch (error) {
      console.error("Failed to reset widgets:", error);
    }
  };

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case "service-status":
        return "server-network";
      case "shortcuts":
        return "gesture-tap";
      case "download-progress":
        return "download";
      case "recent-activity":
        return "clock-time-three";
      case "statistics":
        return "chart-box";
      case "calendar-preview":
        return "calendar";
      default:
        return "widgets";
    }
  };

  const getWidgetDescription = (type: string) => {
    switch (type) {
      case "service-status":
        return "Monitor connection status and response times";
      case "shortcuts":
        return "Quick access to your favorite app sections";
      case "download-progress":
        return "Track active and completed downloads";
      case "recent-activity":
        return "View recent imports and downloads";
      case "statistics":
        return "Library statistics and metadata";
      case "calendar-preview":
        return "Upcoming TV and movie releases";
      default:
        return "Widget description";
    }
  };

  const getSizeLabel = (size: "small" | "medium" | "large") => {
    switch (size) {
      case "small":
        return "Small (160px)";
      case "medium":
        return "Medium (240px)";
      case "large":
        return "Large (320px)";
      default:
        return size;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
    },
    widgetCard: {
      backgroundColor: theme.colors.elevation.level1,
      marginHorizontal: spacing.xs,
      marginVertical: spacing.xs / 2,
      borderRadius: 8,
      padding: spacing.sm,
    },
    widgetCardReordering: {
      backgroundColor: theme.colors.elevation.level2,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    widgetContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    reorderControls: {
      flexDirection: "row",
      gap: spacing.xxs,
      marginRight: spacing.xs,
    },
    widgetIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    widgetInfo: {
      flex: 1,
    },
    widgetTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
      fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
      marginBottom: 2,
    },
    widgetDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      marginBottom: 4,
    },
    widgetSize: {
      color: theme.colors.primary,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
    },
    widgetActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    actionButton: {
      marginHorizontal: 0,
      marginVertical: spacing.xs / 2,
    },
    resetButton: {
      marginHorizontal: 0,
      marginTop: spacing.md,
      marginBottom: spacing.xl,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 64,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      lineHeight: 22,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TabHeader title="Widget Settings" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading widgets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader title="Widget Settings" />

        <AnimatedSection style={styles.section} delay={50}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Widgets</Text>
            {widgets.length > 0 && (
              <Button
                mode={reorderingEnabled ? "contained" : "outlined"}
                compact
                onPress={() => setReorderingEnabled(!reorderingEnabled)}
                icon="drag"
              >
                {reorderingEnabled ? "Done" : "Reorder"}
              </Button>
            )}
          </View>
          {(reorderingEnabled ? localWidgets : widgets).map((widget, index) => (
            <AnimatedListItem
              key={widget.id}
              index={index}
              totalItems={
                reorderingEnabled ? localWidgets.length : widgets.length
              }
            >
              <Card
                variant="custom"
                style={[
                  styles.widgetCard,
                  reorderingEnabled && styles.widgetCardReordering,
                ]}
              >
                <View style={styles.widgetContent}>
                  {reorderingEnabled && (
                    <View style={styles.reorderControls}>
                      <Button
                        mode="text"
                        compact
                        icon="chevron-up"
                        onPress={() => moveWidget(index, index - 1)}
                        disabled={index === 0}
                        style={{ opacity: index === 0 ? 0.5 : 1 }}
                      >
                        Up
                      </Button>
                      <Button
                        mode="text"
                        compact
                        icon="chevron-down"
                        onPress={() => moveWidget(index, index + 1)}
                        disabled={
                          index ===
                          (reorderingEnabled
                            ? localWidgets.length - 1
                            : widgets.length - 1)
                        }
                        style={{
                          opacity:
                            index ===
                            (reorderingEnabled
                              ? localWidgets.length - 1
                              : widgets.length - 1)
                              ? 0.5
                              : 1,
                        }}
                      >
                        Down
                      </Button>
                    </View>
                  )}
                  <View style={styles.widgetIcon}>
                    <MaterialCommunityIcons
                      name={getWidgetIcon(widget.type)}
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.widgetInfo}>
                    <Text style={styles.widgetTitle}>{widget.title}</Text>
                    <Text style={styles.widgetDescription}>
                      {getWidgetDescription(widget.type)}
                    </Text>
                    <Text style={styles.widgetSize}>
                      Size: {getSizeLabel(widget.size)}
                    </Text>
                  </View>
                  {!reorderingEnabled && (
                    <View style={styles.widgetActions}>
                      {widget.type === "recent-activity" && (
                        <Button
                          mode="outlined"
                          compact
                          onPress={() => handleConfigure(widget)}
                          style={{ height: 32 }}
                        >
                          Configure
                        </Button>
                      )}
                      <Button
                        mode="contained-tonal"
                        compact
                        onPress={() => handleWidgetSizePress(widget)}
                        style={{ height: 32 }}
                      >
                        Resize
                      </Button>
                      <Switch
                        value={widget.enabled}
                        onValueChange={() => handleToggleWidget(widget.id)}
                        color={theme.colors.primary}
                      />
                    </View>
                  )}
                </View>
              </Card>
            </AnimatedListItem>
          ))}
        </AnimatedSection>

        <AnimatedSection style={styles.section} delay={100}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {reorderingEnabled && (
            <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              <AnimatedListItem index={0} totalItems={2}>
                <Button
                  mode="contained"
                  onPress={saveReorder}
                  style={styles.actionButton}
                  icon="check"
                >
                  Save Order
                </Button>
              </AnimatedListItem>
              <AnimatedListItem index={1} totalItems={2}>
                <Button
                  mode="outlined"
                  onPress={cancelReorder}
                  style={styles.actionButton}
                  icon="close"
                >
                  Cancel
                </Button>
              </AnimatedListItem>
            </View>
          )}
          <AnimatedListItem
            index={reorderingEnabled ? 2 : 0}
            totalItems={reorderingEnabled ? 3 : 1}
          >
            <Button
              mode="outlined"
              onPress={handleResetToDefaults}
              style={styles.resetButton}
              icon="restart"
            >
              Reset to Defaults
            </Button>
          </AnimatedListItem>
        </AnimatedSection>

        {widgets.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="widgets"
              size={64}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.emptyTitle}>No widgets available</Text>
            <Text style={styles.emptyText}>
              Something went wrong while loading widgets. Please try again.
            </Text>
          </View>
        )}

        {/* Widget Size Selection Dialog */}
        <Portal>
          <Dialog
            visible={sizeDialogVisible}
            onDismiss={() => {
              setSizeDialogVisible(false);
              setSelectedWidget(null);
            }}
            style={{
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Dialog.Title style={styles.sectionTitle}>
              Widget Size: {selectedWidget?.title}
            </Dialog.Title>
            <Dialog.Content>
              <Text
                style={{
                  ...styles.widgetDescription,
                  marginBottom: spacing.md,
                }}
              >
                Select the size for this widget:
              </Text>
              <View style={{ gap: spacing.xs }}>
                {(["small", "medium", "large"] as const).map((size) => (
                  <Button
                    key={size}
                    mode={
                      selectedWidget?.size === size ? "contained" : "outlined"
                    }
                    onPress={() => handleWidgetSizeChange(size)}
                    style={{ marginVertical: 0 }}
                  >
                    {getSizeLabel(size)}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                mode="outlined"
                onPress={() => {
                  setSizeDialogVisible(false);
                  setSelectedWidget(null);
                }}
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default WidgetSettingsScreen;
