import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinResumeItem } from '@/models/jellyfin.types';

interface UseJellyfinResumeOptions {
  readonly serviceId?: string;
  readonly limit?: number;
  readonly includeTypes?: string[];
}

const ensureConnector = (manager: ConnectorManager, serviceId: string): JellyfinConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinResume = ({ serviceId, limit = 20, includeTypes }: UseJellyfinResumeOptions) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  return useQuery<JellyfinResumeItem[]>({
    queryKey: serviceId
      ? queryKeys.jellyfin.resume(serviceId, { limit, includeTypes })
      : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId) {
        return [];
      }

      const connector = ensureConnector(manager, serviceId);
      return connector.getResumeItems(limit, includeTypes);
    },
  });
};
