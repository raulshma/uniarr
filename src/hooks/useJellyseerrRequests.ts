import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from '@tanstack/react-query';

import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { useConnectorsStore, selectGetConnector } from '@/store/connectorsStore';
import type { IConnector } from '@/connectors/base/IConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { components, paths } from '@/connectors/client-schemas/jellyseerr-openapi';
type CreateJellyseerrRequest = paths['/request']['post']['requestBody']['content']['application/json'];
type JellyseerrApprovalOptions = paths['/request/{requestId}']['put']['requestBody']['content']['application/json'];
type JellyseerrDeclineOptions = JellyseerrApprovalOptions;
type JellyseerrRequest = components['schemas']['MediaRequest'];
type JellyseerrRequestList = { items: JellyseerrRequest[]; total: number; pageInfo?: components['schemas']['PageInfo'] };
type JellyseerrRequestQueryOptions = paths['/request']['get']['parameters']['query'];
import { notificationEventService } from '@/services/notifications/NotificationEventService';

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

const ensureConnector = (getConnector: (id: string) => IConnector | undefined, serviceId: string): JellyseerrConnector => {
  const connector = getConnector(serviceId);

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

  // Only include query parameters that are present in the OpenAPI spec for
  // the /request endpoint.
  if (typeof options.take === 'number') sanitized.take = options.take;
  if (typeof options.skip === 'number') sanitized.skip = options.skip;
  if (options.filter && options.filter !== 'all') sanitized.filter = options.filter;
  if (options.sort) sanitized.sort = options.sort;
  if (options.sortDirection) sanitized.sortDirection = options.sortDirection;
  if (typeof options.requestedBy === 'number') sanitized.requestedBy = options.requestedBy;
  if (options.mediaType) sanitized.mediaType = options.mediaType;

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
  const getConnector = useConnectorsStore(selectGetConnector);
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === JELLYSEERR_SERVICE_TYPE;
  const previousRequestIdsRef = useRef<Set<number>>(new Set());
  const hasHydratedRef = useRef(false);

  const normalizedOptions = useMemo(() => sanitizeQueryOptions(options), [
    options?.take,
    options?.skip,
    options?.filter,
    options?.sort,
    options?.sortDirection,
    options?.requestedBy,
    options?.mediaType,
  ]);

  const queryKeyParams = useMemo(
    () => (normalizedOptions ? { ...normalizedOptions } : undefined),
    [normalizedOptions],
  );

  const resolveConnector = useCallback(() => ensureConnector(getConnector, serviceId), [getConnector, serviceId]);

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

  const items = data?.items;

  useEffect(() => {
    if (!hasConnector || !items) {
      previousRequestIdsRef.current = new Set();
      hasHydratedRef.current = false;
      return;
    }

    const connector = getConnector(serviceId) as JellyseerrConnector | undefined;
    const serviceName = connector?.config.name ?? 'Jellyseerr';
    const previousIds = previousRequestIdsRef.current;
    const hasHydrated = hasHydratedRef.current;
    const nextIds = new Set<number>();

    for (const request of items) {
      nextIds.add(request.id);

      if (!hasHydrated) {
        continue;
      }

      // In the OpenAPI types request.status is numeric: 1 == pending
      if (!previousIds.has(request.id) && request.status === 1) {
        void notificationEventService.notifyNewRequest({
          serviceId,
          serviceName,
          request,
        });
      }
    }

    previousRequestIdsRef.current = nextIds;
    hasHydratedRef.current = true;
  }, [hasConnector, items, getConnector, serviceId]);

  return {
    requests: items,
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
