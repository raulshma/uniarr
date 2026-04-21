import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import type {
  AdGuardQueryLogParams,
  AdGuardQueryLogResult,
} from "@/models/adguard.types";
import type { AdGuardHomeConnector } from "@/connectors/implementations/AdGuardHomeConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";

interface UseAdGuardHomeQueryLogResult {
  log: AdGuardQueryLogResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<AdGuardQueryLogResult, Error>>;
  clearQueryLog: () => Promise<void>;
  isClearing: boolean;
  actionError: unknown;
}

const SERVICE_TYPE = "adguard";

export const useAdGuardHomeQueryLog = (
  serviceId: string,
  params?: AdGuardQueryLogParams,
): UseAdGuardHomeQueryLogResult => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const queryClient = useQueryClient();
  const hasConnector = connector?.config.type === SERVICE_TYPE;

  const adguardConnector = connector as AdGuardHomeConnector;

  const sanitizedParams = useMemo(() => {
    if (!params) {
      return undefined;
    }

    const trimmedSearch = params.search?.trim();
    const sanitizedSearch =
      trimmedSearch && trimmedSearch.length > 0 ? trimmedSearch : undefined;

    return {
      limit: params.limit,
      offset: params.offset,
      olderThan: params.olderThan,
      search: sanitizedSearch,
      responseStatus: params.responseStatus,
    } satisfies AdGuardQueryLogParams;
  }, [params]);

  const paramsKey = useMemo(
    () => (sanitizedParams ? JSON.stringify(sanitizedParams) : "default"),
    [sanitizedParams],
  );

  const queryLogQuery = useQuery<AdGuardQueryLogResult, Error>({
    queryKey: queryKeys.adguard.queryLog(serviceId, { hash: paramsKey }),
    queryFn: async () => {
      return adguardConnector.getQueryLog(sanitizedParams);
    },
    enabled: hasConnector,
    refetchOnWindowFocus: false,
  });

  const clearLogMutation = useMutation({
    mutationKey: [...queryKeys.adguard.service(serviceId), "queryLog", "clear"],
    mutationFn: async () => {
      await adguardConnector.clearQueryLog();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adguard.queryLog(serviceId, { hash: paramsKey }),
      });
    },
  });

  return {
    log: queryLogQuery.data,
    isLoading: queryLogQuery.isLoading,
    isFetching: queryLogQuery.isFetching,
    isError: queryLogQuery.isError,
    error: queryLogQuery.error,
    refetch: queryLogQuery.refetch,
    clearQueryLog: clearLogMutation.mutateAsync,
    isClearing: clearLogMutation.isPending,
    actionError: clearLogMutation.error,
  };
};
