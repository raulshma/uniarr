import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from '@tanstack/react-query';

import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { QBittorrentConnector } from '@/connectors/implementations/QBittorrentConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { Torrent, TorrentTransferInfo } from '@/models/torrent.types';

const QB_SERVICE_TYPE = 'qbittorrent';

type TorrentFilters = {
  readonly category?: string;
  readonly tag?: string;
  readonly status?: string;
};

export interface UseQBittorrentOptions {
  readonly filters?: TorrentFilters;
}

export interface UseQBittorrentResult {
  torrents: Torrent[] | undefined;
  transferInfo: TorrentTransferInfo | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<Torrent[], Error>>;
  refreshTransferInfo: (options?: RefetchOptions) => Promise<QueryObserverResult<TorrentTransferInfo, Error>>;
  pauseTorrent: (hash: string) => void;
  pauseTorrentAsync: (hash: string) => Promise<void>;
  isPausing: boolean;
  pauseError: unknown;
  resumeTorrent: (hash: string) => void;
  resumeTorrentAsync: (hash: string) => Promise<void>;
  isResuming: boolean;
  resumeError: unknown;
  deleteTorrent: (variables: { hash: string; deleteFiles?: boolean }) => void;
  deleteTorrentAsync: (variables: { hash: string; deleteFiles?: boolean }) => Promise<void>;
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

const ensureConnector = (manager: ConnectorManager, serviceId: string): QBittorrentConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== QB_SERVICE_TYPE) {
    throw new Error(`qBittorrent connector not registered for service ${serviceId}.`);
  }

  return connector as QBittorrentConnector;
};

export const useQBittorrentTorrents = (
  serviceId: string,
  options: UseQBittorrentOptions = {},
): UseQBittorrentResult => {
  const queryClient = useQueryClient();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const hasConnector = manager.getConnector(serviceId)?.config.type === QB_SERVICE_TYPE;

  const resolveConnector = useCallback(() => ensureConnector(manager, serviceId), [manager, serviceId]);

  const torrentsQuery = useQuery({
    queryKey: queryKeys.qbittorrent.torrents(serviceId, options.filters),
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
    queryKey: queryKeys.qbittorrent.transferInfo(serviceId),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.qbittorrent.service(serviceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.qbittorrent.transferInfo(serviceId) }),
    ]);
  }, [queryClient, serviceId]);

  const pauseMutation = useMutation({
    mutationKey: ['qbittorrent', serviceId, 'pause'],
    mutationFn: async (hash: string) => {
      const connector = resolveConnector();
      await connector.pauseTorrent(hash);
    },
    onSuccess: async () => {
      await invalidateData();
    },
  });

  const resumeMutation = useMutation({
    mutationKey: ['qbittorrent', serviceId, 'resume'],
    mutationFn: async (hash: string) => {
      const connector = resolveConnector();
      await connector.resumeTorrent(hash);
    },
    onSuccess: async () => {
      await invalidateData();
    },
  });

  const deleteMutation = useMutation({
    mutationKey: ['qbittorrent', serviceId, 'delete'],
    mutationFn: async ({ hash, deleteFiles }: { hash: string; deleteFiles?: boolean }) => {
      const connector = resolveConnector();
      await connector.deleteTorrent(hash, deleteFiles ?? false);
    },
    onSuccess: async () => {
      await invalidateData();
    },
  });

  const recheckMutation = useMutation({
    mutationKey: ['qbittorrent', serviceId, 'recheck'],
    mutationFn: async (hash: string) => {
      const connector = resolveConnector();
      await connector.forceRecheck(hash);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.qbittorrent.service(serviceId) });
    },
  });

  return {
    torrents: torrentsQuery.data,
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
