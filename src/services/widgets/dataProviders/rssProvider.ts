import axios from "axios";
import { XMLParser } from "fast-xml-parser";

import { logger } from "@/services/logger/LoggerService";
import { handleApiError } from "@/utils/error.utils";

export interface RssFeedItem {
  id: string;
  title: string;
  link: string;
  summary?: string;
  author?: string;
  publishedAt?: string;
  source?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  parseAttributeValue: true,
});

const normalizeArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const coerceDateString = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

const resolveSourceName = (
  feedTitle: unknown,
  fallbackUrl: string,
): string | undefined => {
  if (typeof feedTitle === "string" && feedTitle.trim().length > 0) {
    return feedTitle.trim();
  }

  try {
    const parsedUrl = new URL(fallbackUrl);
    return parsedUrl.hostname;
  } catch (error) {
    void logger.warn("rssProvider: failed to parse feed host", {
      fallbackUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

const parseRssChannelItems = (feed: any, feedUrl: string): RssFeedItem[] => {
  const feedTitle = feed?.title;
  const items = normalizeArray(feed?.item);

  return items
    .map((item: any) => {
      const title = item?.title ?? item?.["media:title"];
      const link = item?.link ?? item?.guid;
      if (typeof title !== "string" || typeof link !== "string") {
        return null;
      }

      return {
        id: String(item.guid ?? link ?? title),
        title: title.trim(),
        link: link.trim(),
        summary:
          typeof item.description === "string"
            ? item.description.trim()
            : typeof item["content:encoded"] === "string"
              ? item["content:encoded"].trim()
              : undefined,
        author:
          typeof item.author === "string"
            ? item.author.trim()
            : typeof item?.creator === "string"
              ? item.creator.trim()
              : undefined,
        publishedAt: coerceDateString(item.pubDate ?? item.published),
        source: resolveSourceName(feedTitle, feedUrl),
      } satisfies RssFeedItem;
    })
    .filter(Boolean) as RssFeedItem[];
};

const parseAtomEntries = (root: any, feedUrl: string): RssFeedItem[] => {
  const feedTitle = root?.title;
  const entries = normalizeArray(root?.entry);

  return entries
    .map((entry: any) => {
      const title = entry?.title?.["#text"] ?? entry?.title;
      const linkHref = normalizeArray(entry?.link)
        .map((link: any) => link?.href)
        .find((href: unknown) => typeof href === "string");
      if (typeof title !== "string" || typeof linkHref !== "string") {
        return null;
      }

      const summary =
        typeof entry.summary === "string"
          ? entry.summary
          : typeof entry.content === "string"
            ? entry.content
            : undefined;

      return {
        id: String(entry.id ?? linkHref ?? title),
        title: title.trim(),
        link: linkHref.trim(),
        summary: summary?.trim(),
        author: (() => {
          const authors = normalizeArray(entry.author);
          const name = authors
            .map((author: any) => author?.name)
            .find((value: unknown) => typeof value === "string");
          return name ? name.trim() : undefined;
        })(),
        publishedAt: coerceDateString(entry.updated ?? entry.published),
        source: resolveSourceName(feedTitle, feedUrl),
      } satisfies RssFeedItem;
    })
    .filter(Boolean) as RssFeedItem[];
};

const parseFeedItems = (xmlPayload: string, feedUrl: string): RssFeedItem[] => {
  const parsed = parser.parse(xmlPayload);

  if (parsed?.rss?.channel) {
    return parseRssChannelItems(parsed.rss.channel, feedUrl);
  }

  if (parsed?.feed) {
    return parseAtomEntries(parsed.feed, feedUrl);
  }

  void logger.warn("rssProvider: unsupported feed structure", {
    feedUrl,
  });
  return [];
};

export interface FetchRssOptions {
  urls: string[];
  limit?: number;
}

export const fetchRssFeeds = async ({
  urls,
  limit = 8,
}: FetchRssOptions): Promise<RssFeedItem[]> => {
  if (!urls || urls.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await axios.get<string>(url, {
          timeout: 10000,
        });
        return parseFeedItems(response.data, url);
      } catch (error) {
        const apiError = handleApiError(error, {
          operation: "fetchRssFeed",
          endpoint: url,
        });
        void logger.warn("rssProvider: feed fetch failed", {
          url,
          message: apiError.message,
        });
        return [];
      }
    }),
  );

  const merged = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const dedupedMap = new Map<string, RssFeedItem>();
  merged.forEach((item) => {
    const key = `${item.link ?? item.id}`;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, item);
    }
  });

  const ordered = Array.from(dedupedMap.values()).sort((first, second) => {
    const firstDate = first.publishedAt
      ? new Date(first.publishedAt).getTime()
      : 0;
    const secondDate = second.publishedAt
      ? new Date(second.publishedAt).getTime()
      : 0;
    return secondDate - firstDate;
  });

  return ordered.slice(0, limit);
};
