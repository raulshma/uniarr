import React, { useMemo, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Pressable, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

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
      backgroundColor: compact
        ? theme.colors.surfaceVariant
        : theme.colors.surface,
      borderRadius: compact ? 12 : 18,
      paddingVertical: compact
        ? theme.custom.spacing.xs
        : theme.custom.spacing.sm,
      paddingHorizontal: compact
        ? theme.custom.spacing.sm
        : theme.custom.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: compact ? theme.custom.spacing.xs : theme.custom.spacing.md,
      borderWidth: compact ? StyleSheet.hairlineWidth : 0,
      borderColor: compact ? theme.colors.outlineVariant : "transparent",
      marginBottom: compact ? 0 : theme.custom.spacing.sm,
    },
    pressable: {
      flex: 1,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: compact ? theme.custom.spacing.xs : theme.custom.spacing.md,
    },
    posterContainer: {
      width: compact ? 56 : 80,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: compact
        ? theme.custom.typography.titleSmall.fontSize
        : theme.custom.typography.titleMedium.fontSize,
      fontFamily: compact
        ? theme.custom.typography.titleSmall.fontFamily
        : theme.custom.typography.titleMedium.fontFamily,
      fontWeight: compact
        ? (theme.custom.typography.titleSmall.fontWeight as any)
        : (theme.custom.typography.titleMedium.fontWeight as any),
      lineHeight: compact
        ? theme.custom.typography.titleSmall.lineHeight
        : theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: compact
        ? theme.custom.typography.titleSmall.letterSpacing
        : theme.custom.typography.titleMedium.letterSpacing,
      color: theme.colors.onSurface,
    },
    subtitle: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.custom.spacing.xxs,
    },
    trailing: {
      width: compact ? 32 : 40,
      height: compact ? 32 : 40,
      borderRadius: compact ? 16 : 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceVariant,
    },
    trailingSelected: {
      backgroundColor: theme.colors.primaryContainer,
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

  const subtitle = useMemo(() => {
    const parts: string[] = [];

    parts.push(typeConfig.label);

    if (release.type === "episode") {
      if (release.seasonNumber && release.episodeNumber) {
        const season = String(release.seasonNumber).padStart(2, "0");
        const episode = String(release.episodeNumber).padStart(2, "0");
        parts.push(`S${season}E${episode}`);
      } else if (release.seriesTitle) {
        parts.push(release.seriesTitle);
      }
    }

    const releaseDate = release.releaseDate ? release.releaseDate : undefined;
    if (releaseDate) {
      parts.push(formatTimeToRelease(releaseDate));
    }

    return parts.join(" • ");
  }, [release, typeConfig.label]);

  const monitored = release.monitored ?? false;
  const statusIcon = monitored ? "check-circle" : "bookmark-outline";
  const statusColor = monitored
    ? theme.colors.onPrimaryContainer
    : theme.colors.onSurfaceVariant;

  return (
    <AnimatedCard
      style={[
        styles.container,
        isPressed && !compact ? { opacity: 0.9 } : null,
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
        <View style={styles.content}>
          <View style={styles.posterContainer}>
            <MediaPoster
              uri={release.posterUrl}
              size={compact ? 56 : 80}
              borderRadius={14}
              showPlaceholderLabel={false}
            />
          </View>

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={compact ? 1 : 2}>
              {release.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <View style={[styles.trailing, monitored && styles.trailingSelected]}>
            <Icon source={statusIcon} size={20} color={statusColor} />
          </View>
        </View>
      </Pressable>
    </AnimatedCard>
  );
};

export default MediaReleaseCard;
