import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
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
  toggleEpisodeMonitor: (
    seasonNumber: number,
    episodeNumber: number,
    nextState: boolean,
  ) => void;
  toggleEpisodeMonitorAsync: (
    seasonNumber: number,
    episodeNumber: number,
    nextState: boolean,
  ) => Promise<void>;
  isTogglingEpisodeMonitor: boolean;
  toggleEpisodeMonitorError: unknown;
  triggerSearch: () => void;
  triggerSearchAsync: () => Promise<void>;
  isTriggeringSearch: boolean;
  triggerSearchError: unknown;
  searchMissingEpisodes: () => void;
  searchMissingEpisodesAsync: () => Promise<void>;
  isSearchingMissing: boolean;
  searchMissingError: unknown;
  searchMissingEpisode: (seasonNumber: number, episodeNumber: number) => void;
  searchMissingEpisodeAsync: (
    seasonNumber: number,
    episodeNumber: number,
  ) => Promise<void>;
  isSearchingMissingEpisode: boolean;
  searchMissingEpisodeError: unknown;
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
  deleteEpisodeFile: (episodeFileId: number) => void;
  deleteEpisodeFileAsync: (episodeFileId: number) => Promise<void>;
  isDeletingEpisodeFile: boolean;
  deleteEpisodeFileError: unknown;
  removeAndSearchEpisode: (
    episodeFileId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) => void;
  removeAndSearchEpisodeAsync: (
    episodeFileId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) => Promise<void>;
  isRemovingAndSearching: boolean;
  removeAndSearchError: unknown;
}

const SONARR_SERVICE_TYPE = "sonarr";

