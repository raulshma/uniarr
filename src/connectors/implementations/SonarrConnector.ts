import { BaseConnector } from '@/connectors/base/BaseConnector';
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
} from '@/models/media.types';
import type { SearchOptions } from '@/connectors/base/IConnector';
import { handleApiError } from '@/utils/error.utils';

interface SonarrImage {
  readonly coverType: 'poster' | 'fanart' | string;
  readonly url?: string;
  readonly remoteUrl?: string;
}

interface SonarrStatistics {
  readonly seasonCount?: number;
  readonly episodeCount?: number;
  readonly episodeFileCount?: number;
  readonly percentOfEpisodes?: number;
}

interface SonarrSeason {
  readonly id?: number;
  readonly seasonNumber: number;
  readonly monitored: boolean;
  readonly statistics?: SonarrStatistics;
}

interface SonarrSeries {
  readonly id: number;
  readonly title: string;
  readonly sortTitle?: string;
  readonly year?: number;
  readonly status: string;
  readonly overview?: string;
  readonly network?: string;
  readonly genres?: string[];
  readonly path?: string;
  readonly qualityProfileId?: number;
  readonly seasonFolder?: boolean;
  readonly monitored: boolean;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly tmdbId?: number;
  readonly traktId?: number;
  readonly cleanTitle?: string;
  readonly titleSlug?: string;
  readonly rootFolderPath?: string;
  readonly tags?: number[];
  readonly seasons?: SonarrSeason[];
  readonly nextAiring?: string;
  readonly previousAiring?: string;
  readonly added?: string;
  readonly images?: SonarrImage[];
  readonly statistics?: SonarrStatistics;
}

interface SonarrEpisode {
  readonly id: number;
  readonly seriesId: number;
  readonly episodeFileId?: number;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title: string;
  readonly overview?: string;
  readonly airDate?: string;
  readonly airDateUtc?: string;
  readonly hasFile: boolean;
  readonly monitored: boolean;
  readonly absoluteEpisodeNumber?: number;
  readonly runtime?: number;
  readonly quality?: {
    readonly quality?: {
      readonly id: number;
      readonly name: string;
      readonly source?: string;
      readonly resolution?: number;
      readonly sort?: number;
    };
  };
  readonly relativePath?: string;
  readonly images?: SonarrImage[];
}

interface SonarrSystemStatus {
  readonly version?: string;
}

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

interface SonarrQueueSeries {
  readonly id: number;
  readonly title: string;
}

interface SonarrQueueEpisode {
  readonly id: number;
  readonly title: string;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
}

interface SonarrQueueRecord {
  readonly id: number;
  readonly series: SonarrQueueSeries;
  readonly episode?: SonarrQueueEpisode;
  readonly status?: string;
  readonly trackedDownloadState?: string;
  readonly trackedDownloadStatus?: string;
  readonly downloadId?: string;
  readonly protocol?: string;
  readonly size?: number;
  readonly sizeleft?: number;
  readonly timeleft?: string;
}

interface SonarrQueueResponse {
  readonly records: SonarrQueueRecord[];
}

interface SonarrQualityItem {
  readonly id: number;
  readonly name: string;
  readonly source?: string;
  readonly resolution?: number;
  readonly sort?: number;
}

interface SonarrQualityProfileItem {
  readonly allowed: boolean;
  readonly quality: SonarrQualityItem;
}

interface SonarrQualityProfile {
  readonly id: number;
  readonly name: string;
  readonly upgradeAllowed?: boolean;
  readonly cutoff: SonarrQualityItem;
  readonly items: SonarrQualityProfileItem[];
}

interface SonarrTag {
  readonly id: number;
  readonly label: string;
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

interface SonarrRootFolder {
  readonly id: number;
  readonly path: string;
  readonly accessible?: boolean;
  readonly freeSpace?: number;
}

export class SonarrConnector extends BaseConnector<Series, AddSeriesRequest> {
  async initialize(): Promise<void> {
    console.log('🔧 [SonarrConnector] Initializing...');
    await this.getVersion();
    console.log('🔧 [SonarrConnector] Initialization completed');
  }

