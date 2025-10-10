import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinLatestItem } from '@/models/jellyfin.types';

interface UseJellyfinLatestOptions {
  readonly serviceId?: string;
  readonly libraryId?: string;
  readonly limit?: number;
}

const ensureConnector = (manager: ConnectorManager, serviceId: string): JellyfinConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinLatestItems = ({ serviceId, libraryId, limit = 20 }: UseJellyfinLatestOptions) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

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

      const connector = ensureConnector(manager, serviceId);
      return connector.getLatestItems(libraryId, limit);
    },
  });
};
