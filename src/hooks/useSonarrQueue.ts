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
    statusMessages: item.statusMessages || undefined,
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
        let rawQueueItems = response.data?.records ?? [];

        // Collect episode IDs that are missing episode details
        const missingEpisodeIds = rawQueueItems
          .filter(
            (item: components["schemas"]["QueueResource"]) =>
              item.episodeId && (!item.episode || !item.episode.title),
          )
          .map(
            (item: components["schemas"]["QueueResource"]) => item.episodeId!,
          )
          .filter(
            (id: number, index: number, arr: number[]) =>
              arr.indexOf(id) === index,
          ); // Remove duplicates

        // Fetch missing episode details if needed
        if (missingEpisodeIds.length > 0) {
          logger.debug("[useSonarrQueue] Fetching missing episode details", {
            serviceId,
            count: missingEpisodeIds.length,
          });

          try {
            const episodes =
              await connector.getEpisodesByIds(missingEpisodeIds);

            // Create a map of episode ID to episode details
            const episodeMap = new Map<
              number,
              components["schemas"]["EpisodeResource"]
            >();
            episodes.forEach((ep) => {
              if (ep.id !== undefined) {
                episodeMap.set(ep.id, ep);
              }
            });

            // Enrich queue items with fetched episode details
            rawQueueItems = rawQueueItems.map(
              (item: components["schemas"]["QueueResource"]) => {
                if (item.episodeId && episodeMap.has(item.episodeId)) {
                  return {
                    ...item,
                    episode: episodeMap.get(item.episodeId),
                  };
                }
                return item;
              },
            );
          } catch (episodeError) {
            logger.warn("[useSonarrQueue] Failed to fetch episode details", {
              serviceId,
              missingEpisodeIds,
              error: episodeError,
            });
            // Continue with the data we have, episode details are just enrichment
          }
        }

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
        return item.languages.some((lang: components["schemas"]["Language"]) =>
          queryOptions.languages!.includes(lang.id!),
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
      (
        acc: {
          total: number;
          downloading: number;
          completed: number;
          paused: number;
          failed: number;
          warning: number;
          queued: number;
        },
        item: DetailedSonarrQueueItem,
      ) => {
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
          await connector.bulkRemoveFromQueue(ids, {
            removeFromClient,
            blocklist,
            skipRedownload,
            changeCategory,
          });
        } else {
          // For single item, use regular delete
          await connector.removeFromQueue(ids[0]!, {
            removeFromClient,
            blocklist,
            skipRedownload,
            changeCategory,
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

  // Grab item to force import
  const grabItemMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        if (!serviceId || serviceId.trim() === "") {
          throw new Error("Service ID is required to perform queue actions");
        }

        const manager = ConnectorManager.getInstance();
        const connector = manager.getConnector(serviceId) as SonarrConnector;

        if (!connector) {
          throw new Error(`Sonarr connector with ID ${serviceId} not found`);
        }

        logger.debug("[useSonarrQueueActions] Grabbing item", {
          serviceId,
          id,
        });

        // Using private client access for grab operation since no public method exists
        await (connector as any).client.post(`/api/v3/queue/grab/${id}`);

        logger.debug("[useSonarrQueueActions] Item grabbed successfully", {
          serviceId,
          id,
        });

        return { success: true };
      } catch (error) {
        logger.error("[useSonarrQueueActions] Failed to grab item", {
          serviceId,
          id,
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

  // Manual import item (explicit selection from manualimport list)
  const manualImportMutation = useMutation({
    mutationFn: async ({
      item,
      importItem,
    }: {
      item: DetailedSonarrQueueItem;
      importItem: components["schemas"]["ManualImportResource"];
    }) => {
      try {
        if (!serviceId || serviceId.trim() === "") {
          throw new Error("Service ID is required to perform queue actions");
        }

        const manager = ConnectorManager.getInstance();
        const connector = manager.getConnector(serviceId) as SonarrConnector;

        if (!connector) {
          throw new Error(`Sonarr connector with ID ${serviceId} not found`);
        }

        const seriesId = importItem.series?.id ?? item.seriesId ?? undefined;
        if (!seriesId) {
          throw new Error("Missing seriesId for manual import");
        }

        const derivedEpisodeIdsFromEpisodes = Array.isArray(importItem.episodes)
          ? importItem.episodes
              .map((ep) => ep?.id)
              .filter((id): id is number => Number.isInteger(id as number))
          : undefined;

        const fallbackEpisodeIds =
          !derivedEpisodeIdsFromEpisodes?.length &&
          Number.isInteger(item.episodeId)
            ? [item.episodeId as number]
            : [];

        const episodeIds =
          (derivedEpisodeIdsFromEpisodes?.length
            ? derivedEpisodeIdsFromEpisodes
            : fallbackEpisodeIds) ?? [];

        if (!episodeIds.length) {
          throw new Error("Missing episodeIds for manual import");
        }

        const payload = {
          id: importItem.id,
          path: importItem.path,
          seriesId,
          seasonNumber: importItem.seasonNumber ?? item.seasonNumber ?? null,
          episodeIds,
          quality: importItem.quality,
          languages: importItem.languages,
          downloadId: importItem.downloadId ?? item.downloadId,
        };

        logger.debug("[useSonarrQueueActions] Manual importing item", {
          serviceId,
          itemId: item.id,
          payload,
        });

        // Using private client access for manual import since no public method exists
        await (connector as any).client.post("/api/v3/manualimport", [payload]);

        logger.debug(
          "[useSonarrQueueActions] Manual import completed successfully",
          {
            serviceId,
            itemId: item.id,
          },
        );

        return { success: true };
      } catch (error) {
        logger.error("[useSonarrQueueActions] Failed to manually import item", {
          serviceId,
          itemId: item.id,
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

  const grabItem = useCallback(
    (id: number) => {
      grabItemMutation.mutate(id);
    },
    [grabItemMutation],
  );

  const manualImportItem = useCallback(
    (
      item: DetailedSonarrQueueItem,
      importItem: components["schemas"]["ManualImportResource"],
    ) => {
      manualImportMutation.mutate({ item, importItem });
    },
    [manualImportMutation],
  );

  return {
    removeFromQueue,
    grabItem,
    manualImportItem,
    isRemoving: removeFromQueueMutation.isPending,
    isGrabbing: grabItemMutation.isPending,
    isManualImporting: manualImportMutation.isPending,
    error: removeFromQueueMutation.error as ApiError | null,
  };
};
