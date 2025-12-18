import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinItem } from "@/models/jellyfin.types";

interface UseNextEpisodeInfoOptions {
  readonly serviceId?: string;
  readonly seriesId?: string;
  readonly currentItemId?: string;
}

const ensureConnector = (
  getConnector: (id: string) => IConnector | undefined,
  serviceId: string,
): JellyfinConnector => {
  const connector = getConnector(serviceId);

  if (!connector || connector.config.type !== "jellyfin") {
    throw new Error(
      `Jellyfin connector not registered for service ${serviceId}.`,
    );
  }

  return connector as JellyfinConnector;
};

export const useNextEpisodeInfo = ({
  serviceId,
  seriesId,
  currentItemId,
}: UseNextEpisodeInfoOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const enabled = Boolean(serviceId && seriesId && currentItemId);

  return useQuery<JellyfinItem | undefined>({
    queryKey:
      enabled && serviceId && seriesId && currentItemId
        ? queryKeys.jellyfin.nextUp(serviceId, seriesId, { currentItemId })
        : queryKeys.jellyfin.base, // Fallback key, should be disabled anyway
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      if (!serviceId || !seriesId || !currentItemId) {
        throw new Error("Missing required parameters for next episode fetch.");
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getNextUpEpisode(seriesId, currentItemId);
    },
  });
};
