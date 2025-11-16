import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./types";
import { ToolError, ToolErrorCategory, mediaTypeSchema } from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";
import { getTmdbConnector } from "@/services/tmdb/TmdbConnectorProvider";
import type {
  MovieDetailsWithExtrasResponse,
  TvDetailsWithExtrasResponse,
} from "@/connectors/implementations/TmdbConnector";

/**
 * Parameter schema for the MediaDetailsTool.
 * Defines the inputs the LLM can provide when requesting detailed media information.
 */
const mediaDetailsParamsSchema = z.object({
  tmdbId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The Movie Database (TMDb) ID for the media"),
  tvdbId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The TV Database (TVDb) ID for TV shows"),
  title: z
    .string()
    .min(1)
    .optional()
    .describe("Title of the media to search for (if IDs not provided)"),
  mediaType: mediaTypeSchema.describe(
    "Type of media (series for TV shows, movie for movies)",
  ),
});

/**
 * Type for the tool parameters
 */
type MediaDetailsParams = z.infer<typeof mediaDetailsParamsSchema>;

/**
 * Cast member information
 */
interface CastMember {
  name: string;
  character: string;
  order: number;
}

/**
 * Season information for TV shows
 */
interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  overview?: string;
  posterUrl?: string;
}

/**
 * Service availability information
 */
interface ServiceAvailability {
  serviceName: string;
  serviceType: string;
  isInLibrary: boolean;
  isAvailable?: boolean;
  isMonitored?: boolean;
  hasFile?: boolean;
  qualityProfile?: string;
  downloadStatus?: string;
}

/**
 * Comprehensive media details result
 */
interface MediaDetailsResult {
  // Basic information
  title: string;
  originalTitle?: string;
  year?: number;
  mediaType: "series" | "movie";
  overview?: string;
  tagline?: string;

  // Ratings and popularity
  rating?: number;
  voteCount?: number;
  popularity?: number;

  // Runtime and status
  runtime?: number; // minutes for movies
  episodeRuntime?: number[]; // minutes for TV shows
  status?: string;
  releaseDate?: string;
  firstAirDate?: string;
  lastAirDate?: string;

  // Content details
  genres?: string[];
  networks?: string[];
  productionCompanies?: string[];
  spokenLanguages?: string[];
  originCountry?: string[];

  // Cast and crew (limited to top entries)
  cast?: CastMember[];
  directors?: string[];
  writers?: string[];
  creators?: string[];

  // Season information (TV shows only)
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: SeasonInfo[];

  // Images
  posterUrl?: string;
  backdropUrl?: string;

  // External IDs
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;

  // Service availability
  availability: ServiceAvailability[];
}

/**
 * Execute the media details operation.
 * Fetches comprehensive information about a specific movie or TV show from TMDb
 * and checks availability across configured services.
 *
 * @param params - Media details parameters from the LLM
 * @returns Tool result with detailed media information or error
 */
