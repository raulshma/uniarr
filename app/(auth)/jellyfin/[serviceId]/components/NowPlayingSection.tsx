import React, { useMemo, useCallback } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";
import { MediaPoster } from "@/components/media/MediaPoster";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type {
  JellyfinSession,
  JellyfinSessionPlayState,
  JellyfinItem,
} from "@/models/jellyfin.types";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { buildPosterUri } from "../utils/jellyfinHelpers";

interface NowPlayingSectionProps {
  sessions: JellyfinSession[];
  connector: JellyfinConnector | undefined;
  onOpenItem: (itemId?: string) => void;
  onPlayItem: (item: JellyfinItem, resumeTicks?: number | null) => void;
  onOpenNowPlaying: () => void;
  onRefresh: () => void;
}

export const NowPlayingSection: React.FC<NowPlayingSectionProps> = ({
  sessions,
  connector,
  onOpenItem,
  onPlayItem,
  onOpenNowPlaying,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderNowPlayingItem = useCallback(
    (item: JellyfinSession, index: number) => {
      const playing = item.NowPlayingItem;
      if (!playing) return null;

      const title = playing.Name ?? "Untitled";
      const posterUri = buildPosterUri(connector, playing, 240);

      return (
        <Pressable
          key={item.Id}
          style={({ pressed }) => [
            styles.nowPlayingRow,
            pressed && styles.cardPressed,
          ]}
          onPress={() => onOpenItem(playing.Id)}
        >
          <MediaPoster
            key={`now-playing-${item.Id || playing.Id || "unknown"}-${index}`}
            uri={posterUri}
            size={72}
            borderRadius={10}
          />
          <View style={styles.nowPlayingMeta}>
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={styles.nowPlayingTitle}
            >
              {title}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={styles.nowPlayingSubtitle}
            >
              {item.DeviceName ?? "Unknown Device"}
            </Text>
          </View>
          <IconButton
            icon="play-circle"
            accessibilityLabel="Play locally"
            onPress={() =>
              onPlayItem(
                playing as JellyfinItem,
                (item.PlayState as JellyfinSessionPlayState | undefined)
                  ?.PositionTicks ?? null,
              )
            }
          />
          <IconButton
            icon="dots-vertical"
            accessibilityLabel="Session actions"
            onPress={() => void onOpenNowPlaying()}
          />
        </Pressable>
      );
    },
    [connector, onOpenItem, onOpenNowPlaying, onPlayItem, styles],
  );

  if (!sessions || sessions.length === 0) return null;

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Now Playing
        </Text>
        <IconButton
          icon="refresh"
          size={20}
          accessibilityLabel="Refresh now playing"
          onPress={onRefresh}
        />
      </View>

      <View style={styles.nowPlayingList}>
        {sessions.map((s, i) => (
          <View key={s.Id} style={{ marginBottom: spacing.sm }}>
            {renderNowPlayingItem(s as JellyfinSession, i)}
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    nowPlayingList: {
      marginTop: spacing.sm,
    },
    nowPlayingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.sm,
      borderRadius: 10,
      backgroundColor: "transparent",
    },
    nowPlayingMeta: {
      flex: 1,
    },
    nowPlayingTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    nowPlayingSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    cardPressed: {
      opacity: 0.9,
    },
  });
