import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import { queryKeys } from "@/hooks/queryKeys";
import type { AdGuardDashboardOverview } from "@/models/adguard.types";
import type { AdGuardHomeConnector } from "@/connectors/implementations/AdGuardHomeConnector";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";

interface UseAdGuardHomeDashboardResult {
  overview: AdGuardDashboardOverview | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<AdGuardDashboardOverview, Error>>;
  toggleProtection: (enabled: boolean) => Promise<void>;
  isTogglingProtection: boolean;
  refreshFilters: (options?: { whitelist?: boolean }) => Promise<void>;
  isRefreshingFilters: boolean;
  actionsError: unknown;
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

export const useAdGuardHomeDashboard = (
  serviceId: string,
): UseAdGuardHomeDashboardResult => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const queryClient = useQueryClient();
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === SERVICE_TYPE;

  const resolveConnector = useCallback(
    () => ensureAdGuardConnector(getConnector, serviceId),
    [getConnector, serviceId],
  );

  const overviewQuery = useQuery({
    queryKey: queryKeys.adguard.overview(serviceId),
    queryFn: async () => {
      const instance = resolveConnector();
      return instance.getDashboardOverview();
    },
    enabled: hasConnector,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const toggleProtectionMutation = useMutation({
    mutationKey: queryKeys.adguard.overview(serviceId),
    mutationFn: async (enabled: boolean) => {
      const instance = resolveConnector();
      await instance.toggleProtection(enabled);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adguard.overview(serviceId),
      });
    },
  });

  const refreshFiltersMutation = useMutation({
    mutationKey: [...queryKeys.adguard.overview(serviceId), "refreshFilters"],
    mutationFn: async (options?: { whitelist?: boolean }) => {
      const instance = resolveConnector();
      await instance.refreshFilters(options);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adguard.overview(serviceId),
      });
    },
  });

  return {
    overview: overviewQuery.data,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    isError: overviewQuery.isError,
    error: overviewQuery.error,
    refetch: overviewQuery.refetch,
    toggleProtection: toggleProtectionMutation.mutateAsync,
    isTogglingProtection: toggleProtectionMutation.isPending,
    refreshFilters: refreshFiltersMutation.mutateAsync,
    isRefreshingFilters: refreshFiltersMutation.isPending,
    actionsError:
      toggleProtectionMutation.error ?? refreshFiltersMutation.error,
  };
};