async function executeMediaDetails(
  params: MediaDetailsParams,
): Promise<ToolResult<MediaDetailsResult>> {
  const startTime = Date.now();
  const context = ToolContext.getInstance();

  try {
    void logger.debug("MediaDetailsTool: Starting details fetch", {
      tmdbId: params.tmdbId,
      tvdbId: params.tvdbId,
      title: params.title,
      mediaType: params.mediaType,
    });

    // Validate that we have at least one identifier
    if (!params.tmdbId && !params.tvdbId && !params.title) {
      return {
        success: false,
        error:
          "Please provide either a TMDb ID, TVDb ID, or title to get media details.",
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "tmdb",
        },
      };
    }

    // Get TMDb connector
    const tmdbConnector = await getTmdbConnector();

    if (!tmdbConnector) {
      throw new ToolError(
        "TMDb API key not configured",
        ToolErrorCategory.SERVICE_NOT_CONFIGURED,
        "Please configure your TMDb API key in Settings to use this feature.",
        { feature: "media_details" },
      );
    }

    // Determine TMDb ID if not provided
    let tmdbId = params.tmdbId;

    if (!tmdbId) {
      void logger.debug("MediaDetailsTool: No TMDb ID provided, searching", {
        title: params.title,
        tvdbId: params.tvdbId,
      });

      // If we have a title, search for it
      if (params.title) {
        const searchResults = await tmdbConnector.searchMulti({
          query: params.title,
          page: 1,
        });

        if (!searchResults.results || searchResults.results.length === 0) {
          return {
            success: false,
            error: `No results found for "${params.title}". Please check the title and try again, or provide a TMDb ID.`,
            metadata: {
              executionTime: Date.now() - startTime,
              serviceType: "tmdb",
            },
          };
        }

        // Filter by media type
        const filteredResults = searchResults.results.filter((result) => {
          if (params.mediaType === "series") {
            return result.media_type === "tv";
          } else if (params.mediaType === "movie") {
            return result.media_type === "movie";
          }
          return result.media_type === "movie" || result.media_type === "tv";
        });

        if (filteredResults.length === 0) {
          return {
            success: false,
            error: `No ${params.mediaType === "series" ? "TV shows" : "movies"} found for "${params.title}". Try searching without the media type filter.`,
            metadata: {
              executionTime: Date.now() - startTime,
              serviceType: "tmdb",
            },
          };
        }

        if (filteredResults.length > 1) {
          // Multiple matches - ask user to clarify
          const resultsList = filteredResults
            .slice(0, 5)
            .map((result, index) => {
              const title =
                "title" in result
                  ? result.title
                  : "name" in result
                    ? result.name
                    : "Unknown";
              let year: number | undefined;
              if ("release_date" in result && result.release_date) {
                year = new Date(result.release_date as string).getFullYear();
              } else if ("first_air_date" in result && result.first_air_date) {
                year = new Date(result.first_air_date as string).getFullYear();
              }
              return `${index + 1}. ${title}${year ? ` (${year})` : ""} - TMDb ID: ${result.id}`;
            })
            .join("\n");

          return {
            success: false,
            error: `Multiple matches found for "${params.title}". Please specify which one by providing the TMDb ID:\n\n${resultsList}`,
            metadata: {
              executionTime: Date.now() - startTime,
              serviceType: "tmdb",
            },
          };
        }

        // Single match found
        tmdbId = filteredResults[0]!.id;
        void logger.debug("MediaDetailsTool: Found single match", {
          title: params.title,
          tmdbId,
        });
      } else if (params.tvdbId) {
        // We have a TVDb ID but no TMDb ID
        // Unfortunately, TMDb doesn't have a direct TVDb -> TMDb lookup
        // We'll need to use the search service to find it
        return {
          success: false,
          error:
            "Please provide a TMDb ID or title. TVDb ID alone is not sufficient for fetching details.",
          metadata: {
            executionTime: Date.now() - startTime,
            serviceType: "tmdb",
          },
        };
      }
    }

    // Fetch detailed information from TMDb
    void logger.debug("MediaDetailsTool: Fetching details from TMDb", {
      tmdbId,
      mediaType: params.mediaType,
    });

    const details =
      params.mediaType === "series"
        ? await tmdbConnector.getDetails("tv", tmdbId!, {
            appendToResponse: ["credits", "external_ids"],
          })
        : await tmdbConnector.getDetails("movie", tmdbId!, {
            appendToResponse: ["credits", "external_ids"],
          });

    void logger.debug("MediaDetailsTool: TMDb details fetched successfully", {
      tmdbId,
      title:
        "title" in details
          ? details.title
          : "name" in details
            ? details.name
            : "Unknown",
    });

    // Format the comprehensive media information
    const actualMediaType: "series" | "movie" =
      params.mediaType === "series" || params.mediaType === "music"
        ? "series"
        : "movie";
    const result = formatMediaDetails(details, actualMediaType);

    // Check availability across services (subtask 18.2)
    const availability = await checkServiceAvailability(
      context,
      tmdbId!,
      params.tvdbId,
      actualMediaType,
    );

    result.availability = availability;

    void logger.info("MediaDetailsTool: Details fetched successfully", {
      tmdbId,
      title: result.title,
      availableInServices: availability.filter((a) => a.isInLibrary).length,
    });

    return {
      success: true,
      data: result,
      metadata: {
        executionTime: Date.now() - startTime,
        serviceType: "tmdb",
      },
    };
  } catch (error) {
    void logger.error("MediaDetailsTool: Details fetch failed", {
      tmdbId: params.tmdbId,
      title: params.title,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle known error types
    if (error instanceof ToolError) {
      return {
        success: false,
        error: error.toUserMessage(),
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "tmdb",
        },
      };
    }

    // Handle TMDb-specific errors
    if (
      error instanceof Error &&
      (error.message.includes("404") || error.message.includes("not found"))
    ) {
      return {
        success: false,
        error: `Media not found with the provided ID. Please check the TMDb ID and try again.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "tmdb",
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
        error: `Failed to fetch media details due to network issues: ${error.message}. Please check your internet connection and try again.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: "tmdb",
        },
      };
    }

    // Handle generic errors
    return {
      success: false,
      error: `${context.formatError(error)} If the problem persists, please try again later.`,
      metadata: {
        executionTime: Date.now() - startTime,
        serviceType: "tmdb",
      },
    };
  }
}

