import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { useConnectorsStore } from '@/store/connectorsStore';
import type { IConnector } from '@/connectors/base/IConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinLatestItem } from '@/models/jellyfin.types';

interface UseJellyfinLatestOptions {
  readonly serviceId?: string;
  readonly libraryId?: string;
  readonly limit?: number;
}

const ensureConnector = (getConnector: (id: string) => IConnector | undefined, serviceId: string): JellyfinConnector => {
  const connector = getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinLatestItems = ({ serviceId, libraryId, limit = 20 }: UseJellyfinLatestOptions) => {
  const { getConnector } = useConnectorsStore();

  const enabled = Boolean(serviceId && libraryId);

  return useQuery<JellyfinLatestItem[]>({
    queryKey:
      enabled && serviceId && libraryId
        ? queryKeys.jellyfin.latest(serviceId, libraryId, { limit })
        : queryKeys.jellyfin.base,
    enabled,
    queryFn: async () => {
      if (!serviceId || !libraryId) {
        return [];
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getLatestItems(libraryId, limit);
    },
  });
};
