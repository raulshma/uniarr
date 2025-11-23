import { useQuery } from "@tanstack/react-query";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type { JellyfinItem } from "@/models/jellyfin.types";
import { queryKeys } from "@/hooks/queryKeys";

interface UseJellyfinSeriesEpisodesOptions {
  serviceId?: string;
  seriesId?: string;
  enabled?: boolean;
}

export const useJellyfinSeriesEpisodes = ({
  serviceId,
  seriesId,
  enabled = true,
}: UseJellyfinSeriesEpisodesOptions) => {
  return useQuery({
    queryKey: queryKeys.jellyfin.seriesEpisodes(serviceId!, seriesId!),
    queryFn: async (): Promise<JellyfinItem[]> => {
      if (!serviceId || !seriesId) {
        return [];
      }

      const manager = ConnectorManager.getInstance();
      const connector = manager.getConnector(serviceId) as
        | JellyfinConnector
        | undefined;

      if (!connector) {
        throw new Error("Jellyfin connector not found");
      }

      return connector.getSeriesEpisodes(seriesId);
    },
    enabled: enabled && Boolean(serviceId) && Boolean(seriesId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
