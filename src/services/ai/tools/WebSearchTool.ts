import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./types";
import { ToolError, ToolErrorCategory } from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";

/**
 * Parameters for the WebSearchTool
 */
const webSearchParamsSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe(
      "REQUIRED: The search query string to look up on the web using DuckDuckGo. Example: 'Dune 2024 release date' or 'best sci-fi movies 2024'",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe(
      "Optional: Maximum number of search results to return (default: 5, max: 10)",
    ),
  region: z
    .string()
    .optional()
    .describe(
      "Optional: Region/locale for search results (e.g., 'us-en', 'uk-en', 'de-de'). Defaults to 'us-en'",
    ),
});

type WebSearchParams = z.infer<typeof webSearchParamsSchema>;

/**
 * Search result item structure
 */
interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  hostname?: string;
}

/**
 * Result data structure for WebSearchTool
 */
interface WebSearchResult {
  results: SearchResultItem[];
  query: string;
  resultCount: number;
  message: string;
}

/**
 * WebSearchTool - Search the web using DuckDuckGo
 *
 * This tool allows the LLM to search the web for general information,
 * release dates, reviews, media details, and other publicly available
 * information using DuckDuckGo search.
 *
 * @example
 * ```typescript
 * // Search for movie information
 * const result = await execute({
 *   query: 'Dune 2024 release date',
 *   limit: 5
 * });
 *
 * // Search with specific region
 * const result = await execute({
 *   query: 'best sci-fi movies 2024',
 *   limit: 10,
 *   region: 'us-en'
 * });
 * ```
 */
