import { useQuery } from '@tanstack/react-query';

import type { TmdbMediaType } from '@/connectors/implementations/TmdbConnector';
import { ensureTmdbConnector } from '@/services/tmdb/TmdbConnectorProvider';
import { queryKeys } from '@/hooks/queryKeys';

type Genre = {
  id: number;
  name?: string;
};

interface UseTmdbGenresOptions {
  enabled?: boolean;
  language?: string;
}

export const useTmdbGenres = (
  mediaType: TmdbMediaType,
  options: UseTmdbGenresOptions = {},
) => {
  const { enabled = true, language } = options;

  return useQuery<Genre[], Error>({
    enabled,
    queryKey: queryKeys.tmdb.genres(mediaType, language),
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    queryFn: async () => {
      const connector = await ensureTmdbConnector();
      const response = await connector.getGenres(mediaType, language);
      return response.genres ?? [];
    },
  });
};
