import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import type { AddSeriesRequest, Series } from "@/models/media.types";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import { IConnector } from "@/connectors/base/IConnector";
import type { LibraryFilters } from "@/store/libraryFilterStore";

interface UseSonarrSeriesOptions {
  serviceId: string;
  filters?: LibraryFilters;
}

interface UseSonarrSeriesResult {
  series: Series[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<Series[], Error>>;
  addSeries: (request: AddSeriesRequest) => void;
  addSeriesAsync: (request: AddSeriesRequest) => Promise<Series>;
  isAdding: boolean;
  addError: unknown;
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

export const useSonarrSeries = ({
  serviceId,
  filters,
}: UseSonarrSeriesOptions): UseSonarrSeriesResult => {
  const queryClient = useQueryClient();
  const getConnector = useConnectorsStore(selectGetConnector);
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === SONARR_SERVICE_TYPE;

  const resolveConnector = useCallback(
    () => ensureSonarrConnector(getConnector, serviceId),
    [getConnector, serviceId],
  );

  const seriesQuery = useQuery({
    queryKey: queryKeys.sonarr.seriesList(serviceId, filters),
    queryFn: async () => {
      const connector = resolveConnector();
      return connector.getSeries(filters);
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const addSeriesMutation = useMutation({
    mutationKey: queryKeys.sonarr.seriesList(serviceId),
    mutationFn: async (request: AddSeriesRequest) => {
      const connector = resolveConnector();
      return connector.add(request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.sonarr.seriesList(serviceId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.sonarr.queue(serviceId),
      });
    },
  });

  return {
    series: seriesQuery.data,
    isLoading: seriesQuery.isLoading,
    isFetching: seriesQuery.isFetching,
    isError: seriesQuery.isError,
    error: seriesQuery.error,
    refetch: seriesQuery.refetch,
    addSeries: addSeriesMutation.mutate,
    addSeriesAsync: addSeriesMutation.mutateAsync,
    isAdding: addSeriesMutation.isPending,
    addError: addSeriesMutation.error,
  };
};
