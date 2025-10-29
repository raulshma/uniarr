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
import { logger } from "@/services/logger/LoggerService";
import {
  fetchRssFeeds,
  type RssFeedItem,
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
import WidgetHeader from "../common/WidgetHeader";

const CACHE_TTL_MS = 30 * 60 * 1000;

interface RssWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface RssWidgetConfig {
  feeds?: string[];
  limit?: number;
}

const normalizeConfig = (config: Widget["config"]): RssWidgetConfig => {
  if (!config || typeof config !== "object") {
    return {};
  }

  const feeds = Array.isArray(config.feeds)
    ? (config.feeds as string[]).filter(
        (url) => typeof url === "string" && url.trim().length > 0,
      )
    : [];

  const limit = typeof config.limit === "number" ? config.limit : undefined;

  return {
    feeds,
    limit,
  } satisfies RssWidgetConfig;
};

interface RssItemListItemProps {
  item: RssFeedItem;
  index: number;
  itemsLength: number;
  onPress: () => void;
  onLongPress: () => void;
  onLongPressImage: () => void;
}

const RssItemListItem: React.FC<RssItemListItemProps> = ({
  item,
  index,
  itemsLength,
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
        title={item.title}
        subtitle={
          item.source && item.publishedAt
            ? `${item.source} • ${formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}`
            : item.source ||
              (item.publishedAt
                ? formatDistanceToNow(new Date(item.publishedAt), {
                    addSuffix: true,
                  })
                : undefined)
        }
        left={
          item.image
            ? {
                node: (
                  <HapticPressable
                    onLongPress={onLongPressImage}
                    hapticOnLongPress
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                      }}
                    />
                  </HapticPressable>
                ),
              }
            : { iconName: "rss" }
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
          index === 0 ? "top" : index === itemsLength - 1 ? "bottom" : "middle"
        }
      />
    </HapticPressable>
  );
};

const RssWidget: React.FC<RssWidgetProps> = ({ widget, onRefresh, onEdit }) => {
  const theme = useTheme<AppTheme>();
  const { onPress, onLongPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const [items, setItems] = useState<RssFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for image preview modal
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string>("");

  // Get drawer hook for content display
  const { openDrawer } = useWidgetDrawer();

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);

  const feedsConfigured = config.feeds && config.feeds.length > 0;

  const loadItems = useCallback(
    async (forceRefresh = false) => {
      if (!feedsConfigured) {
        setItems([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<RssFeedItem[]>(
            widget.id,
          );
          if (cached && cached.length > 0) {
            setItems(cached);
            setLoading(false);
            setError(null);
          } else {
            setLoading(true);
          }
        } else {
          setIsRefreshing(true);
        }

        const fresh = await fetchRssFeeds({
          urls: config.feeds!,
          limit: config.limit ?? 8,
        });

        setItems(fresh);
        setError(null);
        await widgetService.setWidgetData(widget.id, fresh, CACHE_TTL_MS);
      } catch (error) {
        void logger.warn("RssWidget: failed to load feeds", {
          widgetId: widget.id,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Unable to load RSS feeds");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [config.feeds, config.limit, feedsConfigured, widget.id],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleRefresh = () => {
    onPress();
    void loadItems(true);
    onRefresh?.();
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      void logger.warn("RssWidget: failed to open link", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      setError("Could not open link");
    }
  };

  const handleLongPressImage = async (imageUri: string) => {
    onLongPress();
    // Validate that the image URI is a proper HTTP(S) URL
    if (!imageUri || !imageUri.startsWith("http")) {
      void logger.warn("RssWidget: Invalid image URI", { imageUri });
      setError("Invalid image URL");
      return;
    }
    setSelectedImageUri(imageUri);
    setImageModalVisible(true);
  };

  const handleLongPressItem = (item: RssFeedItem) => {
    onLongPress();
    openDrawer({
      title: item.title,
      content: item.summary,
      metadata: {
        author: item.author,
        date: item.publishedAt
          ? formatDistanceToNow(new Date(item.publishedAt), {
              addSuffix: true,
            })
          : undefined,
        source: item.source,
      },
      actionUrl: item.link || "",
      actionLabel: "Open Full Article",
      loading: false,
    });
  };

  if (!feedsConfigured) {
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
          title="RSS feeds not configured"
          description="Add RSS or Atom feed URLs to start seeing headlines here."
          actionLabel="Choose feeds"
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
        <WidgetHeader
          title={widget.title}
          onEdit={onEdit}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
        />

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
        ) : items.length === 0 ? (
          <SettingsListItem
            title="No articles available. Try refreshing in a bit."
            groupPosition="single"
          />
        ) : (
          <View>
            {items.map((item, index) => (
              <RssItemListItem
                key={item.id}
                item={item}
                index={index}
                itemsLength={items.length}
                onPress={() => openLink(item.link)}
                onLongPress={() => handleLongPressItem(item)}
                onLongPressImage={() => handleLongPressImage(item.image!)}
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
        fileName="Article Thumbnail"
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

export default RssWidget;
