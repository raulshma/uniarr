import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, Dimensions } from "react-native";
import { alert } from "@/services/dialogService";
import {
  Chip,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
  Surface,
  IconButton,
  FAB,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedListItem } from "@/components/common/AnimatedComponents";
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
import type { paths } from "@/connectors/client-schemas/jellyseerr-openapi";
import type { JellyseerrRequest } from "@/models/jellyseerr.types";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type JellyseerrRequestQueryOptions =
  paths["/request"]["get"]["parameters"]["query"];

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

type TabValue = "requests" | "discover" | "stats";

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

type MediaSummary = {
  readonly title: string;
  readonly releaseDate?: string;
  readonly posterUri?: string;
  readonly mediaType: "movie" | "series";
  readonly statusCode?: number;
};

const resolvePosterUri = (path?: string | null): string | undefined => {
  if (!path) {
    return undefined;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

const pickFirstString = (
  ...values: (string | undefined | null)[]
): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
};

const pickFirstNumber = (
  ...values: (number | undefined | null)[]
): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const deriveDownloadStatus = (
  status: number | undefined,
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
  const [filterValue, setFilterValue] = useState<FilterValue>(FILTER_ALL);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabValue>("requests");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(
    new Set(),
  );
  const [bulkActionMode, setBulkActionMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // If the route provides a query param (e.g. from UnifiedSearchPanel), prefill the search term
  useEffect(() => {
    if (initialQuery && initialQuery !== searchTerm) {
      setSearchTerm(initialQuery);
    }
  }, [initialQuery, searchTerm]);

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
  }, [filterValue, hasValidServiceId, page]);

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

  // Helper function to safely convert unknown to Record
  const toRecord = useCallback(
    (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null,
    [],
  );

  const buildMediaSummary = useCallback(
    (request: JellyseerrRequest): MediaSummary => {
      const mediaRecord = toRecord(request.media);
      const mediaInfoRecord = toRecord(mediaRecord?.mediaInfo ?? undefined);
      const asString = (value: unknown): string | undefined =>
        typeof value === "string" && value.length > 0 ? value : undefined;
      const asNumber = (value: unknown): number | undefined =>
        typeof value === "number" && Number.isFinite(value) ? value : undefined;

      const details = request.mediaDetails;
      if (details) {
        const enrichedInfoRecord = toRecord(details.mediaInfo ?? undefined);
        const detailRecord = toRecord(details);

        const title =
          pickFirstString(
            details.mediaType === "movie"
              ? asString(detailRecord?.title)
              : asString(detailRecord?.name),
            details.mediaType === "movie"
              ? asString(detailRecord?.originalTitle)
              : asString(detailRecord?.originalName),
            asString(detailRecord?.title),
            asString(detailRecord?.originalTitle),
            asString(detailRecord?.name),
            asString(detailRecord?.originalName),
            asString(enrichedInfoRecord?.title),
            asString(enrichedInfoRecord?.name),
            asString(mediaInfoRecord?.title),
            asString(mediaInfoRecord?.name),
          ) ?? "";

        const releaseDate = pickFirstString(
          details.mediaType === "movie"
            ? asString(detailRecord?.releaseDate)
            : asString(detailRecord?.firstAirDate),
          asString(detailRecord?.releaseDate),
          asString(detailRecord?.firstAirDate),
          asString(enrichedInfoRecord?.releaseDate),
          asString(enrichedInfoRecord?.firstAirDate),
          asString(mediaInfoRecord?.releaseDate),
          asString(mediaInfoRecord?.firstAirDate),
        );

        const posterCandidate = pickFirstString(
          details.posterPath,
          details.backdropPath,
          asString(enrichedInfoRecord?.posterPath),
          asString(mediaRecord?.posterPath),
          asString(mediaRecord?.backdropPath),
          asString(mediaInfoRecord?.posterPath),
        );

        const statusCode = pickFirstNumber(
          details.mediaInfo?.status,
          asNumber(enrichedInfoRecord?.status),
          asNumber(mediaInfoRecord?.status),
          asNumber(mediaRecord?.status),
        );

        return {
          title,
          releaseDate,
          posterUri: resolvePosterUri(posterCandidate),
          mediaType: details.mediaType === "tv" ? "series" : "movie",
          statusCode,
        };
      }

      const title =
        pickFirstString(
          asString(mediaRecord?.title),
          asString(mediaRecord?.originalTitle),
          asString(mediaRecord?.name),
          asString(mediaRecord?.originalName),
          asString(mediaInfoRecord?.title),
          asString(mediaInfoRecord?.name),
        ) ?? "";

      const releaseDate = pickFirstString(
        asString(mediaRecord?.releaseDate),
        asString(mediaRecord?.firstAirDate),
        asString(mediaInfoRecord?.releaseDate),
        asString(mediaInfoRecord?.firstAirDate),
      );

      const posterCandidate = pickFirstString(
        asString(mediaRecord?.posterPath),
        asString(mediaRecord?.backdropPath),
        asString(mediaInfoRecord?.posterPath),
      );

      const rawMediaType = pickFirstString(
        asString(mediaRecord?.mediaType),
        asString(mediaInfoRecord?.mediaType),
      );

      const statusCode = pickFirstNumber(
        asNumber(mediaRecord?.status),
        asNumber(mediaInfoRecord?.status),
      );

      return {
        title,
        releaseDate,
        posterUri: resolvePosterUri(posterCandidate),
        mediaType:
          rawMediaType === "tv" || rawMediaType === "series"
            ? "series"
            : "movie",
        statusCode,
      };
    },
    [toRecord],
  );

  // Filter requests by search term
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (!searchTerm.trim()) return requests;

    const lowerQuery = searchTerm.toLowerCase();
    return requests.filter((req) => {
      const title = buildMediaSummary(req).title.toLowerCase();
      const requester =
        req.requestedBy?.username?.toLowerCase() ||
        req.requestedBy?.email?.toLowerCase() ||
        "";
      return title.includes(lowerQuery) || requester.includes(lowerQuery);
    });
  }, [requests, searchTerm, buildMediaSummary]);

  // Calculate stats
  const requestStats = useMemo(() => {
    if (!requests) {
      return {
        pending: 0,
        approved: 0,
        processing: 0,
        available: 0,
        declined: 0,
      };
    }

    return requests.reduce(
      (acc, req) => {
        switch (req.status) {
          case 1:
            acc.pending++;
            break;
          case 2:
            acc.approved++;
            break;
          case 3:
            acc.declined++;
            break;
          case 4:
            acc.processing++;
            break;
          case 5:
            acc.available++;
            break;
        }
        return acc;
      },
      {
        pending: 0,
        approved: 0,
        processing: 0,
        available: 0,
        declined: 0,
      },
    );
  }, [requests]);

  useFocusEffect(
    useCallback(() => {
      if (!hasValidServiceId) {
        return;
      }

      void refetch();
    }, [hasValidServiceId, refetch]),
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
        container: {
          flex: 1,
        },
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        headerContainer: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        },
        listHeader: {
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.md,
        },
        headerTitle: {
          color: theme.colors.onBackground,
        },
        headerActions: {
          flexDirection: "row",
          gap: spacing.xs,
        },
        headerMeta: {
          color: theme.colors.onSurfaceVariant,
        },
        searchBar: {
          marginBottom: spacing.md,
          elevation: 2,
        },
        tabBar: {
          marginBottom: spacing.md,
        },
        statsContainer: {
          marginBottom: spacing.md,
        },
        statsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        statCard: {
          flex: 1,
          minWidth: SCREEN_WIDTH / 2 - spacing.lg - spacing.sm / 2,
          padding: spacing.md,
          borderRadius: 12,
          elevation: 2,
        },
        statLabel: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        statValue: {
          fontSize: 24,
          fontWeight: "bold",
          color: theme.colors.onSurface,
        },
        filters: {
          marginBottom: spacing.sm,
        },
        filtersRow: {
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
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
        },
        fab: {
          position: "absolute",
          right: spacing.lg,
          bottom: spacing.xl,
        },
        bulkActionBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: spacing.md,
          backgroundColor: theme.colors.primaryContainer,
        },
        bulkActionButtons: {
          flexDirection: "row",
          gap: spacing.sm,
        },
      }),
    [theme],
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
    [approveRequestAsync],
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
        ],
      );
    },
    [declineRequestAsync],
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
        ],
      );
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

  const handleSelectRequest = useCallback((requestId: number) => {
    setSelectedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }, []);

  const handleBulkApprove = useCallback(async () => {
    const ids = Array.from(selectedRequests);
    if (ids.length === 0) return;

    alert("Approve selected requests", `Approve ${ids.length} request(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            await Promise.all(
              ids.map((id) => approveRequestAsync({ requestId: id })),
            );
            setSelectedRequests(new Set());
            setBulkActionMode(false);
          } catch (error) {
            alert(
              "Bulk approve failed",
              error instanceof Error ? error.message : "Unknown error",
            );
          }
        },
      },
    ]);
  }, [selectedRequests, approveRequestAsync]);

  const handleBulkDecline = useCallback(async () => {
    const ids = Array.from(selectedRequests);
    if (ids.length === 0) return;

    alert("Decline selected requests", `Decline ${ids.length} request(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            await Promise.all(
              ids.map((id) => declineRequestAsync({ requestId: id })),
            );
            setSelectedRequests(new Set());
            setBulkActionMode(false);
          } catch (error) {
            alert(
              "Bulk decline failed",
              error instanceof Error ? error.message : "Unknown error",
            );
          }
        },
      },
    ]);
  }, [selectedRequests, declineRequestAsync]);

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
        typeof status === "number"
          ? formatRequestStatusLabel(status).toLowerCase()
          : (status ?? "").toString().toLowerCase();
      const toneCandidate = toneMap[statusKey];
      const selectedTone = toneCandidate ?? toneMap.unknown;
      if (!selectedTone) {
        return null;
      }
      const label =
        (typeof status === "number"
          ? formatRequestStatusLabel(status)
          : (status ?? "Unknown")) + (is4k ? " • 4K" : "");

      return (
        <Chip
          compact
          mode="flat"
          style={[
            styles.statusChip,
            { backgroundColor: selectedTone.background },
          ]}
          textStyle={{ color: selectedTone.text, fontSize: 13, lineHeight: 18 }}
        >
          {label}
        </Chip>
      );
    },
    [styles.statusChip, theme.colors],
  );

  const renderRequestItem = useCallback(
    ({ item, index }: { item: JellyseerrRequest; index: number }) => {
      const summary = buildMediaSummary(item);
      const downloadStatus = deriveDownloadStatus(summary.statusCode);
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

      const isSelected = selectedRequests.has(item.id);

      return (
        <AnimatedListItem index={index}>
          <View>
            {bulkActionMode && (
              <View
                style={{
                  position: "absolute",
                  top: spacing.sm,
                  left: spacing.sm,
                  zIndex: 10,
                }}
              >
                <IconButton
                  icon={
                    isSelected ? "checkbox-marked" : "checkbox-blank-outline"
                  }
                  size={24}
                  iconColor={
                    isSelected ? theme.colors.primary : theme.colors.outline
                  }
                  onPress={() => handleSelectRequest(item.id)}
                />
              </View>
            )}
            <MediaCard
              id={item.id}
              title={summary.title || `Untitled Media`}
              year={(() => {
                const release = summary.releaseDate;
                if (typeof release === "string" && release.length >= 4) {
                  const parsed = Number.parseInt(release.slice(0, 4), 10);
                  return Number.isFinite(parsed) ? parsed : undefined;
                }
                return undefined;
              })()}
              status={formatRequestStatusLabel(item.status ?? 0)}
              subtitle={`Requested by ${requesterName}`}
              downloadStatus={downloadStatus}
              posterUri={summary.posterUri}
              type={summary.mediaType}
              statusBadge={renderStatusChip(
                item.status as number | undefined,
                item.is4k,
              )}
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
                      isDeletingCurrent ||
                      isApprovingCurrent ||
                      isDecliningCurrent
                    }
                  >
                    Delete
                  </Button>
                </View>
              }
            />
          </View>
        </AnimatedListItem>
      );
    },
    [
      buildMediaSummary,
      handleApproveRequest,
      handleDeclineRequest,
      handleDeleteRequest,
      handleSelectRequest,
      isApproving,
      isDeclining,
      isDeleting,
      pendingAction,
      renderStatusChip,
      selectedRequests,
      bulkActionMode,
      styles.actionRow,
      theme.colors,
    ],
  );

  const keyExtractor = useCallback(
    (item: JellyseerrRequest) => item.id.toString(),
    [],
  );

  const renderStatsTab = useCallback(() => {
    const totalRequests =
      requestStats.pending +
      requestStats.approved +
      requestStats.processing +
      requestStats.available +
      requestStats.declined;

    const statItems = [
      {
        label: "Pending",
        value: requestStats.pending,
        background: theme.colors.primaryContainer,
        text: theme.colors.onPrimaryContainer,
      },
      {
        label: "Approved",
        value: requestStats.approved,
        background: theme.colors.secondaryContainer,
        text: theme.colors.onSecondaryContainer,
      },
      {
        label: "Processing",
        value: requestStats.processing,
        background: theme.colors.tertiaryContainer,
        text: theme.colors.onTertiaryContainer,
      },
      {
        label: "Available",
        value: requestStats.available,
        background: theme.colors.tertiaryContainer,
        text: theme.colors.onTertiaryContainer,
      },
      {
        label: "Declined",
        value: requestStats.declined,
        background: theme.colors.errorContainer,
        text: theme.colors.onErrorContainer,
      },
      {
        label: "Total",
        value: totalRequests,
        background: theme.colors.surfaceVariant,
        text: theme.colors.onSurfaceVariant,
      },
    ];

    return (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {statItems.map((stat, index) => (
              <Surface
                key={index}
                style={[styles.statCard, { backgroundColor: stat.background }]}
              >
                <Text style={[styles.statLabel, { color: stat.text }]}>
                  {stat.label}
                </Text>
                <Text style={[styles.statValue, { color: stat.text }]}>
                  {stat.value}
                </Text>
              </Surface>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }, [requestStats, theme.colors, styles]);

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
          <View style={styles.headerActions}>
            <IconButton
              icon={showFilters ? "chevron-up" : "chevron-down"}
              size={24}
              onPress={() => setShowFilters(!showFilters)}
              accessibilityLabel="Toggle filters"
            />
            <Button
              mode="contained"
              onPress={() => router.push("/(auth)/dashboard")}
            >
              Back to Dashboard
            </Button>
          </View>
        </View>

        {/* Tab Navigation */}
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabValue)}
          buttons={[
            { label: "Requests", value: "requests" },
            { label: "Discover", value: "discover" },
            { label: "Stats", value: "stats" },
          ]}
          style={styles.tabBar}
        />

        {/* Quick Stats Row */}
        {activeTab === "requests" && (
          <View style={styles.statsRow}>
            <Surface
              style={[
                styles.statCard,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>{requestStats.pending}</Text>
            </Surface>
            <Surface
              style={[
                styles.statCard,
                { backgroundColor: theme.colors.secondaryContainer },
              ]}
            >
              <Text style={styles.statLabel}>Approved</Text>
              <Text style={styles.statValue}>{requestStats.approved}</Text>
            </Surface>
          </View>
        )}

        {/* Requests Tab Content */}
        {activeTab === "requests" && (
          <>
            {showFilters && (
              <>
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
              </>
            )}
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
          </>
        )}
      </View>
    ),
    [
      activeTab,
      filterValue,
      handleLoadMore,
      handleLoadPrevious,
      page,
      requests?.length,
      router,
      searchTerm,
      showFilters,
      styles,
      theme.colors,
      total,
      totalPages,
      requestStats,
    ],
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
    [],
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
      <View style={styles.container}>
        {/* Bulk Action Bar */}
        {bulkActionMode && (
          <View style={styles.bulkActionBar}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <IconButton
                icon="close"
                size={20}
                onPress={() => {
                  setBulkActionMode(false);
                  setSelectedRequests(new Set());
                }}
              />
              <Text variant="labelLarge">{selectedRequests.size} selected</Text>
            </View>
            <View style={styles.bulkActionButtons}>
              <Button
                mode="contained"
                icon="check"
                compact
                onPress={handleBulkApprove}
                disabled={selectedRequests.size === 0}
              >
                Approve
              </Button>
              <Button
                mode="outlined"
                icon="close"
                compact
                onPress={handleBulkDecline}
                disabled={selectedRequests.size === 0}
              >
                Decline
              </Button>
            </View>
          </View>
        )}

        {/* Tab Content */}
        {activeTab === "stats" ? (
          renderStatsTab()
        ) : activeTab === "discover" ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xxl,
            }}
          >
            <EmptyState
              title="Discover Coming Soon"
              description="Browse trending movies and TV shows across all services."
              actionLabel="Back to Requests"
              onActionPress={() => setActiveTab("requests")}
            />
          </ScrollView>
        ) : (
          <FlashList
            data={filteredRequests ?? []}
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
        )}

        {/* FAB for Bulk Mode */}
        {activeTab === "requests" && !bulkActionMode && (
          <FAB
            icon="checkbox-multiple-marked"
            label="Select"
            style={styles.fab}
            onPress={() => setBulkActionMode(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default JellyseerrRequestsScreen;
