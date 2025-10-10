import { BaseConnector } from '@/connectors/base/BaseConnector';
import type { SearchOptions } from '@/connectors/base/IConnector';
import type {
  CreateJellyseerrRequest,
  JellyseerrApprovalOptions,
  JellyseerrDeclineOptions,
  JellyseerrMediaSummary,
  JellyseerrPagedResult,
  JellyseerrRequest,
  JellyseerrRequestList,
  JellyseerrRequestQueryOptions,
  JellyseerrRequestStatus,
  JellyseerrSearchResult,
  JellyseerrSeasonRequestStatus,
  JellyseerrUserSummary,
} from '@/models/jellyseerr.types';
import { handleApiError } from '@/utils/error.utils';
import { logger } from '@/services/logger/LoggerService';

const API_PREFIX = '/api/v1';
const REQUEST_ENDPOINT = `${API_PREFIX}/request`;
const SEARCH_ENDPOINT = `${API_PREFIX}/search`;
const TRENDING_ENDPOINT = `${API_PREFIX}/discover/trending`;
const STATUS_ENDPOINT = `${API_PREFIX}/status`;
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

interface ApiPagination {
  readonly pages?: number;
  readonly pageSize?: number;
  readonly results?: number;
  readonly page?: number;
}

interface ApiPaginatedResponse<TItem> {
  readonly pageInfo?: ApiPagination;
  readonly results: TItem[];
  readonly page?: number;
  readonly totalPages?: number;
  readonly totalResults?: number;
}

interface ApiUser {
  readonly id: number;
  readonly email?: string;
  readonly username?: string;
  readonly plexUsername?: string;
  readonly displayName?: string;
  readonly avatar?: string;
}

interface ApiSeasonRequest {
  readonly id?: number;
  readonly seasonNumber: number;
  readonly status?: number;
  readonly status4k?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

interface ApiMedia {
  readonly id?: number;
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly mediaType: 'movie' | 'tv';
  readonly title?: string;
  readonly originalTitle?: string;
  readonly externalUrl?: string;
  readonly overview?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly posterPath?: string;
  readonly backdropPath?: string;
  readonly status?: number;
  readonly status4k?: number;
  readonly popularity?: number;
  readonly voteAverage?: number;
  readonly voteCount?: number;
  readonly runtime?: number;
  readonly network?: string;
  readonly studio?: string;
  readonly studios?: { readonly name: string }[];
  readonly genres?: { readonly name: string }[];
}

interface ApiRequest {
  readonly id: number;
  readonly status?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly requestedBy?: ApiUser;
  readonly modifiedBy?: ApiUser;
  readonly media: ApiMedia;
  readonly seasons?: ApiSeasonRequest[];
  readonly is4k?: boolean;
}

interface ApiStatusResponse {
  readonly version?: string;
  readonly commitTag?: string;
}

interface ApiMediaDetails {
  readonly id?: number;
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly mediaType: 'movie' | 'tv';
  readonly title?: string;
  readonly originalTitle?: string;
  readonly overview?: string;
  readonly posterPath?: string;
  readonly backdropPath?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly rating?: number;
  readonly runtime?: number;
  readonly genres?: { readonly name: string }[];
}

interface ApiSearchResult {
  readonly id: number;
  readonly mediaType: string;
  readonly title?: string;
  readonly name?: string;
  readonly originalTitle?: string;
  readonly originalName?: string;
  readonly overview?: string;
  readonly posterPath?: string;
  readonly backdropPath?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly popularity?: number;
  readonly voteAverage?: number;
  readonly voteCount?: number;
  readonly mediaInfo?: ApiMedia;
}

interface ApproveRequestBody {
  is4k?: boolean;
  seasonIds?: number[];
}

interface DeclineRequestBody {
  is4k?: boolean;
  seasonIds?: number[];
  reason?: string;
}

const mapRequestStatus = (status?: number | string): JellyseerrRequestStatus => {
  if (typeof status === 'string') {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'pending';
      case 'approved':
        return 'approved';
      case 'declined':
        return 'declined';
      case 'processing':
        return 'processing';
      case 'available':
        return 'available';
      default:
        return 'unknown';
    }
  }

  switch (status) {
    case 1:
      return 'pending';
    case 2:
      return 'approved';
    case 3:
      return 'declined';
    case 4:
      return 'processing';
    case 5:
      return 'available';
    default:
      return 'unknown';
  }
};

const mapMediaStatus = (status?: number): JellyseerrRequestStatus => {
  switch (status) {
    case 2:
      return 'pending';
    case 3:
    case 4:
      return 'processing';
    case 5:
      return 'available';
    case 6:
      return 'declined';
    default:
      return 'unknown';
  }
};

