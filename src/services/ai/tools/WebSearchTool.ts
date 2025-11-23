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
      "REQUIRED: The search query string to look up on the web using SearXNG. Example: 'Dune 2024 release date' or 'best sci-fi movies 2024'",
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
      "Optional: Language for search results (e.g., 'en', 'de', 'fr'). Defaults to 'en'",
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
 * WebSearchTool - Search the web using SearXNG
 *
 * This tool allows the LLM to search the web for general information,
 * release dates, reviews, media details, and other publicly available
 * information using SearXNG, a privacy-respecting metasearch engine.
 *
 * @example
 * ```typescript
 * // Search for movie information
 * const result = await execute({
 *   query: 'Dune 2024 release date',
 *   limit: 5
 * });
 *
 * // Search with specific language
 * const result = await execute({
 *   query: 'best sci-fi movies 2024',
 *   limit: 10,
 *   region: 'en'
 * });
 * ```
 */
export const webSearchTool: ToolDefinition<WebSearchParams, WebSearchResult> = {
  name: "search_web",
  description:
    "Search the web using SearXNG for current information. REQUIRED PARAMETER: 'query' - the search terms to look up. Use this tool when you need: release dates, reviews, cast information, ratings, current events, or any information not in your knowledge base. Always provide a specific search query string.",
  parameters: webSearchParamsSchema,

  async execute(params: WebSearchParams): Promise<ToolResult<WebSearchResult>> {
    const startTime = Date.now();
    const context = ToolContext.getInstance();

    try {
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
        params.region || "en",
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
            language: params.region || "en",
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
          language: params.region || "en",
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
 * Perform a SearXNG search and return formatted results
 */
async function performSearch(
  query: string,
  language: string,
): Promise<SearchResultItem[]> {
  try {
    // Use our SearXNG implementation
    const { search, SafeSearchType } = await import("@/utils/searxng");

    // Perform the search
    const searchResults = await search(query, {
      safeSearch: SafeSearchType.MODERATE,
      language,
      pageSize: 10,
    });

    // Map results to our format
    const formattedResults: SearchResultItem[] = searchResults.results.map(
      (result) => {
        // Extract hostname from URL
        let hostname = "";
        try {
          const url = new URL(result.url);
          hostname = url.hostname;
        } catch {
          hostname = "";
        }

        return {
          title: cleanText(result.title),
          snippet: cleanSnippet(result.description),
          url: result.url || "",
          hostname,
        };
      },
    );

    return formattedResults;
  } catch (error) {
    void logger.error("SearXNG search failed", {
      query,
      language,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string | undefined): string {
  if (!text || typeof text !== "string") {
    return "";
  }

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

  return cleaned;
}

/**
 * Clean and truncate snippet text
 */
function cleanSnippet(snippet: string | undefined): string {
  if (!snippet || typeof snippet !== "string") {
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
