import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  FAB,
  Icon,
  IconButton,
  Menu,
  Searchbar,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, Layout } from 'react-native-reanimated';

import { EmptyState } from '@/components/common/EmptyState';
import { ListRefreshControl } from '@/components/common/ListRefreshControl';
import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { ProwlarrApplicationResource } from '@/models/prowlarr.types';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';
import { useProwlarrIndexers } from '@/hooks/useProwlarrIndexers';

const FILTER_ALL = 'all';
const FILTER_ENABLED = 'enabled';
const FILTER_DISABLED = 'disabled';

type FilterValue = typeof FILTER_ALL | typeof FILTER_ENABLED | typeof FILTER_DISABLED;

const FILTER_OPTIONS: FilterValue[] = [FILTER_ALL, FILTER_ENABLED, FILTER_DISABLED];

const FILTER_LABELS: Record<FilterValue, string> = {
  [FILTER_ALL]: 'All Indexers',
  [FILTER_ENABLED]: 'Enabled',
  [FILTER_DISABLED]: 'Disabled',
};

const normalizeSearchTerm = (input: string): string => input.trim().toLowerCase();

const IndexerListItemSkeleton = () => {
  const theme = useTheme<AppTheme>();

  return (
    <Animated.View
      entering={FadeInDown}
      layout={Layout}
      style={[
        styles.indexerItem,
        { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
      ]}
    >
      <View style={styles.indexerContent}>
        <SkeletonPlaceholder style={styles.indexerIcon} />
        <View style={styles.indexerInfo}>
          <SkeletonPlaceholder style={styles.indexerName} />
          <SkeletonPlaceholder style={styles.indexerImplementation} />
          <SkeletonPlaceholder style={styles.indexerPriority} />
        </View>
        <SkeletonPlaceholder style={styles.indexerActions} />
      </View>
    </Animated.View>
  );
};

const ProwlarrIndexerListScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : '';
  const hasValidServiceId = serviceId.length > 0;

  const router = useRouter();
  const theme = useTheme<AppTheme>();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>(FILTER_ALL);
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleFilterChange = useCallback((value: FilterValue) => {
    setSelectedFilter(value);
    setIsFilterMenuVisible(false);
  }, []);


  // Use the Prowlarr indexers hook
  const {
    indexers,
    isLoading,
    error,
    refresh,
    testIndexer,
    toggleIndexer,
    deleteIndexer,
    syncIndexersToApps,
    rescanIndexers,
    getSyncStatus,
  } = useProwlarrIndexers(serviceId);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);


  // Filter and search indexers
  const filteredIndexers = useMemo(() => {
    let filtered = indexers;

    // Apply filter
    if (selectedFilter === FILTER_ENABLED) {
      filtered = filtered.filter((indexer: ProwlarrApplicationResource) => indexer.enable);
    } else if (selectedFilter === FILTER_DISABLED) {
      filtered = filtered.filter((indexer: ProwlarrApplicationResource) => !indexer.enable);
    }

    // Apply search
    if (searchQuery) {
      const searchTerm = normalizeSearchTerm(searchQuery);
      filtered = filtered.filter(
        (indexer: ProwlarrApplicationResource) =>
          normalizeSearchTerm(indexer.name).includes(searchTerm) ||
          normalizeSearchTerm(indexer.implementationName).includes(searchTerm) ||
          normalizeSearchTerm(indexer.implementation).includes(searchTerm)
      );
    }

    return filtered;
  }, [indexers, selectedFilter, searchQuery]);

  // Handle indexer actions
  const handleToggleIndexer = useCallback(async (indexer: ProwlarrApplicationResource) => {
    const success = await toggleIndexer(indexer);
    if (!success) {
      Alert.alert('Error', 'Failed to update indexer');
    }
  }, [toggleIndexer]);

  const handleTestIndexer = useCallback(async (indexer: ProwlarrApplicationResource) => {
    const success = await testIndexer(indexer);
    if (success) {
      Alert.alert('Success', `Indexer "${indexer.name}" tested successfully`);
    } else {
      Alert.alert('Error', 'Failed to test indexer');
    }
  }, [testIndexer]);

  const handleDeleteIndexer = useCallback(async (indexer: ProwlarrApplicationResource) => {
    Alert.alert(
      'Delete Indexer',
      `Are you sure you want to delete "${indexer.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteIndexer(indexer.id);
            if (!success) {
              Alert.alert('Error', 'Failed to delete indexer');
            }
          },
        },
      ]
    );
  }, [deleteIndexer]);

  // Handle sync actions
  const handleSyncIndexers = useCallback(async () => {
    const success = await syncIndexersToApps();
    if (success) {
      Alert.alert('Success', 'Indexers synced to connected applications');
    } else {
      Alert.alert('Error', 'Failed to sync indexers');
    }
  }, [syncIndexersToApps]);

  const handleRescanIndexers = useCallback(async () => {
    const success = await rescanIndexers();
    if (success) {
      Alert.alert('Success', 'Indexers rescanned successfully');
    } else {
      Alert.alert('Error', 'Failed to rescan indexers');
    }
  }, [rescanIndexers]);

  // Render indexer item
  const renderIndexerItem = ({ item }: { item: ProwlarrApplicationResource }) => (
    <Animated.View
      entering={FadeInUp}
      layout={Layout}
      style={[
        styles.indexerItem,
        { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
      ]}
    >
      <View style={styles.indexerContent}>
        <Icon
          source="radar"
          size={24}
          color={item.enable ? theme.colors.primary : theme.colors.outline}
        />
        <View style={styles.indexerInfo}>
          <Text variant="bodyLarge" style={styles.indexerName}>
            {item.name}
          </Text>
          <Text variant="bodyMedium" style={[styles.indexerImplementation, { color: theme.colors.onSurfaceVariant }]}>
            {item.implementationName}
          </Text>
          <Text variant="bodySmall" style={[styles.indexerPriority, { color: theme.colors.onSurfaceVariant }]}>
            Priority: {item.priority} | Sync: {item.syncLevel}
          </Text>
        </View>
        <View style={styles.indexerActions}>
          <Menu
            visible={false}
            onDismiss={() => {}}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={20}
                onPress={() => {}}
              />
            }
          >
            <Menu.Item
              leadingIcon="pencil"
              onPress={() => {
                // TODO: Navigate to edit screen
                Alert.alert('Edit', 'Edit indexer functionality coming soon');
              }}
              title="Edit"
            />
            <Menu.Item
              leadingIcon="test-tube"
              onPress={() => handleTestIndexer(item)}
              title="Test"
            />
            <Menu.Item
              leadingIcon={item.enable ? "pause" : "play"}
              onPress={() => handleToggleIndexer(item)}
              title={item.enable ? "Disable" : "Enable"}
            />
            <Menu.Item
              leadingIcon="delete"
              onPress={() => handleDeleteIndexer(item)}
              title="Delete"
              titleStyle={{ color: theme.colors.error }}
            />
          </Menu>
        </View>
      </View>
    </Animated.View>
  );

  // Loading state
  if (isLoading && indexers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.loadingContainer}>
          {Array.from({ length: 5 }).map((_, index) => (
            <IndexerListItemSkeleton key={index} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle"
          title="Failed to Load Indexers"
          description={error}
          actionLabel="Retry"
          onActionPress={refresh}
        />
      </SafeAreaView>
    );
  }

  // Empty state
  if (indexers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="radar"
          title="No Indexers Found"
          description="Add your first indexer to start managing your torrent indexers."
          actionLabel="Add Indexer"
          onActionPress={() => {
            // TODO: Navigate to add indexer screen
            Alert.alert('Add Indexer', 'Add indexer functionality coming soon');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search and Filter Bar */}
      <Animated.View entering={FadeIn} style={styles.searchContainer}>
        <Searchbar
          placeholder="Search indexers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />

        <Menu
          key={`prowlarr-filter-menu-${isFilterMenuVisible}-${selectedFilter}`}
          visible={isFilterMenuVisible}
          onDismiss={() => setIsFilterMenuVisible(false)}
          anchorPosition="bottom"
          anchor={
            <TouchableRipple borderless={false} onPress={() => setIsFilterMenuVisible(true)}>
              <View style={[styles.filterChip, { borderColor: theme.colors.outline }]}>
                <Icon source="filter-variant" size={16} color={theme.colors.onSurface} />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {FILTER_LABELS[selectedFilter]}
                </Text>
                <Icon source="chevron-down" size={16} color={theme.colors.onSurfaceVariant} />
              </View>
            </TouchableRipple>
          }
        >
          {FILTER_OPTIONS.map((filter) => (
            <Menu.Item
              key={filter}
              onPress={() => handleFilterChange(filter)}
              title={FILTER_LABELS[filter]}
              trailingIcon={selectedFilter === filter ? 'check' : undefined}
            />
          ))}
        </Menu>
      </Animated.View>

      {/* Indexers List */}
      <FlashList
        data={filteredIndexers}
        renderItem={renderIndexerItem}
        refreshControl={
          <ListRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="magnify"
            title="No Indexers Match"
            description={`No indexers found matching "${searchQuery}"`}
          />
        }
        contentContainerStyle={filteredIndexers.length === 0 ? styles.emptyList : undefined}
      />

      {/* Action Menu FAB */}
      <Menu
        visible={false}
        onDismiss={() => {}}
        anchor={
          <FAB
            icon="dots-vertical"
            style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
            onPress={() => {}}
          />
        }
      >
        <Menu.Item
          leadingIcon="plus"
          onPress={() => {
            // TODO: Navigate to add indexer screen
            Alert.alert('Add Indexer', 'Add indexer functionality coming soon');
          }}
          title="Add Indexer"
        />
        <Menu.Item
          leadingIcon="sync"
          onPress={handleSyncIndexers}
          title="Sync to Apps"
        />
        <Menu.Item
          leadingIcon="refresh"
          onPress={handleRescanIndexers}
          title="Rescan Indexers"
        />
      </Menu>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchbar: {
    elevation: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.xs,
  },
  indexerItem: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 24,
    elevation: 1,
  },
  indexerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  indexerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  indexerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  indexerName: {
    width: 120,
    height: 16,
  },
  indexerImplementation: {
    width: 100,
    height: 14,
  },
  indexerPriority: {
    width: 80,
    height: 12,
  },
  indexerActions: {
    justifyContent: 'center',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    margin: spacing.lg,
    right: 0,
    bottom: 0,
  },
});

export default ProwlarrIndexerListScreen;