const resolveImageUrl = (path?: string): string | undefined => {
  if (!path) {
    return undefined;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

const mapUser = (user?: ApiUser): JellyseerrUserSummary | undefined => {
  if (!user) {
    return undefined;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    plexUsername: user.plexUsername,
    displayName: user.displayName,
    avatar: user.avatar,
  };
};

const mapSeason = (
  season: ApiSeasonRequest,
  is4k: boolean | undefined,
): JellyseerrSeasonRequestStatus => {
  const status = is4k ? season.status4k ?? season.status : season.status;
  const mappedStatus = mapRequestStatus(status);

  return {
    id: season.id,
    seasonNumber: season.seasonNumber,
    status: mappedStatus,
    isRequested: mappedStatus !== 'declined',
    isApproved: mappedStatus === 'approved' || mappedStatus === 'available',
    isAvailable: mappedStatus === 'available',
  };
};

const mapMedia = (
  media: ApiMedia,
  is4k: boolean | undefined,
): JellyseerrMediaSummary => {
  const availabilityStatus = mapMediaStatus(is4k ? media.status4k : media.status);

  const studios = media.studios?.map((studio) => studio.name).filter(Boolean);
  const genres = media.genres?.map((genre) => genre.name).filter(Boolean);

  return {
    id: media.id,
    tmdbId: media.tmdbId,
    tvdbId: media.tvdbId,
    imdbId: media.imdbId,
    mediaType: media.mediaType,
    title: media.title ?? media.originalTitle ?? undefined,
    originalTitle: media.originalTitle,
    overview: media.overview,
    posterUrl: resolveImageUrl(media.posterPath),
    backdropUrl: resolveImageUrl(media.backdropPath),
    releaseDate: media.releaseDate,
    firstAirDate: media.firstAirDate,
    status: availabilityStatus,
    rating: media.voteAverage,
    voteCount: media.voteCount,
    popularity: media.popularity,
    runtime: media.runtime,
    network: media.network,
    studios,
    genres,
    externalUrl: media.externalUrl,
  };
};

const mapRequest = (request: ApiRequest): JellyseerrRequest => {
  const seasons = request.seasons?.map((season) => mapSeason(season, request.is4k));

  return {
    id: request.id,
    mediaType: request.media.mediaType,
    status: mapRequestStatus(request.status),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requestedBy: mapUser(request.requestedBy),
    is4k: request.is4k,
    requestedSeasons: seasons,
    media: mapMedia(request.media, request.is4k),
  };
};

const mapPagedRequests = (data: ApiPaginatedResponse<ApiRequest>): JellyseerrRequestList => {
  const items = data.results.map(mapRequest);
  const total = data.pageInfo?.results ?? data.totalResults ?? items.length;

  const pageInfo =
    data.pageInfo ??
    (data.page || data.totalPages || data.totalResults
      ? {
          page: data.page,
          pages: data.totalPages,
          results: data.totalResults,
        }
      : undefined);

  return {
    items,
    total,
    pageInfo,
  };
};

const mapMediaDetails = (media: ApiMediaDetails): JellyseerrMediaSummary => {
  const genres = media.genres?.map((genre) => genre.name).filter(Boolean);

  return {
    id: media.id,
    tmdbId: media.tmdbId,
    tvdbId: media.tvdbId,
    imdbId: media.imdbId,
    mediaType: media.mediaType,
    title: media.title ?? media.originalTitle ?? undefined,
    originalTitle: media.originalTitle,
    overview: media.overview,
    posterUrl: resolveImageUrl(media.posterPath),
    backdropUrl: resolveImageUrl(media.backdropPath),
    releaseDate: media.releaseDate,
    firstAirDate: media.firstAirDate,
    rating: media.rating,
    runtime: media.runtime,
    genres,
  };
};

const mapSearchResults = (results: ApiSearchResult[]): JellyseerrSearchResult[] =>
  results
    .filter((item) => item.mediaType === 'movie' || item.mediaType === 'tv')
    .map((item) => {
      const mediaInfo = item.mediaInfo;
      const status = mediaInfo ? mapMediaStatus(mediaInfo.status) : 'unknown';

      const title =
        item.mediaType === 'tv'
          ? item.name ?? item.originalName ?? item.title ?? item.originalTitle
          : item.title ?? item.originalTitle ?? item.name ?? item.originalName;

      return {
        id: item.id,
        mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
        tmdbId: item.mediaInfo?.tmdbId ?? item.id,
        tvdbId: item.mediaInfo?.tvdbId,
        imdbId: item.mediaInfo?.imdbId,
        title: title ?? `TMDB #${item.id}`,
        overview: item.overview,
        releaseDate: item.releaseDate,
        firstAirDate: item.firstAirDate,
        backdropUrl: resolveImageUrl(item.backdropPath),
        posterUrl: resolveImageUrl(item.posterPath),
        rating: item.voteAverage,
        popularity: item.popularity,
        isRequested: Boolean(mediaInfo),
        mediaStatus: status,
      };
    });

const normalizeRequestQuery = (
  options?: JellyseerrRequestQueryOptions,
): Record<string, unknown> => {
  if (!options) {
    return {};
  }

  const params: Record<string, unknown> = {};

  if (typeof options.take === 'number') {
    params.take = options.take;
  }

  if (typeof options.skip === 'number') {
    params.skip = options.skip;
  }

  if (options.filter && options.filter !== 'all') {
    params.filter = options.filter;
  }

  if (typeof options.is4k === 'boolean') {
    params.is4k = options.is4k;
  }

  if (typeof options.includePending4k === 'boolean') {
    params.includePending4k = options.includePending4k;
  }

  if (options.search && options.search.trim().length > 0) {
    params.search = options.search.trim();
  }

  return params;
};

const buildCreatePayload = (payload: CreateJellyseerrRequest): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    mediaId: payload.mediaId,
    mediaType: payload.mediaType,
  };

  if (payload.tvdbId) {
    body.tvdbId = payload.tvdbId;
  }

  if (typeof payload.is4k === 'boolean') {
    body.is4k = payload.is4k;
  }

  if (payload.mediaType === 'tv') {
    if (payload.seasons && payload.seasons !== 'all') {
      body.seasons = payload.seasons;
    } else if (payload.seasons === 'all') {
      body.seasons = 'all';
    }
  }

  if (typeof payload.serverId === 'number') {
    body.serverId = payload.serverId;
  }

  if (typeof payload.profileId === 'number') {
    body.profileId = payload.profileId;
  }

  if (payload.rootFolder) {
    body.rootFolder = payload.rootFolder;
  }

  if (typeof payload.languageProfileId === 'number') {
    body.languageProfileId = payload.languageProfileId;
  }

  if (typeof payload.userId === 'number') {
    body.userId = payload.userId;
  }

  if (Array.isArray(payload.tags)) {
    body.tags = payload.tags;
  }

  return body;
};

