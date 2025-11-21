import React, { useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { MediaPoster } from "@/components/media/MediaPoster";
import { WatchStatusBadge } from "@/components/jellyfin/WatchStatusBadge";
import DownloadButton from "@/components/downloads/DownloadButton";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { JellyfinItem } from "@/models/jellyfin.types";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type { CollectionSegmentKey } from "../hooks/useJellyfinLibraryState";
import { buildPosterUri, deriveSubtitle } from "../utils/jellyfinHelpers";

interface LibraryGridItemProps {
  item: JellyfinItem;
  index: number;
  connector: JellyfinConnector | undefined;
  serviceId: string | undefined;
  activeSegment: CollectionSegmentKey;
  windowWidth: number;
  numColumns: number;
  onOpenItem: (itemId?: string) => void;
  onPlayItem: (item: JellyfinItem, resumeTicks?: number | null) => void;
}

export const LibraryGridItem: React.FC<LibraryGridItemProps> = ({
  item,
  index,
  connector,
  serviceId,
  activeSegment,
  windowWidth,
  numColumns,
  onOpenItem,
  onPlayItem,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const posterUri = buildPosterUri(
    connector,
    item,
    480,
    (item as any).__posterSourceId as string | undefined,
  );
  const subtitle = deriveSubtitle(item, activeSegment);
  const positionStyle =
    index % 2 === 0 ? styles.gridCardLeft : styles.gridCardRight;
  const isPlayable =
    item.Type === "Movie" ||
    item.Type === "Episode" ||
    item.Type === "Video" ||
    item.MediaType === "Video";

  const contentHorizontalPadding = spacing.lg * 2;
  const totalGaps = spacing.xl;
  const effectiveColumnWidth = Math.max(
    0,
    Math.floor(
      (windowWidth - contentHorizontalPadding - totalGaps) / numColumns,
    ),
  );
  const posterSize = Math.max(140, effectiveColumnWidth - spacing.md * 2);

  const navigationId = (item as any).__navigationId ?? item.Id;

  return (
    <AnimatedListItem index={index}>
      <View>
        <Pressable
          style={({ pressed }) => [
            styles.gridCard,
            positionStyle,
            pressed && styles.cardPressed,
          ]}
          onPress={() => onOpenItem(navigationId)}
        >
          <View style={styles.posterFrame}>
            <MediaPoster
              key={`poster-${item.Id || item.Name || "unknown"}-${index}`}
              uri={posterUri}
              size={posterSize}
              borderRadius={12}
              overlay={
                <>
                  <WatchStatusBadge
                    userData={item.UserData}
                    position="top-right"
                    showProgressBar={true}
                  />
                  {isPlayable ? (
                    <Pressable
                      style={styles.gridPlayOverlay}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${item.Name ?? "item"}`}
                      onPress={(event) => {
                        event.stopPropagation?.();
                        onPlayItem(
                          item,
                          item.UserData?.PlaybackPositionTicks ?? null,
                        );
                      }}
                    >
                      <View style={styles.gridPlayButton}>
                        <MaterialCommunityIcons
                          name="play"
                          size={20}
                          color={theme.colors.onPrimary}
                        />
                      </View>
                    </Pressable>
                  ) : null}
                  {connector && serviceId && item.Id && (
                    <View style={styles.downloadOverlay}>
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
          <Text variant="bodyMedium" numberOfLines={2} style={styles.gridTitle}>
            {item.Name ?? "Untitled"}
          </Text>
          {subtitle ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={styles.gridSubtitle}
            >
              {subtitle}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </AnimatedListItem>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    gridCard: {
      flex: 1,
      gap: spacing.xs,
      marginBottom: spacing.md,
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: "transparent",
      overflow: "visible",
    },
    posterFrame: {
      padding: 0,
      borderRadius: 12,
      alignItems: "center",
    },
    gridPlayOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -18 }, { translateY: -18 }],
      zIndex: 2,
    },
    gridPlayButton: {
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      borderRadius: 20,
      padding: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
    },
    downloadOverlay: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: 16,
    },
    gridCardLeft: {
      marginRight: spacing.md,
    },
    gridCardRight: {
      marginLeft: spacing.md,
    },
    gridTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      textAlign: "center",
      marginTop: spacing.xs,
    },
    gridSubtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    cardPressed: {
      opacity: 0.9,
    },
  });
