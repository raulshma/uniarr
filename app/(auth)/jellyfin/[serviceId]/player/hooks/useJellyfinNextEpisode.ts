import { useQuery } from "@tanstack/react-query";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinItem } from "@/models/jellyfin.types";

interface UseJellyfinNextEpisodeOptions {
  readonly serviceId?: string;
  readonly currentItem?: JellyfinItem;
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

export const useJellyfinNextEpisode = ({
  serviceId,
  currentItem,
}: UseJellyfinNextEpisodeOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);

  const isEpisode = currentItem?.Type === "Episode";
  const seriesId =
    currentItem?.SeriesId ||
    (currentItem?.Type === "Episode" ? currentItem?.ParentId : undefined);
  const currentItemId = currentItem?.Id;

  const enabled = Boolean(serviceId && isEpisode && seriesId && currentItemId);

  return useQuery<JellyfinItem | undefined>({
    queryKey:
      enabled && serviceId && seriesId
        ? queryKeys.jellyfin.nextUp(serviceId, seriesId, {
            currentItemId,
          })
        : ["jellyfin", "nextUp", "disabled"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      if (!serviceId || !seriesId) {
        throw new Error("Missing service ID or series ID");
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getNextUpEpisode(seriesId, currentItemId);
    },
  });
};
