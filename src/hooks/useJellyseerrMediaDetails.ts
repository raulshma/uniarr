import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";

export type JellyseerrMediaType = "movie" | "tv";

export type JellyseerrMediaDetails =
  | components["schemas"]["MovieDetails"]
  | components["schemas"]["TvDetails"];

export const useJellyseerrMediaDetails = (
  serviceId: string,
  mediaType: JellyseerrMediaType,
  mediaId: number,
): UseQueryResult<JellyseerrMediaDetails, Error> => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const jellyseerrConnector = connector as JellyseerrConnector | undefined;
  const enabled = Boolean(
    connector && connector.config.type === "jellyseerr" && mediaId && mediaType,
  );

  return useQuery<JellyseerrMediaDetails, Error>({
    queryKey: queryKeys.jellyseerr.mediaDetail(serviceId, mediaType, mediaId),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      if (!jellyseerrConnector) {
        throw new Error("Jellyseerr connector not found");
      }
      return jellyseerrConnector.getMediaDetails(mediaId, mediaType, {
        signal,
      }) as unknown as JellyseerrMediaDetails;
    },
  });
};
