import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type {
  JellyfinPlaybackInfoResponse,
  JellyfinMediaSource,
} from "@/models/jellyfin.types";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";

interface UseJellyfinPlaybackInfoOptions {
  readonly serviceId?: string;
  readonly itemId?: string;
  readonly mediaSourceId?: string;
  readonly audioStreamIndex?: number;
  readonly subtitleStreamIndex?: number;
  readonly maxStreamingBitrate?: number;
  readonly enabled?: boolean;
  readonly disableRefetch?: boolean;
}

export interface JellyfinPlaybackInfoResult {
  readonly playback: JellyfinPlaybackInfoResponse;
  readonly mediaSource: JellyfinMediaSource;
  readonly streamUrl: string;
}

export const useJellyfinPlaybackInfo = (
  options: UseJellyfinPlaybackInfoOptions,
) => {
  const {
    serviceId,
    itemId,
    mediaSourceId,
    audioStreamIndex,
    subtitleStreamIndex,
    maxStreamingBitrate,
    enabled = true,
    disableRefetch = true,
  } = options;

  const connector = useConnectorsStore(selectConnectorById(serviceId ?? ""));
  const isEnabled = Boolean(
    enabled && serviceId && itemId && connector?.config.type === "jellyfin",
  );

  return useQuery<JellyfinPlaybackInfoResult>({
    queryKey:
      isEnabled && serviceId && itemId
        ? queryKeys.jellyfin.playback(serviceId, itemId, {
            mediaSourceId,
            audioStreamIndex,
            subtitleStreamIndex,
            maxStreamingBitrate,
          })
        : queryKeys.jellyfin.base,
    enabled: isEnabled,
    staleTime: disableRefetch ? Infinity : 30_000,
    refetchOnWindowFocus: !disableRefetch,
    refetchOnReconnect: !disableRefetch,
    queryFn: async ({ signal }) => {
      if (!serviceId || !itemId) {
        throw new Error("Jellyfin playback requires service and item id.");
      }

      return (connector as JellyfinConnector).getPlaybackInfo(
        itemId,
        {
          mediaSourceId,
          audioStreamIndex,
          subtitleStreamIndex,
          maxStreamingBitrate,
        },
        { signal },
      );
    },
  });
};
