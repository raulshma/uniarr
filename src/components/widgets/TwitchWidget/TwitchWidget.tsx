import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";

import { Card } from "@/components/common/Card";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import { getComponentElevation } from "@/constants/elevation";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { logger } from "@/services/logger/LoggerService";
import {
  fetchTwitchChannelStatus,
  type TwitchChannelStatus,
} from "@/services/widgets/dataProviders";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";

const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const OFFLINE_CACHE_TTL_MS = 20 * 60 * 1000;

interface TwitchWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface TwitchWidgetConfig {
  channelLogins?: string[];
  offlineMessage?: string;
}

interface TwitchCredentials {
  clientId?: string;
  accessToken?: string;
}

interface TwitchCacheEntry {
  channels: TwitchChannelStatus[];
  timestamp: number;
}

const normalizeConfig = (config: Widget["config"]): TwitchWidgetConfig => {
  if (!config || typeof config !== "object") {
    return {};
  }

  const channelLogins = Array.isArray(config.channelLogins)
    ? (config.channelLogins as string[]).filter(
        (login) => typeof login === "string" && login.trim().length > 0,
      )
    : [];

  const offlineMessage =
    typeof config.offlineMessage === "string"
      ? config.offlineMessage
      : undefined;

  return {
    channelLogins,
    offlineMessage,
  } satisfies TwitchWidgetConfig;
};

const TwitchWidget: React.FC<TwitchWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();
  const [credentials, setCredentials] = useState<TwitchCredentials | null>(
    null,
  );
  const [channels, setChannels] = useState<TwitchChannelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const hasChannels = config.channelLogins && config.channelLogins.length > 0;
  const credentialsValid = Boolean(
    credentials?.clientId && credentials?.accessToken,
  );

  const loadCredentials = useCallback(async () => {
    const stored = await widgetCredentialService.getCredentials(widget.id);
    setCredentials({
      clientId: stored?.clientId,
      accessToken: stored?.accessToken,
    });
  }, [widget.id]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const loadChannels = useCallback(
    async (forceRefresh = false) => {
      if (!credentialsValid || !hasChannels) {
        setChannels([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<TwitchCacheEntry>(
            widget.id,
          );
          if (cached?.channels) {
            setChannels(cached.channels);
            setLoading(false);
            setError(null);
          } else {
            setLoading(true);
          }
        } else {
          setRefreshing(true);
        }

        const fresh = await fetchTwitchChannelStatus({
          clientId: credentials!.clientId!,
          accessToken: credentials!.accessToken!,
          channelLogins: config.channelLogins!,
        });

        setChannels(fresh);
        setError(null);

        const ttl = fresh.some((channel) => channel.isLive)
          ? LIVE_CACHE_TTL_MS
          : OFFLINE_CACHE_TTL_MS;

        await widgetService.setWidgetData(
          widget.id,
          { channels: fresh, timestamp: Date.now() },
          ttl,
        );
      } catch (error) {
        void logger.warn("TwitchWidget: failed to load channels", {
          widgetId: widget.id,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Unable to load Twitch channels");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      config.channelLogins,
      credentials,
      credentialsValid,
      hasChannels,
      widget.id,
    ],
  );

  useEffect(() => {
    if (!credentialsValid || !hasChannels) {
      setLoading(false);
      return;
    }
    void loadChannels();
  }, [credentialsValid, hasChannels, loadChannels]);

  const handleRefresh = () => {
    onPress();
    void loadChannels(true);
    onRefresh?.();
  };

  const openChannel = async (login: string) => {
    try {
      await Linking.openURL(`https://twitch.tv/${login}`);
    } catch (error) {
      void logger.warn("TwitchWidget: failed to open channel", {
        login,
        error: error instanceof Error ? error.message : String(error),
      });
      setError("Could not open channel");
    }
  };

  if (!credentialsValid) {
    return (
      <Card
        contentPadding="lg"
        style={StyleSheet.flatten([
          styles.card,
          getComponentElevation("widget", theme),
        ])}
      >
        <WidgetConfigPlaceholder
          title="Twitch credentials required"
          description="Add a Client ID and App Access Token to load Twitch status."
          actionLabel="Add credentials"
          onAction={onEdit}
        />
      </Card>
    );
  }

  if (!hasChannels) {
    return (
      <Card
        contentPadding="lg"
        style={StyleSheet.flatten([
          styles.card,
          getComponentElevation("widget", theme),
        ])}
      >
        <WidgetConfigPlaceholder
          title="Choose Twitch channels"
          description="Add the channels you want to monitor."
          actionLabel="Select channels"
          onAction={onEdit}
        />
      </Card>
    );
  }

  return (
    <Card
      contentPadding="lg"
      style={StyleSheet.flatten([
        styles.card,
        getComponentElevation("widget", theme),
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
              height={72}
              borderRadius={12}
              style={{ marginBottom: index < 2 ? 12 : 0 }}
            />
          ))}
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.emptyState}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {config.offlineMessage ?? "No channels are live right now."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {channels.map((channel) => (
            <View key={channel.login} style={styles.listItem}>
              <View style={styles.channelHeader}>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onSurface }}
                >
                  {channel.displayName}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {channel.isLive ? "Live" : "Offline"}
                </Text>
              </View>
              {channel.isLive && (
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {channel.title}
                </Text>
              )}
              <View style={styles.channelActions}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => openChannel(channel.login)}
                >
                  Open in Twitch
                </Button>
                {channel.viewerCount !== undefined && channel.isLive && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {`${channel.viewerCount} viewers`}
                  </Text>
                )}
              </View>
            </View>
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
    borderRadius: 24,
    overflow: "hidden",
    gap: 16,
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
  list: {
    gap: 12,
  },
  listItem: {
    gap: 8,
  },
  channelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  channelActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyState: {
    alignItems: "flex-start",
  },
  error: {
    color: "#ff6b6b",
  },
});

export default TwitchWidget;
