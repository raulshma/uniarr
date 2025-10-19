import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { widgetService } from "@/services/widgets/WidgetService";
import { getComponentElevation } from "@/constants/elevation";
import { borderRadius } from "@/constants/sizes";
import { healthCheckService } from "@/services/bookmarks/HealthCheckService";
import BookmarkItem from "./BookmarkItem";
import type {
  Bookmark,
  BookmarksWidgetProps,
  BookmarkHealth,
} from "./BookmarksWidget.types";

const BookmarksWidget: React.FC<BookmarksWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [health, setHealth] = useState<Map<string, BookmarkHealth>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isEditMode = Boolean(onEdit);

  const handleOpenConfig = useCallback(() => {
    void hapticPress();
    router.push({
      pathname: "/(auth)/settings/bookmarks",
      params: { widgetId: widget.id },
    });
  }, [hapticPress, router, widget.id]);

  // Load bookmarks configuration
  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        await widgetService.initialize();
        const widgetConfig = await widgetService.getWidget(widget.id);

        if (widgetConfig?.config?.bookmarks) {
          const enabledBookmarks = widgetConfig.config.bookmarks.filter(
            (b: Bookmark) => b.enabled,
          );
          setBookmarks(enabledBookmarks);

          // Initialize health checks
          await healthCheckService.initialize();
          enabledBookmarks.forEach((bookmark: Bookmark) => {
            if (bookmark.healthCheck?.enabled) {
              const cachedHealth = healthCheckService.getBookmarkHealth(
                bookmark.id,
              );
              if (cachedHealth) {
                setHealth((prev) =>
                  new Map(prev).set(bookmark.id, cachedHealth),
                );
              }

              healthCheckService.startHealthCheck(
                bookmark,
                bookmark.healthCheck,
                (bookmarkHealth: BookmarkHealth) => {
                  setHealth((prev) =>
                    new Map(prev).set(
                      bookmarkHealth.bookmarkId,
                      bookmarkHealth,
                    ),
                  );
                },
              );
            }
          });
        } else {
          setBookmarks([]);
        }
      } catch (error) {
        console.error("Failed to load bookmarks configuration:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();

    // Cleanup on unmount
    return () => {
      healthCheckService.stopAllHealthChecks();
    };
  }, [widget.id]);

  const handleBookmarkPress = useCallback(
    (bookmark: Bookmark) => {
      hapticPress();
      // URL opening is handled in BookmarkItem component
    },
    [hapticPress],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Reload configuration and restart health checks
      await healthCheckService.initialize();

      // Clear and restart health checks
      healthCheckService.stopAllHealthChecks();

      bookmarks.forEach((bookmark) => {
        if (bookmark.healthCheck?.enabled) {
          healthCheckService.startHealthCheck(
            bookmark,
            bookmark.healthCheck,
            (bookmarkHealth: BookmarkHealth) => {
              setHealth((prev) =>
                new Map(prev).set(bookmarkHealth.bookmarkId, bookmarkHealth),
              );
            },
          );
        }
      });

      onRefresh?.();
    } catch (error) {
      console.error("Failed to refresh bookmarks:", error);
    } finally {
      setRefreshing(false);
    }
  }, [bookmarks, onRefresh]);

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
  const containerElevationStyle = getComponentElevation("widget", theme);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          gridLayout.container,
          { backgroundColor: theme.colors.surface },
          containerElevationStyle,
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            {widget.title}
          </Text>
          <IconButton
            icon={isEditMode ? "pencil" : "cog"}
            size={20}
            onPress={isEditMode ? onEdit : handleOpenConfig}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons
            name="loading"
            size={theme.custom.sizes.iconSizes.lg}
            color={theme.colors.primary}
          />
          <Text variant="bodySmall" style={styles.loadingText}>
            Loading bookmarks...
          </Text>
        </View>
      </View>
    );
  }

  const enabledBookmarks = bookmarks.filter((b) => b.enabled);

  if (enabledBookmarks.length === 0) {
    return (
      <View
        style={[
          styles.container,
          gridLayout.container,
          { backgroundColor: theme.colors.surface },
          containerElevationStyle,
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            {widget.title}
          </Text>
          <IconButton
            icon={isEditMode ? "pencil" : "cog"}
            size={20}
            onPress={isEditMode ? onEdit : handleOpenConfig}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="link-box"
            size={theme.custom.sizes.iconSizes.xxl}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="bodySmall" style={styles.emptyText}>
            No bookmarks configured
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
        containerElevationStyle,
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>
          {widget.title}
        </Text>
        <IconButton
          icon={isEditMode ? "pencil" : "cog"}
          size={20}
          onPress={isEditMode ? onEdit : handleOpenConfig}
          iconColor={theme.colors.onSurfaceVariant}
        />
      </View>

      <ScrollView
        style={gridLayout.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.gridContainer}>
          {enabledBookmarks.map((bookmark) => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              health={health.get(bookmark.id)}
              onPress={handleBookmarkPress}
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
    borderRadius: borderRadius.xl,
    padding: spacing.md,
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
  emptyActionButton: {
    marginTop: spacing.md,
  },
});

export default BookmarksWidget;
