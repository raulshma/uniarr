import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { useConnectorsStore } from '@/store/connectorsStore';
import type { IConnector } from '@/connectors/base/IConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinItem } from '@/models/jellyfin.types';

interface UseJellyfinLibraryItemsOptions {
  readonly serviceId?: string;
  readonly libraryId?: string;
  readonly searchTerm?: string;
  readonly includeItemTypes?: readonly string[];
  readonly mediaTypes?: readonly string[];
  readonly sortBy?: string;
  readonly sortOrder?: 'Ascending' | 'Descending';
  readonly limit?: number;
}

const ensureConnector = (getConnector: (id: string) => IConnector | undefined, serviceId: string): JellyfinConnector => {
  const connector = getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinLibraryItems = ({
  serviceId,
  libraryId,
  searchTerm,
  includeItemTypes,
  mediaTypes,
  sortBy,
  sortOrder,
  limit,
}: UseJellyfinLibraryItemsOptions) => {
  const { getConnector } = useConnectorsStore();

  const enabled = Boolean(serviceId && libraryId);
  const normalizedSearch = searchTerm?.trim() ?? '';

  return useQuery<JellyfinItem[]>({
    queryKey:
      enabled && serviceId && libraryId
        ? queryKeys.jellyfin.libraryItems(serviceId, libraryId, {
            search: normalizedSearch.toLowerCase(),
            includeItemTypes,
            mediaTypes,
            sortBy,
            sortOrder,
            limit,
          })
        : queryKeys.jellyfin.base,
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData ?? [],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!serviceId || !libraryId) {
        return [];
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getLibraryItems(libraryId, {
        searchTerm: normalizedSearch,
        includeItemTypes,
        mediaTypes,
        sortBy,
        sortOrder,
        limit,
      });
    },
  });
};
