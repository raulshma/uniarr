import { z } from "zod";
import type {
  ToolDefinition,
  ToolResult,
  ToolServiceType,
  ToolMediaType,
} from "./types";
import {
  ToolError,
  ToolErrorCategory,
  serviceTypeSchema,
  mediaTypeSchema,
} from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";
import type { Series } from "@/models/media.types";
import type { Movie } from "@/models/movie.types";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";

/**
 * Parameters for the MediaLibraryTool
 */
const mediaLibraryParamsSchema = z.object({
  serviceType: serviceTypeSchema
    .optional()
    .describe(
      "Type of service to retrieve library from (sonarr, radarr, jellyfin, etc.)",
    ),
  mediaType: mediaTypeSchema
    .optional()
    .describe("Type of media to filter by (series, movie, music)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of items to return (default: 10, max: 50)"),
  sortBy: z
    .enum(["title", "added", "releaseDate"])
    .optional()
    .default("title")
    .describe("Sort results by title, added date, or release date"),
  status: z
    .enum(["monitored", "unmonitored", "missing", "available", "all"])
    .optional()
    .default("all")
    .describe(
      "Filter by status: monitored (actively tracked), unmonitored (not tracked), missing (no files), available (has files), or all",
    ),
  qualityProfileId: z
    .number()
    .optional()
    .describe("Filter by quality profile ID"),
  tagIds: z
    .array(z.number())
    .optional()
    .describe("Filter by tag IDs (items must have at least one of these tags)"),
});

type MediaLibraryParams = z.infer<typeof mediaLibraryParamsSchema>;

/**
 * Unified media item structure for tool results
 */
interface MediaLibraryItem {
  id: number;
  title: string;
  year?: number;
  mediaType: ToolMediaType;
  status: string;
  monitored: boolean;
  hasFile?: boolean;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  added?: string;
  releaseDate?: string;
  serviceId: string;
  serviceName: string;
  serviceType: ToolServiceType;
  qualityProfileId?: number;
  tags?: number[];
}

/**
 * Result data structure for MediaLibraryTool
 */
interface MediaLibraryResult {
  items: MediaLibraryItem[];
  totalCount: number;
  serviceTypes: string[];
  message: string;
}

/**
 * MediaLibraryTool - Retrieve media items from the user's library
 *
 * This tool allows the LLM to query the user's media library across
 * configured services (Sonarr, Radarr, Jellyfin, etc.) and retrieve
 * information about movies, TV shows, and music.
 *
 * @example
 * ```typescript
 * // Get all movies from Radarr
 * const result = await execute({
 *   serviceType: 'radarr',
 *   mediaType: 'movie',
 *   limit: 20
 * });
 *
 * // Get recently added TV shows
 * const result = await execute({
 *   mediaType: 'series',
 *   sortBy: 'added',
 *   limit: 10
 * });
 * ```
 */
export const mediaLibraryTool: ToolDefinition<
  MediaLibraryParams,
  MediaLibraryResult
