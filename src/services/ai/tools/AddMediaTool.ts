import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./types";
import { ToolError, ToolErrorCategory } from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { Series } from "@/models/media.types";
import type { Movie } from "@/models/movie.types";

/**
 * Parameter schema for the AddMediaTool.
 * Defines the inputs the LLM can provide when adding media to services.
 */
const addMediaParamsSchema = z.object({
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
    .describe(
      "Title of the media to add (used for search if IDs not provided)",
    ),
  serviceType: z
    .enum(["sonarr", "radarr"])
    .describe(
      "Type of service to add media to (sonarr for TV, radarr for movies)",
    ),
  qualityProfile: z
    .string()
    .optional()
    .describe("Name of quality profile to use (uses default if not specified)"),
  rootFolder: z
    .string()
    .optional()
    .describe("Root folder path to use (uses default if not specified)"),
  monitored: z
    .boolean()
    .default(true)
    .describe("Whether to monitor the media for new releases"),
  searchNow: z
    .boolean()
    .default(false)
    .describe("Whether to immediately search for the media after adding"),
});

/**
 * Type for the tool parameters
 */
type AddMediaParams = z.infer<typeof addMediaParamsSchema>;

/**
 * Result data structure for add media operation
 */
interface AddMediaResult {
  success: boolean;
  title: string;
  year?: number;
  mediaType: "series" | "movie";
  serviceName: string;
  qualityProfile: string;
  rootFolder: string;
  monitored: boolean;
  alreadyExists?: boolean;
  message: string;
}

/**
 * Execute the add media operation.
 * Adds a movie or TV show to the appropriate service (Sonarr or Radarr).
 *
 * @param params - Add media parameters from the LLM
 * @returns Tool result with confirmation or error
 */
