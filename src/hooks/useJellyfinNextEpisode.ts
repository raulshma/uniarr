import { useQuery } from "@tanstack/react-query";
import { useConnectorsStore, selectGetConnector } from "@/store/connectorsStore";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type { JellyfinItem } from "@/models/jellyfin.types";
import { queryKeys } from "@/hooks/queryKeys";

interface UseJellyfinNextEpisodeOptions {
  serviceId?: string;
  seriesId?: string;
  currentItemId?: string;
  enabled?: boolean;
}

export const useJellyfinNextEpisode = ({
  serviceId,
  seriesId,
  currentItemId,
  enabled = true,
}: UseJellyfinNextEpisodeOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);

  const queryEnabled = Boolean(
    enabled && serviceId && seriesId && currentItemId
  );

  return useQuery<JellyfinItem | undefined>({
    queryKey: queryKeys.jellyfin.nextUp(
      serviceId ?? "",
      seriesId ?? "",
      { currentItemId }
    ),
    enabled: queryEnabled,
    staleTime: 60 * 1000, // 1 minute
    queryFn: async () => {
      if (!serviceId || !seriesId || !currentItemId) return undefined;

      const connector = getConnector(serviceId);
      if (!connector || connector.config.type !== "jellyfin") {
        return undefined;
      }

      const jellyfinConnector = connector as JellyfinConnector;
      return jellyfinConnector.getNextUpEpisode(seriesId, currentItemId);
    },
  });
};