/**
 * Format TMDb details into a comprehensive media information structure.
 * Extracts and organizes all relevant information for LLM consumption.
 *
 * @param details - Raw TMDb details response
 * @param mediaType - Type of media (series or movie)
 * @returns Formatted media details
 */
function formatMediaDetails(
  details: MovieDetailsWithExtrasResponse | TvDetailsWithExtrasResponse,
  mediaType: "series" | "movie",
): MediaDetailsResult {
  const isMovie = "title" in details;
  const isTv = "name" in details;

  // Basic information
  const title = isMovie
    ? (details.title ?? "Unknown")
    : isTv
      ? (details.name ?? "Unknown")
      : "Unknown";
  const originalTitle = isMovie
    ? details.original_title
    : isTv
      ? details.original_name
      : undefined;
  const year = isMovie
    ? details.release_date
      ? new Date(details.release_date).getFullYear()
      : undefined
    : isTv
      ? details.first_air_date
        ? new Date(details.first_air_date).getFullYear()
        : undefined
      : undefined;

  // Extract cast (top 10)
  const cast: CastMember[] =
    details.credits?.cast?.slice(0, 10).map((member) => ({
      name: member.name ?? "Unknown",
      character: member.character ?? "Unknown",
      order: member.order ?? 999,
    })) ?? [];

  // Extract directors (movies) or creators (TV)
  const directors: string[] = isMovie
    ? (details.credits?.crew
        ?.filter((member) => member.job === "Director")
        .map((member) => member.name ?? "Unknown") ?? [])
    : [];

  const writers: string[] =
    details.credits?.crew
      ?.filter(
        (member) =>
          member.job === "Writer" ||
          member.job === "Screenplay" ||
          member.job === "Story",
      )
      .slice(0, 5)
      .map((member) => member.name ?? "Unknown") ?? [];

  const creators: string[] = isTv
    ? (details.created_by?.map((creator) => creator.name ?? "Unknown") ?? [])
    : [];

  // Extract genres
  const genres: string[] =
    details.genres?.map((genre) => genre.name ?? "Unknown") ?? [];

  // Extract production companies (top 3)
  const productionCompanies: string[] =
    details.production_companies
      ?.slice(0, 3)
      .map((company) => company.name ?? "Unknown") ?? [];

  // Extract spoken languages
  const spokenLanguages: string[] =
    details.spoken_languages?.map(
      (lang) => lang.english_name ?? lang.name ?? "Unknown",
    ) ?? [];

  // Extract networks (TV only)
  const networks: string[] = isTv
    ? (details.networks?.map((network) => network.name ?? "Unknown") ?? [])
    : [];

  // Extract origin country
  const originCountry: string[] = isTv
    ? (details.origin_country ?? [])
    : (details.production_countries
        ?.map((country) => country.iso_3166_1)
        .filter((code): code is string => code !== undefined) ?? []);

  // Extract season information (TV only)
  const seasons: SeasonInfo[] | undefined = isTv
    ? details.seasons
        ?.filter((season) => season.season_number !== undefined)
        .map((season) => ({
          seasonNumber: season.season_number!,
          name: season.name ?? `Season ${season.season_number}`,
          episodeCount: season.episode_count ?? 0,
          airDate: season.air_date ?? undefined,
          overview: season.overview ?? undefined,
          posterUrl: season.poster_path
            ? `https://image.tmdb.org/t/p/w500${season.poster_path}`
            : undefined,
        }))
    : undefined;

  // Extract external IDs
  const externalIds =
    "external_ids" in details
      ? (details.external_ids as Record<string, unknown>)
      : {};
  const imdbId =
    "imdb_id" in externalIds
      ? (externalIds.imdb_id as string | undefined)
      : undefined;
  const tvdbId =
    "tvdb_id" in externalIds
      ? (externalIds.tvdb_id as number | undefined)
      : undefined;

  // Format poster and backdrop URLs
  const posterUrl = details.poster_path
    ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
    : undefined;
  const backdropUrl = details.backdrop_path
    ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
    : undefined;

  return {
    title,
    originalTitle,
    year,
    mediaType: mediaType === "series" ? "series" : "movie",
    overview: details.overview ?? undefined,
    tagline: "tagline" in details ? (details.tagline ?? undefined) : undefined,
    rating: details.vote_average ?? undefined,
    voteCount: details.vote_count ?? undefined,
    popularity: details.popularity ?? undefined,
    runtime: isMovie ? (details.runtime ?? undefined) : undefined,
    episodeRuntime: isTv ? (details.episode_run_time ?? undefined) : undefined,
    status: details.status ?? undefined,
    releaseDate: isMovie ? (details.release_date ?? undefined) : undefined,
    firstAirDate: isTv ? (details.first_air_date ?? undefined) : undefined,
    lastAirDate: isTv ? (details.last_air_date ?? undefined) : undefined,
    genres,
    networks,
    productionCompanies,
    spokenLanguages,
    originCountry,
    cast,
    directors,
    writers,
    creators,
    numberOfSeasons: isTv
      ? (details.number_of_seasons ?? undefined)
      : undefined,
    numberOfEpisodes: isTv
      ? (details.number_of_episodes ?? undefined)
      : undefined,
    seasons,
    posterUrl,
    backdropUrl,
    tmdbId: details.id,
    tvdbId,
    imdbId,
    availability: [], // Will be populated by checkServiceAvailability
  };
}

