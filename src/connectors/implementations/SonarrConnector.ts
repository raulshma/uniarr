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
import type {
  SearchOptions,
  SystemHealth,
  ConnectorRequestOptions,
} from "@/connectors/base/IConnector";
import { handleApiError } from "@/utils/error.utils";
import type { components } from "@/connectors/client-schemas/sonarr-openapi";
import type { NormalizedRelease } from "@/models/discover.types";
import { normalizeSonarrRelease } from "@/services/ReleaseService";
import type {
  LogQueryOptions,
  ServiceLog,
  ServiceLogLevel,
  HealthMessage,
  HealthMessageSeverity,
} from "@/models/logger.types";

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
  readonly statusMessages?: components["schemas"]["TrackedDownloadStatusMessage"][];
}

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

  override async getHealth(): Promise<SystemHealth> {
    try {
      const response =
        await this.client.get<components["schemas"]["HealthResource"][]>(
          "/api/v3/health",
        );

      const healthResources = response.data ?? [];

      const messages: HealthMessage[] = healthResources.map((resource) => {
        const severityMap: Record<string, HealthMessageSeverity> = {
          ok: "info",
          notice: "info",
          warning: "warning",
          error: "error",
        };

        return {
          id: resource.id?.toString() ?? `health-${Date.now()}`,
          serviceId: this.config.id,
          severity: severityMap[resource.type ?? "notice"] ?? "info",
          message: resource.message ?? "Unknown health issue",
          timestamp: new Date(),
          source: resource.source ?? undefined,
          wikiUrl: resource.wikiUrl?.toString() ?? undefined,
        };
      });

      const hasErrors = messages.some((m) => m.severity === "error");
      const hasWarnings = messages.some((m) => m.severity === "warning");

      let status: "healthy" | "degraded" | "offline" = "healthy";
      let message = "Service is healthy";

      if (hasErrors) {
        status = "degraded";
        message = `Service has ${messages.filter((m) => m.severity === "error").length} error(s)`;
      } else if (hasWarnings) {
        status = "degraded";
        message = `Service has ${messages.filter((m) => m.severity === "warning").length} warning(s)`;
      }

      return {
        status,
        message,
        lastChecked: new Date(),
        messages,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHealth",
        endpoint: "/api/v3/health",
      });

      return {
        status: diagnostic.isNetworkError ? "offline" : "degraded",
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  async getSeries(
    filters?: {
      tags?: number[];
      qualityProfileId?: number;
      monitored?: boolean;
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<Series[]> {
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
      >("/api/v3/series", { params, ...this.toAxiosConfig(options) });
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

  async search(
    query: string,
    searchOptions?: SearchOptions,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Series[]> {
    try {
      const params: Record<string, unknown> = { term: query };

      if (searchOptions?.filters) {
        Object.assign(params, searchOptions.filters);
      }

      const response = await this.client.get<
        components["schemas"]["SeriesResource"][]
      >("/api/v3/series/lookup", {
        params,
        ...this.toAxiosConfig(options),
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

  async getById(
    id: number,
    options?: ConnectorRequestOptions,
  ): Promise<Series> {
    try {
      const [seriesResponse, episodesResponse, episodeFilesResponse] =
        await Promise.all([
          this.client.get<components["schemas"]["SeriesResource"]>(
            `/api/v3/series/${id}`,
            {
              params: { includeSeasonImages: true },
              ...this.toAxiosConfig(options),
            },
          ),
          this.client.get<components["schemas"]["EpisodeResource"][]>(
            `/api/v3/episode`,
            {
              params: { seriesId: id, includeImages: true },
              ...this.toAxiosConfig(options),
            },
          ),
          this.client.get<components["schemas"]["EpisodeFileResource"][]>(
            "/api/v3/episodefile",
            {
              params: { seriesId: id },
              ...this.toAxiosConfig(options),
            },
          ),
        ]);

      const series = this.mapSeries(seriesResponse.data);

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
    options?: { readonly signal?: AbortSignal },
  ): Promise<components["schemas"]["EpisodeFileResource"][]> {
    try {
      const response = await this.client.get<
        components["schemas"]["EpisodeFileResource"][]
      >("/api/v3/episodefile", {
        params: { seriesId },
        ...this.toAxiosConfig(options),
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

  async add(
    request: AddSeriesRequest,
    options?: ConnectorRequestOptions,
  ): Promise<Series> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post<
        components["schemas"]["SeriesResource"]
      >("/api/v3/series", payload, this.toAxiosConfig(options));
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

  async triggerSearch(
    seriesId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "SeriesSearch",
          seriesId,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "triggerSearch",
        endpoint: "/api/v3/command",
      });
    }
  }

  async setMonitored(
    seriesId: number,
    monitored: boolean,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/series/monitor",
        {
          seriesIds: [seriesId],
          monitored,
        },
        this.toAxiosConfig(options),
      );
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
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.put(
        `/api/v3/series/${seriesId}`,
        {
          seasons: [
            {
              seasonNumber,
              monitored,
            },
          ],
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setSeasonMonitored",
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async searchMissingEpisodes(
    seriesId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "SeriesSearch",
          seriesId,
        },
        this.toAxiosConfig(options),
      );
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
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const episodesResponse = await this.client.get<
        components["schemas"]["EpisodeResource"][]
      >(`/api/v3/episode`, {
        params: { seriesId },
        ...this.toAxiosConfig(options),
      });

      const episode = episodesResponse.data.find(
        (ep) =>
          ep.seasonNumber === seasonNumber &&
          ep.episodeNumber === episodeNumber,
      );

      if (!episode || !episode.id) {
        throw new Error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
      }

      await this.client.post(
        "/api/v3/command",
        {
          name: "EpisodeSearch",
          episodeIds: [episode.id],
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchMissingEpisode",
        endpoint: "/api/v3/command",
      });
    }
  }

  async searchEpisodesByIds(
    episodeIds: number[],
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "EpisodeSearch",
          episodeIds,
        },
        this.toAxiosConfig(options),
      );
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
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const episodesResponse = await this.client.get<
        components["schemas"]["EpisodeResource"][]
      >(`/api/v3/episode`, {
        params: { seriesId },
        ...this.toAxiosConfig(options),
      });

      const episode = episodesResponse.data.find(
        (ep) =>
          ep.seasonNumber === seasonNumber &&
          ep.episodeNumber === episodeNumber,
      );

      if (!episode || !episode.id) {
        throw new Error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
      }

      await this.client.put(
        `/api/v3/episode/${episode.id}`,
        {
          monitored,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setEpisodeMonitored",
        endpoint: `/api/v3/episode`,
      });
    }
  }

  async deleteEpisodeFile(
    episodeFileId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.delete(
        `/api/v3/episodefile/${episodeFileId}`,
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteEpisodeFile",
        endpoint: `/api/v3/episodefile/${episodeFileId}`,
      });
    }
  }

  async unmonitorAllEpisodes(
    seriesId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const seriesResponse = await this.client.get<
        components["schemas"]["SeriesResource"]
      >(`/api/v3/series/${seriesId}`, this.toAxiosConfig(options));

      const series = seriesResponse.data;
      if (!series.seasons) {
        return;
      }

      const updatedSeasons = series.seasons.map((season) => ({
        seasonNumber: season.seasonNumber,
        monitored: false,
      }));

      await this.client.put(
        `/api/v3/series/${seriesId}`,
        {
          seasons: updatedSeasons,
        },
        this.toAxiosConfig(options),
      );
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
    deleteOptions: {
      deleteFiles?: boolean;
      addImportListExclusion?: boolean;
    } = {},
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const params = {
        deleteFiles: deleteOptions.deleteFiles ?? false,
        addImportListExclusion: deleteOptions.addImportListExclusion ?? false,
      };

      await this.client.delete(`/api/v3/series/${seriesId}`, {
        params,
        ...this.toAxiosConfig(options),
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
    options?: { readonly signal?: AbortSignal },
  ): Promise<Series> {
    try {
      const response = await this.client.put<
        components["schemas"]["SeriesResource"]
      >(`/api/v3/series/${seriesId}`, updates, this.toAxiosConfig(options));
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

  async refreshSeries(
    seriesId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "SeriesRefresh",
          seriesId,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "refreshSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async rescanSeries(
    seriesId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "SeriesRescan",
          seriesId,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async moveSeries(
    moveOptions: SonarrMoveSeriesOptions,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "SeriesMove",
          ...moveOptions,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "moveSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async getReleases(
    seriesId: number,
    searchOptions?: {
      season?: number;
      episode?: number;
      indexerId?: number;
      minSeeders?: number;
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<NormalizedRelease[]> {
    const candidateEndpoints = [
      "/api/v3/release",
      `/api/v3/series/${seriesId}/releases`,
      "/api/v3/releases",
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        const params: Record<string, unknown> = { seriesId };
        if (searchOptions?.season !== undefined) {
          params.season = searchOptions.season;
        }
        if (searchOptions?.episode !== undefined) {
          params.episode = searchOptions.episode;
        }
        if (searchOptions?.indexerId) {
          params.indexerId = searchOptions.indexerId;
        }

        const response = await this.client.get<SonarrRelease[]>(endpoint, {
          params,
          ...this.toAxiosConfig(options),
        });

        if (Array.isArray(response.data)) {
          return response.data
            .filter((r) => {
              if (
                searchOptions?.minSeeders !== undefined &&
                r.seeders !== null
              ) {
                return (r.seeders ?? 0) >= searchOptions.minSeeders;
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
      }
    }

    logger.warn("[SonarrConnector] Unable to find working releases endpoint", {
      serviceId: this.config.id,
      seriesId,
      tried: candidateEndpoints,
    });

    return [];
  }

  async renameSeries(
    renameOptions: SonarrRenameSeriesOptions,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v3/command",
        {
          name: "SeriesRename",
          ...renameOptions,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "renameSeries",
        endpoint: "/api/v3/command",
      });
    }
  }

  async getTags(options?: {
    readonly signal?: AbortSignal;
  }): Promise<components["schemas"]["TagResource"][]> {
    try {
      const response = await this.client.get<
        components["schemas"]["TagResource"][]
      >("/api/v3/tag", this.toAxiosConfig(options));
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
    options?: { readonly signal?: AbortSignal },
  ): Promise<components["schemas"]["TagResource"]> {
    try {
      const response = await this.client.post<
        components["schemas"]["TagResource"]
      >("/api/v3/tag", { label }, this.toAxiosConfig(options));
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
    options?: { readonly signal?: AbortSignal },
  ): Promise<components["schemas"]["TagResource"]> {
    try {
      const response = await this.client.put<
        components["schemas"]["TagResource"]
      >(
        `/api/v3/tag/${tagId}`,
        { id: tagId, label },
        this.toAxiosConfig(options),
      );
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

  async deleteTag(
    tagId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.delete(
        `/api/v3/tag/${tagId}`,
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTag",
        endpoint: `/api/v3/tag/${tagId}`,
      });
    }
  }

  async bulkUpdateSeries(
    editor: SonarrSeriesEditor,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.put(
        "/api/v3/series/editor",
        editor,
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateSeries",
        endpoint: "/api/v3/series/editor",
      });
    }
  }

  async getQualityProfiles(options?: {
    readonly signal?: AbortSignal;
  }): Promise<QualityProfile[]> {
    const candidateEndpoints = [
      "/api/v3/qualityprofile",
      "/api/v3/qualityProfile",
      "/api/v3/qualityProfiles",
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await this.client.get<
          components["schemas"]["QualityProfileResource"][]
        >(endpoint, this.toAxiosConfig(options));

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
        const axiosError = error as unknown as {
          response?: { status?: number };
        };
        const status = axiosError?.response?.status;
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

  async getRootFolders(options?: {
    readonly signal?: AbortSignal;
  }): Promise<RootFolder[]> {
    try {
      const response = await this.client.get<
        components["schemas"]["RootFolderResource"][]
      >("/api/v3/rootfolder", this.toAxiosConfig(options));
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
    options?: { readonly signal?: AbortSignal },
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
      >("/api/v3/calendar", { params, ...this.toAxiosConfig(options) });
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

  async getQueue(options?: {
    readonly signal?: AbortSignal;
  }): Promise<SonarrQueueItem[]> {
    try {
      const response = await this.client.get<
        components["schemas"]["QueueResourcePagingResource"]
      >("/api/v3/queue", this.toAxiosConfig(options));
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
    removeOptions: {
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    } = {},
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const params = {
        removeFromClient: removeOptions.removeFromClient ?? true,
        blocklist: removeOptions.blocklist ?? false,
        skipRedownload: removeOptions.skipRedownload ?? false,
        changeCategory: removeOptions.changeCategory ?? false,
      };

      await this.client.delete(`/api/v3/queue/${id}`, {
        params,
        ...this.toAxiosConfig(options),
      });
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
    removeOptions: {
      removeFromClient?: boolean;
      blocklist?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    } = {},
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const params = {
        removeFromClient: removeOptions.removeFromClient ?? true,
        blocklist: removeOptions.blocklist ?? false,
        skipRedownload: removeOptions.skipRedownload ?? false,
        changeCategory: removeOptions.changeCategory ?? false,
      };

      const payload = { ids };

      await this.client.delete("/api/v3/queue/bulk", {
        params,
        data: payload,
        ...this.toAxiosConfig(options),
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

  async getHistory(
    historyOptions?: {
      page?: number;
      pageSize?: number;
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<components["schemas"]["HistoryResourcePagingResource"]> {
    try {
      const params: Record<string, unknown> = {};
      if (historyOptions?.page) params.page = historyOptions.page;
      if (historyOptions?.pageSize) params.pageSize = historyOptions.pageSize;
      params.includeSeries = true;
      params.includeEpisode = true;
      params.sortKey = "date";
      params.sortDirection = "descending";

      const response = await this.client.get<
        components["schemas"]["HistoryResourcePagingResource"]
      >("/api/v3/history", { params, ...this.toAxiosConfig(options) });
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

  async getEpisodesByIds(
    episodeIds: number[],
    options?: { readonly signal?: AbortSignal },
  ): Promise<SonarrEpisode[]> {
    try {
      if (!episodeIds || episodeIds.length === 0) {
        return [];
      }

      const batchSize = 5;
      const episodes: SonarrEpisode[] = [];

      for (let i = 0; i < episodeIds.length; i += batchSize) {
        const batch = episodeIds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((episodeId) =>
            this.client
              .get<SonarrEpisode>(
                `/api/v3/episode/${episodeId}`,
                this.toAxiosConfig(options),
              )
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

  override async getLogs(
    options?: LogQueryOptions,
    requestOptions?: { readonly signal?: AbortSignal },
  ): Promise<ServiceLog[]> {
    try {
      const params: Record<string, unknown> = {
        pageSize: options?.limit ?? 50,
        page: options?.startIndex
          ? Math.floor(options.startIndex / (options.limit ?? 50)) + 1
          : 1,
        sortKey: "time",
        sortDirection: "descending",
      };

      if (options?.level && options.level.length > 0) {
        params.level = options.level.map((l) => l.toUpperCase()).join(",");
      }

      const response = await this.client.get<
        components["schemas"]["LogResourcePagingResource"]
      >("/api/v3/log", { params, ...this.toAxiosConfig(requestOptions) });

      const logs = (response.data.records ?? []).map((log) =>
        this.normalizeLogEntry(log),
      );

      let filteredLogs = logs;
      if (options?.since || options?.until) {
        filteredLogs = logs.filter((log) => {
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
        filteredLogs = filteredLogs.filter(
          (log) =>
            log.message.toLowerCase().includes(searchLower) ||
            log.logger?.toLowerCase().includes(searchLower) ||
            log.exception?.toLowerCase().includes(searchLower),
        );
      }

      return filteredLogs;
    } catch (error) {
      logger.error("[SonarrConnector] Failed to retrieve logs", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getLogs",
        endpoint: "/api/v3/log",
      });
    }
  }

  private normalizeLogEntry(
    log: components["schemas"]["LogResource"],
  ): ServiceLog {
    return {
      id: `sonarr-${this.config.id}-${log.id ?? Date.now()}`,
      serviceId: this.config.id,
      serviceName: this.config.name,
      serviceType: this.config.type,
      timestamp: log.time ? new Date(log.time) : new Date(),
      level: this.normalizeSonarrLogLevel(log.level),
      message: log.message ?? "",
      exception: log.exception ?? undefined,
      logger: log.logger ?? undefined,
      method: log.method ?? undefined,
      raw: JSON.stringify(log),
      metadata: {
        exceptionType: log.exceptionType,
      },
    };
  }

  private normalizeSonarrLogLevel(level?: string | null): ServiceLogLevel {
    if (!level) {
      return "info";
    }

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
        return "fatal";
      default:
        return "info";
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
    const posterUrl =
      this.findImageUrl(episode.images ?? undefined, "screenshot") ??
      this.findImageUrl(episode.images ?? undefined, "poster") ??
      (seriesId && episode.id
        ? this.buildEpisodePosterUrl(seriesId, episode.id)
        : undefined);

    const sizeInMB = episode.episodeFile?.size
      ? episode.episodeFile.size / (1024 * 1024)
      : undefined;

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
      statusMessages: record.statusMessages || undefined,
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
