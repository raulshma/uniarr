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

export class BazarrConnector extends BaseConnector<
  BazarrMovie | BazarrEpisode,
  BazarrSearchRequest,
  Partial<BazarrMovie | BazarrEpisode>
> {
  async initialize(): Promise<void> {
    await this.ensureAuthenticated();
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get("/api/system/status");
      return (
        response.data?.bazarrVersion || response.data?.version || "Unknown"
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
      });
    }
  }

  async getMovies(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrMovie[]> {
    try {
      const response = await this.client.get(
        "/api/movies",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMovies",
      });
    }
  }

  async getMovieById(
    id: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<BazarrMovie> {
    try {
      const response = await this.client.get(
        `/api/movies/${id}`,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMovieById",
      });
    }
  }

  async getEpisodes(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrEpisode[]> {
    try {
      const response = await this.client.get(
        "/api/episodes",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodes",
      });
    }
  }

  async getEpisodesBySeriesId(
    seriesId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<BazarrEpisode[]> {
    try {
      const response = await this.client.get(
        `/api/episodes/series/${seriesId}`,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodesBySeriesId",
      });
    }
  }

  async getEpisodeById(
    id: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<BazarrEpisode> {
    try {
      const response = await this.client.get(
        `/api/episodes/${id}`,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodeById",
      });
    }
  }

  async getSubtitles(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(
        "/api/subtitles",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSubtitles",
      });
    }
  }

  async getSubtitlesByMovieId(
    movieId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(
        `/api/subtitles/movie/${movieId}`,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSubtitlesByMovieId",
      });
    }
  }

  async getSubtitlesByEpisodeId(
    episodeId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(
        `/api/subtitles/episode/${episodeId}`,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSubtitlesByEpisodeId",
      });
    }
  }

  async searchSubtitles(
    searchRequest: BazarrSearchRequest,
    options?: { readonly signal?: AbortSignal },
  ): Promise<BazarrSearchResult[]> {
    try {
      const response = await this.client.post(
        "/api/subtitles/search",
        searchRequest,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchSubtitles",
      });
    }
  }

  async downloadSubtitle(
    downloadRequest: BazarrDownloadRequest,
    options?: { readonly signal?: AbortSignal },
  ): Promise<boolean> {
    try {
      await this.client.post(
        "/api/subtitles/download",
        downloadRequest,
        this.toAxiosConfig(options),
      );
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "downloadSubtitle",
      });
    }
  }

  async getLanguages(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrLanguage[]> {
    try {
      const response = await this.client.get(
        "/api/languages",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getLanguages",
      });
    }
  }

  async getEnabledLanguages(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrLanguage[]> {
    try {
      const languages = await this.getLanguages(options);
      return languages.filter((lang) => lang.enabled);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEnabledLanguages",
      });
    }
  }

  async getProviders(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrProvider[]> {
    try {
      const response = await this.client.get(
        "/api/providers",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getProviders",
      });
    }
  }

  async getEnabledProviders(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrProvider[]> {
    try {
      const providers = await this.getProviders(options);
      return providers.filter((provider) => provider.enabled);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEnabledProviders",
      });
    }
  }

  async getProfiles(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrProfile[]> {
    try {
      const response = await this.client.get(
        "/api/profiles",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getProfiles",
      });
    }
  }

  async getQueue(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrQueueItem[]> {
    try {
      const response = await this.client.get(
        "/api/queue",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQueue",
      });
    }
  }

  async getHistory(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrHistoryItem[]> {
    try {
      const response = await this.client.get(
        "/api/history",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHistory",
      });
    }
  }

  async getStatistics(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrStatistics> {
    try {
      const [movies, episodes, subtitles] = await Promise.all([
        this.getMovies(options),
        this.getEpisodes(options),
        this.getSubtitles(options),
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
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getStatistics",
      });
    }
  }

  async getAllMissingSubtitles(options?: {
    readonly signal?: AbortSignal;
  }): Promise<BazarrMissingSubtitle[]> {
    try {
      const [movies, episodes] = await Promise.all([
        this.getMovies(options),
        this.getEpisodes(options),
      ]);

      return [
        ...movies.flatMap((movie) => movie.missingSubtitles || []),
        ...episodes.flatMap((episode) => episode.missingSubtitles || []),
      ];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAllMissingSubtitles",
      });
    }
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<(BazarrMovie | BazarrEpisode)[]> {
    return [];
  }

  override async getLogs(
    options?: LogQueryOptions,
    requestOptions?: { readonly signal?: AbortSignal },
  ): Promise<ServiceLog[]> {
    try {
      const response = await this.client.get<string[]>(
        "/system/logs",
        this.toAxiosConfig(requestOptions),
      );
      const logLines = response.data || [];

      const logs = logLines
        .map((line, index) => this.parseBazarrLogLine(line, index))
        .filter((log): log is ServiceLog => log !== null);

      let filteredLogs = logs;

      if (options?.level && options.level.length > 0) {
        filteredLogs = filteredLogs.filter((log) =>
          options.level!.includes(log.level),
        );
      }

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

      if (options?.searchTerm) {
        const searchLower = options.searchTerm.toLowerCase();
        filteredLogs = filteredLogs.filter((log) =>
          log.message.toLowerCase().includes(searchLower),
        );
      }

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

  private parseBazarrLogLine(line: string, index: number): ServiceLog | null {
    if (!line || line.trim().length === 0) {
      return null;
    }

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
