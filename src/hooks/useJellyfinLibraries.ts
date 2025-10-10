import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinLibraryView } from '@/models/jellyfin.types';

const ensureConnector = (manager: ConnectorManager, serviceId: string): JellyfinConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinLibraries = (serviceId: string | undefined) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  return useQuery<JellyfinLibraryView[]>({
    queryKey: serviceId ? queryKeys.jellyfin.libraries(serviceId) : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId) {
        return [];
      }

      const connector = ensureConnector(manager, serviceId);
      return connector.getLibraries();
    },
  });
};
