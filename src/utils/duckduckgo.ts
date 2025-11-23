/**
 * Custom DuckDuckGo search implementation for React Native
 *
 * This is a React Native-compatible alternative to duck-duck-scrape that works
 * by using fetch instead of Node.js http/https modules.
 *
 * Based on duck-duck-scrape by Snazzah:
 * https://github.com/Snazzah/duck-duck-scrape
 */

import { logger } from "@/services/logger/LoggerService";

/** The safe search values when searching DuckDuckGo. */
export enum SafeSearchType {
  /** Strict filtering, no NSFW content. */
  STRICT = 0,
  /** Moderate filtering. */
  MODERATE = -1,
  /** No filtering. */
  OFF = -2,
}

/** The type of time ranges of the search results in DuckDuckGo. */
export enum SearchTimeType {
  /** From any time. */
  ALL = "a",
  /** From the past day. */
  DAY = "d",
  /** From the past week. */
  WEEK = "w",
  /** From the past month. */
  MONTH = "m",
  /** From the past year. */
  YEAR = "y",
}

/** The options for search. */
export interface SearchOptions {
  /** The safe search type of the search. */
  safeSearch?: SafeSearchType;
  /** The time range of the searches */
  time?: SearchTimeType | string;
  /** The locale of the search. Defaults to "en-us". */
  locale?: string;
  /** The region of the search. Defaults to "wt-wt" or all regions. */
  region?: string;
  /** The market region of the search. Defaults to "US". */
  marketRegion?: string;
  /** The number to offset the results to. */
  offset?: number;
  /** The VQD string that acts like a key to a search. */
  vqd?: string;
}

/** A web search result. */
export interface SearchResult {
  /** The hostname of the website. (i.e. "google.com") */
  hostname: string;
  /** The URL of the result. */
  url: string;
  /** The title of the result. */
  title: string;
  /** The description of the result. */
  description: string;
  /** The raw description with HTML entities. */
  rawDescription: string;
  /** The icon of the website. */
  icon: string;
}

/** The search results from search. */
export interface SearchResponse {
  /** Whether there were no results found. */
  noResults: boolean;
  /** The VQD of the search query. */
  vqd: string;
  /** The web results of the search. */
  results: SearchResult[];
}

interface CallbackSearchResult {
  a: string; // description
  c: string; // URL
  d: string; // domain
  da?: string; // class associations
  h: number;
  i: string; // hostname
  t: string; // title
  u: string; // URL
}

interface CallbackNextSearch {
  n: string; // next page URL
}

