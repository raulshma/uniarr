import React, { useMemo } from "react";
import { ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import type { DiscoverMediaItem } from "@/models/discover.types";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

interface Props {
  item: DiscoverMediaItem;
  onAdd: (item: DiscoverMediaItem) => void;
  onPress: (item: DiscoverMediaItem) => void;
}

export const TmdbListItem: React.FC<Props> = ({ item, onAdd, onPress }) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // full-width card with increased height and backdrop cover
        container: {
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: spacing.sm,
          paddingVertical: 0,
          marginHorizontal: 0,
          marginVertical: spacing.xs,
          backgroundColor: "transparent",
          minHeight: 240,
          height: 240,
        },
        // poster wrapper includes padding top/bottom/left while poster image keeps fixed size
        posterWrapper: {
          marginRight: spacing.md,
          borderRadius: 8,
          overflow: "hidden",
          width: 125,
          height: 240,
          paddingTop: spacing.none,
          paddingBottom: spacing.sm,
          justifyContent: "center",
        },
        contentWrapper: {
          flex: 1,
          justifyContent: "center",
          paddingVertical: spacing.sm,
        },
        // text shadow will be used for contrast instead of a background box
        // (do NOT add a background color to the text section)
        title: {
          color: theme.colors.onSurface,
          // make title larger and bolder for readability
          fontSize: Math.max(
            18,
            theme.custom.typography.titleLarge?.fontSize ?? 18,
          ),
          fontFamily:
            theme.custom.typography.titleLarge?.fontFamily ??
            theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleLarge?.lineHeight ?? 22,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: "700",
          marginBottom: spacing.xs,
        },
        overview: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodySmall.fontSize,
          marginBottom: spacing.xs,
          // subtle shadow for readability over images
          textShadowColor: "rgba(0,0,0,0.7)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        details: {
          flexDirection: "row",
          alignItems: "center",
        },
        // spacer used between detail children since RN doesn't support gap
        detailsSpacer: {
          width: spacing.sm,
        },
        detailText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontFamily: theme.custom.typography.bodySmall.fontFamily,
          textShadowColor: "rgba(0,0,0,0.6)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 1,
        },
        year: {
          color: theme.colors.onSurfaceVariant,
        },
        mediaType: {
          color: theme.colors.primary,
          fontWeight: "600",
        },
        rating: {
          color: theme.colors.primary,
        },
        dot: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
        },
        backgroundImage: {
          width: "100%",
          height: 240,
        },
        backgroundImageStyle: {
          opacity: 0.12,
          resizeMode: "cover",
          backgroundColor: theme.colors.surface,
        },
      }),
    [theme],
  );

  const handleLongPress = () => onAdd(item);

  const formatYear = (date: string | undefined) => {
    if (!date) return "";
    try {
      return new Date(date).getFullYear().toString();
    } catch {
      return "";
    }
  };

  const formatRating = (rating: number | undefined) => {
    if (rating == null) return "";
    return rating.toFixed(1);
  };

  return (
    <ImageBackground
      source={item.backdropUrl ? { uri: item.backdropUrl } : undefined}
      style={styles.backgroundImage}
      imageStyle={styles.backgroundImageStyle}
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.container,
          pressed && { opacity: 0.95 },
        ]}
        onPress={() => onPress(item)}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        <View style={styles.posterWrapper}>
          <MediaPoster
            uri={item.posterUrl}
            size={125}
            borderRadius={8}
            showPlaceholderLabel
          />
        </View>

        <View style={styles.contentWrapper}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>

          {/* Short overview if available */}
          {item.overview ? (
            <Text numberOfLines={2} style={styles.overview}>
              {item.overview}
            </Text>
          ) : null}

          <View style={styles.details}>
            {/* Media type (Movie / TV) */}
            <Text style={[styles.detailText, styles.mediaType]}>
              {item.mediaType === "series" ? "TV Series" : "Movie"}
            </Text>

            {/* year */}
            {item.releaseDate || item.year ? (
              <>
                <View style={styles.detailsSpacer} />
                <Text style={[styles.detailText, styles.year]}>
                  {item.releaseDate ? formatYear(item.releaseDate) : item.year}
                </Text>
              </>
            ) : null}

            {/* spacer when both year and rating present */}
            {(item.releaseDate || item.year) && item.rating ? (
              <View style={styles.detailsSpacer} />
            ) : null}

            {/* Rating (show regardless of releaseDate) */}
            {item.rating ? (
              <Text style={[styles.detailText, styles.rating]}>
                ★ {formatRating(item.rating)}
              </Text>
            ) : null}

            {/* vote count if present */}
            {item.voteCount ? (
              <>
                <View style={styles.detailsSpacer} />
                <Text style={styles.detailText}>({item.voteCount})</Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    </ImageBackground>
  );
};

export default TmdbListItem;