export const webSearchTool: ToolDefinition<WebSearchParams, WebSearchResult> = {
  name: "search_web",
  description:
    "Search the web using DuckDuckGo for current information. REQUIRED PARAMETER: 'query' - the search terms to look up. Use this tool when you need: release dates, reviews, cast information, ratings, current events, or any information not in your knowledge base. Always provide a specific search query string.",
  parameters: webSearchParamsSchema,

  async execute(params: WebSearchParams): Promise<ToolResult<WebSearchResult>> {
    void logger.warn("🚀🚀🚀 WebSearchTool.execute() ENTRY POINT", {
      params,
      paramsType: typeof params,
      paramsKeys: params ? Object.keys(params) : "null/undefined",
      query: params?.query,
      queryType: typeof params?.query,
    });

    const startTime = Date.now();
    const context = ToolContext.getInstance();

    try {
      void logger.warn("🚀 WebSearchTool execution started", { params });

      // Validate query exists and is a string
      if (!params.query || typeof params.query !== "string") {
        throw new ToolError(
          "Search query is required",
          ToolErrorCategory.INVALID_PARAMETERS,
          "The 'query' parameter is required for web search. Please call the tool again with a query string. Example: {query: 'Dune 2024 release date', limit: 5}",
          { params },
        );
      }

      // Validate query length
      if (params.query.trim().length < 2) {
        throw new ToolError(
          "Search query is too short",
          ToolErrorCategory.INVALID_PARAMETERS,
          "Please provide a search query with at least 2 characters.",
          { query: params.query },
        );
      }

      // Perform the search
      const searchResults = await performSearch(
        params.query,
        params.region || "us-en",
      );

      if (!searchResults || searchResults.length === 0) {
        return {
          success: true,
          data: {
            results: [],
            query: params.query,
            resultCount: 0,
            message: `No search results found for "${params.query}". Try refining your search query or using different keywords.`,
          },
          metadata: {
            executionTime: Date.now() - startTime,
            query: params.query,
            region: params.region || "us-en",
          },
        };
      }

      // Limit results to requested count
      const limitedResults = searchResults.slice(0, params.limit);

      const message = generateResultMessage(
        limitedResults.length,
        searchResults.length,
        params.query,
      );

      void logger.debug("WebSearchTool execution completed", {
        query: params.query,
        totalResults: searchResults.length,
        returnedResults: limitedResults.length,
      });

      return {
        success: true,
        data: {
          results: limitedResults,
          query: params.query,
          resultCount: limitedResults.length,
          message,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          query: params.query,
          region: params.region || "us-en",
        },
      };
    } catch (error) {
      void logger.error("WebSearchTool execution failed", {
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ToolError) {
        return {
          success: false,
          error: error.toUserMessage(),
          metadata: {
            executionTime: Date.now() - startTime,
            errorCategory: error.category,
          },
        };
      }

      // Handle rate limiting errors
      if (
        error instanceof Error &&
        (error.message.includes("rate limit") ||
          error.message.includes("429") ||
          error.message.includes("too many requests"))
      ) {
        return {
          success: false,
          error:
            "Search rate limit exceeded. Please wait a moment before trying again.",
          metadata: {
            executionTime: Date.now() - startTime,
            errorCategory: ToolErrorCategory.RATE_LIMIT_EXCEEDED,
          },
        };
      }

      // Handle network errors
      if (
        error instanceof Error &&
        (error.message.includes("network") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ETIMEDOUT"))
      ) {
        return {
          success: false,
          error:
            "Unable to connect to search service. Please check your internet connection and try again.",
          metadata: {
            executionTime: Date.now() - startTime,
            errorCategory: ToolErrorCategory.NETWORK_ERROR,
          },
        };
      }

      return {
        success: false,
        error: context.formatError(error),
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Perform a DuckDuckGo search and return formatted results
 */
async function performSearch(
  query: string,
  region: string,
): Promise<SearchResultItem[]> {
  try {
    void logger.warn("🔍 performSearch called", { query, region });

    // Use our custom DuckDuckGo implementation that works in React Native
    const { search, SafeSearchType } = await import("@/utils/duckduckgo");

    void logger.warn("📦 DuckDuckGo module imported, starting search");

    // Perform the search
    const searchResults = await search(query, {
      safeSearch: SafeSearchType.MODERATE,
      locale: region,
    });

    void logger.warn("✅ Search completed", {
      resultCount: searchResults.results.length,
      noResults: searchResults.noResults,
    });

    // Map results to our format
    void logger.warn("🗺️ Mapping search results", {
      resultCount: searchResults.results.length,
    });

    const formattedResults: SearchResultItem[] = searchResults.results.map(
      (result, index) => {
        void logger.warn(`📋 Formatting result ${index}`, {
          title: result.title,
          titleType: typeof result.title,
          description: result.description,
          descriptionType: typeof result.description,
          url: result.url,
          hostname: result.hostname,
        });

        return {
          title: cleanText(result.title),
          snippet: cleanSnippet(result.description),
          url: result.url || "",
          hostname: result.hostname || "",
        };
      },
    );

    void logger.warn("✅ Results formatted successfully", {
      count: formattedResults.length,
    });

    return formattedResults;
  } catch (error) {
    void logger.error("DuckDuckGo search failed", {
      query,
      region,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string | undefined): string {
  void logger.warn("🧹 cleanText called", {
    text,
    textType: typeof text,
    textValue: String(text),
  });

  if (!text || typeof text !== "string") {
    void logger.warn("⚠️ cleanText: text is empty or not a string");
    return "";
  }

  try {
    const cleaned = text
      // Remove excessive whitespace
      .replace(/\s+/g, " ")
      // Remove HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Trim
      .trim();

    void logger.warn("✅ cleanText completed", {
      original: text.substring(0, 30),
      cleaned: cleaned.substring(0, 30),
    });

    return cleaned;
  } catch (error) {
    void logger.error("❌ Error in cleanText", {
      error: error instanceof Error ? error.message : String(error),
      text: String(text),
    });
    throw error;
  }
}

/**
 * Clean and truncate snippet text
 */
function cleanSnippet(snippet: string | undefined): string {
  void logger.warn("✂️ cleanSnippet called", {
    snippet,
    snippetType: typeof snippet,
  });

  if (!snippet || typeof snippet !== "string") {
    void logger.warn("⚠️ cleanSnippet: snippet is empty or not a string");
    return "";
  }

  const cleaned = cleanText(snippet);

  // Truncate to reasonable length (300 chars) to reduce token usage
  if (cleaned.length > 300) {
    return `${cleaned.substring(0, 297)}...`;
  }

  return cleaned;
}

/**
 * Generate a user-friendly result message
 */
function generateResultMessage(
  returnedCount: number,
  totalCount: number,
  query: string,
): string {
  if (returnedCount === 0) {
    return `No search results found for "${query}".`;
  }

  if (returnedCount < totalCount) {
    return `Found ${totalCount} results for "${query}", showing top ${returnedCount}.`;
  }

  return `Found ${returnedCount} results for "${query}".`;
}
