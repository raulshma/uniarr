import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { useHackerNewsStoryContent } from "@/hooks/useHackerNewsStoryContent";
import { logger } from "@/services/logger/LoggerService";
import {
  fetchHackerNewsStories,
  type HackerNewsFeedType,
  type HackerNewsItem,
} from "@/services/widgets/dataProviders";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import SettingsListItem from "@/components/common/SettingsListItem";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import { Card } from "@/components/common";
import ContentDrawer from "@/components/widgets/ContentDrawer";
import ImagePreviewModal from "@/components/cache/ImagePreviewModal";
import { HapticPressable } from "@/components/common/HapticPressable";

const CACHE_TTL_MS = 15 * 60 * 1000;

interface HackerNewsWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface HackerNewsWidgetConfig {
  feedType?: HackerNewsFeedType;
  limit?: number;
}

const normalizeConfig = (config: Widget["config"]): HackerNewsWidgetConfig => {
  if (!config || typeof config !== "object") {
    return {};
  }

  const feedType =
    config.feedType === "topstories" ||
    config.feedType === "beststories" ||
    config.feedType === "newstories"
      ? (config.feedType as HackerNewsFeedType)
      : undefined;

  const limit = typeof config.limit === "number" ? config.limit : undefined;

  return { feedType, limit } satisfies HackerNewsWidgetConfig;
};

const buildStoryUrl = (item: HackerNewsItem): string => {
  if (item.url && item.url.trim().length > 0) {
    return item.url;
  }
  return `https://news.ycombinator.com/item?id=${item.id}`;
};

const HackerNewsWidget: React.FC<HackerNewsWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress, onLongPress } = useHaptics();
  const [stories, setStories] = useState<HackerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // State for image preview modal
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string>("");

  // State for content drawer
  const [contentDrawerVisible, setContentDrawerVisible] = useState(false);
  const [selectedStory, setSelectedStory] = useState<HackerNewsItem | null>(
    null,
  );

  // Lazy load content for selected story
  const { content, loading: contentLoading } = useHackerNewsStoryContent(
    selectedStory?.id || 0,
  );

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);

  const loadStories = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<HackerNewsItem[]>(
            widget.id,
          );
          if (cached && cached.length > 0) {
            setStories(cached);
            setLoading(false);
            setError(null);
          } else {
            setLoading(true);
          }
        } else {
          setRefreshing(true);
        }

        const fresh = await fetchHackerNewsStories({
          feedType: config.feedType ?? "topstories",
          limit: config.limit ?? 10,
        });

        setStories(fresh);
        setError(null);
        await widgetService.setWidgetData(widget.id, fresh, CACHE_TTL_MS);
      } catch (error) {
        void logger.warn("HackerNewsWidget: failed to load", {
          widgetId: widget.id,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Unable to load Hacker News stories");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [config.feedType, config.limit, widget.id],
  );

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  const handleRefresh = () => {
    onPress();
    void loadStories(true);
    onRefresh?.();
  };

  const openStory = async (item: HackerNewsItem) => {
    try {
      await Linking.openURL(buildStoryUrl(item));
    } catch (error) {
      void logger.warn("HackerNewsWidget: failed to open link", {
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      setError("Could not open story");
    }
  };

  const handleLongPressImage = async (imageUri: string) => {
    onLongPress();
    setSelectedImageUri(imageUri);
    setImageModalVisible(true);
  };

  const handleLongPressItem = (story: HackerNewsItem) => {
    onLongPress();
    setSelectedStory(story);
    setContentDrawerVisible(true);
  };

  return (
    <>
      <Card
        contentPadding="sm"
        style={StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: borderRadius.xxl,
            padding: spacing.sm,
          },
        ])}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {widget.title}
          </Text>
          <View style={styles.actions}>
            {onEdit && (
              <IconButton
                icon="cog"
                size={20}
                onPress={() => {
                  onPress();
                  onEdit();
                }}
              />
            )}
            <IconButton
              icon={refreshing ? "progress-clock" : "refresh"}
              size={20}
              onPress={handleRefresh}
              disabled={refreshing}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonPlaceholder
                key={index}
                height={64}
                borderRadius={12}
                style={{ marginBottom: index < 3 ? 12 : 0 }}
              />
            ))}
          </View>
        ) : stories.length === 0 ? (
          <SettingsListItem
            title="No stories available at the moment."
            groupPosition="single"
          />
        ) : (
          <View>
            {stories.map((story, index) => (
              <HapticPressable
                key={story.id}
                onLongPress={() => handleLongPressItem(story)}
                hapticOnLongPress
              >
                <SettingsListItem
                  title={story.title}
                  subtitle={`${story.score ?? 0} points by ${story.by} • ${formatDistanceToNow(new Date(story.time * 1000), { addSuffix: true })}${story.descendants ? ` • ${story.descendants} comments` : ""}`}
                  left={
                    story.image
                      ? {
                          node: (
                            <HapticPressable
                              onLongPress={() =>
                                handleLongPressImage(story.image!)
                              }
                              hapticOnLongPress
                            >
                              <Image
                                source={{ uri: story.image }}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                }}
                              />
                            </HapticPressable>
                          ),
                        }
                      : {
                          node: (
                            <Text
                              variant="titleMedium"
                              style={{ color: theme.colors.primary }}
                            >
                              {index + 1}
                            </Text>
                          ),
                        }
                  }
                  trailing={
                    <IconButton
                      icon="chevron-right"
                      size={16}
                      iconColor={theme.colors.outline}
                      style={{ margin: 0 }}
                    />
                  }
                  onPress={() => openStory(story)}
                  groupPosition={
                    index === 0
                      ? "top"
                      : index === stories.length - 1
                        ? "bottom"
                        : "middle"
                  }
                />
              </HapticPressable>
            ))}
          </View>
        )}

        {error && (
          <Text variant="bodySmall" style={styles.error}>
            {error}
          </Text>
        )}
      </Card>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={imageModalVisible}
        imageUri={selectedImageUri}
        fileName="Story Favicon"
        fileSize="Image"
        onClose={() => setImageModalVisible(false)}
      />

      {/* Content Drawer */}
      <ContentDrawer
        visible={contentDrawerVisible}
        onDismiss={() => {
          setContentDrawerVisible(false);
          setSelectedStory(null);
        }}
        title={selectedStory?.title || "Story"}
        content={content}
        metadata={{
          score: selectedStory?.score,
          author: selectedStory?.by,
          date: selectedStory?.time
            ? formatDistanceToNow(new Date(selectedStory.time * 1000), {
                addSuffix: true,
              })
            : undefined,
          comments: selectedStory?.descendants,
        }}
        actionUrl={
          selectedStory?.url
            ? selectedStory.url
            : `https://news.ycombinator.com/item?id=${selectedStory?.id || ""}`
        }
        actionLabel="Open on Hacker News"
        loading={contentLoading}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    gap: 12,
  },
  error: {
    color: "#ff6b6b",
  },
});

export default HackerNewsWidget;
