import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { logger } from "@/services/logger/LoggerService";
import type {
  DetailedSonarrQueueItem,
  QueueQueryOptions,
} from "@/models/queue.types";
import type { components } from "@/connectors/client-schemas/sonarr-openapi";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { ApiError } from "@/utils/error.utils";

// Transform a basic queue item to a detailed queue item with computed properties
const transformQueueItem = (
  item: components["schemas"]["QueueResource"],
): DetailedSonarrQueueItem => {
  // Calculate progress if available
  let progress: number | undefined;
  if (item.size && item.size > 0 && item.sizeleft !== undefined) {
    const sizeLeft = parseFloat(String(item.sizeleft));
    progress = Math.round((1 - sizeLeft / item.size) * 100) || 0;
  }

  // Extract time remaining
  let timeRemaining: string | undefined;
  if (item.estimatedCompletionTime) {
    const endTime = new Date(item.estimatedCompletionTime);
    const now = new Date();
    const diffMs = endTime.getTime() - now.getTime();

    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours > 0) {
        timeRemaining = `${diffHours}h ${diffMinutes}m`;
      } else {
        timeRemaining = `${diffMinutes}m`;
      }
    }
  }

  // Get series and episode details
  const seriesTitle = item.series?.title ?? undefined;
  const seriesPosterUrl =
    item.series?.images?.find((img) => img.coverType === "poster")?.remoteUrl ??
    undefined;
  const episodeTitle = item.episode?.title ?? undefined;
  const episodeAirDate = item.episode?.airDate ?? undefined;
  const episodeNumber = item.episode?.episodeNumber;

  return {
    id: item.id || 0,
    seriesId: item.seriesId,
    episodeId: item.episodeId,
    seasonNumber: item.seasonNumber,
    status: item.status || "unknown",
    protocol: item.protocol,
    languages: item.languages,
    quality: item.quality,
    downloadId: item.downloadId,
    size: item.size,
    sizeleft: item.sizeleft,
    timeleft: item.timeleft,
    series: item.series,
    episode: item.episode,
    errorMessage: item.errorMessage,
    added: item.added,
    customFormatScore: item.customFormatScore,
    downloadClient: item.downloadClient,
    indexer: item.indexer,
    outputPath: item.outputPath,
    title: item.title,
    trackedDownloadStatus: item.trackedDownloadStatus,
    trackedDownloadState: item.trackedDownloadState,
    episodeHasFile: item.episodeHasFile,
    downloadClientHasPostImportCategory:
      item.downloadClientHasPostImportCategory,
    progress,
    timeRemaining,
    seriesTitle,
    seriesPosterUrl,
    episodeTitle,
    episodeAirDate,
    episodeNumber,
  };
};

// Default query options
const DEFAULT_QUERY_OPTIONS: QueueQueryOptions = {
  page: 1,
  pageSize: 50,
  includeUnknownSeriesItems: false,
  includeSeries: true,
  includeEpisode: true,
};

