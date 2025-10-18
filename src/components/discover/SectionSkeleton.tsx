import React, { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import DiscoverCardSkeleton from "./DiscoverCardSkeleton";
import { spacing } from "@/theme/spacing";

// Import SkeletonPlaceholder locally to avoid circular imports
import { SkeletonPlaceholder } from "@/components/common/Skeleton";

const SectionSkeleton = () => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: spacing.lg,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
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
          paddingRight: spacing.md,
        },
      }),
    [],
  );

  const skeletonCards = Array(6).fill(null);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <SkeletonPlaceholder width={200} height={28} borderRadius={4} />
        <SkeletonPlaceholder width={60} height={20} borderRadius={4} />
      </View>
      <FlatList
        data={skeletonCards}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => `skeleton-${index}`}
        contentContainerStyle={styles.listContent}
        renderItem={() => <DiscoverCardSkeleton />}
      />
    </View>
  );
};

export default SectionSkeleton;
