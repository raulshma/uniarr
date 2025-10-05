import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, Searchbar, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { MediaCard, type MediaDownloadStatus } from '@/components/media/MediaCard';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { useJellyseerrRequests } from '@/hooks/useJellyseerrRequests';
import type { JellyseerrRequest, JellyseerrRequestQueryOptions } from '@/models/jellyseerr.types';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';

const FILTER_ALL = 'all';
const FILTER_PENDING = 'pending';
const FILTER_APPROVED = 'approved';
const FILTER_PROCESSING = 'processing';
const FILTER_AVAILABLE = 'available';
const FILTER_DECLINED = 'declined';

type FilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_PENDING
  | typeof FILTER_APPROVED
  | typeof FILTER_PROCESSING
  | typeof FILTER_AVAILABLE
  | typeof FILTER_DECLINED;

type PendingAction = {
  readonly type: 'approve' | 'decline' | 'delete';
  readonly requestId: number;
};

const deriveDownloadStatus = (status: string | undefined): MediaDownloadStatus => {
  switch (status) {
    case 'available':
      return 'available';
    case 'processing':
      return 'downloading';
    case 'pending':
      return 'queued';
    case 'declined':
      return 'missing';
    default:
      return 'unknown';
  }
};

const formatRequestStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'declined':
      return 'Declined';
    case 'processing':
      return 'Processing';
    case 'available':
      return 'Available';
    default:
      return 'Unknown';
  }
};

const normalizeSearchTerm = (input: string): string => input.trim().toLowerCase();