export const useSonarrSeriesDetails = ({
  serviceId,
  seriesId,
}: UseSonarrSeriesDetailsParams): UseSonarrSeriesDetailsResult => {
  const queryClient = useQueryClient();
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === SONARR_SERVICE_TYPE;

  const sonarrConnector = connector as SonarrConnector;

  const detailsQuery = useQuery({
    queryKey: queryKeys.sonarr.seriesDetail(serviceId, seriesId),
    queryFn: async () => {
      return sonarrConnector.getById(seriesId);
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
      await sonarrConnector.setMonitored(seriesId, nextState);
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
      await sonarrConnector.setSeasonMonitored(
        seriesId,
        seasonNumber,
        nextState,
      );
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

  const toggleEpisodeMonitorMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "episodeMonitor",
    ],
    mutationFn: async ({
      seasonNumber,
      episodeNumber,
      nextState,
    }: {
      seasonNumber: number;
      episodeNumber: number;
      nextState: boolean;
    }) => {
      await sonarrConnector.setEpisodeMonitored(
        seriesId,
        seasonNumber,
        episodeNumber,
        nextState,
      );
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
      await sonarrConnector.triggerSearch(seriesId);
    },
  });

  const searchMissingEpisodesMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "searchMissing",
    ],
    mutationFn: async () => {
      await sonarrConnector.searchMissingEpisodes(seriesId);
    },
  });

  const searchMissingEpisodeMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "searchMissingEpisode",
    ],
    mutationFn: async ({
      seasonNumber,
      episodeNumber,
    }: {
      seasonNumber: number;
      episodeNumber: number;
    }) => {
      const series = await sonarrConnector.getById(seriesId);
      const episode = series.seasons
        ?.flatMap((s) => s.episodes ?? [])
        .find(
          (ep) =>
            ep.seasonNumber === seasonNumber &&
            ep.episodeNumber === episodeNumber,
        );

      if (!episode || !episode.id) {
        throw new Error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
      }

      await sonarrConnector.searchEpisodesByIds([episode.id]);
    },
  });

  const unmonitorAllEpisodesMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "unmonitorAll",
    ],
    mutationFn: async () => {
      await sonarrConnector.unmonitorAllEpisodes(seriesId);
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
      await sonarrConnector.deleteSeries(seriesId, options);
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

  const deleteEpisodeFileMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "deleteEpisodeFile",
    ],
    mutationFn: async (episodeFileId: number) => {
      await sonarrConnector.deleteEpisodeFile(episodeFileId);
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

  const removeAndSearchEpisodeMutation = useMutation({
    mutationKey: [
      ...queryKeys.sonarr.seriesDetail(serviceId, seriesId),
      "removeAndSearchEpisode",
    ],
    mutationFn: async ({
      episodeFileId,
      seasonNumber,
      episodeNumber,
    }: {
      episodeFileId: number;
      seasonNumber: number;
      episodeNumber: number;
    }) => {
      const series = await sonarrConnector.getById(seriesId);
      const episode = series.seasons
        ?.flatMap((s) => s.episodes ?? [])
        .find(
          (ep) =>
            ep.seasonNumber === seasonNumber &&
            ep.episodeNumber === episodeNumber,
        );

      if (!episode || !episode.id) {
        throw new Error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
      }

      await sonarrConnector.deleteEpisodeFile(episodeFileId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await sonarrConnector.setEpisodeMonitored(
        seriesId,
        seasonNumber,
        episodeNumber,
        true,
      );

      await sonarrConnector.searchEpisodesByIds([episode.id]);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await sonarrConnector.setEpisodeMonitored(
        seriesId,
        seasonNumber,
        episodeNumber,
        true,
      );
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
    toggleEpisodeMonitor: (
      seasonNumber: number,
      episodeNumber: number,
      nextState: boolean,
    ) =>
      toggleEpisodeMonitorMutation.mutate({
        seasonNumber,
        episodeNumber,
        nextState,
      }),
    toggleEpisodeMonitorAsync: (
      seasonNumber: number,
      episodeNumber: number,
      nextState: boolean,
    ) =>
      toggleEpisodeMonitorMutation.mutateAsync({
        seasonNumber,
        episodeNumber,
        nextState,
      }),
    isTogglingEpisodeMonitor: toggleEpisodeMonitorMutation.isPending,
    toggleEpisodeMonitorError: toggleEpisodeMonitorMutation.error,
    triggerSearch: triggerSearchMutation.mutate,
    triggerSearchAsync: triggerSearchMutation.mutateAsync,
    isTriggeringSearch: triggerSearchMutation.isPending,
    triggerSearchError: triggerSearchMutation.error,
    searchMissingEpisodes: searchMissingEpisodesMutation.mutate,
    searchMissingEpisodesAsync: searchMissingEpisodesMutation.mutateAsync,
    isSearchingMissing: searchMissingEpisodesMutation.isPending,
    searchMissingError: searchMissingEpisodesMutation.error,
    searchMissingEpisode: (seasonNumber: number, episodeNumber: number) =>
      searchMissingEpisodeMutation.mutate({ seasonNumber, episodeNumber }),
    searchMissingEpisodeAsync: (seasonNumber: number, episodeNumber: number) =>
      searchMissingEpisodeMutation.mutateAsync({
        seasonNumber,
        episodeNumber,
      }),
    isSearchingMissingEpisode: searchMissingEpisodeMutation.isPending,
    searchMissingEpisodeError: searchMissingEpisodeMutation.error,
    unmonitorAllEpisodes: unmonitorAllEpisodesMutation.mutate,
    unmonitorAllEpisodesAsync: unmonitorAllEpisodesMutation.mutateAsync,
    isUnmonitoringAll: unmonitorAllEpisodesMutation.isPending,
    unmonitorAllError: unmonitorAllEpisodesMutation.error,
    deleteSeries: deleteSeriesMutation.mutate,
    deleteSeriesAsync: deleteSeriesMutation.mutateAsync,
    isDeleting: deleteSeriesMutation.isPending,
    deleteError: deleteSeriesMutation.error,
    deleteEpisodeFile: (episodeFileId: number) =>
      deleteEpisodeFileMutation.mutate(episodeFileId),
    deleteEpisodeFileAsync: (episodeFileId: number) =>
      deleteEpisodeFileMutation.mutateAsync(episodeFileId),
    isDeletingEpisodeFile: deleteEpisodeFileMutation.isPending,
    deleteEpisodeFileError: deleteEpisodeFileMutation.error,
    removeAndSearchEpisode: (
      episodeFileId: number,
      seasonNumber: number,
      episodeNumber: number,
    ) =>
      removeAndSearchEpisodeMutation.mutate({
        episodeFileId,
        seasonNumber,
        episodeNumber,
      }),
    removeAndSearchEpisodeAsync: (
      episodeFileId: number,
      seasonNumber: number,
      episodeNumber: number,
    ) =>
      removeAndSearchEpisodeMutation.mutateAsync({
        episodeFileId,
        seasonNumber,
        episodeNumber,
      }),
    isRemovingAndSearching: removeAndSearchEpisodeMutation.isPending,
    removeAndSearchError: removeAndSearchEpisodeMutation.error,
  };
};
