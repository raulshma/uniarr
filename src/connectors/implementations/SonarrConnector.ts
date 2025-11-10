import { BaseConnector } from "@/connectors/base/BaseConnector";
import { logger } from "@/services/logger/LoggerService";
import type {
  AddSeriesRequest,
  Episode,
  MediaStatistics,
  Quality,
  QualityProfile,
  QualityProfileItem,
  RootFolder,
  Series,
  Season,
} from "@/models/media.types";
import type { SearchOptions } from "@/connectors/base/IConnector";
import { handleApiError } from "@/utils/error.utils";
import type { components } from "@/connectors/client-schemas/sonarr-openapi";
import type { NormalizedRelease } from "@/models/discover.types";
import { normalizeSonarrRelease } from "@/services/ReleaseService";

// Local aliases for the Sonarr OpenAPI-generated schemas. Using these aliases
// keeps the rest of the file readable and allows us to change the underlying
// source of truth without updating every usage site.
type SonarrEpisode = components["schemas"]["EpisodeResource"];
type SonarrQuality = components["schemas"]["Quality"];
type SonarrRelease = components["schemas"]["ReleaseResource"];

export interface SonarrQueueItem {
  readonly id: number;
  readonly seriesId: number;
  readonly seriesTitle?: string;
  readonly episodeId?: number;
  readonly episodeTitle?: string;
  readonly seasonNumber?: number;
  readonly episodeNumber?: number;
  readonly status?: string;
  readonly trackedDownloadState?: string;
  readonly trackedDownloadStatus?: string;
  readonly downloadId?: string;
  readonly protocol?: string;
  readonly size?: number;
  readonly sizeleft?: number;
  readonly timeleft?: string;
}

// A number of small local helper interfaces were previously defined here to
// model Sonarr API responses. We now prefer to use the generated OpenAPI
// types (aliased above) to avoid drift and duplication.

interface SonarrSeriesEditor {
  readonly seriesIds: number[];
  readonly monitored?: boolean;
  readonly qualityProfileId?: number;
  readonly tags?: number[];
}

interface SonarrMoveSeriesOptions {
  readonly seriesId: number;
  readonly destinationPath: string;
  readonly moveFiles?: boolean;
}

interface SonarrRenameSeriesOptions {
  readonly seriesId: number;
  readonly renameFiles?: boolean;
}

// SonarrRootFolder mapped via SonarrRootFolder alias above

export class SonarrConnector extends BaseConnector<Series, AddSeriesRequest> {
  async initialize(): Promise<void> {
    logger.debug("[SonarrConnector] Initializing", {
      serviceId: this.config.id,
    });
    await this.getVersion();
    logger.debug("[SonarrConnector] Initialization completed", {
      serviceId: this.config.id,
    });
  }

