import { BaseConnector } from "@/connectors/base/BaseConnector";
import type { SearchOptions } from "@/connectors/base/IConnector";
import type {
  BazarrMovie,
  BazarrEpisode,
  BazarrSubtitle,
  BazarrMissingSubtitle,
  BazarrLanguage,
  BazarrProvider,
  BazarrProfile,
  BazarrQueueItem,
  BazarrHistoryItem,
  BazarrSearchResult,
  BazarrSearchRequest,
  BazarrDownloadRequest,
  BazarrStatistics,
} from "@/models/bazarr.types";
import { handleApiError } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";
import type {
  LogQueryOptions,
  ServiceLog,
  ServiceLogLevel,
} from "@/models/logger.types";

/**
 * Bazarr connector for subtitle management
 */
export class BazarrConnector extends BaseConnector<
  BazarrMovie | BazarrEpisode,
  BazarrSearchRequest,
  Partial<BazarrMovie | BazarrEpisode>
> {
  async initialize(): Promise<void> {
    // Bazarr initialization - mainly authentication check
    await this.ensureAuthenticated();
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get("/api/system/status");
      return (
        response.data?.bazarrVersion || response.data?.version || "Unknown"
      );
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
      });

      throw new Error(`Failed to get Bazarr version: ${diagnostic.message}`);
    }
  }

  // Movie Management Methods

  /**
   * Get all movies with subtitle information
   */
  async getMovies(): Promise<BazarrMovie[]> {
    try {
      const response = await this.client.get("/api/movies");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMovies",
      });

      throw new Error(`Failed to get movies: ${diagnostic.message}`);
    }
  }

  /**
   * Get a specific movie by ID
   */
  async getMovieById(id: number): Promise<BazarrMovie> {
    try {
      const response = await this.client.get(`/api/movies/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMovieById",
      });

      throw new Error(`Failed to get movie ${id}: ${diagnostic.message}`);
    }
  }

  // Episode Management Methods

  /**
   * Get all episodes with subtitle information
   */
  async getEpisodes(): Promise<BazarrEpisode[]> {
    try {
      const response = await this.client.get("/api/episodes");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodes",
      });

      throw new Error(`Failed to get episodes: ${diagnostic.message}`);
    }
  }

  /**
   * Get episodes for a specific series
   */
  async getEpisodesBySeriesId(seriesId: number): Promise<BazarrEpisode[]> {
    try {
      const response = await this.client.get(
        `/api/episodes/series/${seriesId}`,
      );
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodesBySeriesId",
      });

      throw new Error(
        `Failed to get episodes for series ${seriesId}: ${diagnostic.message}`,
      );
    }
  }

  /**
   * Get a specific episode by ID
   */
  async getEpisodeById(id: number): Promise<BazarrEpisode> {
    try {
      const response = await this.client.get(`/api/episodes/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodeById",
      });

      throw new Error(`Failed to get episode ${id}: ${diagnostic.message}`);
    }
  }

  // Subtitle Management Methods

  /**
   * Get all subtitles
   */
  async getSubtitles(): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get("/api/subtitles");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSubtitles",
      });

      throw new Error(`Failed to get subtitles: ${diagnostic.message}`);
    }
  }

  /**
   * Get subtitles for a specific movie
   */
  async getSubtitlesByMovieId(movieId: number): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(`/api/subtitles/movie/${movieId}`);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSubtitlesByMovieId",
      });

      throw new Error(
        `Failed to get subtitles for movie ${movieId}: ${diagnostic.message}`,
      );
    }
  }

  /**
   * Get subtitles for a specific episode
   */
  async getSubtitlesByEpisodeId(episodeId: number): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(
        `/api/subtitles/episode/${episodeId}`,
      );
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSubtitlesByEpisodeId",
      });

      throw new Error(
        `Failed to get subtitles for episode ${episodeId}: ${diagnostic.message}`,
      );
    }
  }

  /**
   * Search for subtitles for a movie/episode
   */
  async searchSubtitles(
    searchRequest: BazarrSearchRequest,
  ): Promise<BazarrSearchResult[]> {
    try {
      const response = await this.client.post(
        "/api/subtitles/search",
        searchRequest,
      );
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchSubtitles",
      });

      throw new Error(`Failed to search subtitles: ${diagnostic.message}`);
    }
  }

  /**
   * Download a subtitle
   */
  async downloadSubtitle(
    downloadRequest: BazarrDownloadRequest,
  ): Promise<boolean> {
    try {
      await this.client.post("/api/subtitles/download", downloadRequest);
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "downloadSubtitle",
      });

      throw new Error(`Failed to download subtitle: ${diagnostic.message}`);
    }
  }

  // Language Management Methods

  /**
   * Get all available languages
   */
  async getLanguages(): Promise<BazarrLanguage[]> {
    try {
      const response = await this.client.get("/api/languages");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getLanguages",
      });

      throw new Error(`Failed to get languages: ${diagnostic.message}`);
    }
  }

  /**
   * Get enabled languages
   */
  async getEnabledLanguages(): Promise<BazarrLanguage[]> {
    try {
      const languages = await this.getLanguages();
      return languages.filter((lang) => lang.enabled);
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEnabledLanguages",
      });

      throw new Error(`Failed to get enabled languages: ${diagnostic.message}`);
    }
  }

  // Provider Management Methods

  /**
   * Get all subtitle providers
   */
  async getProviders(): Promise<BazarrProvider[]> {
    try {
      const response = await this.client.get("/api/providers");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getProviders",
      });

      throw new Error(`Failed to get providers: ${diagnostic.message}`);
    }
  }

  /**
   * Get enabled providers
   */
  async getEnabledProviders(): Promise<BazarrProvider[]> {
    try {
      const providers = await this.getProviders();
      return providers.filter((provider) => provider.enabled);
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEnabledProviders",
      });

      throw new Error(`Failed to get enabled providers: ${diagnostic.message}`);
    }
  }

  // Profile Management Methods

  /**
   * Get all subtitle profiles
   */
  async getProfiles(): Promise<BazarrProfile[]> {
    try {
      const response = await this.client.get("/api/profiles");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getProfiles",
      });

      throw new Error(`Failed to get profiles: ${diagnostic.message}`);
    }
  }

  // Queue and History Methods

  /**
   * Get download queue
   */
  async getQueue(): Promise<BazarrQueueItem[]> {
    try {
      const response = await this.client.get("/api/queue");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQueue",
      });

      throw new Error(`Failed to get queue: ${diagnostic.message}`);
    }
  }

  /**
   * Get download history
   */
  async getHistory(): Promise<BazarrHistoryItem[]> {
    try {
      const response = await this.client.get("/api/history");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHistory",
      });

      throw new Error(`Failed to get history: ${diagnostic.message}`);
    }
  }

  // Statistics Methods

  /**
   * Get overall statistics
   */
  async getStatistics(): Promise<BazarrStatistics> {
    try {
      const [movies, episodes, subtitles] = await Promise.all([
        this.getMovies(),
        this.getEpisodes(),
        this.getSubtitles(),
      ]);

      const missingSubtitles = [...movies, ...episodes].flatMap(
        (item) => item.missingSubtitles || [],
      ).length;

      return {
        moviesTotal: movies.length,
        episodesTotal: episodes.length,
        subtitlesTotal: subtitles.length,
        missingSubtitles,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getStatistics",
      });

      throw new Error(`Failed to get statistics: ${diagnostic.message}`);
    }
  }

  // Utility Methods

  /**
   * Get missing subtitles for all movies and episodes
   */
  async getAllMissingSubtitles(): Promise<BazarrMissingSubtitle[]> {
    try {
      const [movies, episodes] = await Promise.all([
        this.getMovies(),
        this.getEpisodes(),
      ]);

      return [
        ...movies.flatMap((movie) => movie.missingSubtitles || []),
        ...episodes.flatMap((episode) => episode.missingSubtitles || []),
      ];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAllMissingSubtitles",
      });

      throw new Error(`Failed to get missing subtitles: ${diagnostic.message}`);
    }
  }

  /**
   * Search functionality for unified search integration
   */
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<(BazarrMovie | BazarrEpisode)[]> {
    // Bazarr doesn't have traditional search like Sonarr/Radarr
    // Return empty array for now - could be extended to search movies/episodes by title
    return [];
  }

  /**
   * Retrieve logs from Bazarr using the /system/logs endpoint.
   * Note: Bazarr's log API is simpler and returns logs as an array of strings.
   * We'll parse and normalize them to the unified ServiceLog format.
   */
  override async getLogs(options?: LogQueryOptions): Promise<ServiceLog[]> {
    try {
      const response = await this.client.get<string[]>("/system/logs");
      const logLines = response.data || [];

      // Bazarr returns logs as an array of strings, we need to parse them
      const logs = logLines
        .map((line, index) => this.parseBazarrLogLine(line, index))
        .filter((log): log is ServiceLog => log !== null);

      // Apply filters
      let filteredLogs = logs;

      // Apply level filter if specified
      if (options?.level && options.level.length > 0) {
        filteredLogs = filteredLogs.filter((log) =>
          options.level!.includes(log.level),
        );
      }

      // Apply time range filtering if specified
      if (options?.since || options?.until) {
        filteredLogs = filteredLogs.filter((log) => {
          if (options.since && log.timestamp < options.since) {
            return false;
          }
          if (options.until && log.timestamp > options.until) {
            return false;
          }
          return true;
        });
      }

      // Apply search term filtering if specified
      if (options?.searchTerm) {
        const searchLower = options.searchTerm.toLowerCase();
        filteredLogs = filteredLogs.filter((log) =>
          log.message.toLowerCase().includes(searchLower),
        );
      }

      // Apply limit
      if (options?.limit) {
        const startIndex = options.startIndex ?? 0;
        filteredLogs = filteredLogs.slice(
          startIndex,
          startIndex + options.limit,
        );
      }

      return filteredLogs;
    } catch (error) {
      logger.error("[BazarrConnector] Failed to retrieve logs", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getLogs",
        endpoint: "/system/logs",
      });
    }
  }

  /**
   * Parse a Bazarr log line into a ServiceLog entry.
   * Bazarr log format is typically: "YYYY-MM-DD HH:MM:SS LEVEL :: message"
   */
  private parseBazarrLogLine(line: string, index: number): ServiceLog | null {
    if (!line || line.trim().length === 0) {
      return null;
    }

    // Try to parse the log line
    // Format: "2024-01-15 10:30:45 INFO :: message here"
    const logPattern =
      /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+::\s+(.+)$/;
    const match = line.match(logPattern);

    if (match && match[1] && match[2] && match[3]) {
      const timestamp = match[1];
      const level = match[2];
      const message = match[3];
      return {
        id: `bazarr-${this.config.id}-${index}`,
        serviceId: this.config.id,
        serviceName: this.config.name,
        serviceType: this.config.type,
        timestamp: new Date(timestamp),
        level: this.normalizeBazarrLogLevel(level),
        message: message.trim(),
        raw: line,
      };
    }

    // If parsing fails, return a basic log entry
    return {
      id: `bazarr-${this.config.id}-${index}`,
      serviceId: this.config.id,
      serviceName: this.config.name,
      serviceType: this.config.type,
      timestamp: new Date(),
      level: "info",
      message: line,
      raw: line,
    };
  }

  /**
   * Normalize Bazarr log level to the unified ServiceLogLevel format.
   */
  private normalizeBazarrLogLevel(level: string): ServiceLogLevel {
    const levelLower = level.toLowerCase();
    switch (levelLower) {
      case "trace":
        return "trace";
      case "debug":
        return "debug";
      case "info":
        return "info";
      case "warn":
      case "warning":
        return "warn";
      case "error":
        return "error";
      case "fatal":
      case "critical":
        return "fatal";
      default:
        return "info";
    }
  }
}
