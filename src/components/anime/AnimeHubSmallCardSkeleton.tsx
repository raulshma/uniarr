import React from "react";
import { View, StyleSheet } from "react-native";

import SkeletonLoader from "@/components/common/SkeletonLoader/SkeletonLoader";

export interface AnimeHubSmallCardSkeletonProps {
  /**
   * Custom style for the container
   */
  style?: any;
}

/**
 * AnimeHubSmallCardSkeleton
 *
 * Renders a small media card skeleton (100px width) matching the "What's New"
 * section layout in Anime Hub. This is used for the two-up card display where
 * each card is 100px wide with adjacent metadata area.
 */
const AnimeHubSmallCardSkeleton: React.FC<AnimeHubSmallCardSkeletonProps> = ({
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Poster skeleton */}
      <SkeletonLoader
        width={100}
        height={150}
        borderRadius={12}
        shimmerDuration={1200}
      />

      {/* Metadata skeleton */}
      <View style={styles.metadata}>
        <SkeletonLoader
          width={80}
          height={16}
          borderRadius={4}
          style={styles.title}
          variant="surface"
        />
        <SkeletonLoader
          width={60}
          height={12}
          borderRadius={4}
          variant="surface"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  metadata: {
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  title: {
    marginBottom: 2,
  },
});

export default AnimeHubSmallCardSkeleton;
