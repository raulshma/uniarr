import React from "react";
import { View, StyleSheet } from "react-native";

import SkeletonLoader from "./SkeletonLoader";

export interface MediaCardSkeletonProps {
  /**
   * Size of the media card
   * @default 'medium'
   */
  size?: "small" | "medium" | "large";
  /**
   * Whether to show additional metadata
   * @default true
   */
  showMetadata?: boolean;
  /**
   * Custom style for the container
   */
  style?: any;
  /**
   * Border radius for the poster
   * @default 12
   */
  borderRadius?: number;
}

const sizeConfig = {
  small: {
    width: 96,
    height: 144,
    titleWidth: 80,
    subtitleWidth: 60,
  },
  medium: {
    width: 128,
    height: 192,
    titleWidth: 110,
    subtitleWidth: 80,
  },
  large: {
    width: 160,
    height: 240,
    titleWidth: 140,
    subtitleWidth: 100,
  },
};

const MediaCardSkeleton: React.FC<MediaCardSkeletonProps> = ({
  size = "medium",
  showMetadata = true,
  style,
  borderRadius = 12,
}) => {
  const config = sizeConfig[size];

  return (
    <View style={[styles.container, style]}>
      {/* Poster skeleton */}
      <SkeletonLoader
        width={config.width}
        height={config.height}
        borderRadius={borderRadius}
        shimmerDuration={1200}
      />

      {/* Metadata skeleton */}
      {showMetadata && (
        <View style={styles.metadata}>
          <SkeletonLoader
            width={config.titleWidth}
            height={16}
            borderRadius={4}
            style={styles.title}
            variant="surface"
          />
          <SkeletonLoader
            width={config.subtitleWidth}
            height={12}
            borderRadius={4}
            variant="surface"
          />
        </View>
      )}
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

export default MediaCardSkeleton;