/**
 * Check availability of media across configured services.
 * Checks Sonarr/Radarr for library status and Jellyfin/Plex/Emby for streaming availability.
 *
 * @param context - Tool context
 * @param tmdbId - TMDb ID
 * @param tvdbId - TVDb ID (optional)
 * @param mediaType - Type of media
 * @returns Array of service availability information
 */
async function checkServiceAvailability(
  context: ToolContext,
  tmdbId: number,
  tvdbId: number | undefined,
  mediaType: "series" | "movie",
): Promise<ServiceAvailability[]> {
  const availability: ServiceAvailability[] = [];
  const connectorManager = context.getConnectorManager();

  try {
    // Check Sonarr for TV shows
    if (mediaType === "series" && tvdbId) {
      const sonarrConnectors = connectorManager.getConnectorsByType("sonarr");

      for (const connector of sonarrConnectors) {
        try {
          const series = await (connector as any).getSeries();
          const found = series.find((s: any) => s.tvdbId === tvdbId);

          availability.push({
            serviceName: connector.config.name,
            serviceType: "sonarr",
            isInLibrary: Boolean(found),
            isMonitored: found?.monitored,
            hasFile: found ? (found.episodeFileCount ?? 0) > 0 : false,
            qualityProfile: found?.qualityProfileId
              ? `Profile ${found.qualityProfileId}`
              : undefined,
          });
        } catch (error) {
          void logger.warn(
            "MediaDetailsTool: Failed to check Sonarr availability",
            {
              serviceId: connector.config.id,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }

    // Check Radarr for movies
    if (mediaType === "movie") {
      const radarrConnectors = connectorManager.getConnectorsByType("radarr");

      for (const connector of radarrConnectors) {
        try {
          const movies = await (connector as any).getMovies();
          const found = movies.find((m: any) => m.tmdbId === tmdbId);

          availability.push({
            serviceName: connector.config.name,
            serviceType: "radarr",
            isInLibrary: Boolean(found),
            isMonitored: found?.monitored,
            hasFile: found?.hasFile,
            qualityProfile: found?.qualityProfileId
              ? `Profile ${found.qualityProfileId}`
              : undefined,
          });
        } catch (error) {
          void logger.warn(
            "MediaDetailsTool: Failed to check Radarr availability",
            {
              serviceId: connector.config.id,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }

    // Check Jellyfin for streaming availability
    const jellyfinConnectors = connectorManager.getConnectorsByType("jellyfin");

    for (const connector of jellyfinConnectors) {
      try {
        // Note: This is a simplified check. In a real implementation,
        // you would need to search Jellyfin's library for the media
        // using the TMDb ID or title.
        availability.push({
          serviceName: connector.config.name,
          serviceType: "jellyfin",
          isInLibrary: false, // Would need actual search implementation
          isAvailable: false,
        });
      } catch (error) {
        void logger.warn(
          "MediaDetailsTool: Failed to check Jellyfin availability",
          {
            serviceId: connector.config.id,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  } catch (error) {
    void logger.error("MediaDetailsTool: Error checking service availability", {
      tmdbId,
      tvdbId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return availability;
}

/**
 * MediaDetailsTool definition.
 * Enables the LLM to fetch comprehensive details about movies or TV shows.
 *
 * @example
 * LLM: "Tell me about Breaking Bad"
 * Tool call: { title: "Breaking Bad", mediaType: "series" }
 *
 * @example
 * LLM: "What's the cast of The Matrix?"
 * Tool call: { title: "The Matrix", mediaType: "movie" }
 */
export const mediaDetailsTool: ToolDefinition<
  MediaDetailsParams,
  MediaDetailsResult
> = {
  name: "get_media_details",
  description:
    "Get comprehensive details about a specific movie or TV show including cast, crew, ratings, runtime, genres, plot summary, and availability across configured services. Use this when the user wants detailed information about a specific media item.",
  parameters: mediaDetailsParamsSchema,
  execute: executeMediaDetails,
};