  async getVersion(): Promise<string> {
    try {
      const fullUrl = `${this.config.url}/api/v3/system/status`;
      logger.debug("[SonarrConnector] Getting version", {
        serviceId: this.config.id,
        url: fullUrl,
      });

      logger.debug("[SonarrConnector] Config details", {
        serviceId: this.config.id,
        url: this.config.url,
        apiKey: this.config.apiKey ? "***" : "missing",
        timeout: this.config.timeout,
      });

      const response = await this.client.get<
        components["schemas"]["SystemResource"]
      >("/api/v3/system/status");
      const version = response.data.version ?? "unknown";
      logger.debug("[SonarrConnector] Version retrieved", {
        serviceId: this.config.id,
        version,
        status: response.status,
      });
      return version;
    } catch (error) {
      logger.error("[SonarrConnector] Version request failed", {
        serviceId: this.config.id,
        error,
      });
      const axiosError = error as unknown as {
        message?: string;
        code?: string;
        response?: { status?: number; statusText?: string };
      };
      logger.debug("[SonarrConnector] Error details", {
        serviceId: this.config.id,
        message: axiosError?.message,
        code: axiosError?.code,
        status: axiosError?.response?.status,
        statusText: axiosError?.response?.statusText,
      });

      // Check for network connectivity issues and log at debug level
      if (
        axiosError?.code === "ECONNREFUSED" ||
        axiosError?.code === "ENOTFOUND" ||
        axiosError?.code === "ETIMEDOUT"
      ) {
        logger.debug("[SonarrConnector] Network connectivity issue detected", {
          serviceId: this.config.id,
          code: axiosError.code,
        });
      }

      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
        endpoint: "/api/v3/system/status",
      });
    }
  }

  async getSeries(filters?: {
    tags?: number[];
    qualityProfileId?: number;
    monitored?: boolean;
  }): Promise<Series[]> {
    try {
      const params: Record<string, unknown> = {};

      if (filters?.tags && filters.tags.length > 0) {
        params.tags = filters.tags.join(",");
      }
      if (filters?.qualityProfileId !== undefined) {
        params.qualityProfileId = filters.qualityProfileId;
      }
      if (filters?.monitored !== undefined) {
        params.monitored = filters.monitored;
      }

      const response = await this.client.get<
        components["schemas"]["SeriesResource"][]
      >("/api/v3/series", { params });
      return response.data.map((item) => this.mapSeries(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSeries",
        endpoint: "/api/v3/series",
      });
    }
  }

  async search(query: string, options?: SearchOptions): Promise<Series[]> {
    try {
      const params: Record<string, unknown> = { term: query };

      if (options?.filters) {
        Object.assign(params, options.filters);
      }

      const response = await this.client.get<
        components["schemas"]["SeriesResource"][]
      >("/api/v3/series/lookup", {
        params,
      });

      return response.data.map((item) => this.mapSeries(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "search",
        endpoint: "/api/v3/series/lookup",
      });
    }
  }

  async getById(id: number): Promise<Series> {
    try {
      const [seriesResponse, episodesResponse, episodeFilesResponse] =
        await Promise.all([
          this.client.get<components["schemas"]["SeriesResource"]>(
            `/api/v3/series/${id}`,
            {
              params: { includeSeasonImages: true },
            },
          ),
          this.client.get<components["schemas"]["EpisodeResource"][]>(
            `/api/v3/episode`,
            {
              params: { seriesId: id, includeImages: true },
            },
          ),
          this.client.get<components["schemas"]["EpisodeFileResource"][]>(
            "/api/v3/episodefile",
            {
              params: { seriesId: id },
            },
          ),
        ]);

      const series = this.mapSeries(seriesResponse.data);

      // Create a map of episode files by episodeFileId for quick lookup
      const episodeFilesMap = new Map<
        number,
        components["schemas"]["EpisodeFileResource"]
      >();
      episodeFilesResponse.data.forEach((file) => {
        if (file.id) {
          episodeFilesMap.set(file.id, file);
        }
      });

      const episodesBySeason = this.groupEpisodesBySeason(
        episodesResponse.data,
        series.id,
        episodeFilesMap,
      );

      // Calculate total size on disk
      const totalSizeOnDiskMB = episodeFilesResponse.data.reduce(
        (sum, file) => {
          return sum + (file.size ?? 0) / (1024 * 1024);
        },
        0,
      );

      const seasons: Season[] | undefined = series.seasons?.map((season) => ({
        ...season,
        episodes: episodesBySeason.get(season.seasonNumber),
      }));

      return {
        ...series,
        seasons,
        totalSizeOnDiskMB,
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getById",
        endpoint: `/api/v3/series/${id}`,
      });
    }
  }

  async getEpisodeFiles(
    seriesId: number,
  ): Promise<components["schemas"]["EpisodeFileResource"][]> {
    try {
      const response = await this.client.get<
        components["schemas"]["EpisodeFileResource"][]
      >("/api/v3/episodefile", {
        params: { seriesId },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodeFiles",
        endpoint: "/api/v3/episodefile",
      });
    }
  }

  async add(request: AddSeriesRequest): Promise<Series> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post<
        components["schemas"]["SeriesResource"]
      >("/api/v3/series", payload);
      return this.mapSeries(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "add",
        endpoint: "/api/v3/series",
      });
    }
  }

  async triggerSearch(seriesId: number): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "SeriesSearch",
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "triggerSearch",
        endpoint: "/api/v3/command",
      });
    }
  }

  async setMonitored(seriesId: number, monitored: boolean): Promise<void> {
    try {
      await this.client.post("/api/v3/series/monitor", {
        seriesIds: [seriesId],
        monitored,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setMonitored",
        endpoint: "/api/v3/series/monitor",
      });
    }
  }

  async setSeasonMonitored(
    seriesId: number,
    seasonNumber: number,
    monitored: boolean,
  ): Promise<void> {
    try {
      await this.client.put(`/api/v3/series/${seriesId}`, {
        seasons: [
          {
            seasonNumber,
            monitored,
          },
        ],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setSeasonMonitored",
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async searchMissingEpisodes(seriesId: number): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "SeriesSearch",
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchMissingEpisodes",
        endpoint: "/api/v3/command",
      });
    }
  }

  async searchMissingEpisode(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<void> {
    try {
      // Get all episodes for the series to find the specific episode ID
      const episodesResponse = await this.client.get<
        components["schemas"]["EpisodeResource"][]
      >(`/api/v3/episode`, {
        params: { seriesId },
      });

      // Find the episode matching season and episode number
      const episode = episodesResponse.data.find(
        (ep) =>
          ep.seasonNumber === seasonNumber &&
          ep.episodeNumber === episodeNumber,
      );

      if (!episode || !episode.id) {
        throw new Error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
      }

      // Search using episodeIds with correct API format
      await this.client.post("/api/v3/command", {
        name: "EpisodeSearch",
        episodeIds: [episode.id],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchMissingEpisode",
        endpoint: "/api/v3/command",
      });
    }
  }

  async searchEpisodesByIds(episodeIds: number[]): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "EpisodeSearch",
        episodeIds,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchEpisodesByIds",
        endpoint: "/api/v3/command",
      });
    }
  }

  async setEpisodeMonitored(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
    monitored: boolean,
  ): Promise<void> {
    try {
      // Get all episodes for the series to find the specific episode ID
      const episodesResponse = await this.client.get<
        components["schemas"]["EpisodeResource"][]
      >(`/api/v3/episode`, {
        params: { seriesId },
      });

      // Find the episode matching season and episode number
      const episode = episodesResponse.data.find(
        (ep) =>
          ep.seasonNumber === seasonNumber &&
          ep.episodeNumber === episodeNumber,
      );

      if (!episode || !episode.id) {
        throw new Error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
      }

      // Update the episode's monitored status
      await this.client.put(`/api/v3/episode/${episode.id}`, {
        monitored,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setEpisodeMonitored",
        endpoint: `/api/v3/episode`,
      });
    }
  }

  async deleteEpisodeFile(episodeFileId: number): Promise<void> {
    try {
      await this.client.delete(`/api/v3/episodefile/${episodeFileId}`);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteEpisodeFile",
        endpoint: `/api/v3/episodefile/${episodeFileId}`,
      });
    }
  }

  async unmonitorAllEpisodes(seriesId: number): Promise<void> {
    try {
      // First, get the series to retrieve all seasons
      const seriesResponse = await this.client.get<
        components["schemas"]["SeriesResource"]
      >(`/api/v3/series/${seriesId}`);

      const series = seriesResponse.data;
      if (!series.seasons) {
        return;
      }

      // Unmonitor all seasons
      const updatedSeasons = series.seasons.map((season) => ({
        seasonNumber: season.seasonNumber,
        monitored: false,
      }));

      await this.client.put(`/api/v3/series/${seriesId}`, {
        seasons: updatedSeasons,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "unmonitorAllEpisodes",
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async deleteSeries(
    seriesId: number,
    options: { deleteFiles?: boolean; addImportListExclusion?: boolean } = {},
  ): Promise<void> {
    try {
      const params = {
        deleteFiles: options.deleteFiles ?? false,
        addImportListExclusion: options.addImportListExclusion ?? false,
      };

      await this.client.delete(`/api/v3/series/${seriesId}`, {
        params,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteSeries",
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async updateSeries(
    seriesId: number,
    updates: Partial<
      Omit<
        components["schemas"]["SeriesResource"],
        "id" | "seasons" | "statistics"
      >
    >,
  ): Promise<Series> {
    try {
      const response = await this.client.put<
        components["schemas"]["SeriesResource"]
      >(`/api/v3/series/${seriesId}`, updates);
      return this.mapSeries(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateSeries",
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async refreshSeries(seriesId: number): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "SeriesRefresh",
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "refreshSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async rescanSeries(seriesId: number): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "SeriesRescan",
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async moveSeries(options: SonarrMoveSeriesOptions): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "SeriesMove",
        ...options,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "moveSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  /**
   * Get available releases/candidates for a series (from indexers).
   * Probes multiple candidate endpoints based on Sonarr API versions.
   */
  async getReleases(
    seriesId: number,
    options?: {
      season?: number;
      episode?: number;
      indexerId?: number;
      minSeeders?: number;
    },
  ): Promise<NormalizedRelease[]> {
    const candidateEndpoints = [
      "/api/v3/release",
      `/api/v3/series/${seriesId}/releases`,
      "/api/v3/releases",
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        const params: Record<string, unknown> = { seriesId };
        if (options?.season !== undefined) {
          params.season = options.season;
        }
        if (options?.episode !== undefined) {
          params.episode = options.episode;
        }
        if (options?.indexerId) {
          params.indexerId = options.indexerId;
        }

        const response = await this.client.get<SonarrRelease[]>(endpoint, {
          params,
        });

        if (Array.isArray(response.data)) {
          return response.data
            .filter((r) => {
              if (options?.minSeeders !== undefined && r.seeders !== null) {
                return (r.seeders ?? 0) >= options.minSeeders;
              }
              return true;
            })
            .map((r) => normalizeSonarrRelease(r, this.config.id));
        }
      } catch (error) {
        const axiosError = error as unknown as {
          response?: { status?: number };
        };
        const status = axiosError?.response?.status;
        if (status !== 404) {
          logger.warn("[SonarrConnector] Unexpected error fetching releases", {
            serviceId: this.config.id,
            endpoint,
            status,
            seriesId,
          });
        }
        // Try next candidate endpoint
      }
    }

    logger.warn("[SonarrConnector] Unable to find working releases endpoint", {
      serviceId: this.config.id,
      seriesId,
      tried: candidateEndpoints,
    });

    return [];
  }

  async renameSeries(options: SonarrRenameSeriesOptions): Promise<void> {
    try {
      await this.client.post("/api/v3/command", {
        name: "SeriesRename",
        ...options,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "renameSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async getTags(): Promise<components["schemas"]["TagResource"][]> {
    try {
      const response =
        await this.client.get<components["schemas"]["TagResource"][]>(
          "/api/v3/tag",
        );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTags",
        endpoint: "/api/v3/tag",
      });
    }
  }

  async createTag(
    label: string,
  ): Promise<components["schemas"]["TagResource"]> {
    try {
      const response = await this.client.post<
        components["schemas"]["TagResource"]
      >("/api/v3/tag", { label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "createTag",
        endpoint: "/api/v3/tag",
      });
    }
  }

  async updateTag(
    tagId: number,
    label: string,
  ): Promise<components["schemas"]["TagResource"]> {
    try {
      const response = await this.client.put<
        components["schemas"]["TagResource"]
      >(`/api/v3/tag/${tagId}`, { id: tagId, label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateTag",
        endpoint: `/api/v3/tag/${tagId}`,
      });
    }
  }

  async deleteTag(tagId: number): Promise<void> {
    try {
      await this.client.delete(`/api/v3/tag/${tagId}`);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTag",
        endpoint: `/api/v3/tag/${tagId}`,
      });
    }
  }

  async bulkUpdateSeries(editor: SonarrSeriesEditor): Promise<void> {
    try {
      await this.client.put("/api/v3/series/editor", editor);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateSeries",
        endpoint: "/api/v3/series/editor",
      });
    }
  }

  async getQualityProfiles(): Promise<QualityProfile[]> {
    const candidateEndpoints = [
      "/api/v3/qualityprofile",
      "/api/v3/qualityProfile",
      "/api/v3/qualityProfiles",
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        // Attempt endpoint variant
        const response =
          await this.client.get<
            components["schemas"]["QualityProfileResource"][]
          >(endpoint);

        // Check if response contains an error
        if (
          response.data &&
          typeof response.data === "object" &&
          !Array.isArray(response.data) &&
          "error" in response.data
        ) {
          const errObj = response.data as unknown as { error?: string };
          throw new Error(errObj.error ?? "Unknown error");
        }

        return response.data.map((profile) => this.mapQualityProfile(profile));
      } catch (error) {
        // If this endpoint returned a 404, try the next candidate.
        const axiosError = error as unknown as {
          response?: { status?: number };
        };
        const status = axiosError?.response?.status;
        // Only continue trying on 404; for other errors, fail-fast and report diagnostics
        if (status !== 404) {
          const enhancedError = new Error(
            "Failed to load quality profiles. This may be due to corrupted custom formats in Sonarr. Please check your Sonarr quality profiles and custom formats, then try again.",
          );
          throw handleApiError(enhancedError, {
            serviceId: this.config.id,
            serviceType: this.config.type,
            operation: "getQualityProfiles",
            endpoint,
          });
        }
        // otherwise continue to next candidate
      }
    }

    const enhancedError = new Error(
      "Failed to load quality profiles. Tried several Sonarr endpoints but none responded. This may be due to API changes or server configuration.",
    );
    throw handleApiError(enhancedError, {
      serviceId: this.config.id,
      serviceType: this.config.type,
      operation: "getQualityProfiles",
      endpoint: candidateEndpoints.join(" | "),
    });
  }

  async getRootFolders(): Promise<RootFolder[]> {
    try {
      const response =
        await this.client.get<components["schemas"]["RootFolderResource"][]>(
          "/api/v3/rootfolder",
        );
      return response.data.map((folder) => this.mapRootFolder(folder));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getRootFolders",
        endpoint: "/api/v3/rootfolder",
      });
    }
  }

  async getCalendar(
    start?: string,
    end?: string,
    unmonitored?: boolean,
  ): Promise<SonarrEpisode[]> {
    try {
      const params: Record<string, unknown> = {
        includeSeries: true,
      };
      if (start) params.start = start;
      if (end) params.end = end;
      if (unmonitored !== undefined) params.unmonitored = unmonitored;

      const response = await this.client.get<
        components["schemas"]["EpisodeResource"][]
      >("/api/v3/calendar", { params });
      return response.data ?? [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getCalendar",
        endpoint: "/api/v3/calendar",
      });
    }
  }

  async getQueue(): Promise<SonarrQueueItem[]> {
    try {
      const response =
        await this.client.get<
          components["schemas"]["QueueResourcePagingResource"]
        >("/api/v3/queue");
      return (response.data.records ?? []).map((record) =>
        this.mapQueueRecord(record),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQueue",
        endpoint: "/api/v3/queue",
      });
    }
  }

  async removeFromQueue(
    id: number,
    options: {
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    } = {},
  ): Promise<void> {
    try {
      const params = {
        removeFromClient: options.removeFromClient ?? true,
        blocklist: options.blocklist ?? false,
        skipRedownload: options.skipRedownload ?? false,
        changeCategory: options.changeCategory ?? false,
      };

      await this.client.delete(`/api/v3/queue/${id}`, { params });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "removeFromQueue",
        endpoint: `/api/v3/queue/${id}`,
      });
    }
  }

  async bulkRemoveFromQueue(
    ids: number[],
    options: {
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    } = {},
  ): Promise<void> {
    try {
      const params = {
        removeFromClient: options.removeFromClient ?? true,
        blocklist: options.blocklist ?? false,
        skipRedownload: options.skipRedownload ?? false,
        changeCategory: options.changeCategory ?? false,
      };

      const payload = { ids };

      await this.client.delete("/api/v3/queue/bulk", {
        params,
        data: payload,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkRemoveFromQueue",
        endpoint: "/api/v3/queue/bulk",
      });
    }
  }

  async getHistory(options?: {
    page?: number;
    pageSize?: number;
  }): Promise<components["schemas"]["HistoryResourcePagingResource"]> {
    try {
      const params: Record<string, unknown> = {};
      if (options?.page) params.page = options.page;
      if (options?.pageSize) params.pageSize = options.pageSize;
      // Include related data for better UI display
      params.includeSeries = true;
      params.includeEpisode = true;
      // Order by most recent first
      params.sortKey = "date";
      params.sortDirection = "descending";

      const response = await this.client.get<
        components["schemas"]["HistoryResourcePagingResource"]
      >("/api/v3/history", { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHistory",
        endpoint: "/api/v3/history",
      });
    }
  }

  async getEpisodesByIds(episodeIds: number[]): Promise<SonarrEpisode[]> {
    try {
      if (!episodeIds || episodeIds.length === 0) {
        return [];
      }

      // Fetch episodes in parallel (max 5 at a time to avoid overwhelming the API)
      const batchSize = 5;
      const episodes: SonarrEpisode[] = [];

      for (let i = 0; i < episodeIds.length; i += batchSize) {
        const batch = episodeIds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((episodeId) =>
            this.client
              .get<SonarrEpisode>(`/api/v3/episode/${episodeId}`)
              .then((res) => res.data)
              .catch(() => null),
          ),
        );

        episodes.push(...results.filter((ep) => ep !== null));
      }

      return episodes;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getEpisodesByIds",
        endpoint: "/api/v3/episode/{id}",
      });
    }
  }

  private buildAddPayload(request: AddSeriesRequest): Record<string, unknown> {
    const addOptions = {
      searchForMissingEpisodes:
        request.searchNow ??
        request.addOptions?.searchForMissingEpisodes ??
        false,
      monitor: request.addOptions?.monitor,
    };

    return {
      tvdbId: request.tvdbId,
      tmdbId: request.tmdbId,
      title: request.title,
      titleSlug: request.titleSlug,
      qualityProfileId: request.qualityProfileId,
      languageProfileId: request.languageProfileId,
      rootFolderPath: request.rootFolderPath,
      seasonFolder: request.seasonFolder ?? true,
      monitored: request.monitored ?? true,
      seriesType: request.seriesType ?? "standard",
      tags: request.tags,
      addOptions,
    };
  }

  private mapSeries(data: components["schemas"]["SeriesResource"]): Series {
    const posterUrl = this.findImageUrl(data.images ?? undefined, "poster");
    const backdropUrl = this.findImageUrl(data.images ?? undefined, "fanart");

    return {
      id: data.id ?? 0,
      title: data.title ?? "",
      sortTitle: data.sortTitle ?? undefined,
      year: data.year ?? undefined,
      status: (data.status as unknown as string) ?? "unknown",
      overview: data.overview ?? undefined,
      network: data.network ?? undefined,
      genres: data.genres ?? undefined,
      path: data.path ?? undefined,
      qualityProfileId: data.qualityProfileId ?? undefined,
      seasonFolder: data.seasonFolder ?? undefined,
      monitored: Boolean(data.monitored),
      tvdbId: data.tvdbId ?? undefined,
      imdbId: data.imdbId ?? undefined,
      tmdbId: data.tmdbId ?? undefined,
      traktId: (data as unknown as { traktId?: number })?.traktId ?? undefined,
      cleanTitle: data.cleanTitle ?? undefined,
      titleSlug: data.titleSlug ?? undefined,
      rootFolderPath: data.rootFolderPath ?? undefined,
      tags: data.tags ?? undefined,
      seasons: data.seasons?.map((season) =>
        this.mapSeason(season, data.id ?? undefined),
      ),
      nextAiring: data.nextAiring ?? undefined,
      previousAiring: data.previousAiring ?? undefined,
      added: data.added ?? undefined,
      posterUrl,
      backdropUrl,
      statistics: this.mapStatistics(data.statistics),
      episodeCount: data.statistics?.episodeCount,
      episodeFileCount: data.statistics?.episodeFileCount,
    };
  }

  private mapSeason(
    season: components["schemas"]["SeasonResource"],
    seriesId?: number,
  ): Season {
    const posterUrl =
      this.findImageUrl(season.images ?? undefined, "poster") ??
      (seriesId && (season.seasonNumber ?? undefined)
        ? this.buildSeasonPosterUrl(seriesId, season.seasonNumber ?? 0)
        : undefined);

    return {
      id: undefined,
      seasonNumber: season.seasonNumber ?? 0,
      monitored: Boolean(season.monitored),
      statistics: this.mapStatistics(season.statistics),
      posterUrl,
    };
  }

  private mapStatistics(
    statistics?:
      | components["schemas"]["SeasonStatisticsResource"]
      | components["schemas"]["SeriesStatisticsResource"],
  ): MediaStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      episodeCount: statistics.episodeCount ?? 0,
      episodeFileCount: statistics.episodeFileCount ?? 0,
      percentOfEpisodes: statistics.percentOfEpisodes,
    };
  }

  private mapEpisode(
    episode: components["schemas"]["EpisodeResource"],
    seriesId?: number,
    episodeFilesMap?: Map<number, components["schemas"]["EpisodeFileResource"]>,
  ): Episode {
    // Try to get poster from images array first (if available in API response)
    // Try screenshot first as it's more commonly available for episodes
    const posterUrl =
      this.findImageUrl(episode.images ?? undefined, "screenshot") ??
      this.findImageUrl(episode.images ?? undefined, "poster") ??
      (seriesId && episode.id
        ? this.buildEpisodePosterUrl(seriesId, episode.id)
        : undefined);

    // Extract size from episodeFile if available (size is in bytes, convert to MB)
    const sizeInMB = episode.episodeFile?.size
      ? episode.episodeFile.size / (1024 * 1024)
      : undefined;

    // Get detailed episode file info from the episodeFilesMap if available
    let detailedEpisodeFile:
      | components["schemas"]["EpisodeFileResource"]
      | undefined;
    if (episode.episodeFileId && episodeFilesMap) {
      detailedEpisodeFile = episodeFilesMap.get(episode.episodeFileId);
    } else if (episode.episodeFile) {
      detailedEpisodeFile = episode.episodeFile;
    }

    return {
      id: episode.id ?? 0,
      title: episode.title ?? "",
      overview: episode.overview ?? undefined,
      seasonNumber: episode.seasonNumber ?? 0,
      episodeNumber: episode.episodeNumber ?? 0,
      absoluteEpisodeNumber: episode.absoluteEpisodeNumber ?? undefined,
      airDate: episode.airDate ?? undefined,
      airDateUtc: episode.airDateUtc ?? undefined,
      runtime: episode.runtime ?? undefined,
      monitored: Boolean(episode.monitored),
      hasFile: Boolean(episode.hasFile),
      episodeFileId: episode.episodeFileId ?? undefined,
      quality: (episode as unknown as { quality?: { quality?: SonarrQuality } })
        ?.quality?.quality
        ? this.mapQualityResource(
            (episode as unknown as { quality?: { quality?: SonarrQuality } })
              .quality!.quality!,
          )
        : undefined,
      qualityInfo: detailedEpisodeFile?.quality?.quality
        ? {
            id: detailedEpisodeFile.quality.quality.id,
            name: detailedEpisodeFile.quality.quality.name ?? "Unknown",
            source: detailedEpisodeFile.quality.quality.source,
            resolution: detailedEpisodeFile.quality.quality.resolution,
          }
        : undefined,
      relativePath:
        (episode as unknown as { relativePath?: string })?.relativePath ??
        undefined,
      sizeInMB,
      mediaInfo: detailedEpisodeFile?.mediaInfo
        ? {
            videoCodec: detailedEpisodeFile.mediaInfo.videoCodec ?? undefined,
            audioCodec: detailedEpisodeFile.mediaInfo.audioCodec ?? undefined,
            audioChannels:
              detailedEpisodeFile.mediaInfo.audioChannels ?? undefined,
            resolution: detailedEpisodeFile.mediaInfo.resolution ?? undefined,
            videoBitrate:
              detailedEpisodeFile.mediaInfo.videoBitrate ?? undefined,
            audioBitrate:
              detailedEpisodeFile.mediaInfo.audioBitrate ?? undefined,
            videoFps: detailedEpisodeFile.mediaInfo.videoFps ?? undefined,
            videoDynamicRange:
              detailedEpisodeFile.mediaInfo.videoDynamicRange ?? undefined,
            videoBitDepth:
              detailedEpisodeFile.mediaInfo.videoBitDepth ?? undefined,
            scanType: detailedEpisodeFile.mediaInfo.scanType ?? undefined,
            subtitles: detailedEpisodeFile.mediaInfo.subtitles ?? undefined,
            runTime: detailedEpisodeFile.mediaInfo.runTime ?? undefined,
          }
        : undefined,
      releaseGroup: detailedEpisodeFile?.releaseGroup ?? undefined,
      sceneName: detailedEpisodeFile?.sceneName ?? undefined,
      dateAdded: detailedEpisodeFile?.dateAdded ?? undefined,
      posterUrl,
    };
  }

  private groupEpisodesBySeason(
    episodes: components["schemas"]["EpisodeResource"][],
    seriesId: number,
    episodeFilesMap?: Map<number, components["schemas"]["EpisodeFileResource"]>,
  ): Map<number, Episode[]> {
    return episodes.reduce((accumulator, episode) => {
      const seasonNum = episode.seasonNumber ?? 0;
      const collection = accumulator.get(seasonNum) ?? [];
      collection.push(this.mapEpisode(episode, seriesId, episodeFilesMap));
      accumulator.set(seasonNum, collection);
      return accumulator;
    }, new Map<number, Episode[]>());
  }

  private findImageUrl(
    images: components["schemas"]["MediaCover"][] | null | undefined,
    type: string,
  ): string | undefined {
    return (
      images?.find((image) => image.coverType === type)?.remoteUrl ?? undefined
    );
  }

  private buildSeasonPosterUrl(seriesId: number, seasonNumber: number): string {
    try {
      const url = new URL(
        `/api/v3/mediacover/${seriesId}/season-${seasonNumber}.jpg`,
        this.config.url,
      );
      if (this.config.apiKey) {
        url.searchParams.set("apikey", this.config.apiKey);
      }
      return url.toString();
    } catch {
      // Fallback to string concat if URL construction fails for any reason
      return `${
        this.config.url
      }/api/v3/mediacover/${seriesId}/season-${seasonNumber}.jpg${
        this.config.apiKey
          ? `?apikey=${encodeURIComponent(this.config.apiKey)}`
          : ""
      }`;
    }
  }

  private buildEpisodePosterUrl(seriesId: number, episodeId: number): string {
    try {
      // Try the episode-specific MediaCover endpoint format
      // Use 'screenshot' as the image type for episodes (most common)
      const url = new URL(
        `/api/v3/mediacover/${seriesId}/episode-${episodeId}-screenshot.jpg`,
        this.config.url,
      );
      if (this.config.apiKey) {
        url.searchParams.set("apikey", this.config.apiKey);
      }
      return url.toString();
    } catch {
      return `${
        this.config.url
      }/api/v3/mediacover/${seriesId}/episode-${episodeId}-screenshot.jpg${
        this.config.apiKey
          ? `?apikey=${encodeURIComponent(this.config.apiKey)}`
          : ""
      }`;
    }
  }

  private mapQueueRecord(
    record: components["schemas"]["QueueResource"],
  ): SonarrQueueItem {
    return {
      id: record.id ?? 0,
      seriesId: record.series?.id ?? 0,
      seriesTitle: record.series?.title ?? undefined,
      episodeId: record.episode?.id,
      episodeTitle: record.episode?.title ?? undefined,
      seasonNumber: record.seasonNumber ?? record.episode?.seasonNumber,
      episodeNumber: record.episode?.episodeNumber,
      status: record.status as unknown as string,
      trackedDownloadState: record.trackedDownloadState as unknown as string,
      trackedDownloadStatus: record.trackedDownloadStatus as unknown as string,
      downloadId: record.downloadId ?? undefined,
      protocol: record.protocol as unknown as string | undefined,
      size: record.size as unknown as number | undefined,
      sizeleft: record.sizeleft as unknown as number | undefined,
      timeleft: record.timeleft ?? undefined,
    };
  }

  private mapQualityProfile(
    profile: components["schemas"]["QualityProfileResource"],
  ): QualityProfile {
    return {
      id: profile.id ?? 0,
      name: profile.name ?? "",
      upgradeAllowed: profile.upgradeAllowed ?? false,
      cutoff: this.findQualityById(profile.items ?? [], profile.cutoff ?? 0),
      items: (profile.items ?? []).map((item) =>
        this.mapQualityProfileItem(item),
      ),
    };
  }

  private findQualityById(
    items: components["schemas"]["QualityProfileQualityItemResource"][] = [],
    qualityId: number,
  ): Quality {
    // Flatten all qualities from the nested structure
    const allQualities: components["schemas"]["Quality"][] = [];

    const processItem = (
      item: components["schemas"]["QualityProfileQualityItemResource"],
    ) => {
      if (item.quality) {
        allQualities.push(item.quality);
      }
      if (item.items) {
        (item.items ?? []).forEach(processItem);
      }
    };

    items.forEach(processItem);

    const found = allQualities.find((q) => (q.id ?? 0) === qualityId);
    if (found) {
      return this.mapQualityResource(found);
    }

    // Fallback: create a minimal quality object if not found
    return {
      id: qualityId,
      name: `Quality ${qualityId}`,
      source: "unknown",
      resolution: 0,
      sort: 0,
    };
  }

  private mapQualityProfileItem(
    item: components["schemas"]["QualityProfileQualityItemResource"],
  ): QualityProfileItem {
    // For groups, we need to handle differently, but for now, if no quality, use a placeholder
    const quality =
      (item.quality as components["schemas"]["Quality"] | undefined) ??
      (item as unknown as { quality?: components["schemas"]["Quality"] })
        ?.quality ??
      ({
        id: item.id || 0,
        name: item.name || "Unknown",
        source: "unknown",
        resolution: 0,
        sort: 0,
      } as components["schemas"]["Quality"]);

    return {
      allowed: Boolean(item.allowed),
      quality: this.mapQualityResource(quality),
    };
  }
  private mapQualityResource(
    resource:
      | components["schemas"]["QualityModel"]
      | components["schemas"]["Quality"],
  ): Quality {
    const maybe = resource as unknown;
    const qualityObj: components["schemas"]["Quality"] =
      ((maybe as { quality?: components["schemas"]["Quality"] })?.quality as
        | components["schemas"]["Quality"]
        | undefined) ?? (maybe as components["schemas"]["Quality"]);

    return {
      id: qualityObj?.id ?? 0,
      name: qualityObj?.name ?? "Unknown",
      source: qualityObj?.source ?? undefined,
      resolution: qualityObj?.resolution ?? 0,
      sort: (qualityObj as unknown as { sort?: number })?.sort ?? 0,
    };
  }

  private mapRootFolder(
    folder: components["schemas"]["RootFolderResource"],
  ): RootFolder {
    return {
      id: folder.id ?? 0,
      path: folder.path ?? "",
      accessible: folder.accessible ?? undefined,
      freeSpace: folder.freeSpace ?? undefined,
    };
  }
}
