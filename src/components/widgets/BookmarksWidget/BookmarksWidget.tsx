import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import Animated from "react-native-reanimated";
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
import {
  COMPONENT_ANIMATIONS,
  FadeIn,
  FadeOut,
  ANIMATION_DURATIONS,
} from "@/utils/animations.utils";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
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
  isEditing,
}) => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [health, setHealth] = useState<Map<string, BookmarkHealth>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isEditMode = Boolean(isEditing);

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
    } catch (error) {
      console.error("Failed to refresh bookmarks:", error);
    } finally {
      setRefreshing(false);
    }
  }, [bookmarks]);

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
      <Animated.View
        style={[
          styles.container,
          gridLayout.container,
          { backgroundColor: theme.colors.surface },
          containerElevationStyle,
        ]}
        entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.NORMAL)}
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
        <View style={styles.loadingSkeleton}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonBookmark}>
              <View style={styles.skeletonIcon} />
              <SkeletonPlaceholder
                width="80%"
                height={12}
                borderRadius={4}
                style={{ marginTop: spacing.xs }}
              />
              <SkeletonPlaceholder
                width="60%"
                height={10}
                borderRadius={4}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ))}
        </View>
      </Animated.View>
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
        <Animated.View
          style={styles.gridContainer}
          entering={COMPONENT_ANIMATIONS.SECTION_ENTRANCE(100)}
        >
          {enabledBookmarks.map((bookmark, index) => (
            <Animated.View
              key={bookmark.id}
              entering={COMPONENT_ANIMATIONS.LIST_ITEM_STAGGER(index, 50).delay(
                150,
              )}
              style={[]}
            >
              <BookmarkItem
                bookmark={bookmark}
                health={health.get(bookmark.id)}
                onPress={handleBookmarkPress}
                size={widget.size}
              />
            </Animated.View>
          ))}
        </Animated.View>
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
    maxHeight: 120,
  },
  mediumScrollContainer: {
    maxHeight: 160,
  },
  largeScrollContainer: {
    maxHeight: 210,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  loadingSkeleton: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  skeletonBookmark: {
    alignItems: "center",
    justifyContent: "center",
    width: "48%",
    padding: spacing.sm,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.1)",
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