> = {
  name: "get_media_library",
  description:
    "Retrieve media items from the user's library. Can filter by service type (sonarr, radarr, etc.) and media type (series, movie, music). Returns information about movies, TV shows, or music in the library including title, year, status, and availability.",
  parameters: mediaLibraryParamsSchema,

  async execute(
    params: MediaLibraryParams,
  ): Promise<ToolResult<MediaLibraryResult>> {
    const startTime = Date.now();
    const context = ToolContext.getInstance();
    const connectorManager = context.getConnectorManager();

    try {
      // Collect all media items from relevant connectors
      const allItems: MediaLibraryItem[] = [];
      const serviceTypes = new Set<string>();

      // Determine which connectors to query based on serviceType and mediaType
      const connectorsToQuery = getConnectorsToQuery(
        connectorManager,
        params.serviceType,
        params.mediaType,
      );

      if (connectorsToQuery.length === 0) {
        // No connectors configured
        const serviceTypeHint = params.serviceType
          ? params.serviceType
          : params.mediaType === "series"
            ? "Sonarr"
            : params.mediaType === "movie"
              ? "Radarr"
              : "media management service";

        throw new ToolError(
          `No ${serviceTypeHint} services configured`,
          ToolErrorCategory.SERVICE_NOT_CONFIGURED,
          `Please add a ${serviceTypeHint} service in Settings > Services to view your library.`,
          {
            requestedServiceType: params.serviceType,
            requestedMediaType: params.mediaType,
          },
        );
      }

      // Query each connector
      // NOTE: Currently fetches entire library then filters in-memory.
      // For large libraries (1000+ items), this could be optimized with
      // server-side pagination/filtering in future connector updates.
      await Promise.all(
        connectorsToQuery.map(async (connectorInfo) => {
          try {
            const items = await fetchLibraryItems(connectorInfo);
            allItems.push(...items);
            serviceTypes.add(connectorInfo.serviceType);
          } catch (error) {
            // Log error but continue with other connectors
            void logger.warn("Failed to fetch library from connector", {
              serviceId: connectorInfo.serviceId,
              serviceType: connectorInfo.serviceType,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );

      if (allItems.length === 0) {
        return {
          success: true,
          data: {
            items: [],
            totalCount: 0,
            serviceTypes: Array.from(serviceTypes),
            message: "No media items found in your library.",
          },
          metadata: {
            executionTime: Date.now() - startTime,
            serviceTypes: Array.from(serviceTypes),
          },
        };
      }

      // Filter by mediaType if specified
      let filteredItems = allItems;
      if (params.mediaType && params.mediaType !== "unknown") {
        filteredItems = allItems.filter(
          (item) => item.mediaType === params.mediaType,
        );
      }

      // Apply advanced filters
      filteredItems = applyAdvancedFilters(filteredItems, params);

      // Sort items
      const sortedItems = sortMediaItems(filteredItems, params.sortBy);

      // Limit results
      const limitedItems = sortedItems.slice(0, params.limit);

      const message = generateResultMessage(
        limitedItems.length,
        filteredItems.length,
        params,
      );

      void logger.debug("MediaLibraryTool execution completed", {
        totalItems: allItems.length,
        filteredItems: filteredItems.length,
        returnedItems: limitedItems.length,
        serviceTypes: Array.from(serviceTypes),
      });

      return {
        success: true,
        data: {
          items: limitedItems,
          totalCount: filteredItems.length,
          serviceTypes: Array.from(serviceTypes),
          message,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          serviceTypes: Array.from(serviceTypes),
        },
      };
    } catch (error) {
      void logger.error("MediaLibraryTool execution failed", {
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

interface ConnectorInfo {
  connector: SonarrConnector | RadarrConnector;
  serviceId: string;
  serviceName: string;
  serviceType: ToolServiceType;
  mediaType: ToolMediaType;
}

/**
 * Determine which connectors to query based on filters
 */
function getConnectorsToQuery(
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  serviceType?: ToolServiceType,
  mediaType?: ToolMediaType,
): ConnectorInfo[] {
  const connectorsToQuery: ConnectorInfo[] = [];

  // If serviceType is specified, only query that type
  if (serviceType) {
    const connectors = connectorManager.getConnectorsByType(serviceType);

    for (const connector of connectors) {
      const connectorMediaType = getMediaTypeForService(serviceType);

      // Skip if mediaType filter doesn't match
      if (
        mediaType &&
        mediaType !== "unknown" &&
        mediaType !== connectorMediaType
      ) {
        continue;
      }

      connectorsToQuery.push({
        connector: connector as SonarrConnector | RadarrConnector,
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        serviceType: serviceType,
        mediaType: connectorMediaType,
      });
    }
  } else {
    // Query all relevant media management services
    const serviceTypesToQuery: ToolServiceType[] = [];

    if (!mediaType || mediaType === "series" || mediaType === "unknown") {
      serviceTypesToQuery.push("sonarr");
    }
    if (!mediaType || mediaType === "movie" || mediaType === "unknown") {
      serviceTypesToQuery.push("radarr");
    }
    if (!mediaType || mediaType === "music" || mediaType === "unknown") {
      serviceTypesToQuery.push("lidarr");
    }

    for (const type of serviceTypesToQuery) {
      const connectors = connectorManager.getConnectorsByType(type);

      for (const connector of connectors) {
        connectorsToQuery.push({
          connector: connector as SonarrConnector | RadarrConnector,
          serviceId: connector.config.id,
          serviceName: connector.config.name,
          serviceType: type,
          mediaType: getMediaTypeForService(type),
        });
      }
    }
  }

  return connectorsToQuery;
}

/**
 * Get the media type for a service type
 */
function getMediaTypeForService(serviceType: ToolServiceType): ToolMediaType {
  switch (serviceType) {
    case "sonarr":
      return "series";
    case "radarr":
      return "movie";
    case "lidarr":
      return "music";
    case "jellyfin":
    case "jellyseerr":
      return "unknown"; // These can have multiple types
    default:
      return "unknown";
  }
}

/**
 * Fetch library items from a connector
 */
async function fetchLibraryItems(
  connectorInfo: ConnectorInfo,
): Promise<MediaLibraryItem[]> {
  const { connector, serviceId, serviceName, serviceType } = connectorInfo;

  if (serviceType === "sonarr") {
    const sonarrConnector = connector as SonarrConnector;
    const series = await sonarrConnector.getSeries();
    return series.map((s) =>
      mapSeriesToMediaItem(s, serviceId, serviceName, serviceType),
    );
  } else if (serviceType === "radarr") {
    const radarrConnector = connector as RadarrConnector;
    const movies = await radarrConnector.getMovies();
    return movies.map((m) =>
      mapMovieToMediaItem(m, serviceId, serviceName, serviceType),
    );
  }

  // Other service types not yet implemented
  return [];
}

/**
 * Map a Series to a MediaLibraryItem
 */
function mapSeriesToMediaItem(
  series: Series,
  serviceId: string,
  serviceName: string,
  serviceType: ToolServiceType,
): MediaLibraryItem {
  return {
    id: series.id,
    title: series.title,
    year: series.year,
    mediaType: "series",
    status: series.status,
    monitored: series.monitored,
    hasFile: (series.episodeFileCount ?? 0) > 0,
    posterUrl: series.posterUrl,
    backdropUrl: series.backdropUrl,
    // Truncate overview to reduce token usage
    overview: series.overview
      ? series.overview.length > 200
        ? `${series.overview.substring(0, 200)}...`
        : series.overview
      : undefined,
    added: series.added,
    releaseDate: series.nextAiring || series.previousAiring,
    serviceId,
    serviceName,
    serviceType,
    qualityProfileId: series.qualityProfileId,
    tags: series.tags,
  };
}

/**
 * Map a Movie to a MediaLibraryItem
 */
function mapMovieToMediaItem(
  movie: Movie,
  serviceId: string,
  serviceName: string,
  serviceType: ToolServiceType,
): MediaLibraryItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    mediaType: "movie",
    status: movie.status ?? "unknown",
    monitored: movie.monitored,
    hasFile: movie.hasFile,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    // Truncate overview to reduce token usage
    overview: movie.overview
      ? movie.overview.length > 200
        ? `${movie.overview.substring(0, 200)}...`
        : movie.overview
      : undefined,
    added: movie.movieFile?.dateAdded,
    releaseDate: movie.releaseDate || movie.inCinemas || movie.digitalRelease,
    serviceId,
    serviceName,
    serviceType,
    qualityProfileId: movie.qualityProfileId,
    tags: movie.tags,
  };
}

/**
 * Apply advanced filters to media items
 */
function applyAdvancedFilters(
  items: MediaLibraryItem[],
  params: MediaLibraryParams,
): MediaLibraryItem[] {
  let filtered = items;

  // Filter by status
  if (params.status && params.status !== "all") {
    filtered = filtered.filter((item) => {
      switch (params.status) {
        case "monitored":
          return item.monitored === true;
        case "unmonitored":
          return item.monitored === false;
        case "missing":
          return item.hasFile === false;
        case "available":
          return item.hasFile === true;
        default:
          return true;
      }
    });
  }

  // Filter by quality profile ID
  if (params.qualityProfileId !== undefined) {
    filtered = filtered.filter(
      (item) => item.qualityProfileId === params.qualityProfileId,
    );
  }

  // Filter by tag IDs (item must have at least one of the specified tags)
  if (params.tagIds && params.tagIds.length > 0) {
    filtered = filtered.filter((item) => {
      if (!item.tags || item.tags.length === 0) {
        return false;
      }
      // Check if item has at least one of the specified tag IDs
      return params.tagIds!.some((tagId) => item.tags!.includes(tagId));
    });
  }

  return filtered;
}

/**
 * Sort media items based on the specified sort field
 */
function sortMediaItems(
  items: MediaLibraryItem[],
  sortBy: "title" | "added" | "releaseDate" = "title",
): MediaLibraryItem[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title);

      case "added": {
        const dateA = a.added ? new Date(a.added).getTime() : 0;
        const dateB = b.added ? new Date(b.added).getTime() : 0;
        return dateB - dateA; // Most recent first
      }

      case "releaseDate": {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateB - dateA; // Most recent first
      }

      default:
        return 0;
    }
  });
}

/**
 * Generate a user-friendly result message
 */
function generateResultMessage(
  returnedCount: number,
  totalCount: number,
  params: MediaLibraryParams,
): string {
  const mediaTypeStr = params.mediaType
    ? params.mediaType === "series"
      ? "TV shows"
      : params.mediaType === "movie"
        ? "movies"
        : params.mediaType
    : "media items";

  if (returnedCount === 0) {
    return `No ${mediaTypeStr} found in your library.`;
  }

  if (returnedCount < totalCount) {
    return `Showing ${returnedCount} of ${totalCount} ${mediaTypeStr} from your library.`;
  }

  return `Found ${totalCount} ${mediaTypeStr} in your library.`;
}
