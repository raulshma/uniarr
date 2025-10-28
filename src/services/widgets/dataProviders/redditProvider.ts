import axios from "axios";

import { logger } from "@/services/logger/LoggerService";
import { handleApiError } from "@/utils/error.utils";

export type RedditSort = "hot" | "new" | "rising" | "top";
export type RedditTopTimeRange =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "all";

export interface RedditPostItem {
  id: string;
  title: string;
  author: string;
  score: number;
  comments: number;
  permalink: string;
  url: string;
  createdUtc: number;
  subreddit: string;
  thumbnail?: string;
  flair?: string;
}

export interface FetchRedditOptions {
  subreddits: string[];
  sort?: RedditSort;
  topTimeRange?: RedditTopTimeRange;
  limit?: number;
  includeOver18?: boolean;
}

const buildEndpoint = (
  subreddit: string,
  sort: RedditSort,
  limit: number,
  topTimeRange?: RedditTopTimeRange,
): string => {
  const base = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.json`;
  const params = new URLSearchParams({
    limit: String(limit),
    raw_json: "1",
  });

  if (sort === "top" && topTimeRange) {
    params.set("t", topTimeRange);
  }

  return `${base}?${params.toString()}`;
};

const mapRedditPost = (child: any): RedditPostItem | null => {
  const data = child?.data;
  if (!data) {
    return null;
  }

  if (data.over_18) {
    return null;
  }

  const id = data.id;
  const title = data.title as string | undefined;
  if (!id || !title) {
    return null;
  }

  return {
    id: String(id),
    title: title.trim(),
    author: typeof data.author === "string" ? data.author : "",
    score: typeof data.score === "number" ? data.score : 0,
    comments: typeof data.num_comments === "number" ? data.num_comments : 0,
    permalink:
      typeof data.permalink === "string"
        ? `https://www.reddit.com${data.permalink}`
        : "",
    url: typeof data.url === "string" ? data.url : "",
    createdUtc:
      typeof data.created_utc === "number"
        ? data.created_utc
        : Date.now() / 1000,
    subreddit: typeof data.subreddit === "string" ? data.subreddit : "unknown",
    thumbnail:
      typeof data.thumbnail === "string" && data.thumbnail.startsWith("http")
        ? data.thumbnail
        : undefined,
    flair:
      typeof data.link_flair_text === "string"
        ? data.link_flair_text
        : undefined,
  } satisfies RedditPostItem;
};

export const fetchRedditPosts = async ({
  subreddits,
  sort = "hot",
  topTimeRange = "day",
  limit = 10,
  includeOver18 = false,
}: FetchRedditOptions): Promise<RedditPostItem[]> => {
  if (!subreddits || subreddits.length === 0) {
    return [];
  }

  const perSubreddit = Math.max(1, Math.ceil(limit / subreddits.length));

  const responses = await Promise.allSettled(
    subreddits.map(async (subreddit) => {
      const endpoint = buildEndpoint(
        subreddit,
        sort,
        perSubreddit,
        topTimeRange,
      );
      try {
        const response = await axios.get(endpoint, { timeout: 8000 });
        const children = response.data?.data?.children;
        if (!Array.isArray(children)) {
          return [];
        }

        return children
          .map(mapRedditPost)
          .filter((post): post is RedditPostItem => Boolean(post))
          .filter((post) => (includeOver18 ? true : post.score >= 0));
      } catch (error) {
        const apiError = handleApiError(error, {
          operation: "fetchRedditPosts",
          endpoint,
        });
        void logger.warn("redditProvider: failed to load subreddit", {
          subreddit,
          message: apiError.message,
        });
        return [];
      }
    }),
  );

  const merged = responses.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const deduped = new Map<string, RedditPostItem>();
  merged.forEach((post) => {
    if (!includeOver18 && post.score < 0) {
      return;
    }

    if (!deduped.has(post.id)) {
      deduped.set(post.id, post);
    }
  });

  const ordered = Array.from(deduped.values()).sort(
    (first, second) => second.createdUtc - first.createdUtc,
  );

  return ordered.slice(0, limit);
};
