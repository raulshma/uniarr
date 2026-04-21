import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinLibraryView } from "@/models/jellyfin.types";

export const useJellyfinLibraries = (serviceId: string | undefined) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId ?? ""));

  return useQuery<JellyfinLibraryView[]>({
    queryKey: serviceId
      ? queryKeys.jellyfin.libraries(serviceId)
      : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId && connector?.config.type === "jellyfin"),
    queryFn: async () => {
      if (!serviceId || !connector || connector.config.type !== "jellyfin") {
        return [];
      }

      return (connector as JellyfinConnector).getLibraries();
    },
  });
};
