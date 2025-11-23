/**
 * SearXNG search implementation for React Native
 *
 * This implementation uses SearXNG, a privacy-respecting metasearch engine
 * that aggregates results from multiple search engines.
 *
 * SearXNG instances: https://searx.space/
 */

import { logger } from "@/services/logger/LoggerService";

/** The safe search values when searching SearXNG. */
export enum SafeSearchType {
  /** No filtering. */
  NONE = 0,
  /** Moderate filtering. */
  MODERATE = 1,
  /** Strict filtering, no NSFW content. */
  STRICT = 2,
}

/** The time range of search results. */
export enum SearchTimeType {
  /** From any time. */
  ALL = "all",
  /** From the past day. */
  DAY = "day",
  /** From the past week. */
  WEEK = "week",
  /** From the past month. */
  MONTH = "month",
  /** From the past year. */
  YEAR = "year",
}

/** The options for search. */
export interface SearchOptions {
  /** The safe search type of the search. */
  safeSearch?: SafeSearchType;
  /** The time range of the searches */
  time?: SearchTimeType;
  /** The language of the search. Defaults to "en". */
  language?: string;
  /** The number of results per page. */
  pageSize?: number;
  /** The page number to fetch. */
  page?: number;
  /** The SearXNG instance URL to use. */
  instanceUrl?: string;
  /** Categories to search (e.g., "general", "images", "videos"). */
  categories?: string[];
}

/** A web search result. */
export interface SearchResult {
  /** The URL of the result. */
  url: string;
  /** The title of the result. */
  title: string;
  /** The description/snippet of the result. */
  description: string;
  /** The engine that provided this result. */
  engine?: string;
  /** The score/relevance of the result. */
  score?: number;
}

/** The search results from search. */
export interface SearchResponse {
  /** The web results of the search. */
  results: SearchResult[];
  /** The query that was searched. */
  query: string;
  /** The number of results returned. */
  numberOfResults: number;
  /** Suggestions for alternative queries. */
  suggestions?: string[];
}

/** SearXNG API response format */
interface SearXNGApiResponse {
  query: string;
  number_of_results: number;
  results: {
    url: string;
    title: string;
    content: string;
    engine?: string;
    score?: number;
    category?: string;
  }[];
  suggestions?: string[];
  infoboxes?: unknown[];
  answers?: string[];
}

// Default public SearXNG instances (fallback list)
const DEFAULT_INSTANCES = [
  "https://opnxng.com",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searx.work",
  "https://search.bus-hit.me",
  "https://searx.rhscz.eu",
  "https://search.inetol.net",
  "https://searx.oloke.xyz",
  "https://priv.au",
  "https://fairsuch.net",
];

// Global rate limit tracker - tracks instances that are rate limited
// Key: instance URL, Value: timestamp when rate limit expires (5 minutes)
const rateLimitedInstances = new Map<string, number>();
const RATE_LIMIT_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an instance is currently rate limited
 */
function isRateLimited(instanceUrl: string): boolean {
  const expiry = rateLimitedInstances.get(instanceUrl);
  if (!expiry) return false;

  if (Date.now() > expiry) {
    // Rate limit expired, remove it
    rateLimitedInstances.delete(instanceUrl);
    return false;
  }

  return true;
}

/**
 * Mark an instance as rate limited
 */
function markRateLimited(instanceUrl: string): void {
  rateLimitedInstances.set(instanceUrl, Date.now() + RATE_LIMIT_DURATION);
  void logger.info("Instance marked as rate limited for 5 minutes", {
    instanceUrl,
    expiresAt: new Date(Date.now() + RATE_LIMIT_DURATION).toISOString(),
  });
}

const defaultOptions: Required<SearchOptions> = {
  safeSearch: SafeSearchType.MODERATE,
  time: SearchTimeType.ALL,
  language: "en",
  pageSize: 10,
  page: 1,
  instanceUrl: DEFAULT_INSTANCES[0] ?? "",
  categories: ["general"],
};

/**
 * Perform a SearXNG search
 * @param query The query to search with
 * @param options The options of the search
 * @returns Search results
 */
export async function search(
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> {
  void logger.debug("SearXNG search started", { query, options });

  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty!");
  }

  const opts = { ...defaultOptions, ...options };

  // Try all instances in order, skipping already-tried ones
  return await searchWithInstances(query, opts, []);
}

/**
 * Internal function to search with instance tracking
 */
