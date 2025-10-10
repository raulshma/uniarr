import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinItem } from '@/models/jellyfin.types';

interface UseJellyfinItemDetailsOptions {
  readonly serviceId?: string;
  readonly itemId?: string;
}

const ensureConnector = (manager: ConnectorManager, serviceId: string): JellyfinConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinItemDetails = ({ serviceId, itemId }: UseJellyfinItemDetailsOptions) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const enabled = Boolean(serviceId && itemId);

  return useQuery<JellyfinItem>({
    queryKey:
      enabled && serviceId && itemId
        ? queryKeys.jellyfin.item(serviceId, itemId)
        : queryKeys.jellyfin.base,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      if (!serviceId || !itemId) {
        throw new Error('Jellyfin item identifier is required.');
      }

      const connector = ensureConnector(manager, serviceId);
      return connector.getItem(itemId);
    },
  });
};
