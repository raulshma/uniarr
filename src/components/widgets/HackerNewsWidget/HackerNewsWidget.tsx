import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { usePressWithoutLongPress } from "@/hooks/usePressWithoutLongPress";
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
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import ImageViewer from "@/components/cache/ImageViewer";
import { useWidgetDrawer } from "@/services/widgetDrawerService";
import { HapticPressable } from "@/components/common/HapticPressable";
import { useSettingsStore } from "@/store/settingsStore";
import { createWidgetConfigSignature } from "@/utils/widget.utils";
import { useImagePrefetch } from "@/hooks/useImagePrefetch";

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

interface StoryListItemProps {
  story: HackerNewsItem;
  index: number;
  storiesLength: number;
  onPress: () => void;
  onLongPress: () => void;
  onLongPressImage: () => void;
}

const StoryListItem: React.FC<StoryListItemProps> = ({
  story,
  index,
  storiesLength,
  onPress,
  onLongPress,
  onLongPressImage,
}) => {
  const theme = useTheme<AppTheme>();
  const { handlePress, handlePressIn, handleLongPress } =
    usePressWithoutLongPress(onPress);

  return (
    <HapticPressable
      onLongPress={() => {
        handleLongPress();
        onLongPress();
      }}
      onPressIn={handlePressIn}
      onPress={handlePress}
      hapticOnLongPress
    >
      <SettingsListItem
        title={story.title}
        subtitle={`${story.score ?? 0} points by ${story.by} • ${formatDistanceToNow(new Date(story.time * 1000), { addSuffix: true })}${story.descendants ? ` • ${story.descendants} comments` : ""}`}
        frosted
        left={
          story.image
            ? {
                node: (
                  <HapticPressable
                    onLongPress={onLongPressImage}
                    hapticOnLongPress
                  >
                    <Image
                      source={{ uri: story.image }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                      }}
                      placeholder="data:image/svg+xml,%3Csvg %3E%3Crect width='60' height='60' fill='%23e2e8f0' rx='30'/%3E%3C/svg%3E"
                      contentFit="cover"
                      transition={200}
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
        groupPosition={
          index === 0
            ? "top"
            : index === storiesLength - 1
              ? "bottom"
              : "middle"
        }
      />
    </HapticPressable>
  );
};

const HackerNewsWidget: React.FC<HackerNewsWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const { onPress, onLongPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const [stories, setStories] = useState<HackerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // State for image preview modal
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string>("");

  // State for content drawer
  const [selectedStory, setSelectedStory] = useState<HackerNewsItem | null>(
    null,
  );
  const { openDrawer } = useWidgetDrawer();

  // Lazy load content for selected story
  const { content, loading: contentLoading } = useHackerNewsStoryContent(
    selectedStory?.id || 0,
  );

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const configSignature = useMemo(
    () => createWidgetConfigSignature(config),
    [config],
  );

  // Image prefetching setup
  const getImageUrls = useCallback(
    (index: number) => {
      if (index >= 0 && index < stories.length && stories[index]?.image) {
        return stories[index]?.image;
      }
      return undefined;
    },
    [stories],
  );

  const { preloadInitial } = useImagePrefetch(getImageUrls, {
    priority: "immediate",
    prefetchRange: { before: 1, after: 2 },
    maxConcurrent: 3,
  });

  // Prefetch initial items when widget loads
  useEffect(() => {
    if (stories.length > 0 && !loading && !error) {
      void preloadInitial(
        { start: 0, end: Math.min(2, stories.length - 1) },
        stories.length,
      );
    }
  }, [stories, loading, error, preloadInitial]);

  const loadStories = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<HackerNewsItem[]>(
            widget.id,
            configSignature,
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
        await widgetService.setWidgetData(widget.id, fresh, {
          ttlMs: CACHE_TTL_MS,
          configSignature,
        });
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
    [config.feedType, configSignature, config.limit, widget.id],
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
    // Validate that the image URI is a proper HTTP(S) URL
    if (!imageUri || !imageUri.startsWith("http")) {
      void logger.warn("HackerNewsWidget: Invalid image URI", { imageUri });
      setError("Invalid image URL");
      return;
    }
    setSelectedImageUri(imageUri);
    setImageModalVisible(true);
  };

  const handleLongPressItem = (story: HackerNewsItem) => {
    onLongPress();
    setSelectedStory(story);
    openDrawer({
      title: story.title,
      content: content,
      metadata: {
        score: story.score,
        author: story.by,
        date: story.time
          ? formatDistanceToNow(new Date(story.time * 1000), {
              addSuffix: true,
            })
          : undefined,
        comments: story.descendants,
      },
      actionUrl: story.url
        ? story.url
        : `https://news.ycombinator.com/item?id=${story.id || ""}`,
      actionLabel: "Open on Hacker News",
      loading: contentLoading,
      imageUrl: story.image,
    });
  };

  return (
    <>
      <Card
        contentPadding="sm"
        variant={frostedEnabled ? "frosted" : "custom"}
        style={StyleSheet.flatten([
          styles.card,
          {
            borderRadius: borderRadius.xxl,
            padding: spacing.sm,
          },
        ])}
      >
        <WidgetHeader
          title={widget.title}
          onEdit={onEdit}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

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
            frosted
          />
        ) : (
          <View>
            {stories.map((story, index) => (
              <StoryListItem
                key={story.id}
                story={story}
                index={index}
                storiesLength={stories.length}
                onPress={() => openStory(story)}
                onLongPress={() => handleLongPressItem(story)}
                onLongPressImage={() => handleLongPressImage(story.image!)}
              />
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
      <ImageViewer
        visible={imageModalVisible}
        imageUri={selectedImageUri}
        fileName="Story Favicon"
        fileSize="Image"
        onClose={() => setImageModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  loadingContainer: {
    gap: 12,
  },
  error: {
    color: "#ff6b6b",
  },
});

export default HackerNewsWidget;
