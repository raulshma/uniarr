import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { useConnectorsStore } from '@/store/connectorsStore';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyseerrMediaSummary } from '@/models/jellyseerr.types';

export type JellyseerrMediaType = 'movie' | 'tv';

export const useJellyseerrMediaDetails = (
  serviceId: string,
  mediaType: JellyseerrMediaType,
  mediaId: number,
): UseQueryResult<JellyseerrMediaSummary, Error> => {
  const { getConnector } = useConnectorsStore();
  const connector = getConnector(serviceId) as JellyseerrConnector | undefined;
  const enabled = Boolean(connector && connector.config.type === 'jellyseerr' && mediaId && mediaType);

  return useQuery<JellyseerrMediaSummary, Error>({
    queryKey: queryKeys.jellyseerr.mediaDetail(serviceId, mediaType, mediaId),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!connector) {
        throw new Error('Jellyseerr connector not found');
      }
      return connector.getMediaDetails(mediaId, mediaType);
    },
  });
};
