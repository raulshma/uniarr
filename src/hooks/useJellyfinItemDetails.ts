import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinItem } from "@/models/jellyfin.types";

interface UseJellyfinItemDetailsOptions {
  readonly serviceId?: string;
  readonly itemId?: string;
}

export const useJellyfinItemDetails = ({
  serviceId,
  itemId,
}: UseJellyfinItemDetailsOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId ?? ""));
  const enabled = Boolean(
    serviceId && itemId && connector?.config.type === "jellyfin",
  );

  return useQuery<JellyfinItem>({
    queryKey:
      enabled && serviceId && itemId
        ? queryKeys.jellyfin.item(serviceId, itemId)
        : queryKeys.jellyfin.base,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      if (
        !serviceId ||
        !itemId ||
        !connector ||
        connector.config.type !== "jellyfin"
      ) {
        throw new Error("Jellyfin item identifier is required.");
      }

      return (connector as JellyfinConnector).getItem(itemId);
    },
  });
};