const JellyseerrRequestsScreen = () => {
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(normalizeSearchTerm(searchTerm));
      setPage(1);
    }, 300);

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
        const message =
          bootstrapError instanceof Error ? bootstrapError.message : 'Unknown connector bootstrap error.';

        void logger.warn('Failed to preload Jellyseerr connector.', {
          location: 'JellyseerrRequestsScreen.bootstrap',
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

  const queryOptions = useMemo(() => {
    if (!hasValidServiceId) {
      return undefined;
    }

    const take = 25;
    const skip = (page - 1) * take;

    const options: JellyseerrRequestQueryOptions = {
      take,
      skip,
      filter: filterValue === FILTER_ALL ? undefined : filterValue,
      search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
    };

    return options;
  }, [debouncedSearch, filterValue, hasValidServiceId, page]);

  const {
    requests,
    total,
    pageInfo,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    approveRequestAsync,
    declineRequestAsync,
    deleteRequestAsync,
    isApproving,
    isDeclining,
    isDeleting,
  } = useJellyseerrRequests(serviceId, queryOptions);

  useFocusEffect(
    useCallback(() => {
      if (!hasValidServiceId) {
        return;
      }

      void refetch();
    }, [hasValidServiceId, refetch]),
  );

  const totalPages = pageInfo?.pages ?? (total > 0 ? Math.ceil(total / 25) : 1);

  const connector = hasValidServiceId ? manager.getConnector(serviceId) : undefined;
  const connectorIsJellyseerr = connector?.config.type === 'jellyseerr';

  const isRefreshing = isFetching && !isLoading;
  const isInitialLoad = isBootstrapping || isLoading;

  const styles = useMemo(
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
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        itemSpacing: {
          height: spacing.md,
        },
        statusChip: {
          alignSelf: 'flex-start',
          marginBottom: spacing.sm,
        },
        actionRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        paginationRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.md,
        },
      }),
    [theme],
  );

  const handleApproveRequest = useCallback(
    async (request: JellyseerrRequest) => {
      setPendingAction({ type: 'approve', requestId: request.id });

      try {
        await approveRequestAsync({ requestId: request.id });
      } catch (actionError) {
        const message = actionError instanceof Error ? actionError.message : 'Unable to approve request.';
        Alert.alert('Approve failed', message);
      } finally {
        setPendingAction(null);
      }
    },
    [approveRequestAsync],
  );

  const handleDeclineRequest = useCallback(
    async (request: JellyseerrRequest) => {
      Alert.alert('Decline request', 'Are you sure you want to decline this request?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setPendingAction({ type: 'decline', requestId: request.id });
            try {
              await declineRequestAsync({ requestId: request.id });
            } catch (actionError) {
              const message = actionError instanceof Error ? actionError.message : 'Unable to decline request.';
              Alert.alert('Decline failed', message);
            } finally {
              setPendingAction(null);
            }
          },
        },
      ]);
    },
    [declineRequestAsync],
  );

  const handleDeleteRequest = useCallback(
    async (request: JellyseerrRequest) => {
      Alert.alert('Delete request', 'Deleting a request cannot be undone. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setPendingAction({ type: 'delete', requestId: request.id });
            try {
              await deleteRequestAsync({ requestId: request.id });
            } catch (actionError) {
              const message = actionError instanceof Error ? actionError.message : 'Unable to delete request.';
              Alert.alert('Delete failed', message);
            } finally {
              setPendingAction(null);
            }
          },
        },
      ]);
    },
    [deleteRequestAsync],
  );

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) {
      setPage((current) => current + 1);
    }
  }, [page, totalPages]);

  const handleLoadPrevious = useCallback(() => {
    if (page > 1) {
      setPage((current) => current - 1);
    }
  }, [page]);

  const renderStatusChip = useCallback(
    (status: string, is4k: boolean | undefined) => {
      const toneMap: Record<string, { background: string; text: string }> = {
        pending: { background: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
        approved: { background: theme.colors.secondaryContainer, text: theme.colors.onSecondaryContainer },
        declined: { background: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
        processing: { background: theme.colors.primaryContainer, text: theme.colors.onPrimaryContainer },
        available: { background: theme.colors.tertiaryContainer, text: theme.colors.onTertiaryContainer },
        unknown: { background: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
      };

      const toneCandidate = toneMap[status];
      const selectedTone = toneCandidate ?? toneMap.unknown;
      if (!selectedTone) {
        return null;
      }
      const label = formatRequestStatusLabel(status) + (is4k ? ' • 4K' : '');

      return (
        <Chip
          compact
          mode="flat"
          style={[styles.statusChip, { backgroundColor: selectedTone.background }]}
          textStyle={{ color: selectedTone.text }}
        >
          {label}
        </Chip>
      );
    },
    [styles.statusChip, theme.colors],
  );

  const renderRequestItem = useCallback(
    ({ item }: { item: JellyseerrRequest }) => {
      const downloadStatus = deriveDownloadStatus(item.media.status);
      const requesterName =
        item.requestedBy?.displayName ??
        item.requestedBy?.username ??
        item.requestedBy?.plexUsername ??
        item.requestedBy?.email ??
        'Unknown requester';

      const isApprovingCurrent = pendingAction?.type === 'approve' && pendingAction.requestId === item.id && isApproving;
      const isDecliningCurrent = pendingAction?.type === 'decline' && pendingAction.requestId === item.id && isDeclining;
      const isDeletingCurrent = pendingAction?.type === 'delete' && pendingAction.requestId === item.id && isDeleting;

      return (
        <View>
          {renderStatusChip(item.status, item.is4k)}
          <MediaCard
            id={item.id}
            title={item.media.title ?? `TMDB #${item.media.tmdbId ?? item.id}`}
            year={item.media.releaseDate ? Number.parseInt(item.media.releaseDate.slice(0, 4), 10) : undefined}
            status={formatRequestStatusLabel(item.media.status ?? 'unknown')}
            subtitle={`Requested by ${requesterName}`}
            downloadStatus={downloadStatus}
            posterUri={item.media.posterUrl}
            type={item.media.mediaType === 'tv' ? 'series' : 'movie'}
            footer={
              <View style={styles.actionRow}>
                {item.status === 'pending' ? (
                  <Button
                    mode="contained"
                    onPress={() => void handleApproveRequest(item)}
                    loading={isApprovingCurrent}
                    disabled={isApprovingCurrent || isDecliningCurrent || isDeletingCurrent}
                  >
                    Approve
                  </Button>
                ) : null}
                {item.status === 'pending' || item.status === 'approved' ? (
                  <Button
                    mode="outlined"
                    onPress={() => void handleDeclineRequest(item)}
                    loading={isDecliningCurrent}
                    disabled={isApprovingCurrent || isDecliningCurrent || isDeletingCurrent}
                  >
                    Decline
                  </Button>
                ) : null}
                <Button
                  mode="text"
                  onPress={() => void handleDeleteRequest(item)}
                  loading={isDeletingCurrent}
                  textColor={theme.colors.error}
                  disabled={isDeletingCurrent || isApprovingCurrent || isDecliningCurrent}
                >
                  Delete
                </Button>
              </View>
            }
          />
        </View>
      );
    },
    [handleApproveRequest, handleDeclineRequest, handleDeleteRequest, isApproving, isDeclining, isDeleting, pendingAction, renderStatusChip, styles.actionRow, theme.colors.error],
  );

  const keyExtractor = useCallback((item: JellyseerrRequest) => item.id.toString(), []);

  const listHeader = useMemo(() => (
    <View style={styles.listHeader}>
      <View style={styles.headerRow}>
        <View>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Requests
          </Text>
          <Text variant="bodySmall" style={styles.headerMeta}>
            Showing {requests?.length ?? 0} of {total} requests
          </Text>
        </View>
        <Button mode="contained" onPress={() => router.push('/(auth)/dashboard')}>
          Back to Dashboard
        </Button>
      </View>
      <Searchbar
        placeholder="Search requests"
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.searchBar}
        accessibilityLabel="Search requests"
      />
      <Text variant="labelSmall" style={styles.filterLabel}>
        Filter by status
      </Text>
      <SegmentedButtons
        style={styles.filters}
        value={filterValue}
        onValueChange={(value) => {
          setFilterValue(value as FilterValue);
          setPage(1);
        }}
        buttons={[
          { label: 'All', value: FILTER_ALL },
          { label: 'Pending', value: FILTER_PENDING },
          { label: 'Approved', value: FILTER_APPROVED },
          { label: 'Processing', value: FILTER_PROCESSING },
          { label: 'Available', value: FILTER_AVAILABLE },
          { label: 'Declined', value: FILTER_DECLINED },
        ]}
      />
      <View style={styles.paginationRow}>
        <Button mode="outlined" onPress={handleLoadPrevious} disabled={page <= 1}>
          Previous
        </Button>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Page {page} of {totalPages}
        </Text>
        <Button mode="outlined" onPress={handleLoadMore} disabled={page >= totalPages}>
          Next
        </Button>
      </View>
    </View>
  ), [filterValue, handleLoadMore, handleLoadPrevious, page, requests?.length, router, searchTerm, styles, theme.colors.onSurfaceVariant, total, totalPages]);

  const listEmptyComponent = useMemo(() => (
    <EmptyState
      title="No requests found"
      description="There are no requests matching your filters. Try adjusting the search or filters."
      actionLabel="Reset filters"
      onActionPress={() => {
        setSearchTerm('');
        setFilterValue(FILTER_ALL);
        setPage(1);
      }}
    />
  ), []);

  if (!hasValidServiceId) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Missing service identifier"
          description="Return to the dashboard and select a Jellyseerr service before continuing."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isInitialLoad) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <LoadingState message="Loading requests..." />
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsJellyseerr) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Jellyseerr connector unavailable"
          description="Verify the service configuration in settings and try again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load requests from Jellyseerr.';

    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Failed to load requests"
          description={message}
          actionLabel="Retry"
          onActionPress={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlashList
        data={requests ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderRequestItem}
        ItemSeparatorComponent={() => <View style={styles.itemSpacing} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={styles.emptyContainer}>{listEmptyComponent}</View>}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetch()}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

export default JellyseerrRequestsScreen;
