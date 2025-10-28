import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { spacing } from "@/theme/spacing";

const DetailPageSkeleton = () => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          gap: spacing.lg,
        },
        hero: {
          height: 300,
          borderRadius: 12,
          marginBottom: spacing.lg,
        },
        titleWrapper: {
          gap: spacing.xs,
          marginBottom: spacing.lg,
        },
        title: {
          height: 32,
          width: "80%",
        },
        subtitle: {
          height: 16,
          width: "50%",
        },
        synopsisWrapper: {
          gap: spacing.sm,
          marginBottom: spacing.lg,
        },
        synopsis: {
          height: 16,
        },
        lastSynopsis: {
          width: "60%",
        },
        sectionTitle: {
          height: 20,
          width: "30%",
          marginBottom: spacing.md,
        },
        castRow: {
          flexDirection: "row",
          gap: spacing.sm,
          marginBottom: spacing.lg,
        },
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
        },
      }),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Title skeleton */}
      <View style={styles.titleWrapper}>
        <SkeletonPlaceholder
          width="80%"
          height={32}
          borderRadius={4}
          style={styles.title}
        />
        <SkeletonPlaceholder
          width="50%"
          height={16}
          borderRadius={4}
          style={styles.subtitle}
        />
      </View>

      {/* Synopsis skeleton (3 lines) */}
      <View style={styles.synopsisWrapper}>
        <SkeletonPlaceholder
          width="100%"
          height={16}
          borderRadius={4}
          style={styles.synopsis}
        />
        <SkeletonPlaceholder
          width="100%"
          height={16}
          borderRadius={4}
          style={styles.synopsis}
        />
        <SkeletonPlaceholder
          width="60%"
          height={16}
          borderRadius={4}
          style={[styles.synopsis, styles.lastSynopsis]}
        />
      </View>

      {/* Genres section */}
      <View>
        <SkeletonPlaceholder
          width="30%"
          height={20}
          borderRadius={4}
          style={styles.sectionTitle}
        />
        <SkeletonPlaceholder width="70%" height={16} borderRadius={4} />
      </View>

      {/* Cast section */}
      <View>
        <SkeletonPlaceholder
          width="30%"
          height={20}
          borderRadius={4}
          style={styles.sectionTitle}
        />
        <View style={styles.castRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonPlaceholder
              key={i}
              width={48}
              height={48}
              borderRadius={24}
              style={styles.avatar}
            />
          ))}
        </View>
      </View>

      {/* Ratings section */}
      <View>
        <SkeletonPlaceholder width="50%" height={16} borderRadius={4} />
      </View>
    </View>
  );
};

export default DetailPageSkeleton;
