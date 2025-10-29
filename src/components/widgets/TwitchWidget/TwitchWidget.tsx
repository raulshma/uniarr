import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { useSettingsStore } from "@/store/settingsStore";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import { useHaptics } from "@/hooks/useHaptics";
import { logger } from "@/services/logger/LoggerService";
import {
  fetchTwitchChannelStatus,
  type TwitchChannelStatus,
} from "@/services/widgets/dataProviders";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import {
  Card,
  SettingsGroup,
  SettingsListItem,
  getGroupPositions,
} from "@/components/common";
import WidgetHeader from "../common/WidgetHeader";

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
  clientSecret?: string;
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
  const { onPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);

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
    credentials?.clientId && credentials?.clientSecret,
  );

  const loadCredentials = useCallback(async () => {
    const stored = await widgetCredentialService.getCredentials(widget.id);
    setCredentials({
      clientId: stored?.clientId,
      clientSecret: stored?.clientSecret,
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
          clientSecret: credentials!.clientSecret!,
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
        variant={frostedEnabled ? "frosted" : "custom"}
        style={styles.card}
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
        variant={frostedEnabled ? "frosted" : "custom"}
        style={styles.card}
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
      contentPadding="sm"
      variant={frostedEnabled ? "frosted" : "custom"}
      style={styles.card}
    >
      <WidgetHeader
        title={widget.title}
        onEdit={onEdit}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <SettingsGroup style={styles.settingsGroup}>
        {loading ? (
          <View style={styles.loadingContainer}>
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonPlaceholder
                key={index}
                height={48}
                borderRadius={
                  index === 0
                    ? borderRadius.lg
                    : index === 2
                      ? borderRadius.lg
                      : 0
                }
                style={{ marginBottom: index < 2 ? 1 : 0 }}
              />
            ))}
          </View>
        ) : channels.length === 0 ? (
          <SettingsListItem
            title={config.offlineMessage ?? "No channels are live right now."}
            left={{ iconName: "twitch" }}
            groupPosition="single"
          />
        ) : (
          channels.map((channel, index) => (
            <SettingsListItem
              key={channel.login}
              title={channel.displayName}
              subtitle={
                channel.isLive
                  ? `${channel.title} • ${channel.viewerCount} viewers`
                  : "Offline"
              }
              left={{ iconName: "twitch" }}
              trailing={
                <Button
                  mode="outlined"
                  compact
                  onPress={() => openChannel(channel.login)}
                >
                  Open
                </Button>
              }
              onPress={() => openChannel(channel.login)}
              groupPosition={getGroupPositions(channels.length)[index]}
            />
          ))
        )}
      </SettingsGroup>

      {error && (
        <View style={styles.errorContainer}>
          <Text variant="bodySmall" style={styles.error}>
            {error}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xxl,
    overflow: "hidden",
  },
  settingsGroup: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  loadingContainer: {
    gap: 1,
  },
  errorContainer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  error: {
    color: "#ff6b6b",
  },
});

export default TwitchWidget;
