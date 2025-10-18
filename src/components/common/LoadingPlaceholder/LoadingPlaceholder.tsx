import React from "react";
import { View, StyleSheet } from "react-native";

import { ListSkeleton, SkeletonLoader } from "../SkeletonLoader";

export interface LoadingPlaceholderProps {
  /**
   * Type of loading placeholder to show
   * @default 'media-grid'
   */
  type?: "media-grid" | "media-list" | "services" | "custom";
  /**
   * Number of placeholder items
   * @default 6
   */
  itemCount?: number;
  /**
   * Number of columns for grid layouts
   * @default 3
   */
  columns?: number;
  /**
   * Whether to show a loading message
   * @default false
   */
  showMessage?: boolean;
  /**
   * Custom loading message
   */
  message?: string;
  /**
   * Whether the placeholder should be centered
   * @default true
   */
  centered?: boolean;
  /**
   * Custom style for the container
   */
  style?: any;
  /**
   * Custom skeleton component for 'custom' type
   */
  customSkeleton?: React.ComponentType<any>;
  /**
   * Props to pass to custom skeleton component
   */
  customSkeletonProps?: any;
}

const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  type = "media-grid",
  itemCount = 6,
  columns = 3,
  showMessage = false,
  message,
  centered = true,
  style,
  customSkeleton,
  customSkeletonProps,
}) => {
  const containerStyle = [styles.container, centered && styles.centered, style];

  return (
    <View style={containerStyle}>
      <ListSkeleton
        type={type}
        itemCount={itemCount}
        columns={columns}
        customSkeleton={customSkeleton}
        customSkeletonProps={customSkeletonProps}
      />

      {showMessage && (
        <View style={styles.messageContainer}>
          <View style={styles.skeletonText}>
            <SkeletonLoader width={120} height={16} />
            <SkeletonLoader width={80} height={12} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  messageContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  skeletonText: {
    alignItems: "center",
    gap: 8,
  },
  textLine: {
    height: 16,
  },
});

export default LoadingPlaceholder;
