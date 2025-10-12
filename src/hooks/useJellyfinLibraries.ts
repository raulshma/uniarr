import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { useConnectorsStore, selectGetConnector } from '@/store/connectorsStore';
import type { IConnector } from '@/connectors/base/IConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinLibraryView } from '@/models/jellyfin.types';

const ensureConnector = (getConnector: (id: string) => IConnector | undefined, serviceId: string): JellyfinConnector => {
  const connector = getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinLibraries = (serviceId: string | undefined) => {
  const getConnector = useConnectorsStore(selectGetConnector);

  return useQuery<JellyfinLibraryView[]>({
    queryKey: serviceId ? queryKeys.jellyfin.libraries(serviceId) : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId) {
        return [];
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getLibraries();
    },
  });
};
