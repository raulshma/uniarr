import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import type { DiscoverMediaItem } from "@/models/discover.types";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

interface Props {
  item: DiscoverMediaItem;
  onAdd: (item: DiscoverMediaItem) => void;
  onPress: (item: DiscoverMediaItem) => void;
}

export const TmdbCard: React.FC<Props> = ({ item, onAdd, onPress }) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          margin: 0, // Remove margin to avoid uneven spacing
          height: 280, // Fixed height for perfect column alignment
        },
        posterWrapper: {
          marginBottom: spacing.xs,
          // Ensure absolutely positioned overlays anchor correctly
          position: "relative",
        },
        addButton: {
          position: "absolute",
          top: spacing.xxxs,
          right: spacing.xxxs,
          backgroundColor: theme.colors.primary,
          // Make sure the button renders above the poster (shadows/elevation)
          zIndex: 100,
          elevation: 100,
        },
        title: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleSmall.fontSize,
          fontFamily: theme.custom.typography.titleSmall.fontFamily,
          lineHeight: theme.custom.typography.titleSmall.lineHeight,
          letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
          fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
        },
      }),
    [theme],
  );

  return (
    <Pressable
      accessibilityRole="button"
      style={styles.container}
      onPress={() => onPress(item)}
    >
      <View style={styles.posterWrapper}>
        <MediaPoster
          uri={item.posterUrl}
          size={160}
          borderRadius={12}
          showPlaceholderLabel
          priority="high"
          overlay={
            <IconButton
              icon="plus"
              size={20}
              mode="contained"
              style={styles.addButton}
              iconColor={theme.colors.onPrimary}
              onPress={() => onAdd(item)}
              accessibilityLabel={`Add ${item.title}`}
            />
          }
        />
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {item.title}
      </Text>
    </Pressable>
  );
};

export default TmdbCard;
