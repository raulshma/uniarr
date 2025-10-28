import React, { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import MediaCardSkeleton from "@/components/common/SkeletonLoader/MediaCardSkeleton";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { spacing } from "@/theme/spacing";

export interface AnimeHubSectionSkeletonProps {
  /**
   * Number of skeleton cards to render in the section
   * @default 6
   */
  itemCount?: number;
  /**
   * Size of the cards ('small' = 96, 'medium' = 128, 'large' = 160)
   * @default 'large'
   */
  cardSize?: "small" | "medium" | "large";
  /**
   * Whether to show metadata below each card
   * @default true
   */
  showMetadata?: boolean;
}

/**
 * AnimeHubSectionSkeleton
 *
 * Renders a section skeleton matching the Anime Hub layout.
 * This component displays a section header (title + action button) followed by
 * a horizontal scrollable row of media card skeletons, matching the `AnimeCard`
 * sizing (large = 160px width).
 *
 * The large card size (160px) matches the default `AnimeCard` width used in
 * Anime Hub horizontal lists.
 */
const AnimeHubSectionSkeleton: React.FC<AnimeHubSectionSkeletonProps> = ({
  itemCount = 6,
  cardSize = "large",
  showMetadata = true,
}) => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: spacing.lg,
          marginBottom: spacing.lg,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        titleSkeleton: {
          width: 200,
          height: 28,
        },
        buttonSkeleton: {
          width: 60,
          height: 20,
        },
        listContent: {
          paddingLeft: spacing.md,
          paddingRight: spacing.md,
        },
      }),
    [],
  );

  const skeletonCards = Array(itemCount).fill(null);

  return (
    <View style={styles.container}>
      {/* Section header with title and action button */}
      <View style={styles.sectionHeader}>
        <SkeletonPlaceholder
          width={200}
          height={28}
          borderRadius={4}
          animated
          animationDuration={1000}
        />
        <SkeletonPlaceholder
          width={60}
          height={20}
          borderRadius={4}
          animated
          animationDuration={1000}
        />
      </View>

      {/* Horizontal scrollable list of media card skeletons */}
      <FlatList
        data={skeletonCards}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, index) => `anime-skeleton-${index}`}
        contentContainerStyle={styles.listContent}
        renderItem={() => (
          <MediaCardSkeleton
            size={cardSize}
            showMetadata={showMetadata}
            style={{ marginRight: spacing.md }}
          />
        )}
      />
    </View>
  );
};

export default AnimeHubSectionSkeleton;
