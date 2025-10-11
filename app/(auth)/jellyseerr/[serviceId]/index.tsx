import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from '@/services/dialogService';
import {
  Chip,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import {
  MediaCard,
  MediaCardSkeleton,
  type MediaDownloadStatus,
} from "@/components/media/MediaCard";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useJellyseerrRequests } from "@/hooks/useJellyseerrRequests";
import type { components, paths } from '@/connectors/client-schemas/jellyseerr-openapi';
type JellyseerrRequest = components['schemas']['MediaRequest'];
type JellyseerrRequestQueryOptions = paths['/request']['get']['parameters']['query'];
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

const FILTER_ALL = "all";
const FILTER_PENDING = "pending";
const FILTER_APPROVED = "approved";
const FILTER_PROCESSING = "processing";
const FILTER_AVAILABLE = "available";
const FILTER_DECLINED = "declined";

type FilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_PENDING
  | typeof FILTER_APPROVED
  | typeof FILTER_PROCESSING
  | typeof FILTER_AVAILABLE
  | typeof FILTER_DECLINED;

type PendingAction = {
  readonly type: "approve" | "decline" | "delete";
  readonly requestId: number;
};

const deriveDownloadStatus = (
  status: number | undefined
): MediaDownloadStatus => {
  // OpenAPI numeric codes: 1=pending,2=approved,3=declined,4=processing,5=available
  switch (status) {
    case 5:
      return "available";
    case 4:
      return "downloading";
    case 1:
      return "queued";
    case 3:
      return "missing";
    default:
      return "unknown";
  }
};

const formatRequestStatusLabel = (status: number | undefined): string => {
  switch (status) {
    case 1:
      return "Pending";
    case 2:
      return "Approved";
    case 3:
      return "Declined";
    case 4:
      return "Processing";
    case 5:
      return "Available";
    default:
      return "Unknown";
  }
};

const normalizeSearchTerm = (input: string): string =>
  input.trim().toLowerCase();

