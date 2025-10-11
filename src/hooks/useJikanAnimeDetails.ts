import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/queryKeys";
import { JikanClient } from "@/services/jikan/JikanClient";
import type { JikanAnimeFull } from "@/models/jikan.types";

export const useJikanAnimeDetails = (malId?: number) => {
  const numericMalId = typeof malId === "number" && Number.isFinite(malId) && malId > 0 ? malId : undefined;
  const query = useQuery<JikanAnimeFull, Error>({
    queryKey: queryKeys.discover.jikanDetail(numericMalId ?? 0),
    enabled: Boolean(numericMalId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!numericMalId) {
        throw new Error("Invalid MyAnimeList id");
      }
      return JikanClient.getAnimeFullById(numericMalId);
    },
  });

  return {
    anime: query.data,
    ...query,
  };
};
