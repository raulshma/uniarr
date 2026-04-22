import { BaseConnector } from "@/connectors/base/BaseConnector";
import type {
  SearchOptions,
  SystemHealth,
  ConnectorRequestOptions,
} from "@/connectors/base/IConnector";
import type {
  Quality,
  QualityProfile,
  QualityProfileItem,
  RootFolder,
} from "@/models/media.types";
import type {
  AddMovieRequest,
  Movie,
  MovieFile,
  MovieRatings,
  MovieStatistics,
  RadarrQueueItem,
} from "@/models/movie.types";
import { handleApiError } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";

import type { components } from "@/connectors/client-schemas/radarr-openapi";
import type { NormalizedRelease } from "@/models/discover.types";
import { normalizeRadarrRelease } from "@/services/ReleaseService";
import type {
  LogQueryOptions,
  ServiceLog,
  ServiceLogLevel,
  HealthMessage,
  HealthMessageSeverity,
} from "@/models/logger.types";

export type { RadarrQueueItem };

type RadarrSystemStatus = components["schemas"]["SystemResource"];
type RadarrMovieImage = components["schemas"]["MediaCover"];
type RadarrRatings = components["schemas"]["Ratings"];
type RadarrMovieFile = components["schemas"]["MovieFileResource"];
type RadarrMovieStatistics = components["schemas"]["MovieStatisticsResource"];
type RadarrQualityItem = components["schemas"]["Quality"];
type RadarrQualityProfileItem =
  components["schemas"]["QualityProfileQualityItemResource"];
type RadarrQualityProfile = components["schemas"]["QualityProfileResource"];
type RadarrRootFolder = components["schemas"]["RootFolderResource"];
type RadarrQueueRecord = components["schemas"]["QueueResource"];
type RadarrQueueResponse = components["schemas"]["QueueResourcePagingResource"];
type RadarrTag = components["schemas"]["TagResource"];
type RadarrMovie = components["schemas"]["MovieResource"];
type RadarrMovieEditor = components["schemas"]["MovieEditorResource"];
type RadarrRelease = components["schemas"]["ReleaseResource"];

type RadarrMoveMovieOptions = {
  movieId: number;
  destinationPath: string;
  moveFiles?: boolean;
};

const RADARR_API_PREFIX = "/api/v3";

export class RadarrConnector extends BaseConnector<Movie, AddMovieRequest> {
  async initialize(): Promise<void> {
    logger.debug("[RadarrConnector] Initializing", {
      serviceId: this.config.id,
    });
    await this.getVersion();
    logger.debug("[RadarrConnector] Initialization completed", {
      serviceId: this.config.id,
    });
  }

