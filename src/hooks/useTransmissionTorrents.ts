// no direct React hooks used
import { useCallback, useEffect, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { TransmissionConnector } from "@/connectors/implementations/TransmissionConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { Torrent, TorrentTransferInfo } from "@/models/torrent.types";
import { isTorrentCompleted } from "@/utils/torrent.utils";
import { notificationEventService } from "@/services/notifications/NotificationEventService";
import { IConnector } from "@/connectors/base/IConnector";

const TRANSMISSION_SERVICE_TYPE = "transmission";

type TorrentFilters = {
  readonly category?: string;
  readonly tag?: string;
  readonly status?: string;
};

export interface UseTransmissionOptions {
  readonly filters?: TorrentFilters;
}

export interface UseTransmissionResult {
  torrents: Torrent[] | undefined;
  transferInfo: TorrentTransferInfo | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<Torrent[], Error>>;
  refreshTransferInfo: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<TorrentTransferInfo, Error>>;
  pauseTorrent: (hash: string) => void;
  pauseTorrentAsync: (hash: string) => Promise<void>;
  isPausing: boolean;
  pauseError: unknown;
  resumeTorrent: (hash: string) => void;
  resumeTorrentAsync: (hash: string) => Promise<void>;
  isResuming: boolean;
  resumeError: unknown;
  deleteTorrent: (variables: { hash: string; deleteFiles?: boolean }) => void;
  deleteTorrentAsync: (variables: {
    hash: string;
    deleteFiles?: boolean;
  }) => Promise<void>;
  isDeleting: boolean;
  deleteError: unknown;
  forceRecheck: (hash: string) => void;
  forceRecheckAsync: (hash: string) => Promise<void>;
  isRechecking: boolean;
  recheckError: unknown;
  isTransferLoading: boolean;
  isTransferFetching: boolean;
  transferError: unknown;
}

const ensureConnector = (
  getConnector: (id: string) => IConnector | undefined,
  serviceId: string,
): TransmissionConnector => {
  const connector = getConnector(serviceId);

  if (!connector || connector.config.type !== TRANSMISSION_SERVICE_TYPE) {
    throw new Error(
      `Transmission connector not registered for service ${serviceId}.`,
    );
  }

  return connector as TransmissionConnector;
};

export const useTransmissionTorrents = (
  serviceId: string,
  options: UseTransmissionOptions = {},
): UseTransmissionResult => {
  const queryClient = useQueryClient();
  const getConnector = useConnectorsStore(selectGetConnector);
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === TRANSMISSION_SERVICE_TYPE;
  const previousTorrentsRef = useRef<
    Map<string, { progress: number; state: Torrent["state"] }>
  >(new Map());
  const hasHydratedRef = useRef(false);

  const resolveConnector = useCallback(
    () => ensureConnector(getConnector, serviceId),
    [getConnector, serviceId],
  );

  const torrentsQuery = useQuery({
    queryKey: queryKeys.transmission.torrents(serviceId, options.filters),
    queryFn: async () => {
      const connector = resolveConnector();
      return connector.getTorrents(options.filters);
    },
    enabled: hasConnector,
    refetchInterval: 10_000,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const transferInfoQuery = useQuery({
    queryKey: queryKeys.transmission.transferInfo(serviceId),
    queryFn: async () => {
      const connector = resolveConnector();
      return connector.getTransferInfo();
    },
    enabled: hasConnector,
    refetchInterval: 10_000,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const invalidateData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.transmission.torrents(serviceId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.transmission.transferInfo(serviceId),
      }),
    ]);
  }, [queryClient, serviceId]);

  const pauseMutation = useMutation({
    mutationKey: ["transmission", serviceId, "pause"],
    mutationFn: async (hash: string) => {
      const connector = resolveConnector();
      await connector.pauseTorrent(hash);
    },
    onSuccess: async () => {
      await invalidateData();
    },
  });

  const resumeMutation = useMutation({
    mutationKey: ["transmission", serviceId, "resume"],
    mutationFn: async (hash: string) => {
      const connector = resolveConnector();
      await connector.resumeTorrent(hash);
    },
    onSuccess: async () => {
      await invalidateData();
    },
  });

  const deleteMutation = useMutation({
    mutationKey: ["transmission", serviceId, "delete"],
    mutationFn: async ({
      hash,
      deleteFiles,
    }: {
      hash: string;
      deleteFiles?: boolean;
    }) => {
      const connector = resolveConnector();
      await connector.deleteTorrent(hash, deleteFiles ?? false);
    },
    onSuccess: async () => {
      await invalidateData();
    },
  });

  const recheckMutation = useMutation({
    mutationKey: ["transmission", serviceId, "recheck"],
    mutationFn: async (hash: string) => {
      const connector = resolveConnector();
      await connector.forceRecheck(hash);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transmission.torrents(serviceId),
      });
    },
  });

  const torrents = torrentsQuery.data;

  useEffect(() => {
    if (!hasConnector || !torrents) {
      previousTorrentsRef.current.clear();
      hasHydratedRef.current = false;
      return;
    }

    const connector = getConnector(serviceId) as
      | TransmissionConnector
      | undefined;
    const serviceName = connector?.config.name ?? "Transmission";
    const previous = previousTorrentsRef.current;
    const hasHydrated = hasHydratedRef.current;
    const nextState = new Map<
      string,
      { progress: number; state: Torrent["state"] }
    >();

    for (const torrent of torrents) {
      if (hasHydrated) {
        const last = previous.get(torrent.hash);

        if (isTorrentCompleted(torrent) && (!last || last.progress < 1)) {
          void notificationEventService.notifyDownloadCompleted({
            serviceId,
            serviceName,
            torrent,
          });
        }

        const isFailure = FAILED_TORRENT_STATES.has(torrent.state);
        const wasFailure = last ? FAILED_TORRENT_STATES.has(last.state) : false;
        if (isFailure && !wasFailure) {
          void notificationEventService.notifyDownloadFailed({
            serviceId,
            serviceName,
            torrent,
            reason: torrent.state,
          });
        }
      }

      nextState.set(torrent.hash, {
        progress: torrent.progress,
        state: torrent.state,
      });
    }

    previousTorrentsRef.current = nextState;
    hasHydratedRef.current = true;
  }, [hasConnector, getConnector, serviceId, torrents]);

  return {
    torrents,
    transferInfo: transferInfoQuery.data,
    isLoading: torrentsQuery.isLoading,
    isFetching: torrentsQuery.isFetching,
    isError: torrentsQuery.isError,
    error: torrentsQuery.error,
    refetch: torrentsQuery.refetch,
    refreshTransferInfo: transferInfoQuery.refetch,
    pauseTorrent: pauseMutation.mutate,
    pauseTorrentAsync: pauseMutation.mutateAsync,
    isPausing: pauseMutation.isPending,
    pauseError: pauseMutation.error,
    resumeTorrent: resumeMutation.mutate,
    resumeTorrentAsync: resumeMutation.mutateAsync,
    isResuming: resumeMutation.isPending,
    resumeError: resumeMutation.error,
    deleteTorrent: deleteMutation.mutate,
    deleteTorrentAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
    forceRecheck: recheckMutation.mutate,
    forceRecheckAsync: recheckMutation.mutateAsync,
    isRechecking: recheckMutation.isPending,
    recheckError: recheckMutation.error,
    isTransferLoading: transferInfoQuery.isLoading,
    isTransferFetching: transferInfoQuery.isFetching,
    transferError: transferInfoQuery.error,
  };
};

const FAILED_TORRENT_STATES: ReadonlySet<Torrent["state"]> = new Set([
  "error",
  "missingFiles",
]);
