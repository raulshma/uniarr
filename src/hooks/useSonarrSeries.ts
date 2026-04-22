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
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
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

export const useSonarrSeries = ({
  serviceId,
  filters,
}: UseSonarrSeriesOptions): UseSonarrSeriesResult => {
  const queryClient = useQueryClient();
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === SONARR_SERVICE_TYPE;

  const seriesQuery = useQuery({
    queryKey: queryKeys.sonarr.seriesList(
      serviceId,
      filters as Record<string, unknown> | undefined,
    ),
    queryFn: async ({ signal }) => {
      return (connector as SonarrConnector).getSeries(filters, { signal });
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const addSeriesMutation = useMutation({
    mutationKey: queryKeys.sonarr.seriesList(serviceId),
    mutationFn: async (request: AddSeriesRequest) => {
      return (connector as SonarrConnector).add(request);
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
