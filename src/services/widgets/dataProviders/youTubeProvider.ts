import axios from "axios";

import { logger } from "@/services/logger/LoggerService";
import { handleApiError } from "@/utils/error.utils";

export interface YouTubeVideoItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  videoUrl: string;
}

export interface FetchYouTubeOptions {
  apiKey: string;
  channelIds: string[];
  limit?: number;
  itemsPerChannel?: number;
}

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

const buildVideoUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`;

const mapSearchItem = (item: any): YouTubeVideoItem | null => {
  const id = item?.id?.videoId;
  const snippet = item?.snippet;
  if (!id || !snippet) {
    return null;
  }

  if (snippet.liveBroadcastContent === "upcoming") {
    return null;
  }

  return {
    id,
    title: typeof snippet.title === "string" ? snippet.title : "",
    description:
      typeof snippet.description === "string" ? snippet.description : "",
    publishedAt:
      typeof snippet.publishedAt === "string"
        ? new Date(snippet.publishedAt).toISOString()
        : new Date().toISOString(),
    channelId: typeof snippet.channelId === "string" ? snippet.channelId : "",
    channelTitle:
      typeof snippet.channelTitle === "string" ? snippet.channelTitle : "",
    thumbnailUrl:
      typeof snippet.thumbnails?.medium?.url === "string"
        ? snippet.thumbnails.medium.url
        : typeof snippet.thumbnails?.default?.url === "string"
          ? snippet.thumbnails.default.url
          : undefined,
    videoUrl: buildVideoUrl(id),
  } satisfies YouTubeVideoItem;
};

export const fetchYouTubeUploads = async ({
  apiKey,
  channelIds,
  limit = 10,
  itemsPerChannel,
}: FetchYouTubeOptions): Promise<YouTubeVideoItem[]> => {
  if (!apiKey || channelIds.length === 0) {
    return [];
  }

  const normalizedChannelIds = channelIds
    .map((channelId) => channelId.trim())
    .filter((channelId) => channelId.length > 0);

  if (normalizedChannelIds.length === 0) {
    return [];
  }

  const resolvedPerChannel = itemsPerChannel
    ? Math.max(1, Math.min(itemsPerChannel, 10))
    : Math.max(1, Math.ceil(limit / normalizedChannelIds.length));

  const desiredTotal = itemsPerChannel
    ? resolvedPerChannel * normalizedChannelIds.length
    : limit;
  const totalLimit = Math.max(1, Math.min(desiredTotal, limit));

  const requests = await Promise.allSettled(
    normalizedChannelIds.map(async (channelId) => {
      const params = {
        key: apiKey,
        channelId,
        part: "snippet",
        order: "date",
        maxResults: Math.min(resolvedPerChannel, 10),
        type: "video",
      } as const;

      try {
        const response = await axios.get(SEARCH_ENDPOINT, {
          timeout: 8000,
          params,
        });

        const items = Array.isArray(response.data?.items)
          ? (response.data.items as unknown[])
          : [];
        const mapped = items
          .map((entry) => mapSearchItem(entry))
          .filter((video): video is YouTubeVideoItem => Boolean(video));

        return mapped;
      } catch (error) {
        const apiError = handleApiError(error, {
          operation: "fetchYouTubeUploads",
          endpoint: SEARCH_ENDPOINT,
        });
        void logger.warn("youTubeProvider: failed to load uploads", {
          channelId,
          message: apiError.message,
        });
        return [];
      }
    }),
  );

  const merged = requests.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const deduped = new Map<string, YouTubeVideoItem>();
  merged.forEach((video) => {
    if (!deduped.has(video.id)) {
      deduped.set(video.id, video);
    }
  });

  const ordered = Array.from(deduped.values()).sort((first, second) => {
    return (
      new Date(second.publishedAt).getTime() -
      new Date(first.publishedAt).getTime()
    );
  });

  return ordered.slice(0, totalLimit);
};
