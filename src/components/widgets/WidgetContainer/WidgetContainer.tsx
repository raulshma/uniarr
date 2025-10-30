import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, StyleSheet, Modal } from "react-native";
import { Text, FAB, useTheme, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";

import { gapSizes } from "@/constants/sizes";
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
import RssWidget from "../RssWidget/RssWidget";
import RedditWidget from "../RedditWidget/RedditWidget";
import HackerNewsWidget from "../HackerNewsWidget/HackerNewsWidget";
import WeatherWidget from "../WeatherWidget/WeatherWidget";
import YouTubeWidget from "../YouTubeWidget/YouTubeWidget";
import TwitchWidget from "../TwitchWidget/TwitchWidget";

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

const WidgetContainer: React.FC<WidgetContainerProps> = React.memo(
  ({ editable = false, style }) => {
    const router = useRouter();
    const theme = useTheme<AppTheme>();
    const { onPress } = useHaptics();
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [editing, setEditing] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadWidgets = useCallback(async () => {
      try {
        await widgetService.initialize();
        const availableWidgets = await widgetService.getWidgets();
        const enabledWidgets = availableWidgets.filter((w) => w.enabled);
        setWidgets(enabledWidgets);
      } catch (error) {
        console.error("Failed to load widgets:", error);
      } finally {
        setHasLoaded(true);
      }
    }, []);

    useEffect(() => {
      loadWidgets();
      // eslint-disable-next-line react-compiler/react-compiler
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reload widgets when the screen gains focus (after returning from settings)
    useFocusEffect(
      useCallback(() => {
        // Refresh widgets from storage in case they were reordered
        void (async () => {
          await widgetService.refreshWidgetsFromStorage();
          await loadWidgets();
        })();
        return () => {
          // Cleanup function (optional)
        };
      }, [loadWidgets]),
    );

    // No-op refresh callback - widgets handle their own refresh internally
    const handleWidgetRefresh = useCallback(() => {
      onPress();
    }, [onPress]);

    const handleEditWidget = useCallback(
      (widget: Widget) => {
        onPress();

        const pushWidgetConfig = () =>
          router.push({
            pathname: "/(auth)/settings/widgets/configure",
            params: { widgetId: widget.id },
          });

        switch (widget.type) {
          case "service-status":
            router.push("/(auth)/settings/connections");
            break;
          case "bookmarks":
            router.push({
              pathname: "/(auth)/settings/bookmarks",
              params: { widgetId: widget.id },
            });
            break;
          case "recent-activity":
            router.push("/(auth)/settings/recent-activity-sources");
            break;
          case "shortcuts":
          case "download-progress":
          case "statistics":
          case "calendar-preview":
          case "rss-feed":
          case "subreddit":
          case "hacker-news":
          case "weather":
          case "youtube":
          case "twitch":
            pushWidgetConfig();
            break;
          default:
            router.push("/(auth)/settings/widgets");
            break;
        }
      },
      [onPress, router],
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            flex: 1,
          },
          widgetsContainer: {
            flex: 1,
            gap: theme.custom.spacing.lg,
            padding: theme.custom.spacing.sm,
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
        }),
      [theme],
    );

    const renderWidget = useCallback(
      (widget: Widget) => {
        const editHandler = editable
          ? () => handleEditWidget(widget)
          : undefined;

        switch (widget.type) {
          case "service-status":
            return (
              <ServiceStatusWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "shortcuts":
            return (
              <ShortcutsWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "download-progress":
            return (
              <DownloadProgressWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "recent-activity":
            return (
              <RecentActivityWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "statistics":
            return (
              <StatisticsWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "calendar-preview":
            return (
              <CalendarPreviewWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "bookmarks":
            return (
              <BookmarksWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
                isEditing={editing}
              />
            );
          case "rss-feed":
            return (
              <RssWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "subreddit":
            return (
              <RedditWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "hacker-news":
            return (
              <HackerNewsWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "weather":
            return (
              <WeatherWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "youtube":
            return (
              <YouTubeWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
              />
            );
          case "twitch":
            return (
              <TwitchWidget
                key={widget.id}
                widget={widget}
                onRefresh={handleWidgetRefresh}
                onEdit={editHandler}
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
      },
      [
        editable,
        editing,
        styles.placeholderWidget,
        handleEditWidget,
        handleWidgetRefresh,
      ],
    );

    const handleToggleWidget = useCallback(
      async (widgetId: string) => {
        onPress();
        await widgetService.toggleWidget(widgetId);
        await loadWidgets();
      },
      [onPress, loadWidgets],
    );

    const handleDismissModal = useCallback(() => {
      onPress();
      setEditing(false);
    }, [onPress]);

    const getWidgetIcon = useCallback((type: string): any => {
      const iconMap: Record<string, string> = {
        "service-status": "server-network",
        shortcuts: "gesture-tap",
        "download-progress": "download",
        "recent-activity": "clock-time-three",
        statistics: "chart-box",
        "calendar-preview": "calendar",
        bookmarks: "bookmark",
        "rss-feed": "rss",
        subreddit: "reddit",
        "hacker-news": "newspaper-variant",
        weather: "weather-partly-cloudy",
        youtube: "youtube",
        twitch: "twitch",
      };
      return iconMap[type] || "widgets";
    }, []);

    // Memoize rendered widgets to prevent unnecessary re-renders
    const renderedWidgets = useMemo(() => {
      return widgets.map((widget) => (
        <View key={widget.id} style={styles.widgetWrapper}>
          {renderWidget(widget)}
        </View>
      ));
    }, [widgets, renderWidget, styles.widgetWrapper]);

    // Show nothing while loading for seamless experience
    if (!hasLoaded) {
      return <View style={[styles.container, style]} />;
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
        <View style={styles.widgetsContainer}>{renderedWidgets}</View>

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
  },
);

WidgetContainer.displayName = "WidgetContainer";

export default WidgetContainer;
