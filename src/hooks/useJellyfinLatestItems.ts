import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinLatestItem } from "@/models/jellyfin.types";

interface UseJellyfinLatestOptions {
  readonly serviceId?: string;
  readonly libraryId?: string;
  readonly limit?: number;
}

export const useJellyfinLatestItems = ({
  serviceId,
  libraryId,
  limit = 20,
}: UseJellyfinLatestOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId ?? ""));

  const enabled = Boolean(
    serviceId && libraryId && connector?.config.type === "jellyfin",
  );

  return useQuery<JellyfinLatestItem[]>({
    queryKey:
      enabled && serviceId && libraryId
        ? queryKeys.jellyfin.latest(serviceId, libraryId, { limit })
        : queryKeys.jellyfin.base,
    enabled,
    queryFn: async () => {
      if (
        !serviceId ||
        !libraryId ||
        !connector ||
        connector.config.type !== "jellyfin"
      ) {
        return [];
      }

      return (connector as JellyfinConnector).getLatestItems(libraryId, limit);
    },
  });
};
