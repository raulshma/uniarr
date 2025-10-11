import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { useConnectorsStore } from '@/store/connectorsStore';
import { queryKeys } from '@/hooks/queryKeys';
import type { components } from '@/connectors/client-schemas/jellyseerr-openapi';
type JellyseerrCreditPerson = components['schemas']['Cast'];

export const useJellyseerrMediaCredits = (
  serviceId: string,
  mediaType: 'movie' | 'tv',
  mediaId?: number,
) => {
  const { getConnector } = useConnectorsStore();
  const connector = getConnector(serviceId) as JellyseerrConnector | undefined;
  const enabled = Boolean(connector && mediaId);

  return useQuery<JellyseerrCreditPerson[], Error>({
    queryKey: queryKeys.jellyseerr.mediaCredits(serviceId, mediaType, mediaId ?? 0),
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!connector || !mediaId) throw new Error('Connector not found');
      return connector.getMediaCredits(mediaId, mediaType);
    },
  });
};

export default useJellyseerrMediaCredits;
