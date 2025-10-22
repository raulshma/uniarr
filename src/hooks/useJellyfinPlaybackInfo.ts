import { useQuery } from "@tanstack/react-query";

import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type {
  JellyfinPlaybackInfoResponse,
  JellyfinMediaSource,
} from "@/models/jellyfin.types";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { IConnector } from "@/connectors/base/IConnector";

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

  const getConnector = useConnectorsStore(selectGetConnector);
  const isEnabled = Boolean(enabled && serviceId && itemId);

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
    queryFn: async () => {
      if (!serviceId || !itemId) {
        throw new Error("Jellyfin playback requires service and item id.");
      }

      const connector = ensureConnector(getConnector, serviceId);
      return connector.getPlaybackInfo(itemId, {
        mediaSourceId,
        audioStreamIndex,
        subtitleStreamIndex,
        maxStreamingBitrate,
      });
    },
  });
};
