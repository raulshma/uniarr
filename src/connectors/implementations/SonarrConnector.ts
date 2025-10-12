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

// Local aliases for the Sonarr OpenAPI-generated schemas. Using these aliases
// keeps the rest of the file readable and allows us to change the underlying
// source of truth without updating every usage site.
type SonarrSeries = components["schemas"]["SeriesResource"];
type SonarrEpisode = components["schemas"]["EpisodeResource"];
type SonarrSystemStatus = components["schemas"]["SystemResource"];
type SonarrQualityProfile = components["schemas"]["QualityProfileResource"];
type SonarrQualityProfileItem =
  components["schemas"]["QualityProfileQualityItemResource"];
type SonarrQuality = components["schemas"]["Quality"];
type SonarrRootFolder = components["schemas"]["RootFolderResource"];
type SonarrQueueResponse = components["schemas"]["QueueResourcePagingResource"];
type SonarrQueueRecord = components["schemas"]["QueueResource"];
type SonarrTag = components["schemas"]["TagResource"];

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
      const axiosError = error as any;
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

  async getSeries(): Promise<Series[]> {
    try {
      const response = await this.client.get<
        components["schemas"]["SeriesResource"][]
      >("/api/v3/series");
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
      const [seriesResponse, episodesResponse] = await Promise.all([
        this.client.get<components["schemas"]["SeriesResource"]>(
          `/api/v3/series/${id}`,
          {
            params: { includeSeasonImages: true },
          }
        ),
        this.client.get<components["schemas"]["EpisodeResource"][]>(
          `/api/v3/episode`,
          {
            params: { seriesId: id, includeImages: true },
          }
        ),
      ]);

      const series = this.mapSeries(seriesResponse.data);
      const episodesBySeason = this.groupEpisodesBySeason(
        episodesResponse.data,
        series.id
      );

      const seasons: Season[] | undefined = series.seasons?.map((season) => ({
        ...season,
        episodes: episodesBySeason.get(season.seasonNumber),
      }));

      return {
        ...series,
        seasons,
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

  async deleteSeries(
    seriesId: number,
    options: { deleteFiles?: boolean; addImportListExclusion?: boolean } = {}
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
    >
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
      const response = await this.client.get<
        components["schemas"]["TagResource"][]
      >("/api/v3/tag");
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
    label: string
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
    label: string
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
        const response = await this.client.get<
          components["schemas"]["QualityProfileResource"][]
        >(endpoint);

        // Check if response contains an error
        if (
          response.data &&
          typeof response.data === "object" &&
          !Array.isArray(response.data) &&
          "error" in response.data
        ) {
          throw new Error((response.data as any).error as string);
        }

        return response.data.map((profile) => this.mapQualityProfile(profile));
      } catch (error) {
        // If this endpoint returned a 404, try the next candidate.
        const axiosError = error as any;
        const status = axiosError?.response?.status;
        // Only continue trying on 404; for other errors, fail-fast and report diagnostics
        if (status !== 404) {
          const enhancedError = new Error(
            "Failed to load quality profiles. This may be due to corrupted custom formats in Sonarr. Please check your Sonarr quality profiles and custom formats, then try again."
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
      "Failed to load quality profiles. Tried several Sonarr endpoints but none responded. This may be due to API changes or server configuration."
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
      const response = await this.client.get<
        components["schemas"]["RootFolderResource"][]
      >("/api/v3/rootfolder");
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
    unmonitored?: boolean
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
      const response = await this.client.get<
        components["schemas"]["QueueResourcePagingResource"]
      >("/api/v3/queue");
      return (response.data.records ?? []).map((record) =>
        this.mapQueueRecord(record)
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
      traktId: (data as any).traktId ?? undefined,
      cleanTitle: data.cleanTitle ?? undefined,
      titleSlug: data.titleSlug ?? undefined,
      rootFolderPath: data.rootFolderPath ?? undefined,
      tags: data.tags ?? undefined,
      seasons: data.seasons?.map((season) =>
        this.mapSeason(season, data.id ?? undefined)
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
    seriesId?: number
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
      | components["schemas"]["SeriesStatisticsResource"]
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
    seriesId?: number
  ): Episode {
    // Try to get poster from images array first (if available in API response)
    // Try screenshot first as it's more commonly available for episodes
    const posterUrl =
      this.findImageUrl(episode.images ?? undefined, "screenshot") ??
      this.findImageUrl(episode.images ?? undefined, "poster") ??
      (seriesId && episode.id
        ? this.buildEpisodePosterUrl(seriesId, episode.id)
        : undefined);

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
      quality: (episode as any).quality?.quality
        ? this.mapQualityResource((episode as any).quality.quality)
        : undefined,
      relativePath: (episode as any).relativePath ?? undefined,
      posterUrl,
    };
  }

  private groupEpisodesBySeason(
    episodes: components["schemas"]["EpisodeResource"][],
    seriesId: number
  ): Map<number, Episode[]> {
    return episodes.reduce((accumulator, episode) => {
      const seasonNum = episode.seasonNumber ?? 0;
      const collection = accumulator.get(seasonNum) ?? [];
      collection.push(this.mapEpisode(episode, seriesId));
      accumulator.set(seasonNum, collection);
      return accumulator;
    }, new Map<number, Episode[]>());
  }

  private findImageUrl(
    images: components["schemas"]["MediaCover"][] | null | undefined,
    type: string
  ): string | undefined {
    return (
      images?.find((image) => image.coverType === type)?.remoteUrl ?? undefined
    );
  }

  private buildSeasonPosterUrl(seriesId: number, seasonNumber: number): string {
    try {
      const url = new URL(
        `/api/v3/mediacover/${seriesId}/season-${seasonNumber}.jpg`,
        this.config.url
      );
      if (this.config.apiKey) {
        url.searchParams.set("apikey", this.config.apiKey);
      }
      return url.toString();
    } catch (_e) {
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
        this.config.url
      );
      if (this.config.apiKey) {
        url.searchParams.set("apikey", this.config.apiKey);
      }
      return url.toString();
    } catch (_e) {
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
    record: components["schemas"]["QueueResource"]
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
    profile: components["schemas"]["QualityProfileResource"]
  ): QualityProfile {
    return {
      id: profile.id ?? 0,
      name: profile.name ?? "",
      upgradeAllowed: profile.upgradeAllowed ?? false,
      cutoff: this.findQualityById(profile.items ?? [], profile.cutoff ?? 0),
      items: (profile.items ?? []).map((item) =>
        this.mapQualityProfileItem(item)
      ),
    };
  }

  private findQualityById(
    items: components["schemas"]["QualityProfileQualityItemResource"][] = [],
    qualityId: number
  ): Quality {
    // Flatten all qualities from the nested structure
    const allQualities: components["schemas"]["Quality"][] = [];

    const processItem = (
      item: components["schemas"]["QualityProfileQualityItemResource"]
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
    item: components["schemas"]["QualityProfileQualityItemResource"]
  ): QualityProfileItem {
    // For groups, we need to handle differently, but for now, if no quality, use a placeholder
    const quality =
      (item.quality as components["schemas"]["Quality"] | undefined) ??
      (item as any).quality ??
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
      | components["schemas"]["Quality"]
  ): Quality {
    const qualityObj: components["schemas"]["Quality"] =
      (resource as any).quality ?? (resource as any);
    return {
      id: (qualityObj as any).id ?? 0,
      name: (qualityObj as any).name ?? "Unknown",
      source: (qualityObj as any).source ?? undefined,
      resolution: (qualityObj as any).resolution ?? 0,
      sort: (qualityObj as any).sort ?? 0,
    };
  }

  private mapRootFolder(
    folder: components["schemas"]["RootFolderResource"]
  ): RootFolder {
    return {
      id: folder.id ?? 0,
      path: folder.path ?? "",
      accessible: folder.accessible ?? undefined,
      freeSpace: folder.freeSpace ?? undefined,
    };
  }
}
