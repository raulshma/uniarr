import React from "react";
import { View, StyleSheet } from "react-native";

import SkeletonLoader from "./SkeletonLoader";

export interface ServiceCardSkeletonProps {
  /**
   * Custom style for the container
   */
  style?: any;
  /**
   * Whether to show extended skeleton
   * @default false
   */
  extended?: boolean;
}

const ServiceCardSkeleton: React.FC<ServiceCardSkeletonProps> = ({
  style,
  extended = false,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {/* Service icon skeleton */}
        <SkeletonLoader
          width={48}
          height={48}
          borderRadius={12}
          style={styles.icon}
        />

        <View style={styles.textContainer}>
          {/* Service name skeleton */}
          <SkeletonLoader
            width={120}
            height={18}
            borderRadius={4}
            style={styles.serviceName}
            variant="surface"
          />

          {/* Service URL skeleton */}
          <SkeletonLoader
            width={180}
            height={14}
            borderRadius={4}
            variant="surface"
          />

          {/* Status indicator skeleton */}
          <SkeletonLoader
            width={60}
            height={12}
            borderRadius={6}
            style={styles.status}
            variant="primary"
          />
        </View>

        {/* Action buttons skeleton */}
        <View style={styles.actions}>
          <SkeletonLoader
            width={32}
            height={32}
            borderRadius={16}
            style={styles.actionButton}
          />
          <SkeletonLoader
            width={32}
            height={32}
            borderRadius={16}
            style={styles.actionButton}
          />
        </View>
      </View>

      {/* Extended content skeleton */}
      {extended && (
        <View style={styles.extendedContent}>
          <SkeletonLoader
            width="100%"
            height={1}
            borderRadius={0}
            style={styles.divider}
          />
          <View style={styles.stats}>
            <SkeletonLoader
              width={80}
              height={14}
              borderRadius={4}
              variant="surface"
            />
            <SkeletonLoader
              width={80}
              height={14}
              borderRadius={4}
              variant="surface"
            />
            <SkeletonLoader
              width={80}
              height={14}
              borderRadius={4}
              variant="surface"
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: "transparent",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  serviceName: {
    marginBottom: 2,
  },
  status: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 0,
  },
  actionButton: {
    flexShrink: 0,
  },
  extendedContent: {
    marginTop: 12,
    paddingTop: 12,
  },
  divider: {
    marginBottom: 12,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
});

export default ServiceCardSkeleton;