const JellyseerrRequestsScreen = () => {
  const { serviceId: rawServiceId, query: rawQuery } = useLocalSearchParams<{
    serviceId?: string;
    query?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const initialQuery = typeof rawQuery === "string" ? rawQuery : "";
  const hasValidServiceId = serviceId.length > 0;

  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterValue, setFilterValue] = useState<FilterValue>(FILTER_ALL);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(normalizeSearchTerm(searchTerm));
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // If the route provides a query param (e.g. from UnifiedSearchPanel), prefill the search term
  useEffect(() => {
    if (initialQuery && initialQuery !== searchTerm) {
      setSearchTerm(initialQuery);
    }
  }, [initialQuery]);

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
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Unknown connector bootstrap error.";

        void logger.warn("Failed to preload Jellyseerr connector.", {
          location: "JellyseerrRequestsScreen.bootstrap",
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
    } as any;

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

  // Apply client-side search filtering because the Jellyseerr API /request
  // endpoint does not accept a free-text search parameter in the OpenAPI spec.
  const toRecord = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : null;

  const getMediaTitle = (m: JellyseerrRequest['media'] | undefined): string => {
    if (!m) return '';
    const r = toRecord(m);
    const t = r?.title ?? r?.originalTitle ?? r?.name ?? (r?.mediaInfo && (r.mediaInfo as any)?.title) ?? (r?.mediaInfo && (r.mediaInfo as any)?.name) ?? undefined;
    return typeof t === 'string' ? t : '';
  };

  const filteredRequests = (requests ?? []).filter((r) => {
    if (!debouncedSearch) return true;
    const term = debouncedSearch.toLowerCase();
    const title = getMediaTitle(r.media);
    return title.toLowerCase().includes(term);
  });

  useFocusEffect(
    useCallback(() => {
      if (!hasValidServiceId) {
        return;
      }

      void refetch();
    }, [hasValidServiceId, refetch])
  );

  const totalPages = pageInfo?.pages ?? (total > 0 ? Math.ceil(total / 25) : 1);

  const connector = hasValidServiceId
    ? manager.getConnector(serviceId)
    : undefined;
  const connectorIsJellyseerr = connector?.config.type === "jellyseerr";

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
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
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
        filtersScroll: {
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
          alignSelf: "flex-start",
          marginBottom: spacing.sm,
        },
        actionRow: {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
        paginationRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: spacing.md,
        },
      }),
    [theme]
  );

  const handleApproveRequest = useCallback(
    async (request: JellyseerrRequest) => {
      setPendingAction({ type: "approve", requestId: request.id });

      try {
        await approveRequestAsync({ requestId: request.id });
      } catch (actionError) {
        const message =
          actionError instanceof Error
            ? actionError.message
            : "Unable to approve request.";
  alert("Approve failed", message);
      } finally {
        setPendingAction(null);
      }
    },
    [approveRequestAsync]
  );

  const handleDeclineRequest = useCallback(
    async (request: JellyseerrRequest) => {
  alert(
        "Decline request",
        "Are you sure you want to decline this request?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Decline",
            style: "destructive",
            onPress: async () => {
              setPendingAction({ type: "decline", requestId: request.id });
              try {
                await declineRequestAsync({ requestId: request.id });
              } catch (actionError) {
                const message =
                  actionError instanceof Error
                    ? actionError.message
                    : "Unable to decline request.";
                alert("Decline failed", message);
              } finally {
                setPendingAction(null);
              }
            },
          },
        ]
      );
    },
    [declineRequestAsync]
  );

  const handleDeleteRequest = useCallback(
    async (request: JellyseerrRequest) => {
  alert(
        "Delete request",
        "Deleting a request cannot be undone. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setPendingAction({ type: "delete", requestId: request.id });
              try {
                await deleteRequestAsync({ requestId: request.id });
              } catch (actionError) {
                const message =
                  actionError instanceof Error
                    ? actionError.message
                    : "Unable to delete request.";
                alert("Delete failed", message);
              } finally {
                setPendingAction(null);
              }
            },
          },
        ]
      );
    },
    [deleteRequestAsync]
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
    (status: number | string | undefined, is4k: boolean | undefined) => {
      const toneMap: Record<string, { background: string; text: string }> = {
        pending: {
          background: theme.colors.surfaceVariant,
          text: theme.colors.onSurfaceVariant,
        },
        approved: {
          background: theme.colors.secondaryContainer,
          text: theme.colors.onSecondaryContainer,
        },
        declined: {
          background: theme.colors.errorContainer,
          text: theme.colors.onErrorContainer,
        },
        processing: {
          background: theme.colors.primaryContainer,
          text: theme.colors.onPrimaryContainer,
        },
        available: {
          background: theme.colors.tertiaryContainer,
          text: theme.colors.onTertiaryContainer,
        },
        unknown: {
          background: theme.colors.surfaceVariant,
          text: theme.colors.onSurfaceVariant,
        },
      };

      const statusKey =
        typeof status === 'number' ? formatRequestStatusLabel(status).toLowerCase() : (status ?? '').toString().toLowerCase();
      const toneCandidate = toneMap[statusKey];
      const selectedTone = toneCandidate ?? toneMap.unknown;
      if (!selectedTone) {
        return null;
      }
      const label =
        (typeof status === 'number' ? formatRequestStatusLabel(status) : (status ?? 'Unknown')) +
        (is4k ? ' • 4K' : '');

      return (
        <Chip
          compact
          mode="flat"
          style={[
            styles.statusChip,
            { backgroundColor: selectedTone.background },
          ]}
          textStyle={{ color: selectedTone.text }}
        >
          {label}
        </Chip>
      );
    },
    [styles.statusChip, theme.colors]
  );

  const renderRequestItem = useCallback(
    ({ item }: { item: JellyseerrRequest }) => {
  const downloadStatus = deriveDownloadStatus(item.media?.status as number | undefined);
      const requesterName =
        item.requestedBy?.username ??
        item.requestedBy?.email ??
        item.requestedBy?.plexUsername ??
        item.requestedBy?.email ??
        "Unknown requester";

      const isApprovingCurrent =
        pendingAction?.type === "approve" &&
        pendingAction.requestId === item.id &&
        isApproving;
      const isDecliningCurrent =
        pendingAction?.type === "decline" &&
        pendingAction.requestId === item.id &&
        isDeclining;
      const isDeletingCurrent =
        pendingAction?.type === "delete" &&
        pendingAction.requestId === item.id &&
        isDeleting;

      return (
        <MediaCard
          id={item.id}
          title={
            (getMediaTitle(item.media) || `Untitled Media`)
          }
          year={
            (() => {
              const r = toRecord(item.media);
              const release = r?.releaseDate ?? r?.firstAirDate ?? undefined;
              if (typeof release === 'string' && release.length >= 4) {
                const parsed = Number.parseInt(release.slice(0, 4), 10);
                return Number.isFinite(parsed) ? parsed : undefined;
              }
              return undefined;
            })()
          }
          status={formatRequestStatusLabel(item.status ?? 0)}
          subtitle={`Requested by ${requesterName}`}
          downloadStatus={downloadStatus}
          posterUri={(() => {
            const r = toRecord(item.media);
            const p = r?.posterPath ?? (r?.mediaInfo && (r.mediaInfo as any)?.posterPath) ?? undefined;
            return typeof p === 'string' ? `https://image.tmdb.org/t/p/original${p}` : undefined;
          })()}
          type={(() => {
            const r = toRecord(item.media);
            const mt = r?.mediaType ?? undefined;
            return mt === 'tv' ? 'series' : 'movie';
          })()}
          statusBadge={renderStatusChip(item.status as number | undefined, item.is4k)}
          footer={
            <View style={styles.actionRow}>
              {item.status === 1 ? (
                <Button
                  mode="contained"
                  icon="check"
                  compact
                  onPress={() => void handleApproveRequest(item)}
                  loading={isApprovingCurrent}
                  disabled={
                    isApprovingCurrent ||
                    isDecliningCurrent ||
                    isDeletingCurrent
                  }
                >
                  Approve
                </Button>
              ) : null}
              {item.status === 1 || item.status === 2 ? (
                <Button
                  mode="outlined"
                  icon="close"
                  compact
                  onPress={() => void handleDeclineRequest(item)}
                  loading={isDecliningCurrent}
                  disabled={
                    isApprovingCurrent ||
                    isDecliningCurrent ||
                    isDeletingCurrent
                  }
                >
                  Decline
                </Button>
              ) : null}
              <Button
                mode="text"
                icon="delete"
                compact
                onPress={() => void handleDeleteRequest(item)}
                loading={isDeletingCurrent}
                textColor={theme.colors.error}
                disabled={
                  isDeletingCurrent || isApprovingCurrent || isDecliningCurrent
                }
              >
                Delete
              </Button>
            </View>
          }
        />
      );
    },
    [
      handleApproveRequest,
      handleDeclineRequest,
      handleDeleteRequest,
      isApproving,
      isDeclining,
      isDeleting,
      pendingAction,
      renderStatusChip,
      styles.actionRow,
      theme.colors.error,
    ]
  );

  const keyExtractor = useCallback(
    (item: JellyseerrRequest) => item.id.toString(),
    []
  );

  const listHeader = useMemo(
    () => (
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
          <Button
            mode="contained"
            onPress={() => router.push("/(auth)/dashboard")}
          >
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
        >
          <SegmentedButtons
            value={filterValue}
            onValueChange={(value) => {
              setFilterValue(value as FilterValue);
              setPage(1);
            }}
            buttons={[
              { label: "All", value: FILTER_ALL },
              { label: "Pending", value: FILTER_PENDING },
              { label: "Approved", value: FILTER_APPROVED },
              { label: "Processing", value: FILTER_PROCESSING },
              { label: "Available", value: FILTER_AVAILABLE },
              { label: "Declined", value: FILTER_DECLINED },
            ]}
          />
        </ScrollView>
        <View style={styles.paginationRow}>
          <Button
            mode="outlined"
            onPress={handleLoadPrevious}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Page {page} of {totalPages}
          </Text>
          <Button
            mode="outlined"
            onPress={handleLoadMore}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </View>
      </View>
    ),
    [
      filterValue,
      handleLoadMore,
      handleLoadPrevious,
      page,
      requests?.length,
      router,
      searchTerm,
      styles,
      theme.colors.onSurfaceVariant,
      total,
      totalPages,
    ]
  );

  const listEmptyComponent = useMemo(
    () => (
      <EmptyState
        title="No requests found"
        description="There are no requests matching your filters. Try adjusting the search or filters."
        actionLabel="Reset filters"
        onActionPress={() => {
          setSearchTerm("");
          setFilterValue(FILTER_ALL);
          setPage(1);
        }}
      />
    ),
    []
  );

  if (!hasValidServiceId) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={styles.listHeader}>
            <View style={styles.headerRow}>
              <View>
                <SkeletonPlaceholder
                  width="55%"
                  height={28}
                  borderRadius={10}
                  style={{ marginBottom: spacing.xs }}
                />
                <SkeletonPlaceholder width="40%" height={18} borderRadius={8} />
              </View>
              <SkeletonPlaceholder width={148} height={40} borderRadius={20} />
            </View>
            <SkeletonPlaceholder
              width="100%"
              height={48}
              borderRadius={24}
              style={styles.searchBar}
            />
            <SkeletonPlaceholder
              width="35%"
              height={16}
              borderRadius={8}
              style={styles.filterLabel}
            />
            <View
              style={[
                styles.filters,
                { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
              ]}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonPlaceholder
                  key={`segment-${index}`}
                  width={112}
                  height={36}
                  borderRadius={12}
                />
              ))}
            </View>
            <View style={styles.paginationRow}>
              <SkeletonPlaceholder width={120} height={36} borderRadius={18} />
              <SkeletonPlaceholder width={100} height={20} borderRadius={8} />
              <SkeletonPlaceholder width={120} height={36} borderRadius={18} />
            </View>
          </View>
          {Array.from({ length: 5 }).map((_, index) => (
            <MediaCardSkeleton
              key={index}
              style={{ marginBottom: spacing.lg }}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!connector || !connectorIsJellyseerr) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
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
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load requests from Jellyseerr.";

    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>{listEmptyComponent}</View>
        }
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refetch()}
          />
        }
      />
    </SafeAreaView>
  );
};

export default JellyseerrRequestsScreen;
