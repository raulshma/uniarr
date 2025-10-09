import { BaseConnector } from '@/connectors/base/BaseConnector';
import type { SearchOptions } from '@/connectors/base/IConnector';
import type { Quality, QualityProfile, QualityProfileItem, RootFolder } from '@/models/media.types';
import type {
  AddMovieRequest,
  Movie,
  MovieFile,
  MovieRatings,
  MovieStatistics,
  RadarrQueueItem,
} from '@/models/movie.types';
import { handleApiError } from '@/utils/error.utils';

interface RadarrSystemStatus {
  readonly version?: string;
}

interface RadarrMovieImage {
  readonly coverType: string;
  readonly url?: string;
  readonly remoteUrl?: string;
}

interface RadarrRatings {
  readonly value?: number;
  readonly votes?: number;
  readonly type?: string;
}

interface RadarrMovieFileQuality {
  readonly quality?: RadarrQualityItem;
  readonly revision?: {
    readonly version?: number;
    readonly real?: number;
    readonly isRepack?: boolean;
  };
}

interface RadarrMovieFile {
  readonly id: number;
  readonly relativePath?: string;
  readonly size?: number;
  readonly quality?: RadarrMovieFileQuality;
  readonly dateAdded?: string;
  readonly sceneName?: string;
}

interface RadarrMovieStatistics {
  readonly movieFileCount?: number;
  readonly sizeOnDisk?: number;
  readonly percentAvailable?: number;
}

interface RadarrQualityItem {
  readonly id: number;
  readonly name: string;
  readonly source?: string;
  readonly resolution?: number;
  readonly sort?: number;
}

interface RadarrQualityProfileItem {
  readonly allowed: boolean;
  readonly quality?: RadarrQualityItem;
  readonly items?: RadarrQualityProfileItem[];
  readonly name?: string;
  readonly id?: number;
}

interface RadarrQualityProfile {
  readonly id: number;
  readonly name: string;
  readonly upgradeAllowed?: boolean;
  readonly cutoff: number;
  readonly items: RadarrQualityProfileItem[];
}

interface RadarrRootFolder {
  readonly id: number;
  readonly path: string;
  readonly accessible?: boolean;
  readonly freeSpace?: number;
}

interface RadarrQueueMovie {
  readonly id: number;
  readonly title: string;
}

interface RadarrQueueRecord {
  readonly id: number;
  readonly movie: RadarrQueueMovie;
  readonly status?: string;
  readonly trackedDownloadState?: string;
  readonly trackedDownloadStatus?: string;
  readonly protocol?: string;
  readonly size?: number;
  readonly sizeleft?: number;
  readonly timeleft?: string;
}

interface RadarrQueueResponse {
  readonly records: RadarrQueueRecord[];
}

interface RadarrTag {
  readonly id: number;
  readonly label: string;
}

interface RadarrMovieEditor {
  readonly movieIds: number[];
  readonly monitored?: boolean;
  readonly qualityProfileId?: number;
  readonly tags?: number[];
}

interface RadarrMoveMovieOptions {
  readonly movieId: number;
  readonly destinationPath: string;
  readonly moveFiles?: boolean;
}

interface RadarrMovie {
  readonly id: number;
  readonly title: string;
  readonly sortTitle?: string;
  readonly year?: number;
  readonly status?: string;
  readonly overview?: string;
  readonly studio?: string;
  readonly genres?: string[];
  readonly path?: string;
  readonly qualityProfileId?: number;
  readonly monitored: boolean;
  readonly hasFile: boolean;
  readonly isAvailable?: boolean;
  readonly minimumAvailability?: string;
  readonly runtime?: number;
  readonly certification?: string;
  readonly imdbId?: string;
  readonly tmdbId?: number;
  readonly titleSlug?: string;
  readonly website?: string;
  readonly inCinemas?: string;
  readonly digitalRelease?: string;
  readonly physicalRelease?: string;
  readonly releaseDate?: string;
  readonly tags?: number[];
  readonly images?: RadarrMovieImage[];
  readonly movieFile?: RadarrMovieFile;
  readonly ratings?: RadarrRatings;
  readonly statistics?: RadarrMovieStatistics;
}

const RADARR_API_PREFIX = '/api/v3';

export class RadarrConnector extends BaseConnector<Movie, AddMovieRequest> {
  async initialize(): Promise<void> {
    console.log('🔧 [RadarrConnector] Initializing...');
    await this.getVersion();
    console.log('🔧 [RadarrConnector] Initialization completed');
  }

