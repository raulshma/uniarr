import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { formatDistanceToNow } from "date-fns";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { logger } from "@/services/logger/LoggerService";
import {
  fetchYouTubeUploads,
  type YouTubeVideoItem,
} from "@/services/widgets/dataProviders";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import SettingsListItem from "@/components/common/SettingsListItem";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import { Card } from "@/components/common";

const CACHE_TTL_MS = 60 * 60 * 1000;

interface YouTubeWidgetProps {
  widget: Widget;
  onEdit?: () => void;
  onRefresh?: () => void;
}

interface YouTubeCacheEntry {
  videos: YouTubeVideoItem[];
}

type YouTubeWidgetConfig = {
  channelIds: string[];
  limit?: number;
  itemsPerChannel?: 2 | 3;
};

const normalizeConfig = (config: Widget["config"]): YouTubeWidgetConfig => {
  if (!config || typeof config !== "object") {
    return { channelIds: [] };
  }

  const channelIds = Array.isArray(config.channelIds)
    ? (config.channelIds as string[]).filter(
        (id) => typeof id === "string" && id.trim().length > 0,
      )
    : [];

  const limit = typeof config.limit === "number" ? config.limit : undefined;
  const itemsPerChannel =
    typeof config.itemsPerChannel === "number" &&
    [2, 3].includes(config.itemsPerChannel)
      ? (config.itemsPerChannel as 2 | 3)
      : undefined;

  return {
    channelIds,
    limit,
    itemsPerChannel,
  } satisfies YouTubeWidgetConfig;
};

const YouTubeWidget: React.FC<YouTubeWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const hasChannels = config.channelIds && config.channelIds.length > 0;
  const itemsPerChannel = config.itemsPerChannel ?? 3;

  const loadCredentials = useCallback(async () => {
    const credentials = await widgetCredentialService.getCredentials(widget.id);
    setApiKey(credentials?.apiKey ?? null);
  }, [widget.id]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const loadVideos = useCallback(
    async (forceRefresh = false) => {
      if (!apiKey || !hasChannels) {
        setVideos([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<YouTubeCacheEntry>(
            widget.id,
          );
          if (cached?.videos?.length) {
            setVideos(cached.videos);
            setLoading(false);
            setError(null);
          } else {
            setLoading(true);
          }
        } else {
          setRefreshing(true);
        }

        const targetLimit = Math.max(
          1,
          config.limit ?? 0,
          config.channelIds.length * itemsPerChannel,
        );

        const fresh = await fetchYouTubeUploads({
          apiKey,
          channelIds: config.channelIds,
          limit: targetLimit,
          itemsPerChannel,
        });

        setVideos(fresh);
        setError(null);
        await widgetService.setWidgetData(
          widget.id,
          { videos: fresh },
          CACHE_TTL_MS,
        );
      } catch (error) {
        void logger.warn("YouTubeWidget: failed to load uploads", {
          widgetId: widget.id,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Unable to load YouTube uploads");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      apiKey,
      config.channelIds,
      config.limit,
      hasChannels,
      itemsPerChannel,
      widget.id,
    ],
  );

  useEffect(() => {
    if (!apiKey || !hasChannels) {
      setLoading(false);
      return;
    }
    void loadVideos();
  }, [apiKey, hasChannels, loadVideos]);

  const handleRefresh = () => {
    onPress();
    void loadVideos(true);
    onRefresh?.();
  };

  const openVideo = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      void logger.warn("YouTubeWidget: failed to open video", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      setError("Could not open video");
    }
  };

  if (!apiKey) {
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
          title="YouTube API key needed"
          description="Add your YouTube Data API key to load channel uploads."
          actionLabel="Add API key"
          onAction={onEdit}
        />
      </View>
    );
  }

  if (!hasChannels) {
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
          title="Add YouTube channels"
          description="Enter channel IDs to track their latest uploads."
          actionLabel="Select channels"
          onAction={onEdit}
        />
      </View>
    );
  }

  return (
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
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonPlaceholder
              key={index}
              height={64}
              borderRadius={12}
              style={{ marginBottom: index < 2 ? 12 : 0 }}
            />
          ))}
        </View>
      ) : videos.length === 0 ? (
        <SettingsListItem
          title="No uploads yet. Try again later."
          groupPosition="single"
        />
      ) : (
        <View>
          {videos.map((video, index) => (
            <SettingsListItem
              key={video.id}
              title={video.title}
              subtitle={`${video.channelTitle} • ${formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}`}
              left={{ iconName: "youtube" }}
              trailing={
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                  style={{ margin: 0 }}
                />
              }
              onPress={() => openVideo(video.videoUrl)}
              groupPosition={
                index === 0
                  ? "top"
                  : index === videos.length - 1
                    ? "bottom"
                    : "middle"
              }
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

export default YouTubeWidget;
