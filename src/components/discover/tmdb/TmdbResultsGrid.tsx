import React, { useMemo } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { SkiaLoader } from "@/components/common/SkiaLoader";
import { FlashList } from "@shopify/flash-list";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { DiscoverMediaItem } from "@/models/discover.types";
import { spacing } from "@/theme/spacing";
import { TmdbListItem } from "@/components/discover/tmdb/TmdbListItem";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";

interface Props {
  items: DiscoverMediaItem[];
  onAdd: (item: DiscoverMediaItem) => void;
  onCardPress: (item: DiscoverMediaItem) => void;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  isFetchingMore?: boolean;
}

export const TmdbResultsGrid: React.FC<Props> = ({
  items,
  onAdd,
  onCardPress,
  onEndReached,
  refreshing,
  onRefresh,
  isFetchingMore,
}) => {
  const theme = useTheme<AppTheme>();
  const allowAnimations = !refreshing && !isFetchingMore;
  const totalItems = items.length;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // removed horizontal padding so items can render edge-to-edge
        contentContainer: {
          paddingBottom: spacing.xxl,
        },
        emptyState: {
          paddingVertical: spacing.xl,
          alignItems: "center",
          gap: spacing.sm,
        },
        footer: {
          paddingVertical: spacing.md,
        },
      }),
    [],
  );

  const renderItem = ({
    item,
    index,
  }: {
    item: DiscoverMediaItem;
    index: number;
  }) => (
    <AnimatedListItem
      index={index}
      totalItems={totalItems}
      staggerDelay={60}
      animated={allowAnimations}
    >
      <TmdbListItem item={item} onAdd={onAdd} onPress={onCardPress} />
    </AnimatedListItem>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
        No results yet
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Adjust filters or try another media type.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (onEndReached && isFetchingMore) {
      return (
        <View style={styles.footer}>
          <SkiaLoader size={40} />
        </View>
      );
    }
    return null;
  };

  return (
    <FlashList<DiscoverMediaItem>
      data={items}
      keyExtractor={(item: DiscoverMediaItem) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
};

export default TmdbResultsGrid;
