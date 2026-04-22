import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinSession } from "@/models/jellyfin.types";

interface UseJellyfinNowPlayingOptions {
  readonly serviceId?: string;
  readonly refetchInterval?: number | false;
  readonly enabled?: boolean;
  readonly pollingEnabled?: boolean;
}

export const useJellyfinNowPlaying = ({
  serviceId,
  refetchInterval = 10_000,
  enabled = true,
  pollingEnabled = true,
}: UseJellyfinNowPlayingOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId ?? ""));
  const isEnabled =
    Boolean(serviceId && connector?.config.type === "jellyfin") && enabled;
  const pollingInterval = isEnabled && pollingEnabled ? refetchInterval : false;

  return useQuery<JellyfinSession[]>({
    queryKey:
      isEnabled && serviceId
        ? queryKeys.jellyfin.nowPlaying(serviceId)
        : queryKeys.jellyfin.base,
    enabled: isEnabled,
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous ?? [],
    queryFn: async ({ signal }) => {
      if (!serviceId || !connector || connector.config.type !== "jellyfin") {
        return [];
      }

      return (connector as JellyfinConnector).getNowPlayingSessions({ signal });
    },
  });
};
