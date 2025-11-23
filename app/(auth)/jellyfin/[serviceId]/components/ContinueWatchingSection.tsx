import React, { useMemo, useCallback } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MediaPoster } from "@/components/media/MediaPoster";
import { WatchStatusBadge } from "@/components/jellyfin/WatchStatusBadge";
import DownloadButton from "@/components/downloads/DownloadButton";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { JellyfinResumeItem, JellyfinItem } from "@/models/jellyfin.types";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { buildPosterUri } from "../utils/jellyfinHelpers";

interface ContinueWatchingSectionProps {
  items: JellyfinResumeItem[];
  connector: JellyfinConnector | undefined;
  serviceId: string | undefined;
  windowWidth: number;
  onOpenItem: (itemId?: string) => void;
  onPlayItem: (item: JellyfinItem, resumeTicks?: number | null) => void;
  onRefresh: () => void;
}

export const ContinueWatchingSection: React.FC<
  ContinueWatchingSectionProps
> = ({
  items,
  connector,
  serviceId,
  windowWidth,
  onOpenItem,
  onPlayItem,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderResumeItem = useCallback(
    ({ item, index }: { item: JellyfinResumeItem; index: number }) => {
      const isEpisode = item.Type === "Episode";
      const title = item.SeriesName ?? item.Name ?? "Untitled";
      const posterUri = buildPosterUri(connector, item, 420);

      // Format episode info (e.g., "S01E05" or "Episode 5")
      let episodeInfo = "";
      if (isEpisode) {
        const season = item.ParentIndexNumber;
        const episode = item.IndexNumber;
        if (season !== undefined && episode !== undefined) {
          episodeInfo = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
        } else if (episode !== undefined) {
          episodeInfo = `Episode ${episode}`;
        }
      }

      const posterSize = Math.max(
        120,
        Math.min(
          240,
          Math.floor((windowWidth - spacing.lg * 2 - spacing.md) / 2),
        ),
      );

      return (
        <View
          style={[
            { width: posterSize },
            index > 0 && { marginLeft: spacing.md },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.resumePosterWrap,
              pressed && styles.cardPressed,
            ]}
            onPress={() => onOpenItem(item.Id)}
          >
            <View style={styles.resumePosterContainer}>
              <MediaPoster
                key={`resume-poster-${item.Id || item.Name || "unknown"}-${index}`}
                uri={posterUri}
                size={posterSize - 8}
                borderRadius={12}
                accessibilityLabel={`Continue watching ${title}`}
                overlay={
                  <>
                    <WatchStatusBadge
                      userData={item.UserData}
                      position="top-left"
                      showProgressBar={true}
                    />
                    <Pressable
                      style={styles.playOverlay}
                      hitSlop={10}
                      onPress={() =>
                        onPlayItem(
                          item as JellyfinItem,
                          item.UserData?.PlaybackPositionTicks ?? null,
                        )
                      }
                    >
                      <MaterialCommunityIcons
                        name="play"
                        size={28}
                        color={theme.colors.onPrimary}
                      />
                    </Pressable>
                    {connector && serviceId && item.Id && (
                      <View style={styles.resumeDownloadOverlay}>
                        <DownloadButton
                          serviceConfig={connector.config}
                          contentId={item.Id}
                          size="small"
                          variant="icon"
                          onDownloadStart={() => {}}
                          onDownloadError={() => {}}
                        />
                      </View>
                    )}
                  </>
                }
              />
            </View>
          </Pressable>
          <Text
            numberOfLines={1}
            variant="bodySmall"
            style={styles.resumePosterTitle}
          >
            {title}
          </Text>
          {episodeInfo && (
            <Text
              numberOfLines={1}
              variant="bodySmall"
              style={styles.episodeInfo}
            >
              {episodeInfo}
            </Text>
          )}
        </View>
      );
    },
    [connector, onOpenItem, onPlayItem, serviceId, windowWidth, theme, styles],
  );

  if (!items || items.length === 0) return null;

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Continue Watching
        </Text>
        <IconButton
          icon="refresh"
          size={20}
          accessibilityLabel="Refresh continue watching"
          onPress={onRefresh}
        />
      </View>

      <FlashList<JellyfinResumeItem>
        data={items}
        keyExtractor={(item: JellyfinResumeItem, index: number) => {
          const baseKey = item.Id || item.Name || "unknown";
          return `${baseKey}-${index}`;
        }}
        renderItem={renderResumeItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.resumeList}
        estimatedItemSize={150}
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.xs,
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    resumeList: {
      marginTop: spacing.sm,
      paddingRight: spacing.md,
    },
    resumePosterWrap: {
      alignItems: "center",
    },
    resumePosterContainer: {
      position: "relative",
      alignItems: "center",
    },
    playOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -18 }, { translateY: -18 }],
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: 6,
      borderRadius: 20,
    },
    resumeDownloadOverlay: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: 12,
    },
    resumePosterTitle: {
      marginTop: spacing.xs,
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    episodeInfo: {
      marginTop: 2,
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
    },
    cardPressed: {
      opacity: 0.9,
    },
  });
