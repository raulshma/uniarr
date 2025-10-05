import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  IconButton,
  ProgressBar,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ListRefreshControl } from '@/components/common/ListRefreshControl';
import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import { TorrentCardSkeleton } from '@/components/torrents';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { useQBittorrentTorrents } from '@/hooks/useQBittorrentTorrents';
import type { Torrent } from '@/models/torrent.types';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';
import {
  deriveTorrentStatusLabel,
  formatBytes,
  formatEta,
  formatSpeed,
  isTorrentActive,
  isTorrentCompleted,
  isTorrentPaused,
} from '@/utils/torrent.utils';

const FILTER_ALL = 'all';
const FILTER_ACTIVE = 'active';
const FILTER_COMPLETED = 'completed';
const FILTER_PAUSED = 'paused';

type FilterValue = typeof FILTER_ALL | typeof FILTER_ACTIVE | typeof FILTER_COMPLETED | typeof FILTER_PAUSED;

type TorrentAction = 'pause' | 'resume';

const QBittorrentServiceScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : '';
  const hasValidServiceId = serviceId.length > 0;

  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValue, setFilterValue] = useState<FilterValue>(FILTER_ALL);
  const [pendingAction, setPendingAction] = useState<TorrentAction | null>(null);
  const [pendingHash, setPendingHash] = useState<string | null>(null);

  const {
    torrents,
    transferInfo,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    refreshTransferInfo,
    pauseTorrentAsync,
    isPausing,
    pauseError,
    resumeTorrentAsync,
    isResuming,
    resumeError,
    deleteTorrentAsync,
    isDeleting,
    deleteError,
    forceRecheckAsync,
    isRechecking,
    recheckError,
    isTransferLoading,
    transferError,
  } = useQBittorrentTorrents(serviceId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      if (!hasValidServiceId) {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        if (!manager.getConnector(serviceId)) {
          await manager.loadSavedServices();
        }
      } catch (bootstrapError) {
        const message = bootstrapError instanceof Error ? bootstrapError.message : 'Failed to preload qBittorrent connector.';
        void logger.warn('Failed to bootstrap qBittorrent connector.', {
          serviceId,
          message,
        });
      } finally {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [hasValidServiceId, manager, serviceId]);

  useFocusEffect(
    useCallback(() => {
      if (!hasValidServiceId) {
        return;
      }

      void refetch();
      void refreshTransferInfo();
    }, [hasValidServiceId, refetch, refreshTransferInfo]),
  );

  const connector = hasValidServiceId ? manager.getConnector(serviceId) : undefined;
  const connectorIsQBittorrent = connector?.config.type === 'qbittorrent';

  const isInitialLoad = isBootstrapping || isLoading || (isTransferLoading && !transferInfo);
  const isRefreshing = isFetching && !isLoading;
  const isMutating = isPausing || isResuming || isDeleting || isRechecking;

  const combinedError = pauseError ?? resumeError ?? deleteError ?? recheckError ?? transferError;

  useEffect(() => {
    if (!combinedError) {
      return;
    }

    const message = combinedError instanceof Error ? combinedError.message : String(combinedError);
    void logger.warn('qBittorrent action failed.', {
      serviceId,
      message,
    });
    Alert.alert('Action failed', message);
  }, [combinedError, serviceId]);

  const filteredTorrents = useMemo(() => {
    if (!torrents) {
      return [] as Torrent[];
    }

    const query = debouncedSearch;

    return torrents.filter((torrent) => {
      if (query.length > 0) {
        const haystack = [torrent.name, torrent.category, ...(torrent.tags ?? [])]
          .filter(Boolean)
          .map((value) => value!.toLowerCase());

        if (!haystack.some((value) => value.includes(query))) {
          return false;
        }
      }

      switch (filterValue) {
        case FILTER_ACTIVE:
          return isTorrentActive(torrent);
        case FILTER_COMPLETED:
          return isTorrentCompleted(torrent);
        case FILTER_PAUSED:
          return isTorrentPaused(torrent);
        case FILTER_ALL:
        default:
          return true;
      }
    });
  }, [debouncedSearch, filterValue, torrents]);

  const summary = useMemo(() => {
    const list = torrents ?? [];
    const total = list.length;
  const active = list.filter((torrent) => isTorrentActive(torrent)).length;
  const completed = list.filter((torrent) => isTorrentCompleted(torrent)).length;
  const paused = list.filter((torrent) => isTorrentPaused(torrent)).length;

    return { total, active, completed, paused };
  }, [torrents]);

  const themeStyles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        listHeader: {
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        },
        headerTitle: {
          color: theme.colors.onBackground,
        },
        headerMeta: {
          color: theme.colors.onSurfaceVariant,
        },
        searchBar: {
          marginBottom: spacing.md,
        },
        filters: {
          marginBottom: spacing.sm,
        },
        filterLabel: {
          marginBottom: spacing.xs,
          color: theme.colors.onSurfaceVariant,
        },
        torrentCard: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: spacing.md,
          padding: spacing.md,
        },
        torrentHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xs,
        },
        torrentName: {
          flex: 1,
          color: theme.colors.onSurface,
          marginRight: spacing.sm,
        },
        torrentStatus: {
          color: theme.colors.onSurfaceVariant,
        },
        progressContainer: {
          marginVertical: spacing.sm,
        },
        metaRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        metaText: {
          color: theme.colors.onSurfaceVariant,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        actionButtons: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        itemSeparator: {
          height: spacing.md,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        summaryRow: {
          flexDirection: 'row',
          gap: spacing.md,
          marginBottom: spacing.md,
        },
        summaryChip: {
          flex: 1,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          backgroundColor: theme.colors.elevation.level2,
          borderRadius: spacing.sm,
        },
        summaryLabel: {
          color: theme.colors.onSurfaceVariant,
        },
        summaryValue: {
          color: theme.colors.onSurface,
          fontWeight: '600',
        },
      }),
    [theme],
  );

  const handleViewDownloads = useCallback(() => {
    router.push('/(auth)/downloads');
  }, [router]);

  const handleRetry = useCallback(() => {
    void refetch();
    void refreshTransferInfo();
  }, [refetch, refreshTransferInfo]);

  const performPauseResume = useCallback(
    async (torrent: Torrent, action: TorrentAction) => {
      if (isMutating) {
        return;
      }

      setPendingAction(action);
      setPendingHash(torrent.hash);
      try {
        if (action === 'pause') {
          await pauseTorrentAsync(torrent.hash);
        } else {
          await resumeTorrentAsync(torrent.hash);
        }
      } finally {
        setPendingHash(null);
      }
    },
    [isMutating, pauseTorrentAsync, resumeTorrentAsync],
  );

  const confirmDeleteTorrent = useCallback(
    (torrent: Torrent) => {
      if (isMutating) {
        return;
      }

      Alert.alert(
        'Remove torrent',
        `Do you want to remove "${torrent.name}" from qBittorrent?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete data',
            style: 'destructive',
            onPress: () => void deleteTorrentAsync({ hash: torrent.hash, deleteFiles: true }),
          },
          {
            text: 'Remove only',
            onPress: () => void deleteTorrentAsync({ hash: torrent.hash, deleteFiles: false }),
          },
        ],
      );
    },
    [deleteTorrentAsync, isMutating],
  );

  const handleForceRecheck = useCallback(
    async (torrent: Torrent) => {
      if (isMutating) {
        return;
      }

      await forceRecheckAsync(torrent.hash);
    },
    [forceRecheckAsync, isMutating],
  );

  const renderTorrentItem = useCallback(
    ({ item }: { item: Torrent }) => {
  const paused = isTorrentPaused(item);
      const progress = Math.max(0, Math.min(1, item.progress));
      const percent = Math.round(progress * 1000) / 10;
  const statusLabel = deriveTorrentStatusLabel(item);
      const etaLabel = percent >= 100 ? 'Complete' : formatEta(item.eta);
      const action: TorrentAction = paused ? 'resume' : 'pause';
      const actionIcon = paused ? 'play' : 'pause';
      const isActionPending = pendingHash === item.hash && isMutating;

      return (
        <View style={themeStyles.torrentCard}>
          <View style={themeStyles.torrentHeader}>
            <Text variant="titleMedium" numberOfLines={2} style={themeStyles.torrentName}>
              {item.name}
            </Text>
            <Text variant="bodyMedium" style={themeStyles.torrentStatus}>
              {statusLabel}
            </Text>
          </View>
          <View style={themeStyles.progressContainer}>
            <ProgressBar progress={progress} color={theme.colors.primary} />
            <View style={themeStyles.metaRow}>
              <Text variant="bodySmall" style={themeStyles.metaText}>
                DL {formatSpeed(item.downloadSpeed)}
              </Text>
              <Text variant="bodySmall" style={themeStyles.metaText}>
                UL {formatSpeed(item.uploadSpeed)}
              </Text>
              <Text variant="bodySmall" style={themeStyles.metaText}>
                ETA {etaLabel}
              </Text>
              <Text variant="bodySmall" style={themeStyles.metaText}>
                {percent.toFixed(1)}%
              </Text>
              <Text variant="bodySmall" style={themeStyles.metaText}>
                {formatBytes(item.downloaded)} / {formatBytes(item.size)}
              </Text>
            </View>
          </View>
          <View style={themeStyles.actionRow}>
            <View style={themeStyles.actionButtons}>
              <IconButton
                icon={actionIcon}
                size={24}
                onPress={() => void performPauseResume(item, action)}
                disabled={isMutating || isActionPending}
              />
              <IconButton
                icon="refresh"
                size={24}
                onPress={() => void handleForceRecheck(item)}
                disabled={isMutating}
              />
              <IconButton
                icon="delete"
                size={24}
                onPress={() => confirmDeleteTorrent(item)}
                disabled={isMutating}
              />
            </View>
            <Text variant="bodySmall" style={themeStyles.metaText}>
              Ratio {item.ratio.toFixed(2)}
            </Text>
          </View>
        </View>
      );
    },
    [confirmDeleteTorrent, handleForceRecheck, isMutating, pendingAction, performPauseResume, theme.colors.primary, themeStyles],
  );

  const keyExtractor = useCallback((item: Torrent) => item.hash, []);

  const listHeader = useMemo(() => (
    <View style={themeStyles.listHeader}>
      <View style={themeStyles.headerRow}>
        <View>
          <Text variant="headlineSmall" style={themeStyles.headerTitle}>
            Torrents
          </Text>
          <Text variant="bodySmall" style={themeStyles.headerMeta}>
            Showing {filteredTorrents.length} of {summary.total} torrents
          </Text>
        </View>
        <Button mode="text" onPress={handleViewDownloads}>
          Downloads Overview
        </Button>
      </View>
      <View style={themeStyles.summaryRow}>
        <View style={themeStyles.summaryChip}>
          <Text variant="labelSmall" style={themeStyles.summaryLabel}>
            Active
          </Text>
          <Text variant="titleMedium" style={themeStyles.summaryValue}>
            {summary.active}
          </Text>
        </View>
        <View style={themeStyles.summaryChip}>
          <Text variant="labelSmall" style={themeStyles.summaryLabel}>
            Completed
          </Text>
          <Text variant="titleMedium" style={themeStyles.summaryValue}>
            {summary.completed}
          </Text>
        </View>
        <View style={themeStyles.summaryChip}>
          <Text variant="labelSmall" style={themeStyles.summaryLabel}>
            Paused
          </Text>
          <Text variant="titleMedium" style={themeStyles.summaryValue}>
            {summary.paused}
          </Text>
        </View>
      </View>
      <Searchbar
        placeholder="Search torrents"
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={themeStyles.searchBar}
        accessibilityLabel="Search torrents"
      />
      <Text variant="labelSmall" style={themeStyles.filterLabel}>
        Filter torrents
      </Text>
      <SegmentedButtons
        style={themeStyles.filters}
        value={filterValue}
        onValueChange={(value) => setFilterValue(value as FilterValue)}
        buttons={[
          { label: 'All', value: FILTER_ALL },
          { label: 'Active', value: FILTER_ACTIVE },
          { label: 'Completed', value: FILTER_COMPLETED },
          { label: 'Paused', value: FILTER_PAUSED },
        ]}
      />
      {transferInfo ? (
        <View style={themeStyles.summaryRow}>
          <View style={themeStyles.summaryChip}>
            <Text variant="labelSmall" style={themeStyles.summaryLabel}>
              Download speed
            </Text>
            <Text variant="titleMedium" style={themeStyles.summaryValue}>
              {formatSpeed(transferInfo.downloadSpeed)}
            </Text>
          </View>
          <View style={themeStyles.summaryChip}>
            <Text variant="labelSmall" style={themeStyles.summaryLabel}>
              Upload speed
            </Text>
            <Text variant="titleMedium" style={themeStyles.summaryValue}>
              {formatSpeed(transferInfo.uploadSpeed)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  ), [filterValue, filteredTorrents.length, handleViewDownloads, searchTerm, summary, themeStyles, transferInfo]);

  const listEmptyComponent = useMemo(() => {
    if (filteredTorrents.length === 0 && (torrents?.length ?? 0) > 0) {
      return (
        <EmptyState
          title="No torrents match"
          description="Try a different search or reset the filters."
          actionLabel="Clear filters"
          onActionPress={() => {
            setSearchTerm('');
            setFilterValue(FILTER_ALL);
          }}
        />
      );
    }

    return (
      <EmptyState
        title="No torrents"
        description="Add torrents in qBittorrent to see them here."
        actionLabel="Refresh"
        onActionPress={handleRetry}
      />
    );
  }, [filteredTorrents.length, handleRetry, torrents?.length]);

  if (!hasValidServiceId) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Missing service"
          description="Select a qBittorrent service from the dashboard and try again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isInitialLoad) {
    return (
      <SafeAreaView style={themeStyles.safeArea}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={themeStyles.listHeader}>
            <View style={themeStyles.headerRow}>
              <View>
                <SkeletonPlaceholder width="60%" height={28} borderRadius={10} style={{ marginBottom: spacing.xs }} />
                <SkeletonPlaceholder width="40%" height={18} borderRadius={8} />
              </View>
              <SkeletonPlaceholder width={160} height={40} borderRadius={20} />
            </View>
            <View style={themeStyles.summaryRow}>
              {[0, 1, 2].map((index) => (
                <SkeletonPlaceholder key={`summary-${index}`} width="100%" height={56} borderRadius={16} style={{ flex: 1 }} />
              ))}
            </View>
            <SkeletonPlaceholder width="100%" height={48} borderRadius={24} style={themeStyles.searchBar} />
            <SkeletonPlaceholder width="35%" height={16} borderRadius={8} style={themeStyles.filterLabel} />
            <View style={[themeStyles.filters, { flexDirection: 'row', gap: spacing.sm }]}>
              {[0, 1, 2, 3].map((index) => (
                <SkeletonPlaceholder key={`filter-${index}`} width={96} height={36} borderRadius={18} />
              ))}
            </View>
            <View style={themeStyles.summaryRow}>
              <SkeletonPlaceholder width="100%" height={56} borderRadius={16} style={{ flex: 1 }} />
              <SkeletonPlaceholder width="100%" height={56} borderRadius={16} style={{ flex: 1 }} />
            </View>
          </View>
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={{ marginBottom: spacing.md }}>
              <TorrentCardSkeleton />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsQBittorrent) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="qBittorrent connector unavailable"
          description="Check the service configuration in settings and try again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load torrents from qBittorrent.';

    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Failed to load torrents"
          description={message}
          actionLabel="Retry"
          onActionPress={handleRetry}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themeStyles.safeArea}>
      <FlashList
        data={filteredTorrents}
        keyExtractor={keyExtractor}
        renderItem={renderTorrentItem}
        ItemSeparatorComponent={() => <View style={themeStyles.itemSeparator} />}
        contentContainerStyle={themeStyles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={themeStyles.emptyContainer}>{listEmptyComponent}</View>}
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refetch();
              void refreshTransferInfo();
            }}
          />
        }
      />
    </SafeAreaView>
  );
};

export default QBittorrentServiceScreen;
