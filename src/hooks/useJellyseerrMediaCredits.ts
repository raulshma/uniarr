import { useQuery } from "@tanstack/react-query";

import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";

type MappedCreditPerson = {
  readonly id?: number;
  readonly name?: string;
  readonly character?: string;
  readonly profileUrl?: string;
};

export const useJellyseerrMediaCredits = (
  serviceId: string,
  mediaType: "movie" | "tv",
  mediaId?: number,
) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const jellyseerrConnector = connector as JellyseerrConnector | undefined;
  const enabled = Boolean(connector && mediaId);

  return useQuery<MappedCreditPerson[], Error>({
    queryKey: queryKeys.jellyseerr.mediaCredits(
      serviceId,
      mediaType,
      mediaId ?? 0,
    ),
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async ({ signal }) => {
      if (!jellyseerrConnector || !mediaId)
        throw new Error("Connector not found");
      return jellyseerrConnector.getMediaCredits(mediaId, mediaType, {
        signal,
      });
    },
  });
};

export default useJellyseerrMediaCredits;
