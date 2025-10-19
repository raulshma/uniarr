import { useCallback } from "react";
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
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { IConnector } from "@/connectors/base/IConnector";
import type { Series } from "@/models/media.types";
import { queryKeys } from "@/hooks/queryKeys";

interface UseSonarrSeriesDetailsParams {
  serviceId: string;
  seriesId: number;
}

export interface UseSonarrSeriesDetailsResult {
  series: Series | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<Series, Error>>;
  toggleMonitor: (nextState: boolean) => void;
  toggleMonitorAsync: (nextState: boolean) => Promise<void>;
  isTogglingMonitor: boolean;
  toggleMonitorError: unknown;
  toggleSeasonMonitor: (seasonNumber: number, nextState: boolean) => void;
  toggleSeasonMonitorAsync: (
    seasonNumber: number,
    nextState: boolean,
  ) => Promise<void>;
  isTogglingSeasonMonitor: boolean;
  toggleSeasonMonitorError: unknown;
  triggerSearch: () => void;
  triggerSearchAsync: () => Promise<void>;
  isTriggeringSearch: boolean;
  triggerSearchError: unknown;
  searchMissingEpisodes: () => void;
  searchMissingEpisodesAsync: () => Promise<void>;
  isSearchingMissing: boolean;
  searchMissingError: unknown;
  unmonitorAllEpisodes: () => void;
  unmonitorAllEpisodesAsync: () => Promise<void>;
  isUnmonitoringAll: boolean;
  unmonitorAllError: unknown;
  deleteSeries: (options?: {
    deleteFiles?: boolean;
    addImportListExclusion?: boolean;
  }) => void;
  deleteSeriesAsync: (options?: {
    deleteFiles?: boolean;
    addImportListExclusion?: boolean;
  }) => Promise<void>;
  isDeleting: boolean;
  deleteError: unknown;
}

const SONARR_SERVICE_TYPE = "sonarr";

const ensureSonarrConnector = (
  getConnector: (id: string) => IConnector | undefined,
  serviceId: string,
): SonarrConnector => {
  const connector = getConnector(serviceId);
  if (!connector || connector.config.type !== SONARR_SERVICE_TYPE) {
    throw new Error(
      `Sonarr connector not registered for service ${serviceId}.`,
    );
  }

  return connector as SonarrConnector;
};

export const useSonarrSeriesDetails = ({
  serviceId,
  seriesId,
}: UseSonarrSeriesDetailsParams): UseSonarrSeriesDetailsResult => {
  const queryClient = useQueryClient();
  const getConnector = useConnectorsStore(selectGetConnector);
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === SONARR_SERVICE_TYPE;

  const resolveConnector = useCallback(
    () => ensureSonarrConnector(getConnector, serviceId),
    [getConnector, serviceId],
  );

  const detailsQuery = useQuery({
    queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
    queryFn: async () => {
      const connector = resolveConnector();
      return connector.getById(seriesId);
    },
    enabled: hasConnector && Number.isFinite(seriesId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const toggleMonitorMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "monitor",
    ],
    mutationFn: async (nextState: boolean) => {
      const connector = resolveConnector();
      await connector.setMonitored(seriesId, nextState);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesList(serviceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.queue(serviceId),
        }),
      ]);
    },
  });

  const toggleSeasonMonitorMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "seasonMonitor",
    ],
    mutationFn: async ({
      seasonNumber,
      nextState,
    }: {
      seasonNumber: number;
      nextState: boolean;
    }) => {
      const connector = resolveConnector();
      await connector.setSeasonMonitored(seriesId, seasonNumber, nextState);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesList(serviceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.queue(serviceId),
        }),
      ]);
    },
  });

  const triggerSearchMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "search",
    ],
    mutationFn: async () => {
      const connector = resolveConnector();
      await connector.triggerSearch(seriesId);
    },
  });

  const searchMissingEpisodesMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "searchMissing",
    ],
    mutationFn: async () => {
      const connector = resolveConnector();
      await connector.searchMissingEpisodes(seriesId);
    },
  });

  const unmonitorAllEpisodesMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "unmonitorAll",
    ],
    mutationFn: async () => {
      const connector = resolveConnector();
      await connector.unmonitorAllEpisodes(seriesId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesList(serviceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.queue(serviceId),
        }),
      ]);
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "delete",
    ],
    mutationFn: async (options?: {
      deleteFiles?: boolean;
      addImportListExclusion?: boolean;
    }) => {
      const connector = resolveConnector();
      await connector.deleteSeries(seriesId, options);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesList(serviceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.queue(serviceId),
        }),
      ]);
      queryClient.removeQueries({
        queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      });
    },
  });

  return {
    series: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isFetching: detailsQuery.isFetching,
    isError: detailsQuery.isError,
    error: detailsQuery.error,
    refetch: detailsQuery.refetch,
    toggleMonitor: toggleMonitorMutation.mutate,
    toggleMonitorAsync: toggleMonitorMutation.mutateAsync,
    isTogglingMonitor: toggleMonitorMutation.isPending,
    toggleMonitorError: toggleMonitorMutation.error,
    toggleSeasonMonitor: (seasonNumber: number, nextState: boolean) =>
      toggleSeasonMonitorMutation.mutate({ seasonNumber, nextState }),
    toggleSeasonMonitorAsync: (seasonNumber: number, nextState: boolean) =>
      toggleSeasonMonitorMutation.mutateAsync({ seasonNumber, nextState }),
    isTogglingSeasonMonitor: toggleSeasonMonitorMutation.isPending,
    toggleSeasonMonitorError: toggleSeasonMonitorMutation.error,
    triggerSearch: triggerSearchMutation.mutate,
    triggerSearchAsync: triggerSearchMutation.mutateAsync,
    isTriggeringSearch: triggerSearchMutation.isPending,
    triggerSearchError: triggerSearchMutation.error,
    searchMissingEpisodes: searchMissingEpisodesMutation.mutate,
    searchMissingEpisodesAsync: searchMissingEpisodesMutation.mutateAsync,
    isSearchingMissing: searchMissingEpisodesMutation.isPending,
    searchMissingError: searchMissingEpisodesMutation.error,
    unmonitorAllEpisodes: unmonitorAllEpisodesMutation.mutate,
    unmonitorAllEpisodesAsync: unmonitorAllEpisodesMutation.mutateAsync,
    isUnmonitoringAll: unmonitorAllEpisodesMutation.isPending,
    unmonitorAllError: unmonitorAllEpisodesMutation.error,
    deleteSeries: deleteSeriesMutation.mutate,
    deleteSeriesAsync: deleteSeriesMutation.mutateAsync,
    isDeleting: deleteSeriesMutation.isPending,
    deleteError: deleteSeriesMutation.error,
  };
};
