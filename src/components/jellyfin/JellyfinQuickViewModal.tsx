import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  BackHandler,
} from "react-native";
import { Text, useTheme, Button, Chip } from "react-native-paper";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";

import type { AppTheme } from "@/constants/theme";
import type { JellyfinItem } from "@/models/jellyfin.types";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { spacing } from "@/theme/spacing";
import { WatchStatusBadge } from "./WatchStatusBadge";

type Layout = {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_WIDTH = SCREEN_WIDTH * 0.9;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.8;

interface JellyfinQuickViewModalProps {
  visible: boolean;
  item: JellyfinItem | null;
  initialLayout: Layout | null;
  connector: JellyfinConnector | undefined;
  onDismiss: () => void;
  onOpenDetails: (itemId: string) => void;
  onPlay: (item: JellyfinItem) => void;
}

export const JellyfinQuickViewModal: React.FC<JellyfinQuickViewModalProps> = ({
  visible,
  item,
  initialLayout,
  connector,
  onDismiss,
  onOpenDetails,
  onPlay,
}) => {
  const theme = useTheme<AppTheme>();
  const progress = useSharedValue(0);

  // Preserve item and layout during close animation
  const [displayItem, setDisplayItem] = useState(item);
  const [displayLayout, setDisplayLayout] = useState(initialLayout);

  useEffect(() => {
    if (visible && item && initialLayout) {
      // When opening, immediately update the display data
      setDisplayItem(item);
      setDisplayLayout(initialLayout);
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else if (!visible) {
      // When closing, animate first, then clear data after animation completes
      progress.value = withTiming(
        0,
        {
          duration: 250,
          easing: Easing.ease,
        },
        (finished) => {
          if (finished) {
            runOnJS(setDisplayItem)(null);
            runOnJS(setDisplayLayout)(null);
          }
        },
      );
    }
  }, [visible, item, initialLayout, progress]);

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onDismiss();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [visible, onDismiss]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const containerStyle = useAnimatedStyle(() => {
    if (!displayLayout) return {};

    // Interpolate position and size from initial layout to modal layout
    const targetX = (SCREEN_WIDTH - MODAL_WIDTH) / 2;
    const targetY = (SCREEN_HEIGHT - MODAL_HEIGHT) / 2;

    const left = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.pageX, targetX],
    );
    const top = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.pageY, targetY],
    );
    const width = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.width, MODAL_WIDTH],
    );
    const height = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.height, MODAL_HEIGHT],
    );
    const borderRadius = interpolate(progress.value, [0, 1], [16, 24]);

    return {
      left,
      top,
      width,
      height,
      borderRadius,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0.6, 1],
      [0, 1],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      progress.value,
      [0.6, 1],
      [20, 0],
      Extrapolate.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  if (!displayItem || !displayLayout) return null;

  const backdropUri = connector?.config.url
    ? `${connector.config.url}/Items/${displayItem.Id}/Images/Backdrop?maxWidth=1280&quality=90`
    : undefined;

  const posterUri = connector?.config.url
    ? `${connector.config.url}/Items/${displayItem.Id}/Images/Primary?maxHeight=600&quality=90`
    : undefined;

  const isPlayable =
    displayItem.Type === "Movie" ||
    displayItem.Type === "Episode" ||
    displayItem.Type === "Video" ||
    displayItem.MediaType === "Video";

  // Calculate watch progress
  const playedPercentage = displayItem.UserData?.PlayedPercentage ?? 0;
  const isWatched = displayItem.UserData?.Played ?? false;
  const hasProgress =
    (displayItem.UserData?.PlaybackPositionTicks ?? 0) > 600_000_000;

  // Format runtime
  const runtimeMinutes = displayItem.RunTimeTicks
    ? Math.round(displayItem.RunTimeTicks / 600_000_000)
    : null;
  const runtimeText = runtimeMinutes
    ? `${Math.floor(runtimeMinutes / 60)}h ${runtimeMinutes % 60}m`
    : null;

  // Get genres
  const genres = displayItem.Genres?.slice(0, 3) ?? [];

  // Get community rating
  const rating = displayItem.CommunityRating
    ? displayItem.CommunityRating.toFixed(1)
    : null;

  const handleDismiss = () => {
    onDismiss();
  };

  const handleOpenDetails = () => {
    if (displayItem.Id) {
      onDismiss();
      onOpenDetails(displayItem.Id);
    }
  };

  const handlePlay = () => {
    onDismiss();
    onPlay(displayItem);
  };

  const styles = createStyles(theme);

  // Don't render at all if never opened
  if (!displayItem && !visible) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.6)" },
            backdropStyle,
          ]}
        >
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={80}
            tint="dark"
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Animated Card */}
      <Animated.View
        style={[
          styles.cardContainer,
          { backgroundColor: theme.colors.surface },
          containerStyle,
        ]}
      >
        <View style={styles.cardContent}>
          {/* Header with backdrop */}
          <View style={styles.header}>
            {backdropUri && (
              <Image
                source={{ uri: backdropUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )}
            <LinearGradient
              colors={["transparent", theme.colors.surface]}
              style={StyleSheet.absoluteFill}
            />

            {/* Watch status badge */}
            <View style={styles.watchBadgeContainer}>
              <WatchStatusBadge
                userData={displayItem.UserData}
                position="top-right"
                showProgressBar={false}
              />
            </View>
          </View>

          {/* Scrollable content */}
          <Animated.ScrollView
            style={[styles.scrollContent, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            {/* Poster and basic info */}
            <View style={styles.infoSection}>
              {posterUri && (
                <Image
                  source={{ uri: posterUri }}
                  style={styles.poster}
                  contentFit="cover"
                />
              )}

              <View style={styles.basicInfo}>
                <Text variant="headlineSmall" style={styles.title}>
                  {displayItem.Name}
                </Text>

                {/* Metadata row */}
                <View style={styles.metadataRow}>
                  {displayItem.ProductionYear && (
                    <Text variant="bodyMedium" style={styles.metadata}>
                      {displayItem.ProductionYear}
                    </Text>
                  )}
                  {rating && (
                    <View style={styles.ratingContainer}>
                      <MaterialCommunityIcons
                        name="star"
                        size={16}
                        color={theme.colors.primary}
                      />
                      <Text variant="bodyMedium" style={styles.metadata}>
                        {rating}
                      </Text>
                    </View>
                  )}
                  {runtimeText && (
                    <Text variant="bodyMedium" style={styles.metadata}>
                      {runtimeText}
                    </Text>
                  )}
                </View>

                {/* Watch progress */}
                {hasProgress && !isWatched && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${playedPercentage}%`,
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text variant="bodySmall" style={styles.progressText}>
                      {Math.round(playedPercentage)}% watched
                    </Text>
                  </View>
                )}

                {/* Genres */}
                {genres.length > 0 && (
                  <View style={styles.genresContainer}>
                    {genres.map((genre, index) => (
                      <Chip
                        key={index}
                        mode="outlined"
                        compact
                        style={styles.genreChip}
                      >
                        {genre}
                      </Chip>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Overview */}
            {displayItem.Overview && (
              <View style={styles.overviewSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Overview
                </Text>
                <Text
                  variant="bodyMedium"
                  style={styles.overview}
                  numberOfLines={6}
                >
                  {displayItem.Overview}
                </Text>
              </View>
            )}

            {/* Additional info for TV shows */}
            {displayItem.Type === "Series" && (
              <View style={styles.additionalInfo}>
                {displayItem.Status && (
                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>
                      Status:
                    </Text>
                    <Text variant="bodyMedium">{displayItem.Status}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Episode info */}
            {displayItem.Type === "Episode" && (
              <View style={styles.additionalInfo}>
                {displayItem.SeriesName && (
                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>
                      Series:
                    </Text>
                    <Text variant="bodyMedium">{displayItem.SeriesName}</Text>
                  </View>
                )}
                {displayItem.SeasonName && (
                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>
                      Season:
                    </Text>
                    <Text variant="bodyMedium">{displayItem.SeasonName}</Text>
                  </View>
                )}
                {typeof displayItem.IndexNumber === "number" && (
                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>
                      Episode:
                    </Text>
                    <Text variant="bodyMedium">{displayItem.IndexNumber}</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.ScrollView>

          {/* Action buttons */}
          <Animated.View style={[styles.actions, contentStyle]}>
            {isPlayable && (
              <Button
                mode="contained"
                onPress={handlePlay}
                icon="play"
                style={styles.playButton}
              >
                {hasProgress && !isWatched ? "Resume" : "Play"}
              </Button>
            )}
            <Button
              mode="outlined"
              onPress={handleOpenDetails}
              icon="information"
              style={styles.detailsButton}
            >
              Full Details
            </Button>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    cardContainer: {
      position: "absolute",
      overflow: "hidden",
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    cardContent: {
      flex: 1,
      overflow: "hidden",
    },
    header: {
      height: 180,
      position: "relative",
      overflow: "hidden",
    },
    watchBadgeContainer: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      zIndex: 10,
    },
    scrollContent: {
      flex: 1,
    },
    infoSection: {
      flexDirection: "row",
      padding: spacing.lg,
      gap: spacing.md,
    },
    poster: {
      width: 100,
      height: 150,
      borderRadius: 8,
    },
    basicInfo: {
      flex: 1,
      gap: spacing.sm,
    },
    title: {
      fontWeight: "bold",
    },
    metadataRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flexWrap: "wrap",
    },
    metadata: {
      opacity: 0.7,
    },
    ratingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    progressContainer: {
      gap: spacing.xs,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    progressText: {
      opacity: 0.7,
    },
    genresContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    genreChip: {
      height: 28,
    },
    overviewSection: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    sectionTitle: {
      fontWeight: "600",
    },
    overview: {
      lineHeight: 22,
      opacity: 0.8,
    },
    additionalInfo: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    infoRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    infoLabel: {
      fontWeight: "600",
      minWidth: 80,
    },
    actions: {
      flexDirection: "row",
      padding: spacing.lg,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
    },
    playButton: {
      flex: 1,
    },
    detailsButton: {
      flex: 1,
    },
  });