const buildApproveBody = (options?: JellyseerrApprovalOptions): ApproveRequestBody | undefined => {
  if (!options) {
    return undefined;
  }

  const body: ApproveRequestBody = {};

  if (typeof options.is4k === 'boolean') {
    body.is4k = options.is4k;
  }

  if (Array.isArray(options.seasonIds) && options.seasonIds.length > 0) {
    body.seasonIds = options.seasonIds;
  }

  return body;
};

const buildDeclineBody = (options?: JellyseerrDeclineOptions): DeclineRequestBody | undefined => {
  if (!options) {
    return undefined;
  }

  const body: DeclineRequestBody = {};

  if (typeof options.is4k === 'boolean') {
    body.is4k = options.is4k;
  }

  if (Array.isArray(options.seasonIds) && options.seasonIds.length > 0) {
    body.seasonIds = options.seasonIds;
  }

  if (options.reason && options.reason.trim().length > 0) {
    body.reason = options.reason.trim();
  }

  return body;
};

export class JellyseerrConnector extends BaseConnector<JellyseerrRequest, CreateJellyseerrRequest> {
  async initialize(): Promise<void> {
    await this.ensureAuthenticated();
    await this.getVersion();
  }

  async getVersion(): Promise<string> {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.client.get<ApiStatusResponse>(STATUS_ENDPOINT);
      return response.data.version ?? response.data.commitTag ?? 'unknown';
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
        endpoint: STATUS_ENDPOINT,
      });
    }
  }

  async getRequests(options?: JellyseerrRequestQueryOptions): Promise<JellyseerrRequestList> {
    await this.ensureAuthenticated();
    
    try {
      const params = normalizeRequestQuery(options);
      const response = await this.client.get<ApiPaginatedResponse<ApiRequest>>(REQUEST_ENDPOINT, { params });
      let requests = mapPagedRequests(response.data);

      // Fetch media details for requests that don't have title
      const requestsToUpdate = requests.items.filter((item: JellyseerrRequest) => !item.media.title);
      if (requestsToUpdate.length > 0) {
        const mediaDetailsPromises = requestsToUpdate.map(async (request: JellyseerrRequest) => {
          if (request.media.id) {
            try {
              const mediaDetails = await this.getMediaDetails(request.media.id, request.mediaType);
              return { requestId: request.id, mediaDetails };
            } catch (error) {
              logger.warn('Failed to fetch media details', { mediaId: request.media.id, mediaType: request.mediaType, error });
              return null;
            }
          }
          return null;
        });

        const mediaDetailsResults = await Promise.all(mediaDetailsPromises);
        const mediaDetailsMap = new Map<number, JellyseerrMediaSummary>();
        mediaDetailsResults.forEach((result: { requestId: number; mediaDetails: JellyseerrMediaSummary } | null) => {
          if (result) {
            mediaDetailsMap.set(result.requestId, result.mediaDetails);
          }
        });

        requests = {
          ...requests,
          items: requests.items.map((item: JellyseerrRequest) => {
            const mediaDetails = mediaDetailsMap.get(item.id);
            if (mediaDetails) {
              return {
                ...item,
                media: mediaDetails,
              };
            }
            return item;
          }),
        };
      }

      return requests;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getRequests',
        endpoint: REQUEST_ENDPOINT,
      });
    }
  }

  async getMediaDetails(mediaId: number, mediaType: 'movie' | 'tv'): Promise<JellyseerrMediaSummary> {
    await this.ensureAuthenticated();
    
    try {
      const endpoint = mediaType === 'movie' 
        ? `${API_PREFIX}/movie/${mediaId}` 
        : `${API_PREFIX}/tv/${mediaId}`;
      
      const response = await this.client.get<ApiMediaDetails>(endpoint);
      return mapMediaDetails(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getMediaDetails',
        endpoint: mediaType === 'movie' ? `${API_PREFIX}/movie/${mediaId}` : `${API_PREFIX}/tv/${mediaId}`,
      });
    }
  }

  async createRequest(payload: CreateJellyseerrRequest): Promise<JellyseerrRequest> {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.client.post<ApiRequest>(REQUEST_ENDPOINT, buildCreatePayload(payload));
      return mapRequest(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'createRequest',
        endpoint: REQUEST_ENDPOINT,
      });
    }
  }

  async approveRequest(requestId: number, options?: JellyseerrApprovalOptions): Promise<JellyseerrRequest> {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.client.post<ApiRequest>(
        `${REQUEST_ENDPOINT}/${requestId}/approve`,
        buildApproveBody(options),
      );
      return mapRequest(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'approveRequest',
        endpoint: `${REQUEST_ENDPOINT}/${requestId}/approve`,
      });
    }
  }

  async declineRequest(requestId: number, options?: JellyseerrDeclineOptions): Promise<JellyseerrRequest> {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.client.post<ApiRequest>(
        `${REQUEST_ENDPOINT}/${requestId}/decline`,
        buildDeclineBody(options),
      );
      return mapRequest(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'declineRequest',
        endpoint: `${REQUEST_ENDPOINT}/${requestId}/decline`,
      });
    }
  }

  async deleteRequest(requestId: number): Promise<boolean> {
    await this.ensureAuthenticated();
    
    try {
      await this.client.delete(`${REQUEST_ENDPOINT}/${requestId}`);
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'deleteRequest',
        endpoint: `${REQUEST_ENDPOINT}/${requestId}`,
      });
    }
  }

  async search(query: string, options?: SearchOptions): Promise<JellyseerrSearchResult[]> {
    await this.ensureAuthenticated();
    
    try {
      const params: Record<string, unknown> = {
        query,
      };

      const page = options?.pagination?.page;
      if (typeof page === 'number' && page > 0) {
        params.page = page;
      }

      const filters = options?.filters ?? {};
      const languageValue = (filters as Record<string, unknown>).language;
      if (typeof languageValue === 'string' && languageValue.trim().length > 0) {
        params.language = languageValue.trim();
      }

      const response = await this.client.get<ApiPaginatedResponse<ApiSearchResult>>(SEARCH_ENDPOINT, {
        params,
      });

      return mapSearchResults(response.data.results);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'search',
        endpoint: SEARCH_ENDPOINT,
      });
    }
  }

  async getTrending(options?: { page?: number; language?: string }): Promise<JellyseerrPagedResult<JellyseerrSearchResult>> {
    await this.ensureAuthenticated();

    try {
      const params: Record<string, unknown> = {};

      if (typeof options?.page === 'number' && options.page > 0) {
        params.page = options.page;
      }

      if (options?.language) {
        params.language = options.language;
      }

      const response = await this.client.get<ApiPaginatedResponse<ApiSearchResult>>(TRENDING_ENDPOINT, {
        params,
      });

      const items = mapSearchResults(response.data.results);
      const totalResults = response.data.totalResults ?? response.data.pageInfo?.results ?? items.length;

      return {
        items,
        total: totalResults,
        pageInfo: {
          page: response.data.page ?? response.data.pageInfo?.page,
          pages: response.data.totalPages ?? response.data.pageInfo?.pages,
          results: totalResults,
          totalResults,
        },
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTrending',
        endpoint: TRENDING_ENDPOINT,
      });
    }
  }
}
