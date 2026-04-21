import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinResumeItem } from "@/models/jellyfin.types";

interface UseJellyfinResumeOptions {
  readonly serviceId?: string;
  readonly limit?: number;
  readonly includeTypes?: string[];
}

export const useJellyfinResume = ({
  serviceId,
  limit = 20,
  includeTypes,
}: UseJellyfinResumeOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId ?? ""));

  return useQuery<JellyfinResumeItem[]>({
    queryKey: serviceId
      ? queryKeys.jellyfin.resume(serviceId, { limit, includeTypes })
      : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId || !connector || connector.config.type !== "jellyfin") {
        return [];
      }

      const jellyfinConnector = connector as JellyfinConnector;

      const resumeItems = await jellyfinConnector.getResumeItems(
        limit,
        includeTypes,
      );

      const sessions = await jellyfinConnector.getNowPlayingSessions();

      const playingItems: JellyfinResumeItem[] = sessions
        .filter((session) => {
          const item = session.NowPlayingItem || session.NowViewingItem;
          if (!item) return false;

          const itemTypes = includeTypes || ["Movie", "Episode"];
          if (!itemTypes.includes(item.Type || "")) return false;

          const position = session.PlayState?.PositionTicks;
          const runtime = item.RunTimeTicks;
          if (!position || !runtime || position < 600000000) return false;

          return true;
        })
        .map((session) => {
          const item = (session.NowPlayingItem || session.NowViewingItem)!;
          const userData = item.UserData ? { ...item.UserData } : {};
          if (
            session.PlayState?.PositionTicks &&
            !userData.PlaybackPositionTicks
          ) {
            userData.PlaybackPositionTicks = session.PlayState.PositionTicks;
          }
          return {
            ...item,
            UserData: userData,
          };
        });

      const allItems = [...resumeItems];
      const existingIds = new Set(resumeItems.map((item) => item.Id));

      for (const playingItem of playingItems) {
        if (!existingIds.has(playingItem.Id)) {
          allItems.push(playingItem);
        }
      }

      const result = allItems.slice(0, limit);
      return result;
    },
  });
};
