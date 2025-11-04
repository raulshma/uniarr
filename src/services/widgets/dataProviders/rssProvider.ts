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
  image?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@", // Use @ prefix for attributes
  trimValues: true,
  parseAttributeValue: true,
  // Handle different media namespace formats better
  isArray: (name, jpath) => {
    if (
      ["media:content", "media:thumbnail", "media:group", "enclosure"].includes(
        name,
      )
    ) {
      return true;
    }
    return false;
  },
  // Support processing of unprefixed namespaces
  processEntities: false,
  stopNodes: ["script", "style"],
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

      // Enhanced image extraction from multiple sources
      let image: string | undefined;

      // Helper function to try multiple possible paths for media content
      const getMediaContent = (obj: any, key: string) => {
        // Try with media: prefix
        if (obj?.[`media:${key}`]) {
          return obj[`media:${key}`];
        }
        // Try without prefix (for unprefixed namespaces)
        if (obj?.[key]) {
          return obj[key];
        }
        return undefined;
      };

      // Check enclosures first
      const enclosures = normalizeArray(item?.enclosure);
      const imageEnclosure = enclosures.find(
        (enc: any) =>
          typeof enc?.["@url"] === "string" &&
          enc?.["@type"]?.startsWith("image/"),
      );
      if (imageEnclosure) {
        image = imageEnclosure["@url"];
      } else {
        // Try to get media:content with or without namespace prefix
        const mediaContent = getMediaContent(item, "content");
        if (mediaContent) {
          const mediaContentArray = normalizeArray(mediaContent);
          if (Array.isArray(mediaContentArray)) {
            // If it's an array, find the first image
            const imageContent = mediaContentArray.find((mc: any) => {
              const mediaType = mc["@type"] || mc.type || "";
              const medium = mc["@medium"] || mc.medium || "";
              return mediaType.startsWith("image/") || medium === "image";
            });
            if (imageContent?.["@url"]) {
              image = imageContent["@url"];
            }
          } else {
            // Single media:content element
            // Check for MIME type first
            const mediaType = mediaContent["@type"] || mediaContent.type || "";

            // Also check for medium="image" attribute
            const medium = mediaContent["@medium"] || mediaContent.medium || "";

            if (mediaType.startsWith("image/") || medium === "image") {
              image = mediaContent["@url"];
            }
          }
        }

        if (!image) {
          // Try to get media:thumbnail with or without namespace prefix
          const mediaThumbnail = getMediaContent(item, "thumbnail");
          if (mediaThumbnail?.["@url"]) {
            image = mediaThumbnail["@url"];
          } else if (
            item?.["content"]?.["@url"] &&
            (item?.["content"]?.["@type"]?.startsWith("image/") ||
              item?.["content"]?.type?.startsWith("image/"))
          ) {
            image = item.content["@url"];
          }
        }
      }

      // Handle media:group
      if (!image && item?.["media:group"]) {
        // Try media:content in media:group
        const groupMediaContent = getMediaContent(
          item["media:group"],
          "content",
        );
        if (groupMediaContent) {
          const groupMediaContentArray = normalizeArray(groupMediaContent);
          if (Array.isArray(groupMediaContentArray)) {
            // If it's an array, find the first image
            const imageContent = groupMediaContentArray.find((mc: any) => {
              const mediaType = mc["@type"] || mc.type || "";
              const medium = mc["@medium"] || mc.medium || "";
              return mediaType.startsWith("image/") || medium === "image";
            });
            if (imageContent?.["@url"]) {
              image = imageContent["@url"];
            }
          } else {
            // Single media:content element
            const groupMediaType =
              groupMediaContent["@type"] || groupMediaContent.type || "";
            const groupMedium =
              groupMediaContent["@medium"] || groupMediaContent.medium || "";

            if (
              groupMediaType.startsWith("image/") ||
              groupMedium === "image"
            ) {
              image = groupMediaContent["@url"];
            }
          }
        }

        // Try media:thumbnail in media:group
        if (!image) {
          const groupMediaThumbnail = getMediaContent(
            item["media:group"],
            "thumbnail",
          );
          if (groupMediaThumbnail?.["@url"]) {
            image = groupMediaThumbnail["@url"];
          }
        }
      }

      // Last resort: try to extract first image from description/content
      if (!image) {
        const description =
          item.description || item["content:encoded"] || item.content;
        if (typeof description === "string") {
          const imgMatch = description.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
          if (imgMatch && imgMatch[1]) {
            image = imgMatch[1];
          }
        }
      }

      // Debug logging for better troubleshooting
      const description =
        item.description || item["content:encoded"] || item.content;
      if (item?.["media:content"]?.url) {
        logger.debug("RSS Item has media:content element", {
          title: item?.title,
          mediaContent: item?.["media:content"],
          extractedImage: image,
        });
      }
      if (!image) {
        logger.debug("No image found in RSS item", {
          title: item?.title,
          hasEnclosure: !!item?.enclosure,
          hasMediaContent: !!item?.["media:content"],
          hasMediaThumbnail: !!item?.["media:thumbnail"],
          descriptionLength:
            typeof description === "string" ? description.length : 0,
        });
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
        image,
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

      // Helper function to try multiple possible paths for media content
      const getMediaContent = (obj: any, key: string) => {
        // Try with media: prefix
        if (obj?.[`media:${key}`]) {
          return obj[`media:${key}`];
        }
        // Try without prefix (for unprefixed namespaces)
        if (obj?.[key]) {
          return obj[key];
        }
        return undefined;
      };

      // Extract image from media content
      let image: string | undefined;

      // Try to get media:content with or without namespace prefix
      const mediaContent = getMediaContent(entry, "content");
      if (mediaContent) {
        const mediaContentArray = normalizeArray(mediaContent);
        if (Array.isArray(mediaContentArray)) {
          // If it's an array, find the first image
          const imageContent = mediaContentArray.find((mc: any) => {
            const mediaType = mc["@type"] || mc.type || "";
            const medium = mc["@medium"] || mc.medium || "";
            return mediaType.startsWith("image/") || medium === "image";
          });
          if (imageContent?.["@url"]) {
            image = imageContent["@url"];
            logger.debug("Extracted media:content image from array", {
              url: image,
            });
          }
        } else {
          // Single media:content element
          const mediaType = mediaContent["@type"] || mediaContent.type || "";
          const medium = mediaContent["@medium"] || mediaContent.medium || "";

          if (mediaType.startsWith("image/") || medium === "image") {
            image = mediaContent["@url"];
            logger.debug("Extracted media:content image", {
              url: image,
              type: mediaType,
              medium: medium,
            });
          }
        }
      }

      // Try to get media:thumbnail if no image found yet
      if (!image) {
        const mediaThumbnail = getMediaContent(entry, "thumbnail");
        if (mediaThumbnail?.["@url"]) {
          image = mediaThumbnail["@url"];
          logger.debug("Extracted media:thumbnail image", { url: image });
        }
      }

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
        image,
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
