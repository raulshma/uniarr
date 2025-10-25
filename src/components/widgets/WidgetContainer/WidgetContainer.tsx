import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Modal } from "react-native";
import Animated from "react-native-reanimated";
import { Text, FAB, useTheme, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { gapSizes } from "@/constants/sizes";
import { FadeIn, FadeOut, ANIMATION_DURATIONS } from "@/utils/animations.utils";
import { Card } from "@/components/common/Card";
import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedScrollView as AnimatedScroll,
} from "@/components/common/AnimatedComponents";

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

  const handleDismissModal = () => {
    onPress();
    setEditing(false);
  };

  const getWidgetIcon = (type: string): any => {
    const iconMap: Record<string, string> = {
      "service-status": "server-network",
      shortcuts: "gesture-tap",
      "download-progress": "download",
      "recent-activity": "clock-time-three",
      statistics: "chart-box",
      "calendar-preview": "calendar",
      bookmarks: "bookmark",
    };
    return iconMap[type] || "widgets";
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
        /* Modal styles updated for design consistency */
        modalOverlay: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        modalScrollContainer: {
          paddingBottom: theme.custom.spacing.lg,
        },
        modalContent: {
          paddingHorizontal: theme.custom.spacing.lg,
          paddingTop: theme.custom.spacing.md,
          paddingBottom: theme.custom.spacing.lg,
          gap: theme.custom.spacing.sm,
        },
        widgetListCard: {
          backgroundColor: theme.colors.elevation.level1,
          marginVertical: theme.custom.spacing.xs / 2,
        },
        widgetListContent: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.md,
        },
        widgetIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
        },
        widgetListInfo: {
          flex: 1,
        },
        emptyModalState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: theme.custom.spacing.xxl,
        },
        loadingSkeleton: {
          gap: theme.custom.spacing.lg,
        },
        skeletonWidget: {
          borderRadius: theme.custom.sizes.borderRadius.xl,
          overflow: "hidden",
        },
      }),
    [theme],
  );

  if (isLoading) {
    return (
      <Animated.View
        style={[styles.container, style]}
        entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.NORMAL)}
      >
        <View style={styles.loadingSkeleton}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonWidget}>
              <SkeletonPlaceholder
                width="100%"
                height={120}
                borderRadius={theme.custom.sizes.borderRadius.xl}
              />
            </View>
          ))}
        </View>
      </Animated.View>
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
        onRequestClose={handleDismissModal}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <AnimatedScroll contentContainerStyle={styles.modalScrollContainer}>
            <TabHeader
              title="Widget Settings"
              showTitle={true}
              leftAction={{
                icon: "close",
                onPress: handleDismissModal,
              }}
            />

            <View style={styles.modalContent}>
              {widgets.length > 0 ? (
                widgets.map((widget, index) => (
                  <AnimatedListItem
                    key={widget.id}
                    index={index}
                    totalItems={widgets.length}
                  >
                    <Card
                      variant="custom"
                      style={styles.widgetListCard}
                      onPress={() => {
                        onPress();
                        handleEditWidget(widget);
                      }}
                    >
                      <View style={styles.widgetListContent}>
                        <View style={styles.widgetIcon}>
                          <MaterialCommunityIcons
                            name={getWidgetIcon(widget.type)}
                            size={20}
                            color={theme.colors.primary}
                          />
                        </View>
                        <View style={styles.widgetListInfo}>
                          <Text
                            variant="titleSmall"
                            style={{ color: theme.colors.onSurface }}
                          >
                            {widget.title}
                          </Text>
                          <Text
                            variant="bodySmall"
                            style={{
                              color: theme.colors.onSurfaceVariant,
                              marginTop: 2,
                            }}
                          >
                            {widget.type}
                          </Text>
                        </View>
                        <Button
                          mode={widget.enabled ? "outlined" : "contained"}
                          compact
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleToggleWidget(widget.id);
                          }}
                          style={{ marginLeft: "auto" }}
                        >
                          {widget.enabled ? "Disable" : "Enable"}
                        </Button>
                      </View>
                    </Card>
                  </AnimatedListItem>
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
            </View>
          </AnimatedScroll>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default WidgetContainer;
