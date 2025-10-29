import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, Linking } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { usePressWithoutLongPress } from "@/hooks/usePressWithoutLongPress";
import { useRedditPostContent } from "@/hooks/useRedditPostContent";
import { logger } from "@/services/logger/LoggerService";
import {
  fetchRedditPosts,
  type RedditPostItem,
  type RedditSort,
  type RedditTopTimeRange,
} from "@/services/widgets/dataProviders";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import SettingsListItem from "@/components/common/SettingsListItem";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import { Card } from "@/components/common";
import ImageViewer from "@/components/cache/ImageViewer";
import { useWidgetDrawer } from "@/services/widgetDrawerService";
import { HapticPressable } from "@/components/common/HapticPressable";
import { useSettingsStore } from "@/store/settingsStore";

const CACHE_TTL_MS = 20 * 60 * 1000;

interface RedditWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface RedditWidgetConfig {
  subreddits?: string[];
  sort?: RedditSort;
  topTimeRange?: RedditTopTimeRange;
  limit?: number;
}

const normalizeConfig = (config: Widget["config"]): RedditWidgetConfig => {
  if (!config || typeof config !== "object") {
    return {};
  }

  const subreddits = Array.isArray(config.subreddits)
    ? (config.subreddits as string[]).filter(
        (name) => typeof name === "string" && name.trim().length > 0,
      )
    : [];

  const sort =
    config.sort === "new" ||
    config.sort === "hot" ||
    config.sort === "rising" ||
    config.sort === "top"
      ? (config.sort as RedditSort)
      : undefined;

  const topTimeRange =
    config.topTimeRange === "hour" ||
    config.topTimeRange === "day" ||
    config.topTimeRange === "week" ||
    config.topTimeRange === "month" ||
    config.topTimeRange === "year" ||
    config.topTimeRange === "all"
      ? (config.topTimeRange as RedditTopTimeRange)
      : undefined;

  const limit = typeof config.limit === "number" ? config.limit : undefined;

  return {
    subreddits,
    sort,
    topTimeRange,
    limit,
  } satisfies RedditWidgetConfig;
};

interface PostListItemProps {
  post: RedditPostItem;
  index: number;
  postsLength: number;
  onPress: () => void;
  onLongPress: () => void;
  onLongPressImage: () => void;
}

const PostListItem: React.FC<PostListItemProps> = ({
  post,
  index,
  postsLength,
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
        title={post.title}
        subtitle={`r/${post.subreddit} • u/${post.author} • ${formatDistanceToNow(new Date(post.createdUtc * 1000), { addSuffix: true })} • ${post.score} upvotes • ${post.comments} comments`}
        left={
          post.thumbnail
            ? {
                node: (
                  <HapticPressable
                    onLongPress={onLongPressImage}
                    hapticOnLongPress
                  >
                    <Image
                      source={{ uri: post.thumbnail }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                      }}
                    />
                  </HapticPressable>
                ),
              }
            : { iconName: "reddit" }
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
          index === 0 ? "top" : index === postsLength - 1 ? "bottom" : "middle"
        }
      />
    </HapticPressable>
  );
};

const RedditWidget: React.FC<RedditWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress, onLongPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const [posts, setPosts] = useState<RedditPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // State for image preview modal
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string>("");

  // State for content drawer
  const [selectedPost, setSelectedPost] = useState<RedditPostItem | null>(null);
  const { openDrawer } = useWidgetDrawer();

  // Lazy load content for selected post
  const { content, loading: contentLoading } = useRedditPostContent(
    selectedPost?.permalink || "",
  );

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const hasSources = config.subreddits && config.subreddits.length > 0;

  const loadPosts = useCallback(
    async (forceRefresh = false) => {
      if (!hasSources) {
        setPosts([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<RedditPostItem[]>(
            widget.id,
          );
          if (cached && cached.length > 0) {
            setPosts(cached);
            setLoading(false);
            setError(null);
          } else {
            setLoading(true);
          }
        } else {
          setRefreshing(true);
        }

        const fresh = await fetchRedditPosts({
          subreddits: config.subreddits!,
          sort: config.sort ?? "hot",
          topTimeRange: config.topTimeRange ?? "day",
          limit: config.limit ?? 10,
        });

        setPosts(fresh);
        setError(null);
        await widgetService.setWidgetData(widget.id, fresh, CACHE_TTL_MS);
      } catch (error) {
        void logger.warn("RedditWidget: failed to load posts", {
          widgetId: widget.id,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Unable to load subreddit posts");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      config.limit,
      config.sort,
      config.subreddits,
      config.topTimeRange,
      hasSources,
      widget.id,
    ],
  );

  const handleLongPressImage = async (imageUri: string) => {
    onLongPress();
    // Validate that the image URI is a proper HTTP(S) URL
    if (!imageUri || !imageUri.startsWith("http")) {
      void logger.warn("RedditWidget: Invalid image URI", { imageUri });
      setError("Invalid image URL");
      return;
    }
    setSelectedImageUri(imageUri);
    setImageModalVisible(true);
  };

  const handleLongPressItem = (post: RedditPostItem) => {
    onLongPress();
    setSelectedPost(post);
    openDrawer({
      title: post.title,
      content: content,
      metadata: {
        score: post.score,
        author: post.author,
        comments: post.comments,
        source: post.subreddit ? `r/${post.subreddit}` : undefined,
      },
      actionUrl:
        post.permalink && post.permalink.startsWith("http")
          ? post.permalink
          : post.permalink
            ? `https://www.reddit.com${post.permalink}`
            : "",
      actionLabel: "Open on Reddit",
      loading: contentLoading,
    });
  };

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const handleRefresh = () => {
    onPress();
    void loadPosts(true);
    onRefresh?.();
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      void logger.warn("RedditWidget: failed to open link", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      setError("Could not open post");
    }
  };

  if (!hasSources) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderRadius: borderRadius.xxl,
            padding: spacing.sm,
          },
        ])}
      >
        <WidgetConfigPlaceholder
          title="Pick subreddits"
          description="Select the communities you want to follow to populate this widget."
          actionLabel="Choose subreddits"
          onAction={onEdit}
        />
      </View>
    );
  }

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
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonPlaceholder
                key={index}
                height={64}
                borderRadius={12}
                style={{ marginBottom: index < 2 ? 12 : 0 }}
              />
            ))}
          </View>
        ) : posts.length === 0 ? (
          <SettingsListItem
            title="No posts right now. Try again soon."
            groupPosition="single"
          />
        ) : (
          <View>
            {posts.map((post, index) => (
              <PostListItem
                key={post.id}
                post={post}
                index={index}
                postsLength={posts.length}
                onPress={() => openLink(post.permalink || post.url)}
                onLongPress={() => handleLongPressItem(post)}
                onLongPressImage={() => handleLongPressImage(post.thumbnail!)}
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
        fileName="Post Thumbnail"
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

export default RedditWidget;