async function executeAddMedia(
  params: AddMediaParams,
): Promise<ToolResult<AddMediaResult>> {
  const startTime = Date.now();
  const context = ToolContext.getInstance();
  const connectorManager = context.getConnectorManager();

  try {
    void logger.debug("AddMediaTool: Starting add operation", {
      title: params.title,
      serviceType: params.serviceType,
      tmdbId: params.tmdbId,
      tvdbId: params.tvdbId,
    });

    // Get the appropriate connector
    const connectors = connectorManager.getConnectorsByType(params.serviceType);

    if (connectors.length === 0) {
      throw context.createServiceNotConfiguredError(params.serviceType);
    }

    // Use the first connector of the requested type
    const connector = connectors[0] as SonarrConnector | RadarrConnector;
    const serviceName = connector.config.name;

    void logger.debug("AddMediaTool: Using connector", {
      serviceId: connector.config.id,
      serviceName,
      serviceType: params.serviceType,
    });

    // Determine media type
    const mediaType = params.serviceType === "sonarr" ? "series" : "movie";

    // If IDs not provided, search for the media
    let searchResult: Series | Movie | undefined;

    if (!params.tmdbId && !params.tvdbId) {
      void logger.debug("AddMediaTool: No IDs provided, searching for media", {
        title: params.title,
      });

      const searchResults = await connector.search(params.title);

      if (searchResults.length === 0) {
        return {
          success: false,
          error: `No results found for "${params.title}". Please check the title and try again, or provide a TMDb/TVDb ID.`,
          metadata: {
            executionTime: Date.now() - startTime,
            serviceType: params.serviceType,
          },
        };
      }

      if (searchResults.length > 1) {
        // Multiple matches - ask user to clarify
        const resultsList = searchResults
          .slice(0, 5)
          .map((result: Series | Movie, index: number) => {
            const year = "year" in result ? result.year : undefined;
            return `${index + 1}. ${result.title}${year ? ` (${year})` : ""}`;
          })
          .join("\n");

        return {
          success: false,
          error: `Multiple matches found for "${params.title}". Please specify which one:\n\n${resultsList}\n\nProvide the TMDb ID or TVDb ID for the specific item you want to add.`,
          metadata: {
            executionTime: Date.now() - startTime,
            serviceType: params.serviceType,
          },
        };
      }

      // Single match found
      searchResult = searchResults[0] as Series | Movie;
      void logger.debug("AddMediaTool: Found single match", {
        title: searchResult.title,
        id: searchResult.id,
      });
    }

    // Get quality profiles and root folders
    const [qualityProfiles, rootFolders] = await Promise.all([
      connector.getQualityProfiles(),
      connector.getRootFolders(),
    ]);

    if (qualityProfiles.length === 0) {
      throw new ToolError(
        "No quality profiles configured",
        ToolErrorCategory.SERVICE_NOT_CONFIGURED,
        `Please configure at least one quality profile in ${serviceName} before adding media.`,
        { serviceType: params.serviceType, serviceName },
      );
    }

    if (rootFolders.length === 0) {
      throw new ToolError(
        "No root folders configured",
        ToolErrorCategory.SERVICE_NOT_CONFIGURED,
        `Please configure at least one root folder in ${serviceName} before adding media.`,
        { serviceType: params.serviceType, serviceName },
      );
    }

    // Determine quality profile
    let qualityProfileId: number;
    let qualityProfileName: string;

    if (params.qualityProfile) {
      const profile = qualityProfiles.find(
        (p) => p.name.toLowerCase() === params.qualityProfile!.toLowerCase(),
      );

      if (!profile) {
        const availableProfiles = qualityProfiles.map((p) => p.name).join(", ");
        return {
          success: false,
          error: `Quality profile "${params.qualityProfile}" not found. Available profiles: ${availableProfiles}`,
          metadata: {
            executionTime: Date.now() - startTime,
            serviceType: params.serviceType,
          },
        };
      }

      qualityProfileId = profile.id;
      qualityProfileName = profile.name;
    } else {
      // Use first quality profile as default
      qualityProfileId = qualityProfiles[0]!.id;
      qualityProfileName = qualityProfiles[0]!.name;
    }

    // Determine root folder
    let rootFolderPath: string;

    if (params.rootFolder) {
      const folder = rootFolders.find((f) => f.path === params.rootFolder);

      if (!folder) {
        const availableFolders = rootFolders.map((f) => f.path).join(", ");
        return {
          success: false,
          error: `Root folder "${params.rootFolder}" not found. Available folders: ${availableFolders}`,
          metadata: {
            executionTime: Date.now() - startTime,
            serviceType: params.serviceType,
          },
        };
      }

      rootFolderPath = folder.path;
    } else {
      // Use first root folder as default
      rootFolderPath = rootFolders[0]!.path;
    }

    // Add the media
    let addedMedia: Series | Movie;

    if (params.serviceType === "sonarr") {
      const sonarrConnector = connector as SonarrConnector;

      // Check if already exists
      if (params.tvdbId) {
        const existingSeries = await sonarrConnector.getSeries();
        const existing = existingSeries.find((s) => s.tvdbId === params.tvdbId);

        if (existing) {
          return {
            success: true,
            data: {
              success: true,
              title: existing.title,
              year: existing.year,
              mediaType: "series",
              serviceName,
              qualityProfile: qualityProfileName,
              rootFolder: rootFolderPath,
              monitored: existing.monitored,
              alreadyExists: true,
              message: `"${existing.title}" is already in your ${serviceName} library.`,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              serviceType: params.serviceType,
              serviceId: connector.config.id,
            },
          };
        }
      }

      // Build add request
      const addRequest = {
        tvdbId: params.tvdbId || (searchResult as Series | undefined)?.tvdbId,
        tmdbId: params.tmdbId || (searchResult as Series | undefined)?.tmdbId,
        title: searchResult?.title || params.title,
        titleSlug: (searchResult as Series | undefined)?.titleSlug,
        rootFolderPath,
        qualityProfileId,
        monitored: params.monitored,
        searchNow: params.searchNow,
        addOptions: {
          searchForMissingEpisodes: params.searchNow,
          monitor: (params.monitored ? "all" : "none") as
            | "all"
            | "none"
            | "future"
            | "existing"
            | "firstSeason"
            | "latestSeason",
        },
      };

      addedMedia = await sonarrConnector.add(addRequest);
    } else {
      // Radarr
      const radarrConnector = connector as RadarrConnector;

      // Check if already exists
      if (params.tmdbId) {
        const existingMovies = await radarrConnector.getMovies();
        const existing = existingMovies.find((m) => m.tmdbId === params.tmdbId);

        if (existing) {
          return {
            success: true,
            data: {
              success: true,
              title: existing.title,
              year: existing.year,
              mediaType: "movie",
              serviceName,
              qualityProfile: qualityProfileName,
              rootFolder: rootFolderPath,
              monitored: existing.monitored,
              alreadyExists: true,
              message: `"${existing.title}" is already in your ${serviceName} library.`,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              serviceType: params.serviceType,
              serviceId: connector.config.id,
            },
          };
        }
      }

      // Build add request
      const addRequest = {
        tmdbId:
          params.tmdbId || (searchResult as Movie | undefined)?.tmdbId || 0,
        title: searchResult?.title || params.title,
        year: (searchResult as Movie | undefined)?.year,
        titleSlug: (searchResult as Movie | undefined)?.titleSlug,
        qualityProfileId,
        rootFolderPath,
        monitored: params.monitored,
        searchOnAdd: params.searchNow,
        searchForMovie: params.searchNow,
        images: (searchResult as Movie | undefined)?.images,
      };

      addedMedia = await radarrConnector.add(addRequest);
    }

    const year = "year" in addedMedia ? addedMedia.year : undefined;

    void logger.info("AddMediaTool: Successfully added media", {
      title: addedMedia.title,
      year,
      mediaType,
      serviceId: connector.config.id,
      serviceName,
    });

    return {
      success: true,
      data: {
        success: true,
        title: addedMedia.title,
        year,
        mediaType,
        serviceName,
        qualityProfile: qualityProfileName,
        rootFolder: rootFolderPath,
        monitored: params.monitored,
        alreadyExists: false,
        message: `Successfully added "${addedMedia.title}"${year ? ` (${year})` : ""} to ${serviceName} with quality profile "${qualityProfileName}". ${params.monitored ? "Monitoring is enabled." : "Monitoring is disabled."} ${params.searchNow ? "Search has been triggered." : ""}`,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        serviceType: params.serviceType,
        serviceId: connector.config.id,
      },
    };
  } catch (error) {
    void logger.error("AddMediaTool: Add operation failed", {
      title: params.title,
      serviceType: params.serviceType,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle known error types
    if (error instanceof ToolError) {
      return {
        success: false,
        error: error.toUserMessage(),
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: params.serviceType,
        },
      };
    }

    // Handle "already exists" errors from the service
    if (
      error instanceof Error &&
      (error.message.includes("already") ||
        error.message.includes("exists") ||
        error.message.includes("duplicate"))
    ) {
      return {
        success: false,
        error: `"${params.title}" may already exist in your library. Please check your ${params.serviceType} library and try again.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: params.serviceType,
        },
      };
    }

    // Handle validation errors
    if (
      error instanceof Error &&
      (error.message.includes("validation") ||
        error.message.includes("invalid") ||
        error.message.includes("required"))
    ) {
      return {
        success: false,
        error: `Invalid parameters: ${error.message}. Please check the media details and try again.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: params.serviceType,
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
        error: `Failed to add media due to network issues: ${error.message}. Please check your internet connection and ensure ${params.serviceType} is running.`,
        metadata: {
          executionTime: Date.now() - startTime,
          serviceType: params.serviceType,
        },
      };
    }

    // Handle generic errors
    return {
      success: false,
      error: `${context.formatError(error)} If the problem persists, please check your ${params.serviceType} configuration and try again.`,
      metadata: {
        executionTime: Date.now() - startTime,
        serviceType: params.serviceType,
      },
    };
  }
}

/**
 * AddMediaTool definition.
 * Enables the LLM to add movies or TV shows to Sonarr or Radarr.
 *
 * @example
 * LLM: "Add Breaking Bad to Sonarr"
 * Tool call: { title: "Breaking Bad", serviceType: "sonarr", monitored: true }
 *
 * @example
 * LLM: "Add The Matrix to Radarr with high quality"
 * Tool call: { title: "The Matrix", serviceType: "radarr", qualityProfile: "HD-1080p", monitored: true }
 */
export const addMediaTool: ToolDefinition<AddMediaParams, AddMediaResult> = {
  name: "add_media",
  description:
    "Add a movie or TV show to a media management service (Sonarr for TV shows, Radarr for movies). Can search by title or use TMDb/TVDb IDs. Automatically handles quality profiles and root folders. Use this when the user wants to add content to their library.",
  parameters: addMediaParamsSchema,
  execute: executeAddMedia,
};
