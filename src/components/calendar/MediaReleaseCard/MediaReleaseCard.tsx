import React, { useMemo, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Pressable, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { MediaRelease } from "@/models/calendar.types";
import { formatTimeToRelease } from "@/utils/calendar.utils";
import { MediaPoster } from "@/components/media/MediaPoster";
import { AnimatedCard } from "@/components/common/AnimatedComponents";

export type MediaReleaseCardProps = {
  release: MediaRelease;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
  animationDelay?: number;
};

const MediaReleaseCard: React.FC<MediaReleaseCardProps> = ({
  release,
  compact = false,
  onPress,
  style,
  animated = true,
  animationDelay = 0,
}) => {
  const theme = useTheme<AppTheme>();
  const [isPressed, setIsPressed] = useState(false);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: compact ? 16 : 24,
      padding: compact ? theme.custom.spacing.sm : theme.custom.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.md,
      // Subtle shadow
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      marginBottom: compact ? 0 : theme.custom.spacing.sm,
    },
    pressable: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.md,
    },
    posterContainer: {
      width: compact ? 48 : 72,
      aspectRatio: 2 / 3,
      borderRadius: compact ? 8 : 12,
      backgroundColor: theme.colors.surfaceVariant,
      // Poster shadow
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    info: {
      flex: 1,
      justifyContent: "center",
      gap: 2,
    },
    title: {
      fontSize: compact
        ? theme.custom.typography.titleMedium.fontSize
        : theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: "600",
      color: theme.colors.onSurface,
      letterSpacing: -0.2,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    metaText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: theme.colors.outline,
    },
    episodeCode: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    statusIndicator: {
      width: 4,
      height: "60%",
      borderRadius: 2,
      backgroundColor: release.monitored
        ? theme.colors.primary
        : theme.colors.outlineVariant,
      opacity: 0.8,
    },
  });

  const typeConfig = useMemo(() => {
    switch (release.type) {
      case "movie":
        return { label: "Movie", icon: "movie-open" };
      case "series":
        return { label: "TV Show", icon: "television-classic" };
      case "episode":
        return { label: "TV Show", icon: "play-circle" };
      default:
        return { label: "Media", icon: "play" };
    }
  }, [release.type]);

  const renderMeta = () => {
    const parts: React.ReactNode[] = [];

    // Type Label
    parts.push(
      <Text key="type" style={styles.metaText}>
        {typeConfig.label}
      </Text>,
    );

    // Episode Info
    if (release.type === "episode") {
      if (release.seasonNumber && release.episodeNumber) {
        const season = String(release.seasonNumber).padStart(2, "0");
        const episode = String(release.episodeNumber).padStart(2, "0");
        parts.push(
          <View key="dot1" style={styles.dot} />,
          <Text key="ep" style={[styles.metaText, styles.episodeCode]}>
            S{season}E{episode}
          </Text>,
        );
      }
    }

    // Release Time
    if (release.releaseDate) {
      parts.push(
        <View key="dot2" style={styles.dot} />,
        <Text key="time" style={styles.metaText}>
          {formatTimeToRelease(release.releaseDate)}
        </Text>,
      );
    }

    return <View style={styles.metaRow}>{parts}</View>;
  };

  return (
    <AnimatedCard
      style={[
        styles.container,
        isPressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
      delay={animationDelay}
      animated={animated}
    >
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`${release.title}, ${typeConfig.label}`}
      >
        <View style={styles.posterContainer}>
          <MediaPoster
            uri={release.posterUrl}
            size={compact ? 48 : 72} // This prop might be ignored if style overrides, but good for placeholder sizing
            borderRadius={compact ? 8 : 12}
            showPlaceholderLabel={false}
            style={{ width: "100%", height: "100%" }}
          />
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {release.title}
          </Text>
          {release.seriesTitle && release.type === "episode" && (
            <Text
              style={[styles.metaText, { marginBottom: 2 }]}
              numberOfLines={1}
            >
              {release.seriesTitle}
            </Text>
          )}
          {renderMeta()}
        </View>

        <View style={styles.statusIndicator} />
      </Pressable>
    </AnimatedCard>
  );
};

export default MediaReleaseCard;