  async getVersion(): Promise<string> {
    try {
      const fullUrl = `${this.config.url}${RADARR_API_PREFIX}/system/status`;
      logger.debug("[RadarrConnector] Getting version", {
        serviceId: this.config.id,
        url: fullUrl,
      });
      logger.debug("[RadarrConnector] Config details", {
        serviceId: this.config.id,
        url: this.config.url,
        apiKey: this.config.apiKey ? "***" : "missing",
        timeout: this.config.timeout,
      });

      const response = await this.client.get<RadarrSystemStatus>(
        `${RADARR_API_PREFIX}/system/status`,
      );
      const version = (response.data?.version as string) ?? "unknown";
      logger.debug("[RadarrConnector] Version retrieved", {
        serviceId: this.config.id,
        version,
        status: response.status,
      });
      return version;
    } catch (error) {
      logger.error("[RadarrConnector] Version request failed", {
        serviceId: this.config.id,
        error,
      });
      const axiosError = error as unknown as {
        message?: string;
        code?: string;
        response?: { status?: number; statusText?: string };
      };
      logger.debug("[RadarrConnector] Error details", {
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
        logger.debug("[RadarrConnector] Network connectivity issue detected", {
          serviceId: this.config.id,
          code: axiosError.code,
        });
      }

      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
        endpoint: `${RADARR_API_PREFIX}/system/status`,
      });
    }
  }

  override async getHealth(): Promise<SystemHealth> {
    try {
      const response = await this.client.get<
        components["schemas"]["HealthResource"][]
      >(`${RADARR_API_PREFIX}/health`);

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
        endpoint: `${RADARR_API_PREFIX}/health`,
      });

      return {
        status: diagnostic.isNetworkError ? "offline" : "degraded",
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  async getMovies(
    filters?: {
      tags?: number[];
      qualityProfileId?: number;
      monitored?: boolean;
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<Movie[]> {
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

      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/movie`,
        { params, ...this.toAxiosConfig(options) },
      );
      return (response.data ?? []).map((item) => this.mapMovie(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMovies",
        endpoint: `${RADARR_API_PREFIX}/movie`,
      });
    }
  }

  async search(
    query: string,
    searchOptions?: SearchOptions,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Movie[]> {
    try {
      const params: Record<string, unknown> = { term: query };

      if (searchOptions?.filters) {
        Object.assign(params, searchOptions.filters);
      }

      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/movie/lookup`,
        {
          params,
          ...this.toAxiosConfig(options),
        },
      );

      return (response.data ?? []).map((item) => this.mapMovie(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "search",
        endpoint: `${RADARR_API_PREFIX}/movie/lookup`,
      });
    }
  }

  async lookupByTmdbId(
    tmdbId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Movie | undefined> {
    try {
      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/movie/lookup/tmdb`,
        {
          params: { tmdbId },
          ...this.toAxiosConfig(options),
        },
      );

      if (response.data && response.data.length > 0) {
        return this.mapMovie(response.data[0]);
      }

      logger.debug("[RadarrConnector] TMDB lookup returned no results", {
        serviceId: this.config.id,
        tmdbId,
      });
      return undefined;
    } catch (error) {
      logger.warn("[RadarrConnector] TMDB lookup failed", {
        serviceId: this.config.id,
        tmdbId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async getById(id: number, options?: ConnectorRequestOptions): Promise<Movie> {
    try {
      const response = await this.client.get<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie/${id}`,
        this.toAxiosConfig(options),
      );
      return this.mapMovie(response.data as RadarrMovie);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getById",
        endpoint: `${RADARR_API_PREFIX}/movie/${id}`,
      });
    }
  }

  async add(
    request: AddMovieRequest,
    options?: ConnectorRequestOptions,
  ): Promise<Movie> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie`,
        payload,
        this.toAxiosConfig(options),
      );
      return this.mapMovie(response.data as RadarrMovie);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "add",
        endpoint: `${RADARR_API_PREFIX}/movie`,
      });
    }
  }

  async triggerSearch(
    movieId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        `${RADARR_API_PREFIX}/command`,
        {
          name: "MoviesSearch",
          movieIds: [movieId],
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "triggerSearch",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async setMonitored(
    movieId: number,
    monitored: boolean,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      const existing = await this.client.get<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie/${movieId}`,
        this.toAxiosConfig(options),
      );
      const payload = {
        ...(existing.data as RadarrMovie),
        monitored,
      };

      await this.client.put(
        `${RADARR_API_PREFIX}/movie/${movieId}`,
        payload as unknown as RadarrMovie,
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setMonitored",
        endpoint: `${RADARR_API_PREFIX}/movie/${movieId}`,
      });
    }
  }

  async deleteMovie(
    movieId: number,
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

      await this.client.delete(`${RADARR_API_PREFIX}/movie/${movieId}`, {
        params,
        ...this.toAxiosConfig(options),
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteMovie",
        endpoint: `${RADARR_API_PREFIX}/movie/${movieId}`,
      });
    }
  }

  async updateMovie(
    movieId: number,
    updates: Partial<
      Omit<
        RadarrMovie,
        "id" | "movieFile" | "ratings" | "statistics" | "images"
      >
    >,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Movie> {
    try {
      const response = await this.client.put<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie/${movieId}`,
        updates,
        this.toAxiosConfig(options),
      );
      return this.mapMovie(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateMovie",
        endpoint: `${RADARR_API_PREFIX}/movie/${movieId}`,
      });
    }
  }

  async refreshMovie(
    movieId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        `${RADARR_API_PREFIX}/command`,
        {
          name: "MoviesRefresh",
          movieIds: [movieId],
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "refreshMovie",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async rescanMovie(
    movieId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        `${RADARR_API_PREFIX}/command`,
        {
          name: "MoviesRescan",
          movieIds: [movieId],
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanMovie",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async moveMovie(
    moveOptions: RadarrMoveMovieOptions,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        `${RADARR_API_PREFIX}/command`,
        {
          name: "MoviesMove",
          ...moveOptions,
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "moveMovie",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async getReleases(
    movieId: number,
    searchOptions?: { indexerId?: number; minSeeders?: number },
    options?: { readonly signal?: AbortSignal },
  ): Promise<NormalizedRelease[]> {
    const candidateEndpoints = [
      `${RADARR_API_PREFIX}/release`,
      `${RADARR_API_PREFIX}/movie/${movieId}/releases`,
      `${RADARR_API_PREFIX}/releases`,
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        const params: Record<string, unknown> = { movieId };
        if (searchOptions?.indexerId) {
          params.indexerId = searchOptions.indexerId;
        }

        const response = await this.client.get<RadarrRelease[]>(endpoint, {
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
            .map((r) => normalizeRadarrRelease(r, this.config.id));
        }
      } catch (error) {
        const axiosError = error as unknown as {
          response?: { status?: number };
        };
        const status = axiosError?.response?.status;
        if (status !== 404) {
          logger.warn("[RadarrConnector] Unexpected error fetching releases", {
            serviceId: this.config.id,
            endpoint,
            status,
            movieId,
          });
        }
      }
    }

    logger.warn("[RadarrConnector] Unable to find working releases endpoint", {
      serviceId: this.config.id,
      movieId,
      tried: candidateEndpoints,
    });

    return [];
  }

  async getTags(options?: {
    readonly signal?: AbortSignal;
  }): Promise<RadarrTag[]> {
    try {
      const response = await this.client.get<RadarrTag[]>(
        `${RADARR_API_PREFIX}/tag`,
        this.toAxiosConfig(options),
      );
      return response.data ?? [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTags",
        endpoint: `${RADARR_API_PREFIX}/tag`,
      });
    }
  }

  async createTag(
    label: string,
    options?: { readonly signal?: AbortSignal },
  ): Promise<RadarrTag> {
    try {
      const response = await this.client.post<RadarrTag>(
        `${RADARR_API_PREFIX}/tag`,
        { label },
        this.toAxiosConfig(options),
      );
      return response.data as RadarrTag;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "createTag",
        endpoint: `${RADARR_API_PREFIX}/tag`,
      });
    }
  }

  async updateTag(
    tagId: number,
    label: string,
    options?: { readonly signal?: AbortSignal },
  ): Promise<RadarrTag> {
    try {
      const response = await this.client.put<RadarrTag>(
        `${RADARR_API_PREFIX}/tag/${tagId}`,
        { id: tagId, label },
        this.toAxiosConfig(options),
      );
      return response.data as RadarrTag;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateTag",
        endpoint: `${RADARR_API_PREFIX}/tag/${tagId}`,
      });
    }
  }

  async deleteTag(
    tagId: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.delete(
        `${RADARR_API_PREFIX}/tag/${tagId}`,
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTag",
        endpoint: `${RADARR_API_PREFIX}/tag/${tagId}`,
      });
    }
  }

  async bulkUpdateMovies(
    editor: RadarrMovieEditor,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.put(
        `${RADARR_API_PREFIX}/movie/editor`,
        editor,
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateMovies",
        endpoint: `${RADARR_API_PREFIX}/movie/editor`,
      });
    }
  }

  async getQualityProfiles(options?: {
    readonly signal?: AbortSignal;
  }): Promise<QualityProfile[]> {
    const candidateEndpoints = [
      `${RADARR_API_PREFIX}/qualityprofile`,
      `${RADARR_API_PREFIX}/qualityProfile`,
      `${RADARR_API_PREFIX}/qualityProfiles`,
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await this.client.get<RadarrQualityProfile[]>(
          endpoint,
          this.toAxiosConfig(options),
        );

        if (
          response.data &&
          typeof response.data === "object" &&
          !Array.isArray(response.data) &&
          "error" in response.data
        ) {
          const errObj = response.data as unknown as { error?: string };
          throw new Error(errObj.error ?? "Unknown error");
        }

        return (response.data ?? []).map((profile) =>
          this.mapQualityProfile(profile as RadarrQualityProfile),
        );
      } catch (error) {
        const axiosError = error as unknown as {
          response?: { status?: number };
        };
        const status = axiosError?.response?.status;
        if (status !== 404) {
          const enhancedError = new Error(
            "Failed to load quality profiles. This may be due to corrupted custom formats in Radarr. Please check your Radarr quality profiles and custom formats, then try again.",
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
      "Failed to load quality profiles. Tried several Radarr endpoints but none responded. This may be due to API changes or server configuration.",
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
      const response = await this.client.get<RadarrRootFolder[]>(
        `${RADARR_API_PREFIX}/rootfolder`,
        this.toAxiosConfig(options),
      );
      return (response.data ?? []).map((folder) =>
        this.mapRootFolder(folder as RadarrRootFolder),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getRootFolders",
        endpoint: `${RADARR_API_PREFIX}/rootfolder`,
      });
    }
  }

  async getCalendar(
    start?: string,
    end?: string,
    unmonitored?: boolean,
    options?: { readonly signal?: AbortSignal },
  ): Promise<RadarrMovie[]> {
    try {
      const params: Record<string, unknown> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (unmonitored !== undefined) params.unmonitored = unmonitored;

      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/calendar`,
        { params, ...this.toAxiosConfig(options) },
      );
      return (response.data ?? []) as RadarrMovie[];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getCalendar",
        endpoint: `${RADARR_API_PREFIX}/calendar`,
      });
    }
  }

  async getQueue(options?: {
    readonly signal?: AbortSignal;
  }): Promise<RadarrQueueItem[]> {
    try {
      const response = await this.client.get<RadarrQueueResponse>(
        `${RADARR_API_PREFIX}/queue`,
        this.toAxiosConfig(options),
      );
      const records = (response.data?.records ?? []) as RadarrQueueRecord[];
      return records.map((record) => this.mapQueueRecord(record));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQueue",
        endpoint: `${RADARR_API_PREFIX}/queue`,
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
      params.includeMovie = true;
      params.sortKey = "date";
      params.sortDirection = "descending";

      const response = await this.client.get<
        components["schemas"]["HistoryResourcePagingResource"]
      >(`${RADARR_API_PREFIX}/history`, {
        params,
        ...this.toAxiosConfig(options),
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHistory",
        endpoint: `${RADARR_API_PREFIX}/history`,
      });
    }
  }

  private buildAddPayload(request: AddMovieRequest): Record<string, unknown> {
    const sanitizedRoot = this.trimTrailingSlash(request.rootFolderPath);
    const pathSuffix =
      request.path ?? this.buildDefaultPathSuffix(request.title, request.year);
    const path = `${sanitizedRoot}/${pathSuffix}`;

    const addOptions = {
      searchOnAdd: request.searchOnAdd ?? request.searchForMovie ?? false,
      searchForMovie: request.searchForMovie ?? request.searchOnAdd ?? false,
      monitor: request.monitored ? "movie" : "none",
    };

    return {
      title: request.title,
      qualityProfileId: request.qualityProfileId,
      tmdbId: request.tmdbId,
      year: request.year,
      titleSlug: request.titleSlug,
      images: request.images?.map((image) => ({
        coverType: image.coverType,
        url: image.url,
        remoteUrl: image.remoteUrl,
      })),
      rootFolderPath: request.rootFolderPath,
      monitored: request.monitored,
      minimumAvailability: request.minimumAvailability ?? "announced",
      tags: request.tags ?? [],
      addOptions,
      path,
    };
  }

  private buildDefaultPathSuffix(title: string, year?: number): string {
    const normalizedTitle = title.replace(/[:\\/*?"<>|]/g, "").trim();
    return year ? `${normalizedTitle} (${year})` : normalizedTitle;
  }

  private trimTrailingSlash(input: string): string {
    return input.replace(/[\\/]+$/u, "");
  }

  private mapMovie(data: RadarrMovie | undefined): Movie {
    const posterUrl = this.resolveImageUrl(
      this.findImageUrl(
        (data?.images as RadarrMovieImage[] | undefined) ?? [],
        "poster",
      ),
    );
    const backdropUrl = this.resolveImageUrl(
      this.findImageUrl(
        (data?.images as RadarrMovieImage[] | undefined) ?? [],
        "fanart",
      ),
    );
    return {
      id: (data?.id ?? 0) as number,
      title: (data?.title ?? "") as string,
      sortTitle: (data?.sortTitle ?? undefined) as string | undefined,
      year: data?.year,
      status: (data?.status ?? undefined) as string | undefined,
      overview: (data?.overview ?? undefined) as string | undefined,
      studio: (data?.studio ?? undefined) as string | undefined,
      genres: data?.genres ?? [],
      path: (data?.path ?? undefined) as string | undefined,
      qualityProfileId: data?.qualityProfileId,
      monitored: Boolean(data?.monitored),
      hasFile: Boolean(data?.hasFile),
      isAvailable: data?.isAvailable,
      minimumAvailability: (data?.minimumAvailability ?? undefined) as
        | string
        | undefined,
      runtime: data?.runtime,
      certification: (data?.certification ?? undefined) as string | undefined,
      imdbId: (data?.imdbId ?? undefined) as string | undefined,
      tmdbId: data?.tmdbId,
      titleSlug: (data?.titleSlug ?? undefined) as string | undefined,
      website: (data?.website ?? undefined) as string | undefined,
      inCinemas: (data?.inCinemas ?? undefined) as string | undefined,
      digitalRelease: (data?.digitalRelease ?? undefined) as string | undefined,
      physicalRelease: (data?.physicalRelease ?? undefined) as
        | string
        | undefined,
      releaseDate: (data?.releaseDate ?? undefined) as string | undefined,
      tags: data?.tags ?? [],
      posterUrl,
      backdropUrl,
      ratings: this.mapRatings(data?.ratings as RadarrRatings | undefined),
      statistics: this.mapStatistics(
        data?.statistics as RadarrMovieStatistics | undefined,
      ),
      movieFile: this.mapMovieFile(
        data?.movieFile as RadarrMovieFile | undefined,
      ),
      images: (data?.images ?? []).map((image) => ({
        coverType: (image?.coverType ?? "") as string,
        url: (image?.url ?? undefined) as string | undefined,
        remoteUrl: (image?.remoteUrl ?? undefined) as string | undefined,
      })),
    };
  }

  private mapRatings(
    ratings?: RadarrRatings | undefined,
  ): MovieRatings | undefined {
    if (!ratings) {
      return undefined;
    }

    const imdb = ratings.imdb ?? undefined;
    const tmdb = ratings.tmdb ?? undefined;
    const mc = ratings.metacritic ?? undefined;
    const rt = ratings.rottenTomatoes ?? undefined;
    const trakt = ratings.trakt ?? undefined;

    if (imdb?.value ?? imdb?.votes) {
      return { value: imdb.value, votes: imdb.votes, type: "imdb" };
    }
    if (tmdb?.value ?? tmdb?.votes) {
      return { value: tmdb.value, votes: tmdb.votes, type: "tmdb" };
    }
    if (mc?.value ?? mc?.votes) {
      return { value: mc.value, votes: mc.votes, type: "metacritic" };
    }
    if (rt?.value ?? rt?.votes) {
      return { value: rt.value, votes: rt.votes, type: "rottenTomatoes" };
    }
    if (trakt?.value ?? trakt?.votes) {
      return { value: trakt.value, votes: trakt.votes, type: "trakt" };
    }

    return undefined;
  }

  private mapStatistics(
    statistics?: RadarrMovieStatistics | undefined,
  ): MovieStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      movieFileCount: statistics.movieFileCount,
      sizeOnDisk: statistics.sizeOnDisk,
      percentAvailable: undefined,
    };
  }

  private mapMovieFile(
    movieFile?: RadarrMovieFile | undefined,
  ): MovieFile | undefined {
    if (!movieFile) {
      return undefined;
    }

    return {
      id: movieFile.id as number,
      relativePath: (movieFile.relativePath ?? undefined) as string | undefined,
      size: movieFile.size,
      dateAdded: movieFile.dateAdded,
      sceneName: (movieFile.sceneName ?? undefined) as string | undefined,
      quality: movieFile.quality
        ? {
            quality: movieFile.quality.quality
              ? this.mapQualityResource(
                  movieFile.quality.quality as RadarrQualityItem,
                )
              : undefined,
            revision: movieFile.quality.revision as any,
          }
        : undefined,
    };
  }

  private mapQueueRecord(record: RadarrQueueRecord): RadarrQueueItem {
    return {
      id: record.id as number,
      movieId: (record.movie as any)?.id as number,
      title: (record.movie as any)?.title as string,
      status: record.status,
      trackedDownloadState: record.trackedDownloadState,
      trackedDownloadStatus: record.trackedDownloadStatus,
      protocol: record.protocol,
      size: record.size,
      sizeleft: record.sizeleft,
      timeleft: record.timeleft ?? undefined,
    };
  }

  private mapQualityProfile(
    profile: RadarrQualityProfile | undefined,
  ): QualityProfile {
    const items = (profile?.items ?? []) as RadarrQualityProfileItem[];
    return {
      id: (profile?.id ?? 0) as number,
      name: (profile?.name ?? "") as string,
      upgradeAllowed: profile?.upgradeAllowed,
      cutoff: this.findQualityById(items, profile?.cutoff ?? 0),
      items: items.map((item) => this.mapQualityProfileItem(item)),
    };
  }

  private findQualityById(
    items: RadarrQualityProfileItem[],
    qualityId: number,
  ): Quality {
    const allQualities: RadarrQualityItem[] = [];

    const processItem = (item: RadarrQualityProfileItem) => {
      if (item.quality) {
        allQualities.push(item.quality);
      }
      if (item.items) {
        item.items.forEach(processItem);
      }
    };

    items.forEach(processItem as any);

    const found = allQualities.find((q) => q.id === qualityId);
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
    item: RadarrQualityProfileItem | undefined,
  ): QualityProfileItem {
    const quality = item?.quality || {
      id: (item?.id ?? 0) as number,
      name: item?.name ?? "Unknown",
      source: "unknown",
      resolution: 0,
      sort: 0,
    };

    return {
      allowed: Boolean(item?.allowed),
      quality: this.mapQualityResource(quality as RadarrQualityItem),
    };
  }

  private mapQualityResource(resource: RadarrQualityItem | undefined): Quality {
    return {
      id: (resource?.id ?? 0) as number,
      name: (resource?.name ?? "") as string,
      source: resource?.source,
      resolution: resource?.resolution ?? 0,
      sort: 0,
    };
  }

  private mapRootFolder(folder: RadarrRootFolder | undefined): RootFolder {
    return {
      id: (folder?.id ?? 0) as number,
      path: folder?.path ?? "",
      accessible: folder?.accessible,
      freeSpace: (folder?.freeSpace ?? undefined) as number | undefined,
    };
  }

  private findImageUrl(
    images: (RadarrMovieImage | undefined)[] | undefined,
    type: string,
  ): string | undefined {
    if (!images?.length) {
      return undefined;
    }

    const match = images.find((image) => (image?.coverType ?? "") === type);
    if (!match) {
      return undefined;
    }

    return (match?.remoteUrl ?? match?.url) as string | undefined;
  }

  private resolveImageUrl(url: string | undefined): string | undefined {
    if (!url) {
      return undefined;
    }

    try {
      const resolved = new URL(url, this.client.defaults.baseURL as string);

      if (this.config.apiKey) {
        const base = new URL(this.client.defaults.baseURL as string);
        if (resolved.origin === base.origin) {
          resolved.searchParams.set("apikey", this.config.apiKey);
        }
      }

      return resolved.toString();
    } catch {
      return url;
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
      >(`${RADARR_API_PREFIX}/log`, {
        params,
        ...this.toAxiosConfig(requestOptions),
      });

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
      logger.error("[RadarrConnector] Failed to retrieve logs", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getLogs",
        endpoint: `${RADARR_API_PREFIX}/log`,
      });
    }
  }

  private normalizeLogEntry(
    log: components["schemas"]["LogResource"],
  ): ServiceLog {
    return {
      id: `radarr-${this.config.id}-${log.id ?? Date.now()}`,
      serviceId: this.config.id,
      serviceName: this.config.name,
      serviceType: this.config.type,
      timestamp: log.time ? new Date(log.time) : new Date(),
      level: this.normalizeRadarrLogLevel(log.level),
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

  private normalizeRadarrLogLevel(level?: string | null): ServiceLogLevel {
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
}