async function searchWithInstances(
  query: string,
  options: Required<SearchOptions>,
  triedInstances: string[],
): Promise<SearchResponse> {
  // Get list of instances to try, excluding already-tried ones and rate-limited ones
  const instancesToTry = DEFAULT_INSTANCES.filter(
    (instance) =>
      !triedInstances.includes(instance) && !isRateLimited(instance),
  );

  // If a specific instance was requested and not yet tried, try it first
  if (
    options.instanceUrl &&
    !triedInstances.includes(options.instanceUrl) &&
    !isRateLimited(options.instanceUrl) &&
    !instancesToTry.includes(options.instanceUrl)
  ) {
    instancesToTry.unshift(options.instanceUrl);
  } else if (
    options.instanceUrl &&
    (triedInstances.includes(options.instanceUrl) ||
      isRateLimited(options.instanceUrl))
  ) {
    // Requested instance already failed or rate limited, use remaining instances
    void logger.debug("Requested instance unavailable, using fallbacks", {
      requestedInstance: options.instanceUrl,
      triedInstances,
      isRateLimited: isRateLimited(options.instanceUrl),
    });
  }

  if (instancesToTry.length === 0) {
    throw new Error(
      "No available SearXNG instances. All instances are either rate limited or have failed.",
    );
  }

  const errors: string[] = [];

  for (const instanceUrl of instancesToTry) {
    // Double-check rate limit status before trying
    if (isRateLimited(instanceUrl)) {
      void logger.debug("Skipping rate-limited instance", { instanceUrl });
      continue;
    }

    try {
      void logger.debug("Trying SearXNG instance", {
        instanceUrl,
        attemptNumber: triedInstances.length + 1,
        availableInstances: instancesToTry.length,
      });

      const result = await searchSingleInstance(query, {
        ...options,
        instanceUrl,
      });

      void logger.info("SearXNG search succeeded", {
        instanceUrl,
        resultCount: result.results.length,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${instanceUrl}: ${errorMsg}`);

      // If rate limited, mark it globally
      if (errorMsg.includes("Rate limited")) {
        markRateLimited(instanceUrl);
      }

      void logger.warn("SearXNG instance failed", {
        instanceUrl,
        error: errorMsg,
        isRateLimited: errorMsg.includes("Rate limited"),
      });

      // Mark this instance as tried
      triedInstances.push(instanceUrl);

      // Continue to next instance
    }
  }

  throw new Error(
    `All SearXNG instances failed (tried ${triedInstances.length}). Errors: ${errors.join("; ")}`,
  );
}

/**
 * Search a single SearXNG instance without fallback logic
 */
async function searchSingleInstance(
  query: string,
  options: Required<SearchOptions>,
): Promise<SearchResponse> {
  // Build query parameters for SearXNG JSON API
  const queryParams: Record<string, string> = {
    q: query,
    format: "json",
    language: options.language,
    safesearch: String(options.safeSearch),
    pageno: String(options.page),
    categories: options.categories.join(","),
  };

  // Add time range if specified
  if (options.time && options.time !== SearchTimeType.ALL) {
    queryParams.time_range = options.time;
  }

  const searchUrl = `${options.instanceUrl}/search?${new URLSearchParams(queryParams).toString()}`;

  const response = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    },
  });

  void logger.debug("SearXNG response received", {
    status: response.status,
    ok: response.ok,
    instanceUrl: options.instanceUrl,
  });

  if (!response.ok) {
    // Handle rate limiting (429) - throw immediately to skip to next server
    if (response.status === 429) {
      void logger.warn(
        "SearXNG instance rate limited (429), marking for cooldown",
        {
          instanceUrl: options.instanceUrl,
        },
      );
      throw new Error(`Rate limited (429)`);
    }

    throw new Error(
      `SearXNG search failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as SearXNGApiResponse;

  void logger.debug("SearXNG results parsed", {
    resultCount: data.results?.length || 0,
    numberOfResults: data.number_of_results,
  });

  // Map results to our format
  const results: SearchResult[] = (data.results || []).map((result) => ({
    url: result.url,
    title: cleanText(result.title),
    description: cleanText(result.content),
    engine: result.engine,
    score: result.score,
  }));

  return {
    results,
    query: data.query || query,
    numberOfResults: data.number_of_results || results.length,
    suggestions: data.suggestions,
  };
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string | undefined): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\s+/g, " ") // Remove excessive whitespace
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .trim();
}

/**
 * Get a list of available SearXNG instances
 * This is a static list, but could be enhanced to fetch from searx.space API
 */
export function getAvailableInstances(): string[] {
  return [...DEFAULT_INSTANCES];
}
