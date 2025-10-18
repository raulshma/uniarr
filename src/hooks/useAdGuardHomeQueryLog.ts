import { useCallback, useMemo } from "react";
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
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";
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

const ensureAdGuardConnector = (
  getConnector: (id: string) => IConnector | undefined,
  serviceId: string,
): AdGuardHomeConnector => {
  const connector = getConnector(serviceId);
  if (!connector || connector.config.type !== SERVICE_TYPE) {
    throw new Error(
      `AdGuard connector not registered for service ${serviceId}.`,
    );
  }

  return connector as AdGuardHomeConnector;
};

export const useAdGuardHomeQueryLog = (
  serviceId: string,
  params?: AdGuardQueryLogParams,
): UseAdGuardHomeQueryLogResult => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const queryClient = useQueryClient();
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === SERVICE_TYPE;

  const resolveConnector = useCallback(
    () => ensureAdGuardConnector(getConnector, serviceId),
    [getConnector, serviceId],
  );

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
      const instance = resolveConnector();
      return instance.getQueryLog(sanitizedParams);
    },
    enabled: hasConnector,
    refetchOnWindowFocus: false,
  });

  const clearLogMutation = useMutation({
    mutationKey: [...queryKeys.adguard.service(serviceId), "queryLog", "clear"],
    mutationFn: async () => {
      const instance = resolveConnector();
      await instance.clearQueryLog();
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
