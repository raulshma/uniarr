import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./types";
import { ToolError, mediaTypeSchema } from "./types";
import { ToolContext } from "./ToolContext";
import type { UnifiedSearchResult } from "@/models/search.types";
import { logger } from "@/services/logger/LoggerService";

/**
 * Parameter schema for the UnifiedSearchTool.
 * Defines the inputs the LLM can provide when searching for media.
 */
const unifiedSearchParamsSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe("Search query (movie title, TV show name, etc.)"),
  mediaType: mediaTypeSchema
    .optional()
    .describe("Type of media to search for (series, movie, music)"),
  serviceIds: z
    .array(z.string())
    .optional()
    .describe("Specific service IDs to search (if not provided, searches all)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Maximum number of results to return"),
});

/**
 * Type for the tool parameters
 */
type UnifiedSearchParams = z.infer<typeof unifiedSearchParamsSchema>;

/**
 * Formatted search result for LLM consumption
 */
interface FormattedSearchResult {
  title: string;
  year?: number;
  overview?: string;
  mediaType: string;
  serviceName: string;
  isInLibrary: boolean;
  isAvailable?: boolean;
  isRequested?: boolean;
  rating?: number;
  posterUrl?: string;
  externalIds?: {
    tmdbId?: number;
    tvdbId?: number;
    imdbId?: string;
  };
}

/**
 * Result data structure for search results
 */
interface UnifiedSearchResultData {
  results: FormattedSearchResult[];
  totalFound: number;
  searchedServices: string[];
  errors?: string[];
}

/**
 * Format a search result for LLM consumption.
 * Extracts relevant fields and indicates library/availability status.
 *
 * @param result - Raw search result from UnifiedSearchService
 * @returns Formatted result with key information
 */
function formatSearchResult(
  result: UnifiedSearchResult,
): FormattedSearchResult {
  return {
    title: result.title,
    year: result.year,
    overview: result.overview
      ? result.overview.length > 200
        ? `${result.overview.substring(0, 200)}...`
        : result.overview
      : undefined,
    mediaType: result.mediaType,
    serviceName: result.serviceName,
    isInLibrary: result.isInLibrary ?? false,
    isAvailable: result.isAvailable,
    isRequested: result.isRequested,
    rating: result.rating,
    posterUrl: result.posterUrl,
    externalIds: result.externalIds
      ? {
          tmdbId: result.externalIds.tmdbId,
          tvdbId: result.externalIds.tvdbId,
          imdbId: result.externalIds.imdbId,
        }
      : undefined,
  };
}

/**
 * Execute the unified search operation.
 * Searches for media across configured services using the UnifiedSearchService.
 *
 * @param params - Search parameters from the LLM
 * @returns Tool result with search results or error
 */
