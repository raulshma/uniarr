import { BaseConnector } from "@/connectors/base/BaseConnector";
import type { SearchOptions } from "@/connectors/base/IConnector";
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

// Aliases for generated OpenAPI types
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
        `${RADARR_API_PREFIX}/system/status`
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
      const axiosError = error as any;
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

  async getMovies(): Promise<Movie[]> {
    try {
      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/movie`
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

  async search(query: string, options?: SearchOptions): Promise<Movie[]> {
    try {
      const params: Record<string, unknown> = { term: query };

      if (options?.filters) {
        Object.assign(params, options.filters);
      }

      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/movie/lookup`,
        {
          params,
        }
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

  async getById(id: number): Promise<Movie> {
    try {
      const response = await this.client.get<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie/${id}`
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

  async add(request: AddMovieRequest): Promise<Movie> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie`,
        payload
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

  async triggerSearch(movieId: number): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: "MoviesSearch",
        movieIds: [movieId],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "triggerSearch",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async setMonitored(movieId: number, monitored: boolean): Promise<void> {
    try {
      const existing = await this.client.get<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie/${movieId}`
      );
      const payload = {
        ...(existing.data as RadarrMovie),
        monitored,
      };

      await this.client.put(
        `${RADARR_API_PREFIX}/movie/${movieId}`,
        payload as unknown as RadarrMovie
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
    options: { deleteFiles?: boolean; addImportListExclusion?: boolean } = {}
  ): Promise<void> {
    try {
      const params = {
        deleteFiles: options.deleteFiles ?? false,
        addImportListExclusion: options.addImportListExclusion ?? false,
      };

      await this.client.delete(`${RADARR_API_PREFIX}/movie/${movieId}`, {
        params,
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
    >
  ): Promise<Movie> {
    try {
      const response = await this.client.put<RadarrMovie>(
        `${RADARR_API_PREFIX}/movie/${movieId}`,
        updates
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

  async refreshMovie(movieId: number): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: "MoviesRefresh",
        movieIds: [movieId],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "refreshMovie",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async rescanMovie(movieId: number): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: "MoviesRescan",
        movieIds: [movieId],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanMovie",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async moveMovie(options: RadarrMoveMovieOptions): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: "MoviesMove",
        ...options,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "moveMovie",
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async getTags(): Promise<RadarrTag[]> {
    try {
      const response = await this.client.get<RadarrTag[]>(
        `${RADARR_API_PREFIX}/tag`
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

  async createTag(label: string): Promise<RadarrTag> {
    try {
      const response = await this.client.post<RadarrTag>(
        `${RADARR_API_PREFIX}/tag`,
        { label }
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

  async updateTag(tagId: number, label: string): Promise<RadarrTag> {
    try {
      const response = await this.client.put<RadarrTag>(
        `${RADARR_API_PREFIX}/tag/${tagId}`,
        { id: tagId, label }
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

  async deleteTag(tagId: number): Promise<void> {
    try {
      await this.client.delete(`${RADARR_API_PREFIX}/tag/${tagId}`);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTag",
        endpoint: `${RADARR_API_PREFIX}/tag/${tagId}`,
      });
    }
  }

  async bulkUpdateMovies(editor: RadarrMovieEditor): Promise<void> {
    try {
      await this.client.put(`${RADARR_API_PREFIX}/movie/editor`, editor);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateMovies",
        endpoint: `${RADARR_API_PREFIX}/movie/editor`,
      });
    }
  }

  async getQualityProfiles(): Promise<QualityProfile[]> {
    const candidateEndpoints = [
      `${RADARR_API_PREFIX}/qualityprofile`,
      `${RADARR_API_PREFIX}/qualityProfile`,
      `${RADARR_API_PREFIX}/qualityProfiles`,
    ];

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await this.client.get<RadarrQualityProfile[]>(
          endpoint
        );

        // Check if response contains an error
        if (
          response.data &&
          typeof response.data === "object" &&
          !Array.isArray(response.data) &&
          "error" in response.data
        ) {
          throw new Error((response.data as any).error as string);
        }

        return (response.data ?? []).map((profile) =>
          this.mapQualityProfile(profile as RadarrQualityProfile)
        );
      } catch (error) {
        const axiosError = error as any;
        const status = axiosError?.response?.status;
        if (status !== 404) {
          const enhancedError = new Error(
            "Failed to load quality profiles. This may be due to corrupted custom formats in Radarr. Please check your Radarr quality profiles and custom formats, then try again."
          );
          throw handleApiError(enhancedError, {
            serviceId: this.config.id,
            serviceType: this.config.type,
            operation: "getQualityProfiles",
            endpoint,
          });
        }
        // otherwise try next candidate
      }
    }

    const enhancedError = new Error(
      "Failed to load quality profiles. Tried several Radarr endpoints but none responded. This may be due to API changes or server configuration."
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
      const response = await this.client.get<RadarrRootFolder[]>(
        `${RADARR_API_PREFIX}/rootfolder`
      );
      return (response.data ?? []).map((folder) =>
        this.mapRootFolder(folder as RadarrRootFolder)
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
    unmonitored?: boolean
  ): Promise<RadarrMovie[]> {
    try {
      const params: Record<string, unknown> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (unmonitored !== undefined) params.unmonitored = unmonitored;

      const response = await this.client.get<RadarrMovie[]>(
        `${RADARR_API_PREFIX}/calendar`,
        { params }
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

  async getQueue(): Promise<RadarrQueueItem[]> {
    try {
      const response = await this.client.get<RadarrQueueResponse>(
        `${RADARR_API_PREFIX}/queue`
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

  async getHistory(options?: { page?: number; pageSize?: number }): Promise<components["schemas"]["HistoryResourcePagingResource"]> {
    try {
      const params: Record<string, unknown> = {};
      if (options?.page) params.page = options.page;
      if (options?.pageSize) params.pageSize = options.pageSize;
      // Include related data for better UI display
      params.includeMovie = true;
      // Order by most recent first
      params.sortKey = "date";
      params.sortDirection = "descending";

      const response = await this.client.get<
        components["schemas"]["HistoryResourcePagingResource"]
      >(`${RADARR_API_PREFIX}/history`, { params });
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
        "poster"
      )
    );
    const backdropUrl = this.resolveImageUrl(
      this.findImageUrl(
        (data?.images as RadarrMovieImage[] | undefined) ?? [],
        "fanart"
      )
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
        data?.statistics as RadarrMovieStatistics | undefined
      ),
      movieFile: this.mapMovieFile(
        data?.movieFile as RadarrMovieFile | undefined
      ),
      images: (data?.images ?? []).map((image) => ({
        coverType: (image?.coverType ?? "") as string,
        url: (image?.url ?? undefined) as string | undefined,
        remoteUrl: (image?.remoteUrl ?? undefined) as string | undefined,
      })),
    };
  }

  private mapRatings(
    ratings?: RadarrRatings | undefined
  ): MovieRatings | undefined {
    if (!ratings) {
      return undefined;
    }

    // Ratings in Radarr are nested (imdb/tmdb/etc). Prefer imdb, then tmdb, then others.
    const pick = (r?: { value?: number; votes?: number } | null) => ({
      value: r?.value,
      votes: r?.votes,
    });

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
    statistics?: RadarrMovieStatistics | undefined
  ): MovieStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      movieFileCount: statistics.movieFileCount,
      sizeOnDisk: statistics.sizeOnDisk,
      // Radarr's MovieStatisticsResource does not include percentAvailable; keep undefined.
      percentAvailable: undefined,
    };
  }

  private mapMovieFile(
    movieFile?: RadarrMovieFile | undefined
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
                  movieFile.quality.quality as RadarrQualityItem
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
    profile: RadarrQualityProfile | undefined
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
    qualityId: number
  ): Quality {
    // Flatten all qualities from the nested structure
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
    item: RadarrQualityProfileItem | undefined
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
    type: string
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

      // If the connector has an apiKey and the resolved URL is within the same origin,
      // append the apikey as a query parameter so image requests can be authenticated.
      if (this.config.apiKey) {
        const base = new URL(this.client.defaults.baseURL as string);
        if (resolved.origin === base.origin) {
          resolved.searchParams.set("apikey", this.config.apiKey);
        }
      }

      return resolved.toString();
    } catch (_error) {
      return url;
    }
  }
}