const VQD_REGEX = /vqd=['"](\d+-\d+(?:-\d+)?)['"]/;
const SEARCH_REGEX =
  /DDG\.pageLayout\.load\('d',(\[.+\])\);DDG\.duckbar\.load(?:Module)?\('/;

const COMMON_HEADERS: Record<string, string> = {
  "sec-ch-ua": '"Not=A?Brand";v="8", "Chromium";v="129"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "sec-gpc": "1",
  "upgrade-insecure-requests": "1",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
};

const defaultOptions: Required<SearchOptions> = {
  safeSearch: SafeSearchType.OFF,
  time: SearchTimeType.ALL,
  locale: "en-us",
  region: "wt-wt",
  offset: 0,
  marketRegion: "US",
  vqd: "",
};

/**
 * Perform a DuckDuckGo search
 * @param query The query to search with
 * @param options The options of the search
 * @returns Search results
 */
export async function search(
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> {
  void logger.warn("🔍 DuckDuckGo search started", { query, options });

  if (!query) throw new Error("Query cannot be empty!");

  const opts = { ...defaultOptions, ...options };
  sanityCheck(opts);

  let vqd = opts.vqd;
  if (!vqd) {
    void logger.warn("🔑 Getting VQD for query", { query });
    vqd = await getVQD(query);
    void logger.warn("✅ VQD obtained", { vqd });
  }

  // Build query parameters matching duck-duck-scrape
  const queryParams: Record<string, string> = {
    q: query,
    ...(opts.safeSearch !== SafeSearchType.STRICT ? { t: "D" } : {}),
    l: opts.locale,
    ...(opts.safeSearch === SafeSearchType.STRICT ? { p: "1" } : {}),
    kl: opts.region,
    s: String(opts.offset),
    dl: "en",
    ct: "US",
    bing_market: opts.marketRegion,
    df: opts.time as string,
    vqd,
    ...(opts.safeSearch !== SafeSearchType.STRICT
      ? { ex: String(opts.safeSearch) }
      : {}),
    sp: "1",
    bpa: "1",
    biaexp: "b",
    msvrtexp: "b",
    ...(opts.safeSearch === SafeSearchType.STRICT
      ? {
          videxp: "a",
          nadse: "b",
          eclsexp: "a",
          stiaexp: "a",
          tjsexp: "b",
          related: "b",
          msnexp: "a",
        }
      : {
          nadse: "b",
          eclsexp: "b",
          tjsexp: "b",
        }),
  };

  const searchUrl = `https://links.duckduckgo.com/d.js?${new URLSearchParams(queryParams).toString()}`;

  void logger.warn("🌐 Fetching search results", { searchUrl });

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: COMMON_HEADERS,
    });

    void logger.warn("📡 Response received", {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      throw new Error(
        `DuckDuckGo search failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.text();
    void logger.warn("📄 Response body length", { length: body.length });

    // Check for errors
    if (body.includes("DDG.deep.is506")) {
      throw new Error("A server error occurred!");
    }
    if (body.includes("DDG.deep.anomalyDetectionBlock")) {
      throw new Error(
        "DDG detected an anomaly in the request, you are likely making requests too quickly.",
      );
    }

    // Extract search results using regex
    const searchMatch = SEARCH_REGEX.exec(body);
    if (!searchMatch || !searchMatch[1]) {
      void logger.warn("❌ No search results found in response");
      return {
        noResults: true,
        vqd,
        results: [],
      };
    }

    void logger.warn("🔍 Parsing search results JSON");
    const searchResults = JSON.parse(searchMatch[1].replace(/\t/g, "    ")) as (
      | CallbackSearchResult
      | CallbackNextSearch
    )[];

    void logger.warn("📊 Raw search results parsed", {
      count: searchResults.length,
      firstResult: searchResults[0],
    });

    // Check for no results
    if (
      searchResults.length === 1 &&
      searchResults[0] &&
      !("n" in searchResults[0])
    ) {
      const onlyResult = searchResults[0] as CallbackSearchResult;
      if (
        (!onlyResult.da && onlyResult.t === "EOF") ||
        !onlyResult.a ||
        onlyResult.d === "google.com search"
      ) {
        return {
          noResults: true,
          vqd,
          results: [],
        };
      }
    }

    // Parse results
    const results: SearchResult[] = [];
    let resultIndex = 0;
    for (const search of searchResults) {
      if ("n" in search) {
        void logger.warn("⏭️ Skipping 'next page' entry");
        continue; // Skip "next page" entries
      }

      const result = search as CallbackSearchResult;

      void logger.warn(`📝 Processing result ${resultIndex}`, {
        title: result.t,
        titleType: typeof result.t,
        description: result.a,
        descriptionType: typeof result.a,
        hostname: result.i,
        hostnameType: typeof result.i,
        url: result.u,
        urlType: typeof result.u,
        rawResult: result,
      });

      try {
        const decodedDescription = decodeHtmlEntities(result.a);
        void logger.warn(`✅ Decoded description for result ${resultIndex}`, {
          decodedDescription,
        });

        results.push({
          title: result.t || "",
          description: decodedDescription,
          rawDescription: result.a || "",
          hostname: result.i || "",
          icon: `https://external-content.duckduckgo.com/ip3/${result.i}.ico`,
          url: result.u || "",
        });
      } catch (error) {
        void logger.error(`❌ Error processing result ${resultIndex}`, {
          error: error instanceof Error ? error.message : String(error),
          result,
        });
        throw error;
      }

      resultIndex++;
    }

    void logger.warn("✅ Search completed successfully", {
      resultCount: results.length,
    });

    return {
      noResults: false,
      vqd,
      results,
    };
  } catch (error) {
    void logger.error("❌ DuckDuckGo search failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      query,
    });

    if (error instanceof Error) {
      throw new Error(`DuckDuckGo search error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get the VQD of a search query
 * @param query The query to search
 * @returns The VQD string
 */
async function getVQD(query: string): Promise<string> {
  try {
    const searchUrl = `https://duckduckgo.com/?${new URLSearchParams({ q: query, ia: "web" }).toString()}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to get VQD: ${response.status}`);
    }

    const body = await response.text();
    const match = VQD_REGEX.exec(body);

    if (!match || !match[1]) {
      throw new Error("VQD not found in response");
    }

    return match[1];
  } catch (error) {
    throw new Error(
      `Failed to get the VQD for query "${query}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate search options
 */
function sanityCheck(options: Required<SearchOptions>): void {
  if (!(options.safeSearch in SafeSearchType)) {
    throw new TypeError(
      `${options.safeSearch} is an invalid safe search type!`,
    );
  }

  if (typeof options.offset !== "number") {
    throw new TypeError("Search offset is not a number!");
  }

  if (options.offset < 0) {
    throw new RangeError("Search offset cannot be below zero!");
  }

  if (
    options.time &&
    !Object.values(SearchTimeType).includes(options.time as SearchTimeType) &&
    !/\d{4}-\d{2}-\d{2}..\d{4}-\d{2}-\d{2}/.test(options.time as string)
  ) {
    throw new TypeError(`${options.time} is an invalid search time!`);
  }

  if (!options.locale || typeof options.locale !== "string") {
    throw new TypeError("Search locale must be a string!");
  }

  if (!options.region || typeof options.region !== "string") {
    throw new TypeError("Search region must be a string!");
  }

  if (!options.marketRegion || typeof options.marketRegion !== "string") {
    throw new TypeError("Search market region must be a string!");
  }

  if (options.vqd && !/\d+-\d+(?:-\d+)?/.test(options.vqd)) {
    throw new Error(`${options.vqd} is an invalid VQD!`);
  }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string | undefined): string {
  void logger.warn("🔤 decodeHtmlEntities called", {
    text,
    textType: typeof text,
    textValue: String(text),
  });

  if (!text || typeof text !== "string") {
    void logger.warn(
      "⚠️ Text is empty or not a string, returning empty string",
    );
    return "";
  }

  try {
    const decoded = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<b>/g, "")
      .replace(/<\/b>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    void logger.warn("✅ HTML entities decoded successfully", {
      original: text.substring(0, 50),
      decoded: decoded.substring(0, 50),
    });

    return decoded;
  } catch (error) {
    void logger.error("❌ Error in decodeHtmlEntities", {
      error: error instanceof Error ? error.message : String(error),
      text: String(text),
    });
    throw error;
  }
}
