import { useCallback, useMemo } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from '@tanstack/react-query';

import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type {
  CreateJellyseerrRequest,
  JellyseerrApprovalOptions,
  JellyseerrDeclineOptions,
  JellyseerrRequest,
  JellyseerrRequestList,
  JellyseerrRequestQueryOptions,
} from '@/models/jellyseerr.types';

const JELLYSEERR_SERVICE_TYPE = 'jellyseerr';

type ApproveVariables = {
  requestId: number;
  options?: JellyseerrApprovalOptions;
};

type DeclineVariables = {
  requestId: number;
  options?: JellyseerrDeclineOptions;
};

type DeleteVariables = {
  requestId: number;
};

type CreateVariables = CreateJellyseerrRequest;

const ensureConnector = (manager: ConnectorManager, serviceId: string): JellyseerrConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== JELLYSEERR_SERVICE_TYPE) {
    throw new Error(`Jellyseerr connector not registered for service ${serviceId}.`);
  }

  return connector as JellyseerrConnector;
};

const sanitizeQueryOptions = (
  options?: JellyseerrRequestQueryOptions,
): JellyseerrRequestQueryOptions | undefined => {
  if (!options) {
    return undefined;
  }

  const sanitized: JellyseerrRequestQueryOptions = {};

  if (typeof options.take === 'number') {
    sanitized.take = options.take;
  }

  if (typeof options.skip === 'number') {
    sanitized.skip = options.skip;
  }

  if (options.filter && options.filter !== 'all') {
    sanitized.filter = options.filter;
  }

  if (typeof options.is4k === 'boolean') {
    sanitized.is4k = options.is4k;
  }

  if (typeof options.includePending4k === 'boolean') {
    sanitized.includePending4k = options.includePending4k;
  }

  if (options.search && options.search.trim().length > 0) {
    sanitized.search = options.search.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

interface UseJellyseerrRequestsResult {
  readonly requests: JellyseerrRequest[] | undefined;
  readonly total: number;
  readonly pageInfo: JellyseerrRequestList['pageInfo'];
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<JellyseerrRequestList, Error>>;
  readonly createRequest: (variables: CreateVariables) => void;
  readonly createRequestAsync: (variables: CreateVariables) => Promise<JellyseerrRequest>;
  readonly approveRequest: (variables: ApproveVariables) => void;
  readonly approveRequestAsync: (variables: ApproveVariables) => Promise<JellyseerrRequest>;
  readonly declineRequest: (variables: DeclineVariables) => void;
  readonly declineRequestAsync: (variables: DeclineVariables) => Promise<JellyseerrRequest>;
  readonly deleteRequest: (variables: DeleteVariables) => void;
  readonly deleteRequestAsync: (variables: DeleteVariables) => Promise<boolean>;
  readonly isCreating: boolean;
  readonly isApproving: boolean;
  readonly isDeclining: boolean;
  readonly isDeleting: boolean;
  readonly createError: unknown;
  readonly approveError: unknown;
  readonly declineError: unknown;
  readonly deleteError: unknown;
}

export const useJellyseerrRequests = (
  serviceId: string,
  options?: JellyseerrRequestQueryOptions,
): UseJellyseerrRequestsResult => {
  const queryClient = useQueryClient();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const hasConnector = manager.getConnector(serviceId)?.config.type === JELLYSEERR_SERVICE_TYPE;

  const normalizedOptions = useMemo(() => sanitizeQueryOptions(options), [
    options?.take,
    options?.skip,
    options?.filter,
    options?.is4k,
    options?.includePending4k,
    options?.search,
  ]);

  const queryKeyParams = useMemo(
    () => (normalizedOptions ? { ...normalizedOptions } : undefined),
    [normalizedOptions],
  );

  const resolveConnector = useCallback(() => ensureConnector(manager, serviceId), [manager, serviceId]);

  const requestsQuery = useQuery<JellyseerrRequestList, Error>({
    queryKey: queryKeys.jellyseerr.requestsList(serviceId, queryKeyParams),
    queryFn: async () => {
      const connector = resolveConnector();
      return connector.getRequests(normalizedOptions);
    },
    enabled: hasConnector,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const invalidateRequests = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.jellyseerr.service(serviceId) });
  }, [queryClient, serviceId]);

  const createMutation = useMutation<JellyseerrRequest, Error, CreateVariables>({
    mutationFn: async (payload) => {
      const connector = resolveConnector();
      return connector.createRequest(payload);
    },
    onSuccess: async () => {
      await invalidateRequests();
    },
  });

  const approveMutation = useMutation<JellyseerrRequest, Error, ApproveVariables>({
    mutationFn: async ({ requestId, options: mutationOptions }) => {
      const connector = resolveConnector();
      return connector.approveRequest(requestId, mutationOptions);
    },
    onSuccess: async () => {
      await invalidateRequests();
    },
  });

  const declineMutation = useMutation<JellyseerrRequest, Error, DeclineVariables>({
    mutationFn: async ({ requestId, options: mutationOptions }) => {
      const connector = resolveConnector();
      return connector.declineRequest(requestId, mutationOptions);
    },
    onSuccess: async () => {
      await invalidateRequests();
    },
  });

  const deleteMutation = useMutation<boolean, Error, DeleteVariables>({
    mutationFn: async ({ requestId }) => {
      const connector = resolveConnector();
      return connector.deleteRequest(requestId);
    },
    onSuccess: async () => {
      await invalidateRequests();
    },
  });

  const data = requestsQuery.data;

  return {
    requests: data?.items,
    total: data?.total ?? 0,
    pageInfo: data?.pageInfo,
    isLoading: requestsQuery.isLoading,
    isFetching: requestsQuery.isFetching,
    isError: requestsQuery.isError,
    error: requestsQuery.error,
    refetch: requestsQuery.refetch,
    createRequest: createMutation.mutate,
    createRequestAsync: createMutation.mutateAsync,
    approveRequest: approveMutation.mutate,
    approveRequestAsync: approveMutation.mutateAsync,
    declineRequest: declineMutation.mutate,
    declineRequestAsync: declineMutation.mutateAsync,
    deleteRequest: deleteMutation.mutate,
    deleteRequestAsync: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isApproving: approveMutation.isPending,
    isDeclining: declineMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createError: createMutation.error,
    approveError: approveMutation.error,
    declineError: declineMutation.error,
    deleteError: deleteMutation.error,
  };
};