// Hook to get Sonarr queue
export const useSonarrQueue = (
  serviceId: string,
  options: QueueQueryOptions = {},
) => {
  // Merge with default options
  const queryOptions = useMemo(
    () => ({
      ...DEFAULT_QUERY_OPTIONS,
      ...options,
    }),
    [options],
  );

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.sonarr.queue(serviceId, queryOptions),
    queryFn: async () => {
      try {
        // Return empty result if serviceId is not provided
        if (!serviceId || serviceId.trim() === "") {
          return {
            items: [],
            hasMore: false,
            totalRecords: 0,
          };
        }

        const manager = ConnectorManager.getInstance();
        const connector = manager.getConnector(serviceId) as SonarrConnector;

        if (!connector) {
          throw new Error(`Sonarr connector with ID ${serviceId} not found`);
        }

        logger.debug("[useSonarrQueue] Fetching queue", {
          serviceId,
          queryOptions,
        });

        // Get queue data from connector
        const response = await (connector as any).client.get("/api/v3/queue");
        const rawQueueItems = response.data?.records ?? [];
        const detailedItems = rawQueueItems.map(transformQueueItem);

        logger.debug("[useSonarrQueue] Queue fetched successfully", {
          serviceId,
          itemCount: detailedItems.length,
        });

        return {
          items: detailedItems,
          hasMore: false, // Sonarr API returns all items at once
          totalRecords: detailedItems.length,
        };
      } catch (error) {
        logger.error("[useSonarrQueue] Failed to fetch queue", {
          serviceId,
          error,
        });
        throw error;
      }
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refresh every 30 seconds when component is mounted
  });

  // Filter queue items based on provided filters
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    let result = data.items;

    // Filter by status
    if (queryOptions.status && queryOptions.status.length > 0) {
      result = result.filter((item: DetailedSonarrQueueItem) =>
        queryOptions.status!.includes(item.status),
      );
    }

    // Filter by protocol
    if (queryOptions.protocol && queryOptions.protocol.length > 0) {
      result = result.filter((item: DetailedSonarrQueueItem) =>
        queryOptions.protocol!.includes(item.protocol || "unknown"),
      );
    }

    // Filter by series IDs
    if (queryOptions.seriesIds && queryOptions.seriesIds.length > 0) {
      result = result.filter(
        (item: DetailedSonarrQueueItem) =>
          item.seriesId && queryOptions.seriesIds!.includes(item.seriesId),
      );
    }

    // Filter by languages
    if (queryOptions.languages && queryOptions.languages.length > 0) {
      result = result.filter((item: DetailedSonarrQueueItem) => {
        if (!item.languages) return false;
        return item.languages.some((lang: any) =>
          queryOptions.languages!.includes(lang.id),
        );
      });
    }

    // Filter by quality
    if (queryOptions.quality && queryOptions.quality.length > 0) {
      result = result.filter(
        (item: DetailedSonarrQueueItem) =>
          item.quality?.quality?.id &&
          queryOptions.quality!.includes(item.quality.quality.id),
      );
    }

    return result;
  }, [data?.items, queryOptions]);

  // Queue statistics
  const stats = useMemo(() => {
    if (!data?.items)
      return {
        total: 0,
        downloading: 0,
        completed: 0,
        paused: 0,
        failed: 0,
        warning: 0,
        queued: 0,
      };

    return data.items.reduce(
      (acc: any, item: DetailedSonarrQueueItem) => {
        acc.total++;

        switch (item.status) {
          case "downloading":
            acc.downloading++;
            break;
          case "completed":
            acc.completed++;
            break;
          case "paused":
            acc.paused++;
            break;
          case "failed":
            acc.failed++;
            break;
          case "warning":
            acc.warning++;
            break;
          case "queued":
            acc.queued++;
            break;
        }

        return acc;
      },
      {
        total: 0,
        downloading: 0,
        completed: 0,
        paused: 0,
        failed: 0,
        warning: 0,
        queued: 0,
      },
    );
  }, [data?.items]);

  return {
    items: filteredItems,
    stats,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};

export const useSonarrQueueActions = (serviceId: string) => {
  const queryClient = useQueryClient();

  const removeFromQueueMutation = useMutation({
    mutationFn: async ({
      ids,
      removeFromClient = true,
      blocklist = false,
      skipRedownload = false,
      changeCategory = false,
    }: {
      ids: number[];
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    }) => {
      try {
        // Return early if serviceId is not provided
        if (!serviceId || serviceId.trim() === "") {
          throw new Error("Service ID is required to perform queue actions");
        }

        const manager = ConnectorManager.getInstance();
        const connector = manager.getConnector(serviceId) as SonarrConnector;

        if (!connector) {
          throw new Error(`Sonarr connector with ID ${serviceId} not found`);
        }

        logger.debug("[useSonarrQueueActions] Removing items from queue", {
          serviceId,
          ids,
          removeFromClient,
          blocklist,
          skipRedownload,
          changeCategory,
        });

        // Use bulk delete endpoint if multiple items
        if (ids.length > 1) {
          const payload = {
            ids,
          };

          const params = {
            removeFromClient,
            blocklist,
            skipRedownload,
            changeCategory,
          };

          await (connector as any).client.delete(`/api/v3/queue/bulk`, {
            data: payload,
            params,
          });
        } else {
          // For single item, use regular delete
          const params = {
            removeFromClient,
            blocklist,
            skipRedownload,
            changeCategory,
          };

          await (connector as any).client.delete(`/api/v3/queue/${ids[0]}`, {
            params,
          });
        }

        logger.debug("[useSonarrQueueActions] Items removed successfully", {
          serviceId,
          idsCount: ids.length,
        });

        return { success: true };
      } catch (error) {
        logger.error("[useSonarrQueueActions] Failed to remove items", {
          serviceId,
          ids,
          error,
        });
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the queue query to refetch the updated data
      queryClient.invalidateQueries({
        queryKey: queryKeys.sonarr.queue(serviceId),
      });
    },
  });

  const removeFromQueue = useCallback(
    (
      ids: number[],
      options?: {
        removeFromClient?: boolean;
        blocklist?: boolean;
        skipRedownload?: boolean;
        changeCategory?: boolean;
      },
    ) => {
      removeFromQueueMutation.mutate({
        ids,
        removeFromClient: options?.removeFromClient,
        blocklist: options?.blocklist,
        skipRedownload: options?.skipRedownload,
        changeCategory: options?.changeCategory,
      });
    },
    [removeFromQueueMutation],
  );

  return {
    removeFromQueue,
    isRemoving: removeFromQueueMutation.isPending,
    error: removeFromQueueMutation.error as ApiError | null,
  };
};
