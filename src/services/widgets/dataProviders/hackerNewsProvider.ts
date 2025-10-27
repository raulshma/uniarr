import axios from "axios";

import { logger } from "@/services/logger/LoggerService";
import { handleApiError } from "@/utils/error.utils";

const API_BASE = "https://hacker-news.firebaseio.com/v0";

export type HackerNewsFeedType = "topstories" | "beststories" | "newstories";

export interface HackerNewsItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number;
}

const fetchStoryIds = async (
  feedType: HackerNewsFeedType,
): Promise<number[]> => {
  try {
    const response = await axios.get<number[]>(`${API_BASE}/${feedType}.json`, {
      timeout: 8000,
    });
    if (Array.isArray(response.data)) {
      return response.data as number[];
    }
    return [];
  } catch (error) {
    const apiError = handleApiError(error, {
      operation: "fetchHackerNewsIds",
      endpoint: `${API_BASE}/${feedType}.json`,
    });
    void logger.warn("hackerNewsProvider: failed to load story ids", {
      feedType,
      message: apiError.message,
    });
    return [];
  }
};

const fetchStoryDetails = async (
  id: number,
): Promise<HackerNewsItem | null> => {
  try {
    const response = await axios.get(`${API_BASE}/item/${id}.json`, {
      timeout: 8000,
    });

    const payload = response.data;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (payload.type !== "story") {
      return null;
    }

    if (typeof payload.title !== "string") {
      return null;
    }

    return {
      id,
      title: payload.title.trim(),
      url: typeof payload.url === "string" ? payload.url : undefined,
      score: typeof payload.score === "number" ? payload.score : 0,
      by: typeof payload.by === "string" ? payload.by : "",
      time: typeof payload.time === "number" ? payload.time : 0,
      descendants:
        typeof payload.descendants === "number"
          ? payload.descendants
          : undefined,
    } satisfies HackerNewsItem;
  } catch (error) {
    const apiError = handleApiError(error, {
      operation: "fetchHackerNewsItem",
      endpoint: `${API_BASE}/item/${id}.json`,
    });
    void logger.warn("hackerNewsProvider: failed to load item", {
      id,
      message: apiError.message,
    });
    return null;
  }
};

export interface FetchHackerNewsOptions {
  feedType?: HackerNewsFeedType;
  limit?: number;
}

export const fetchHackerNewsStories = async ({
  feedType = "topstories",
  limit = 10,
}: FetchHackerNewsOptions = {}): Promise<HackerNewsItem[]> => {
  const ids = await fetchStoryIds(feedType);
  if (ids.length === 0) {
    return [];
  }

  const slice = ids.slice(0, limit * 2); // fetch extras to account for filtering

  const stories = await Promise.all(
    slice.map(async (id) => {
      const story = await fetchStoryDetails(id);
      return story;
    }),
  );

  return stories
    .filter((story): story is HackerNewsItem => Boolean(story))
    .slice(0, limit);
};
