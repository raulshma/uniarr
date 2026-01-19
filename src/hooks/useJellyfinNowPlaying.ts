// no direct React hooks used
import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinSession } from "@/models/jellyfin.types";

interface UseJellyfinNowPlayingOptions {
  readonly serviceId?: string;
  readonly refetchInterval?: number | false;
  readonly enabled?: boolean;
  readonly pollingEnabled?: boolean;
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

export const useJellyfinNowPlaying = ({
  serviceId,
  refetchInterval = 10_000,
  enabled = true,
  pollingEnabled = true,
}: UseJellyfinNowPlayingOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const isEnabled = Boolean(serviceId) && enabled;
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
    queryFn: async () => {
      if (!serviceId) {
        return [];
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getNowPlayingSessions();
    },
  });
};