  async getVersion(): Promise<string> {
    try {
      const fullUrl = `${this.config.url}${RADARR_API_PREFIX}/system/status`;
      console.log('🔧 [RadarrConnector] Getting version from:', fullUrl);
      console.log('🔧 [RadarrConnector] Config details:', {
        url: this.config.url,
        apiKey: this.config.apiKey ? '***' : 'missing',
        timeout: this.config.timeout
      });
      
      const response = await this.client.get<RadarrSystemStatus>(`${RADARR_API_PREFIX}/system/status`);
      const version = response.data.version ?? 'unknown';
      console.log('🔧 [RadarrConnector] Version retrieved successfully:', version);
      console.log('🔧 [RadarrConnector] Response status:', response.status);
      console.log('🔧 [RadarrConnector] Response headers:', response.headers);
      return version;
    } catch (error) {
      console.error('🔧 [RadarrConnector] Version request failed:', error);
      const axiosError = error as any;
      console.error('🔧 [RadarrConnector] Error details:', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data
      });
      
      // Check if it's a network connectivity issue
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND' || axiosError.code === 'ETIMEDOUT') {
        console.error('🔧 [RadarrConnector] Network connectivity issue detected');
        console.error('🔧 [RadarrConnector] This might be a VPN or firewall issue');
      }
      
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
        endpoint: `${RADARR_API_PREFIX}/system/status`,
      });
    }
  }

  async getMovies(): Promise<Movie[]> {
    try {
      const response = await this.client.get<RadarrMovie[]>(`${RADARR_API_PREFIX}/movie`);
      return response.data.map((item) => this.mapMovie(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getMovies',
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

      const response = await this.client.get<RadarrMovie[]>(`${RADARR_API_PREFIX}/movie/lookup`, {
        params,
      });

      return response.data.map((item) => this.mapMovie(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'search',
        endpoint: `${RADARR_API_PREFIX}/movie/lookup`,
      });
    }
  }

  async getById(id: number): Promise<Movie> {
    try {
      const response = await this.client.get<RadarrMovie>(`${RADARR_API_PREFIX}/movie/${id}`);
      return this.mapMovie(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getById',
        endpoint: `${RADARR_API_PREFIX}/movie/${id}`,
      });
    }
  }

  async add(request: AddMovieRequest): Promise<Movie> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post<RadarrMovie>(`${RADARR_API_PREFIX}/movie`, payload);
      return this.mapMovie(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'add',
        endpoint: `${RADARR_API_PREFIX}/movie`,
      });
    }
  }

  async triggerSearch(movieId: number): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: 'MoviesSearch',
        movieIds: [movieId],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'triggerSearch',
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async setMonitored(movieId: number, monitored: boolean): Promise<void> {
    try {
      const existing = await this.client.get<RadarrMovie>(`${RADARR_API_PREFIX}/movie/${movieId}`);
      const payload = {
        ...existing.data,
        monitored,
      };

      await this.client.put(`${RADARR_API_PREFIX}/movie/${movieId}`, payload);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'setMonitored',
        endpoint: `${RADARR_API_PREFIX}/movie/${movieId}`,
      });
    }
  }

  async deleteMovie(
    movieId: number,
    options: { deleteFiles?: boolean; addImportListExclusion?: boolean } = {},
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
        operation: 'deleteMovie',
        endpoint: `${RADARR_API_PREFIX}/movie/${movieId}`,
      });
    }
  }

  async updateMovie(
    movieId: number,
    updates: Partial<Omit<RadarrMovie, 'id' | 'movieFile' | 'ratings' | 'statistics' | 'images'>>
  ): Promise<Movie> {
    try {
      const response = await this.client.put<RadarrMovie>(`${RADARR_API_PREFIX}/movie/${movieId}`, updates);
      return this.mapMovie(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'updateMovie',
        endpoint: `${RADARR_API_PREFIX}/movie/${movieId}`,
      });
    }
  }

  async refreshMovie(movieId: number): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: 'MoviesRefresh',
        movieIds: [movieId],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'refreshMovie',
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async rescanMovie(movieId: number): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: 'MoviesRescan',
        movieIds: [movieId],
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'rescanMovie',
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async moveMovie(options: RadarrMoveMovieOptions): Promise<void> {
    try {
      await this.client.post(`${RADARR_API_PREFIX}/command`, {
        name: 'MoviesMove',
        ...options,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'moveMovie',
        endpoint: `${RADARR_API_PREFIX}/command`,
      });
    }
  }

  async getTags(): Promise<RadarrTag[]> {
    try {
      const response = await this.client.get<RadarrTag[]>(`${RADARR_API_PREFIX}/tag`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTags',
        endpoint: `${RADARR_API_PREFIX}/tag`,
      });
    }
  }

  async createTag(label: string): Promise<RadarrTag> {
    try {
      const response = await this.client.post<RadarrTag>(`${RADARR_API_PREFIX}/tag`, { label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'createTag',
        endpoint: `${RADARR_API_PREFIX}/tag`,
      });
    }
  }

  async updateTag(tagId: number, label: string): Promise<RadarrTag> {
    try {
      const response = await this.client.put<RadarrTag>(`${RADARR_API_PREFIX}/tag/${tagId}`, { id: tagId, label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'updateTag',
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
        operation: 'deleteTag',
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
        operation: 'bulkUpdateMovies',
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
        const response = await this.client.get<RadarrQualityProfile[]>(endpoint);
        
        // Check if response contains an error
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data) && 'error' in response.data) {
          throw new Error((response.data as any).error as string);
        }
        
        return response.data.map((profile) => this.mapQualityProfile(profile));
      } catch (error) {
        const axiosError = error as any;
        const status = axiosError?.response?.status;
        if (status !== 404) {
          const enhancedError = new Error(
            'Failed to load quality profiles. This may be due to corrupted custom formats in Radarr. Please check your Radarr quality profiles and custom formats, then try again.'
          );
          throw handleApiError(enhancedError, {
            serviceId: this.config.id,
            serviceType: this.config.type,
            operation: 'getQualityProfiles',
            endpoint,
          });
        }
        // otherwise try next candidate
      }
    }

    const enhancedError = new Error(
      'Failed to load quality profiles. Tried several Radarr endpoints but none responded. This may be due to API changes or server configuration.'
    );
    throw handleApiError(enhancedError, {
      serviceId: this.config.id,
      serviceType: this.config.type,
      operation: 'getQualityProfiles',
      endpoint: candidateEndpoints.join(' | '),
    });
  }

  async getRootFolders(): Promise<RootFolder[]> {
    try {
      const response = await this.client.get<RadarrRootFolder[]>(`${RADARR_API_PREFIX}/rootfolder`);
      return response.data.map((folder) => this.mapRootFolder(folder));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getRootFolders',
        endpoint: `${RADARR_API_PREFIX}/rootfolder`,
      });
    }
  }

  async getQueue(): Promise<RadarrQueueItem[]> {
    try {
      const response = await this.client.get<RadarrQueueResponse>(`${RADARR_API_PREFIX}/queue`);
      return (response.data.records ?? []).map((record) => this.mapQueueRecord(record));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getQueue',
        endpoint: `${RADARR_API_PREFIX}/queue`,
      });
    }
  }

  private buildAddPayload(request: AddMovieRequest): Record<string, unknown> {
    const sanitizedRoot = this.trimTrailingSlash(request.rootFolderPath);
    const pathSuffix = request.path ?? this.buildDefaultPathSuffix(request.title, request.year);
    const path = `${sanitizedRoot}/${pathSuffix}`;

    const addOptions = {
      searchOnAdd: request.searchOnAdd ?? request.searchForMovie ?? false,
      searchForMovie: request.searchForMovie ?? request.searchOnAdd ?? false,
      monitor: request.monitored ? 'movie' : 'none',
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
      minimumAvailability: request.minimumAvailability ?? 'announced',
      tags: request.tags ?? [],
      addOptions,
      path,
    };
  }

  private buildDefaultPathSuffix(title: string, year?: number): string {
    const normalizedTitle = title.replace(/[:\\/*?"<>|]/g, '').trim();
    return year ? `${normalizedTitle} (${year})` : normalizedTitle;
  }

  private trimTrailingSlash(input: string): string {
    return input.replace(/[\\/]+$/u, '');
  }

  private mapMovie(data: RadarrMovie): Movie {
    const posterUrl = this.resolveImageUrl(this.findImageUrl(data.images, 'poster'));
    const backdropUrl = this.resolveImageUrl(this.findImageUrl(data.images, 'fanart'));

    return {
      id: data.id,
      title: data.title,
      sortTitle: data.sortTitle,
      year: data.year,
      status: data.status,
      overview: data.overview,
      studio: data.studio,
      genres: data.genres,
      path: data.path,
      qualityProfileId: data.qualityProfileId,
      monitored: data.monitored,
      hasFile: data.hasFile,
      isAvailable: data.isAvailable,
      minimumAvailability: data.minimumAvailability,
      runtime: data.runtime,
      certification: data.certification,
      imdbId: data.imdbId,
      tmdbId: data.tmdbId,
      titleSlug: data.titleSlug,
      website: data.website,
      inCinemas: data.inCinemas,
      digitalRelease: data.digitalRelease,
      physicalRelease: data.physicalRelease,
      releaseDate: data.releaseDate,
      tags: data.tags,
      posterUrl,
      backdropUrl,
      ratings: this.mapRatings(data.ratings),
      statistics: this.mapStatistics(data.statistics),
      movieFile: this.mapMovieFile(data.movieFile),
      images: data.images?.map((image) => ({
        coverType: image.coverType,
        url: image.url,
        remoteUrl: image.remoteUrl,
      })),
    };
  }

  private mapRatings(ratings?: RadarrRatings): MovieRatings | undefined {
    if (!ratings) {
      return undefined;
    }

    return {
      value: ratings.value,
      votes: ratings.votes,
      type: ratings.type,
    };
  }

  private mapStatistics(statistics?: RadarrMovieStatistics): MovieStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      movieFileCount: statistics.movieFileCount,
      sizeOnDisk: statistics.sizeOnDisk,
      percentAvailable: statistics.percentAvailable,
    };
  }

  private mapMovieFile(movieFile?: RadarrMovieFile): MovieFile | undefined {
    if (!movieFile) {
      return undefined;
    }

    return {
      id: movieFile.id,
      relativePath: movieFile.relativePath,
      size: movieFile.size,
      dateAdded: movieFile.dateAdded,
      sceneName: movieFile.sceneName,
      quality: movieFile.quality
        ? {
            quality: movieFile.quality.quality ? this.mapQualityResource(movieFile.quality.quality) : undefined,
            revision: movieFile.quality.revision,
          }
        : undefined,
    };
  }

  private mapQueueRecord(record: RadarrQueueRecord): RadarrQueueItem {
    return {
      id: record.id,
      movieId: record.movie.id,
      title: record.movie.title,
      status: record.status,
      trackedDownloadState: record.trackedDownloadState,
      trackedDownloadStatus: record.trackedDownloadStatus,
      protocol: record.protocol,
      size: record.size,
      sizeleft: record.sizeleft,
      timeleft: record.timeleft,
    };
  }

  private mapQualityProfile(profile: RadarrQualityProfile): QualityProfile {
    return {
      id: profile.id,
      name: profile.name,
      upgradeAllowed: profile.upgradeAllowed,
      cutoff: this.findQualityById(profile.items, profile.cutoff),
      items: profile.items.map((item) => this.mapQualityProfileItem(item)),
    };
  }

  private findQualityById(items: RadarrQualityProfileItem[], qualityId: number): Quality {
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
    
    items.forEach(processItem);
    
    const found = allQualities.find(q => q.id === qualityId);
    if (found) {
      return this.mapQualityResource(found);
    }
    
    // Fallback: create a minimal quality object if not found
    return {
      id: qualityId,
      name: `Quality ${qualityId}`,
      source: 'unknown',
      resolution: 0,
      sort: 0,
    };
  }

  private mapQualityProfileItem(item: RadarrQualityProfileItem): QualityProfileItem {
    // For groups, we need to handle differently, but for now, if no quality, use a placeholder
    const quality = item.quality || {
      id: item.id || 0,
      name: item.name || 'Unknown',
      source: 'unknown',
      resolution: 0,
      sort: 0,
    };
    
    return {
      allowed: item.allowed,
      quality: this.mapQualityResource(quality),
    };
  }

  private mapQualityResource(resource: RadarrQualityItem): Quality {
    return {
      id: resource.id,
      name: resource.name,
      source: resource.source,
      resolution: resource.resolution,
      sort: resource.sort,
    };
  }

  private mapRootFolder(folder: RadarrRootFolder): RootFolder {
    return {
      id: folder.id,
      path: folder.path,
      accessible: folder.accessible,
      freeSpace: folder.freeSpace,
    };
  }

  private findImageUrl(images: RadarrMovieImage[] | undefined, type: string): string | undefined {
    if (!images?.length) {
      return undefined;
    }

    const match = images.find((image) => image.coverType === type);
    if (!match) {
      return undefined;
    }

    return match.remoteUrl ?? match.url;
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
          resolved.searchParams.set('apikey', this.config.apiKey);
        }
      }

      return resolved.toString();
    } catch (_error) {
      return url;
    }
  }
}