  async getVersion(): Promise<string> {
    try {
      const fullUrl = `${this.config.url}/api/v3/system/status`;
      console.log('🔧 [SonarrConnector] Getting version from:', fullUrl);
      console.log('🔧 [SonarrConnector] Config details:', {
        url: this.config.url,
        apiKey: this.config.apiKey ? '***' : 'missing',
        timeout: this.config.timeout
      });
      
      const response = await this.client.get<SonarrSystemStatus>('/api/v3/system/status');
      const version = response.data.version ?? 'unknown';
      console.log('🔧 [SonarrConnector] Version retrieved successfully:', version);
      console.log('🔧 [SonarrConnector] Response status:', response.status);
      console.log('🔧 [SonarrConnector] Response headers:', response.headers);
      return version;
    } catch (error) {
      console.error('🔧 [SonarrConnector] Version request failed:', error);
      const axiosError = error as any;
      console.error('🔧 [SonarrConnector] Error details:', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data
      });
      
      // Check if it's a network connectivity issue
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND' || axiosError.code === 'ETIMEDOUT') {
        console.error('🔧 [SonarrConnector] Network connectivity issue detected');
        console.error('🔧 [SonarrConnector] This might be a VPN or firewall issue');
      }
      
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
        endpoint: '/api/v3/system/status',
      });
    }
  }

  async getSeries(): Promise<Series[]> {
    try {
      const response = await this.client.get<SonarrSeries[]>('/api/v3/series');
      return response.data.map((item: SonarrSeries) => this.mapSeries(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getSeries',
        endpoint: '/api/v3/series',
      });
    }
  }

  async search(query: string, options?: SearchOptions): Promise<Series[]> {
    try {
      const params: Record<string, unknown> = { term: query };

      if (options?.filters) {
        Object.assign(params, options.filters);
      }

      const response = await this.client.get<SonarrSeries[]>('/api/v3/series/lookup', {
        params,
      });

      return response.data.map((item: SonarrSeries) => this.mapSeries(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'search',
        endpoint: '/api/v3/series/lookup',
      });
    }
  }

  async getById(id: number): Promise<Series> {
    try {
      const [seriesResponse, episodesResponse] = await Promise.all([
        this.client.get<SonarrSeries>(`/api/v3/series/${id}`),
        this.client.get<SonarrEpisode[]>(`/api/v3/episode`, {
          params: { seriesId: id },
        }),
      ]);

      const series = this.mapSeries(seriesResponse.data);
      const episodesBySeason = this.groupEpisodesBySeason(episodesResponse.data, seriesResponse.data.id);

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
        operation: 'getById',
        endpoint: `/api/v3/series/${id}`,
      });
    }
  }

  async add(request: AddSeriesRequest): Promise<Series> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post<SonarrSeries>('/api/v3/series', payload);
      return this.mapSeries(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'add',
        endpoint: '/api/v3/series',
      });
    }
  }

  async triggerSearch(seriesId: number): Promise<void> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'SeriesSearch',
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'triggerSearch',
        endpoint: '/api/v3/command',
      });
    }
  }

  async setMonitored(seriesId: number, monitored: boolean): Promise<void> {
    try {
      await this.client.post('/api/v3/series/monitor', {
        seriesIds: [seriesId],
        monitored,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'setMonitored',
        endpoint: '/api/v3/series/monitor',
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
        operation: 'deleteSeries',
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async updateSeries(
    seriesId: number,
    updates: Partial<Omit<SonarrSeries, 'id' | 'seasons' | 'statistics'>>
  ): Promise<Series> {
    try {
      const response = await this.client.put<SonarrSeries>(`/api/v3/series/${seriesId}`, updates);
      return this.mapSeries(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'updateSeries',
        endpoint: `/api/v3/series/${seriesId}`,
      });
    }
  }

  async refreshSeries(seriesId: number): Promise<void> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'SeriesRefresh',
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'refreshSeries',
        endpoint: '/api/v3/command',
      });
    }
  }

  async rescanSeries(seriesId: number): Promise<void> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'SeriesRescan',
        seriesId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'rescanSeries',
        endpoint: '/api/v3/command',
      });
    }
  }

  async moveSeries(options: SonarrMoveSeriesOptions): Promise<void> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'SeriesMove',
        ...options,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'moveSeries',
        endpoint: '/api/v3/command',
      });
    }
  }

  async renameSeries(options: SonarrRenameSeriesOptions): Promise<void> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'SeriesRename',
        ...options,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'renameSeries',
        endpoint: '/api/v3/command',
      });
    }
  }

  async getTags(): Promise<SonarrTag[]> {
    try {
      const response = await this.client.get<SonarrTag[]>('/api/v3/tag');
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTags',
        endpoint: '/api/v3/tag',
      });
    }
  }

  async createTag(label: string): Promise<SonarrTag> {
    try {
      const response = await this.client.post<SonarrTag>('/api/v3/tag', { label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'createTag',
        endpoint: '/api/v3/tag',
      });
    }
  }

  async updateTag(tagId: number, label: string): Promise<SonarrTag> {
    try {
      const response = await this.client.put<SonarrTag>(`/api/v3/tag/${tagId}`, { id: tagId, label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'updateTag',
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
        operation: 'deleteTag',
        endpoint: `/api/v3/tag/${tagId}`,
      });
    }
  }

  async bulkUpdateSeries(editor: SonarrSeriesEditor): Promise<void> {
    try {
      await this.client.put('/api/v3/series/editor', editor);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'bulkUpdateSeries',
        endpoint: '/api/v3/series/editor',
      });
    }
  }

  async getQualityProfiles(): Promise<QualityProfile[]> {
    try {
      const response = await this.client.get<SonarrQualityProfile[]>('/api/v3/qualityprofile');
      return response.data.map((profile: SonarrQualityProfile) => this.mapQualityProfile(profile));
    } catch (error) {
      // Provide more specific error message for quality profile issues
      const enhancedError = new Error(
        'Failed to load quality profiles. This may be due to corrupted custom formats in Sonarr. Please check your Sonarr quality profiles and custom formats, then try again.'
      );
      throw handleApiError(enhancedError, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getQualityProfiles',
        endpoint: '/api/v3/qualityprofile',
      });
    }
  }

  async getRootFolders(): Promise<RootFolder[]> {
    try {
      const response = await this.client.get<SonarrRootFolder[]>('/api/v3/rootfolder');
      return response.data.map((folder: SonarrRootFolder) => this.mapRootFolder(folder));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getRootFolders',
        endpoint: '/api/v3/rootfolder',
      });
    }
  }

  async getQueue(): Promise<SonarrQueueItem[]> {
    try {
      const response = await this.client.get<SonarrQueueResponse>('/api/v3/queue');
      return (response.data.records ?? []).map((record: SonarrQueueRecord) => this.mapQueueRecord(record));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getQueue',
        endpoint: '/api/v3/queue',
      });
    }
  }

  private buildAddPayload(request: AddSeriesRequest): Record<string, unknown> {
    const addOptions = {
      searchForMissingEpisodes: request.searchNow ?? request.addOptions?.searchForMissingEpisodes ?? false,
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
      seriesType: request.seriesType ?? 'standard',
      tags: request.tags,
      addOptions,
    };
  }

  private mapSeries(data: SonarrSeries): Series {
    const posterUrl = this.findImageUrl(data.images, 'poster');
    const backdropUrl = this.findImageUrl(data.images, 'fanart');

    return {
      id: data.id,
      title: data.title,
      sortTitle: data.sortTitle,
      year: data.year,
      status: data.status,
      overview: data.overview,
      network: data.network,
      genres: data.genres,
      path: data.path,
      qualityProfileId: data.qualityProfileId,
      seasonFolder: data.seasonFolder,
      monitored: data.monitored,
      tvdbId: data.tvdbId,
      imdbId: data.imdbId,
      tmdbId: data.tmdbId,
      traktId: data.traktId,
      cleanTitle: data.cleanTitle,
      titleSlug: data.titleSlug,
      rootFolderPath: data.rootFolderPath,
      tags: data.tags,
      seasons: data.seasons?.map((season) => this.mapSeason(season, data.id)),
      nextAiring: data.nextAiring,
      previousAiring: data.previousAiring,
      added: data.added,
      posterUrl,
      backdropUrl,
      statistics: this.mapStatistics(data.statistics),
      episodeCount: data.statistics?.episodeCount,
      episodeFileCount: data.statistics?.episodeFileCount,
    };
  }

  private mapSeason(season: SonarrSeason, seriesId?: number): Season {
    return {
      id: season.id,
      seasonNumber: season.seasonNumber,
      monitored: season.monitored,
      statistics: this.mapStatistics(season.statistics),
      posterUrl: seriesId ? this.buildSeasonPosterUrl(seriesId, season.seasonNumber) : undefined,
    };
  }

  private mapStatistics(statistics?: SonarrStatistics): MediaStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      episodeCount: statistics.episodeCount ?? 0,
      episodeFileCount: statistics.episodeFileCount ?? 0,
      percentOfEpisodes: statistics.percentOfEpisodes,
    };
  }

  private mapEpisode(episode: SonarrEpisode, seriesId?: number): Episode {
    // Try to get poster from images array first (if available in API response)
    // Try screenshot first as it's more commonly available for episodes
    const posterUrl = this.findImageUrl(episode.images, 'screenshot') 
      ?? this.findImageUrl(episode.images, 'poster')
      ?? (seriesId ? this.buildEpisodePosterUrl(seriesId, episode.id) : undefined);

    return {
      id: episode.id,
      title: episode.title,
      overview: episode.overview,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      absoluteEpisodeNumber: episode.absoluteEpisodeNumber,
      airDate: episode.airDate,
      airDateUtc: episode.airDateUtc,
      runtime: episode.runtime,
      monitored: episode.monitored,
      hasFile: episode.hasFile,
      episodeFileId: episode.episodeFileId,
      quality: episode.quality?.quality ? this.mapQualityResource(episode.quality.quality) : undefined,
      relativePath: episode.relativePath,
      posterUrl,
    };
  }

  private groupEpisodesBySeason(episodes: SonarrEpisode[], seriesId: number): Map<number, Episode[]> {
    return episodes.reduce((accumulator, episode) => {
      const collection = accumulator.get(episode.seasonNumber) ?? [];
      collection.push(this.mapEpisode(episode, seriesId));
      accumulator.set(episode.seasonNumber, collection);
      return accumulator;
    }, new Map<number, Episode[]>());
  }

  private findImageUrl(images: SonarrImage[] | undefined, type: SonarrImage['coverType']): string | undefined {
    return images?.find((image) => image.coverType === type)?.remoteUrl ?? undefined;
  }

  private buildSeasonPosterUrl(seriesId: number, seasonNumber: number): string {
    try {
      const url = new URL(`/api/v3/MediaCover/${seriesId}/season-${seasonNumber}.jpg`, this.config.url);
      if (this.config.apiKey) {
        url.searchParams.set('apikey', this.config.apiKey);
      }
      return url.toString();
    } catch (_e) {
      // Fallback to string concat if URL construction fails for any reason
      return `${this.config.url}/api/v3/MediaCover/${seriesId}/season-${seasonNumber}.jpg${
        this.config.apiKey ? `?apikey=${encodeURIComponent(this.config.apiKey)}` : ''
      }`;
    }
  }

  private buildEpisodePosterUrl(seriesId: number, episodeId: number): string {
    try {
      // Try the episode-specific MediaCover endpoint format
      // Use 'screenshot' as the image type for episodes (most common)
      const url = new URL(
        `/api/v3/MediaCover/${seriesId}/episode-${episodeId}-screenshot.jpg`,
        this.config.url,
      );
      if (this.config.apiKey) {
        url.searchParams.set('apikey', this.config.apiKey);
      }
      return url.toString();
    } catch (_e) {
      return `${this.config.url}/api/v3/MediaCover/${seriesId}/episode-${episodeId}-screenshot.jpg${
        this.config.apiKey ? `?apikey=${encodeURIComponent(this.config.apiKey)}` : ''
      }`;
    }
  }

  private mapQueueRecord(record: SonarrQueueRecord): SonarrQueueItem {
    return {
      id: record.id,
      seriesId: record.series.id,
      seriesTitle: record.series.title,
      episodeId: record.episode?.id,
      episodeTitle: record.episode?.title,
      seasonNumber: record.episode?.seasonNumber,
      episodeNumber: record.episode?.episodeNumber,
      status: record.status,
      trackedDownloadState: record.trackedDownloadState,
      trackedDownloadStatus: record.trackedDownloadStatus,
      downloadId: record.downloadId,
      protocol: record.protocol,
      size: record.size,
      sizeleft: record.sizeleft,
      timeleft: record.timeleft,
    };
  }

  private mapQualityProfile(profile: SonarrQualityProfile): QualityProfile {
    return {
      id: profile.id,
      name: profile.name,
      upgradeAllowed: profile.upgradeAllowed,
      cutoff: this.mapQualityResource(profile.cutoff),
      items: profile.items.map((item) => this.mapQualityProfileItem(item)),
    };
  }

  private mapQualityProfileItem(item: SonarrQualityProfileItem): QualityProfileItem {
    return {
      allowed: item.allowed,
      quality: this.mapQualityResource(item.quality),
    };
  }

  private mapQualityResource(resource: SonarrQualityItem): Quality {
    return {
      id: resource.id,
      name: resource.name,
      source: resource.source,
      resolution: resource.resolution,
      sort: resource.sort,
    };
  }

  private mapRootFolder(folder: SonarrRootFolder): RootFolder {
    return {
      id: folder.id,
      path: folder.path,
      accessible: folder.accessible,
      freeSpace: folder.freeSpace,
    };
  }
}
