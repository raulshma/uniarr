import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinSession } from '@/models/jellyfin.types';

interface UseJellyfinNowPlayingOptions {
  readonly serviceId?: string;
  readonly refetchInterval?: number;
}

const ensureConnector = (manager: ConnectorManager, serviceId: string): JellyfinConnector => {
  const connector = manager.getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinNowPlaying = ({ serviceId, refetchInterval = 10_000 }: UseJellyfinNowPlayingOptions) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const enabled = Boolean(serviceId);

  return useQuery<JellyfinSession[]>({
    queryKey: enabled && serviceId ? queryKeys.jellyfin.nowPlaying(serviceId) : queryKeys.jellyfin.base,
    enabled,
    refetchInterval,
    refetchIntervalInBackground: true,
    placeholderData: (previous) => previous ?? [],
    queryFn: async () => {
      if (!serviceId) {
        return [];
      }

      const connector = ensureConnector(manager, serviceId);
      return connector.getNowPlayingSessions();
    },
  });
};
