import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinIntro } from "@/models/jellyfin.types";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";

interface UseJellyfinIntroTimestampsOptions {
  readonly serviceId?: string;
  readonly itemId?: string;
  readonly mode?: "Introduction" | "Credits" | "Preview" | "Recap";
  readonly enabled?: boolean;
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

export const useJellyfinIntroTimestamps = (
  options: UseJellyfinIntroTimestampsOptions,
) => {
  const { serviceId, itemId, mode = "Introduction", enabled = true } = options;

  const getConnector = useConnectorsStore(selectGetConnector);
  const isEnabled = Boolean(enabled && serviceId && itemId);

  return useQuery<JellyfinIntro | null>({
    queryKey:
      isEnabled && serviceId && itemId
        ? queryKeys.jellyfin.item(serviceId, itemId, "intro-timestamps", mode)
        : queryKeys.jellyfin.base,
    enabled: isEnabled,
    staleTime: 60_000,
    retry: false, // Don't retry if it fails (e.g. plugin not installed)
    queryFn: async () => {
      if (!serviceId || !itemId) {
        throw new Error("Jellyfin intro timestamps requires service and item id.");
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getIntroTimestamps(itemId, mode);
    },
  });
};
