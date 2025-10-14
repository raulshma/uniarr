import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { DiscoverMediaItem } from '@/models/discover.types';
import { spacing } from '@/theme/spacing';
import { TmdbCard } from '@/components/discover/tmdb/TmdbCard';

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        contentContainer: {
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.xxl,
        },
        emptyState: {
          paddingVertical: spacing.xl,
          alignItems: 'center',
          gap: spacing.sm,
        },
        footer: {
          paddingVertical: spacing.md,
        },
      }),
    [],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      renderItem={({ item }) => (
        <TmdbCard item={item} onAdd={onAdd} onPress={onCardPress} />
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            No results yet
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Adjust filters or try another media type.
          </Text>
        </View>
      }
      ListFooterComponent={
        isFetchingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator />
          </View>
        ) : null
      }
      contentContainerStyle={styles.contentContainer}
      columnWrapperStyle={{ justifyContent: 'space-between' }}
      refreshControl={
        onRefresh
          ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            )
          : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
};

export default TmdbResultsGrid;