async function executeUnifiedSearch(
  params: UnifiedSearchParams,
): Promise<ToolResult<UnifiedSearchResultData>> {
  const startTime = Date.now();
  const context = ToolContext.getInstance();
  const searchService = context.getSearchService();

  try {
    void logger.debug("UnifiedSearchTool: Starting search", {
      query: params.query,
      mediaType: params.mediaType,
      serviceIds: params.serviceIds,
      limit: params.limit,
    });

    // Build search options
    const searchOptions = {
      serviceIds: params.serviceIds,
      mediaTypes: params.mediaType ? [params.mediaType] : undefined,
      limitPerService: params.limit,
    };

    // Execute search
    const response = await searchService.search(params.query, searchOptions);

    void logger.debug("UnifiedSearchTool: Search completed", {
      resultCount: response.results.length,
      errorCount: response.errors.length,
      durationMs: response.durationMs,
    });

    // Check if we have any results
    if (response.results.length === 0) {
      // Check if there were errors
      if (response.errors.length > 0) {
        const errorMessages = response.errors.map(
          (err) => `${err.serviceType}: ${err.message}`,
        );

        void logger.warn(
          "UnifiedSearchTool: Search returned no results with errors",
          {
            query: params.query,
            errorCount: response.errors.length,
          },
        );

        return {
          success: false,
          error: `Search failed: ${errorMessages.join("; ")}. Please check your service configurations and try again.`,
          metadata: {
            executionTime: Date.now() - startTime,
            serviceType: "unified_search",
          },
        };
      }

      // No results and no errors - provide helpful suggestions
      void logger.info("UnifiedSearchTool: Search returned no results", {
        query: params.query,
        mediaType: params.mediaType,
      });

      const suggestions: string[] = [];
      suggestions.push("No results found for your search.");

      // Provide suggestions based on the query
      if (params.query.length < 3) {
        suggestions.push(
          "Try using a longer search term (at least 3 characters).",
        );
      } else {
        suggestions.push("Try:");
        suggestions.push("- Using different keywords or spelling");
        suggestions.push("- Removing year or extra details");
        suggestions.push(
          "- Searching for the original title if it's a foreign film/show",
        );
        if (params.mediaType) {
          suggestions.push(
            `- Searching without the media type filter (currently: ${params.mediaType})`,
          );
        }
      }

      return {
        success: true,
        data: {
          results: [],
          totalFound: 0,
          searchedServices: [],
          errors: [suggestions.join(" ")],
        },
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "unified_search",
        },
      };
    }

    // Limit results to the requested amount
    const limitedResults = response.results.slice(0, params.limit);

    // Format results for LLM consumption
    const formattedResults = limitedResults.map(formatSearchResult);

    // Get list of services that were searched
    const searchedServices = Array.from(
      new Set(response.results.map((r) => r.serviceName)),
    );

    // Format any errors as warnings
    const errorMessages =
      response.errors.length > 0
        ? response.errors.map((err) => `${err.serviceType}: ${err.message}`)
        : undefined;

    void logger.info("UnifiedSearchTool: Returning formatted results", {
      formattedCount: formattedResults.length,
      inLibraryCount: formattedResults.filter((r) => r.isInLibrary).length,
      availableCount: formattedResults.filter((r) => r.isAvailable).length,
      requestedCount: formattedResults.filter((r) => r.isRequested).length,
    });

    return {
      success: true,
      data: {
        results: formattedResults,
        totalFound: response.results.length,
        searchedServices,
        errors: errorMessages,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        serviceType: "unified_search",
      },
    };
  } catch (error) {
    void logger.error("UnifiedSearchTool: Search failed", {
      query: params.query,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle known error types
    if (error instanceof ToolError) {
      return {
        success: false,
        error: error.toUserMessage(),
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "unified_search",
        },
      };
    }

    // Handle validation errors (e.g., query too short)
    if (error instanceof Error && error.message.includes("validation")) {
      return {
        success: false,
        error: `Invalid search parameters: ${error.message}. Please provide a search query with at least 2 characters.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "unified_search",
        },
      };
    }

    // Handle network/timeout errors
    if (
      error instanceof Error &&
      (error.message.includes("timeout") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED"))
    ) {
      return {
        success: false,
        error: `Search failed due to network issues: ${error.message}. Please check your internet connection and ensure your services are running.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "unified_search",
        },
      };
    }

    // Handle generic errors with helpful message
    return {
      success: false,
      error: `${context.formatError(error)} If the problem persists, try searching with different terms or check your service configurations.`,
      metadata: {
        executionTime: Date.now() - startTime,
        serviceType: "unified_search",
      },
    };
  }
}

/**
 * UnifiedSearchTool definition.
 * Enables the LLM to search for media across all configured services.
 *
 * @example
 * LLM: "Search for Breaking Bad"
 * Tool call: { query: "Breaking Bad", limit: 10 }
 *
 * @example
 * LLM: "Find movies about space"
 * Tool call: { query: "space", mediaType: "movie", limit: 10 }
 */
export const unifiedSearchTool: ToolDefinition<
  UnifiedSearchParams,
  UnifiedSearchResultData
> = {
  name: "search_media",
  description:
    "Search for movies, TV shows, or music across all configured media services. Returns results from Sonarr, Radarr, Jellyseerr, Jellyfin, and other configured services. Use this when the user wants to find or discover media content.",
  parameters: unifiedSearchParamsSchema,
  execute: executeUnifiedSearch,
};
