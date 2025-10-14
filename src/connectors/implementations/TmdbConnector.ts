import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import type { operations } from '@/connectors/client-schemas/tmdb-openapi';
import type { AxiosRequestHeaders } from 'axios';
import { logger } from '@/services/logger/LoggerService';

const TMDB_API_BASE_URL = 'https://api.themoviedb.org';
const RETRYABLE_STATUS = new Set<number>([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 500;

export class TmdbConnectorError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'TmdbConnectorError';
  }
}

export type TmdbMediaType = 'movie' | 'tv';

export type DiscoverMovieQuery = NonNullable<operations['discover-movie']['parameters']['query']>;
export type DiscoverTvQuery = NonNullable<operations['discover-tv']['parameters']['query']>;
export type DiscoverMovieResponse = operations['discover-movie']['responses'][200]['content']['application/json'];
export type DiscoverTvResponse = operations['discover-tv']['responses'][200]['content']['application/json'];

export type GenreMovieResponse = operations['genre-movie-list']['responses'][200]['content']['application/json'];
export type GenreTvResponse = operations['genre-tv-list']['responses'][200]['content']['application/json'];

export type MovieDetailsResponse = operations['movie-details']['responses'][200]['content']['application/json'];
export type TvDetailsResponse = operations['tv-series-details']['responses'][200]['content']['application/json'];

export type MovieImagesResponse = operations['movie-images']['responses'][200]['content']['application/json'];
export type TvImagesResponse = operations['tv-series-images']['responses'][200]['content']['application/json'];

export type MovieWatchProvidersResponse = operations['movie-watch-providers']['responses'][200]['content']['application/json'];
export type TvWatchProvidersResponse = operations['tv-series-watch-providers']['responses'][200]['content']['application/json'];

export type MovieVideosResponse = operations['movie-videos']['responses'][200]['content']['application/json'];
export type TvVideosResponse = operations['tv-series-videos']['responses'][200]['content']['application/json'];

export type MovieCreditsResponse = operations['movie-credits']['responses'][200]['content']['application/json'];
export type TvCreditsResponse = operations['tv-series-credits']['responses'][200]['content']['application/json'];

export type MovieDetailsWithExtrasResponse = MovieDetailsResponse & {
  images?: MovieImagesResponse;
  videos?: MovieVideosResponse;
  'watch/providers'?: MovieWatchProvidersResponse;
  credits?: MovieCreditsResponse;
  recommendations?: DiscoverMovieResponse;
  similar?: DiscoverMovieResponse;
};

export type TvDetailsWithExtrasResponse = TvDetailsResponse & {
  images?: TvImagesResponse;
  videos?: TvVideosResponse;
  'watch/providers'?: TvWatchProvidersResponse;
  credits?: TvCreditsResponse;
  recommendations?: DiscoverTvResponse;
  similar?: DiscoverTvResponse;
};

export interface GetDetailsOptions {
  language?: string;
  appendToResponse?: string[];
}

export type SearchMultiQuery = NonNullable<operations['search-multi']['parameters']['query']>;
export type SearchMultiResponse = operations['search-multi']['responses'][200]['content']['application/json'];

export interface ValidateApiKeyResult {
  ok: boolean;
  message?: string;
  statusCode?: number;
}

const normalizeCredential = (credential: string): string => credential.trim();

const looksLikeV4Token = (credential: string): boolean => {
  const trimmed = credential.trim();
  if (trimmed.startsWith('Bearer ')) {
    return true;
  }

  if (trimmed.length > 40 && trimmed.includes('.')) {
    return true;
  }

  // V4 tokens are JWT-like strings with allowed chars A-Z, a-z, 0-9, - and _
  if (/^[A-Za-z0-9\-_]{60,}$/.test(trimmed)) {
    return true;
  }

  return false;
};

const toBearerToken = (credential: string): string =>
  credential.startsWith('Bearer ') ? credential : `Bearer ${credential}`;

const parseRetryAfter = (value: unknown): number | undefined => {
  if (Array.isArray(value) && value.length) {
    return parseRetryAfter(value[0]);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const seconds = Number.parseFloat(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds;
    }

    const asDate = Date.parse(trimmed);
    if (!Number.isNaN(asDate)) {
      const diffMs = asDate - Date.now();
      if (Number.isFinite(diffMs) && diffMs > 0) {
        return diffMs / 1000;
      }
    }
  }

  return undefined;
};

export class TmdbConnector {
  private readonly client: AxiosInstance;

  private readonly credential: string;

  private readonly useBearerAuth: boolean;

  constructor(credential: string) {
    if (!credential || !credential.trim()) {
      throw new Error('TMDB credential is required');
    }

    this.credential = normalizeCredential(credential);
    this.useBearerAuth = looksLikeV4Token(this.credential);
    this.client = this.createHttpClient();
  }

  private createHttpClient(): AxiosInstance {
    const instance = axios.create({
      baseURL: TMDB_API_BASE_URL,
      timeout: 15_000,
    });

    instance.interceptors.request.use((config) => {
      const headers: AxiosRequestHeaders = {
        ...(config.headers ?? {}),
        Accept: 'application/json',
      } as AxiosRequestHeaders;

      if (this.useBearerAuth) {
        headers.Authorization = toBearerToken(this.credential);
      }

      config.headers = headers;

      if (!this.useBearerAuth) {
        const params = {
          ...(config.params ?? {}),
        } as Record<string, any>;

        if (typeof params.api_key === 'undefined') {
          params.api_key = this.credential;
        }

        config.params = params;
      }

      return config;
    });

    return instance;
  }

  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    attempt = 0,
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.request<T>({ ...config });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        if (RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES) {
          const retryHint = error.response?.headers?.['retry-after'];
          const retryAfterSeconds = Array.isArray(retryHint)
            ? Number.parseFloat(retryHint[0] ?? '')
            : Number.parseFloat(String(retryHint ?? ''));
          const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : RETRY_BASE_DELAY * Math.pow(2, attempt);

          await new Promise((resolve) => {
            setTimeout(resolve, delay);
          });

          return this.requestWithRetry<T>(config, attempt + 1);
        }
      }

      throw error;
    }
  }

  private parseError(error: unknown): {
    message: string;
    statusCode?: number;
    code?: string;
    retryAfterSeconds?: number;
  } {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as Record<string, unknown> | undefined;
      const statusMessage = typeof data?.status_message === 'string' ? data.status_message : undefined;
      const code = typeof data?.status_code === 'number' ? String(data.status_code) : error.code ?? undefined;
      const headers = error.response?.headers as (Record<string, unknown> & { get?: (name: string) => unknown }) | undefined;
      const rawRetryAfter = headers?.get ? headers.get('retry-after') ?? headers.get('Retry-After') : headers?.['retry-after'] ?? headers?.['Retry-After'];
      const retryAfterSeconds = parseRetryAfter(rawRetryAfter);

      return {
        message: statusMessage ?? error.message ?? 'TMDB request failed.',
        statusCode: status,
        code,
        retryAfterSeconds,
      };
    }

    if (error instanceof Error) {
      return { message: error.message };
    }

    return { message: 'Unexpected TMDB error.' };
  }

  private handleError(error: unknown, context: string): never {
    const parsed = this.parseError(error);
    const friendlyMessage = this.buildFriendlyMessage(parsed);

    void logger.error('TMDB request failed.', {
      scope: 'TmdbConnector',
      context,
      statusCode: parsed.statusCode,
      code: parsed.code,
      retryAfterSeconds: parsed.retryAfterSeconds,
      message: parsed.message,
      friendlyMessage,
    });
    throw new TmdbConnectorError(
      friendlyMessage,
      parsed.statusCode,
      parsed.code,
      parsed.retryAfterSeconds,
    );
  }

  private buildFriendlyMessage(error: {
    message: string;
    statusCode?: number;
    retryAfterSeconds?: number;
  }): string {
    if (error.statusCode === 429) {
      const waitSeconds = error.retryAfterSeconds;
      if (typeof waitSeconds === 'number' && Number.isFinite(waitSeconds) && waitSeconds > 0) {
        const rounded = Math.ceil(waitSeconds);
        return `TMDB is rate limiting requests. Please wait about ${rounded} second${rounded === 1 ? '' : 's'} and try again.`;
      }
      return 'TMDB is rate limiting requests right now. Please wait a moment and try again.';
    }

    if (error.statusCode && error.statusCode >= 500) {
      return 'TMDB is currently unavailable. Try again in a few moments.';
    }

    if (!error.statusCode) {
      return 'Unable to reach TMDB. Check your connection and try again.';
    }

    const trimmed = error.message?.trim();
    return trimmed?.length ? trimmed : 'TMDB request failed.';
  }

  private removeUndefined<TParams extends Record<string, unknown> | undefined>(
    params: TParams,
  ): TParams {
    if (!params) {
      return params;
    }

    const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
    return Object.fromEntries(entries) as TParams;
  }

  async validateApiKey(): Promise<ValidateApiKeyResult> {
    try {
      await this.requestWithRetry<operations['authentication-validate-key']['responses'][200]['content']['application/json']>({
        method: 'GET',
        url: '/3/authentication',
      });

      return { ok: true };
    } catch (error) {
      const parsed = this.parseError(error);
      if (parsed.statusCode === 401 || parsed.statusCode === 403) {
        return {
          ok: false,
          statusCode: parsed.statusCode,
          message: 'TMDB rejected the provided credential. Double-check your API key or V4 token.',
        };
      }

      return {
        ok: false,
        statusCode: parsed.statusCode,
        message: parsed.message,
      };
    }
  }

  async discoverMovies(params: DiscoverMovieQuery = {}): Promise<DiscoverMovieResponse> {
    try {
      const response = await this.requestWithRetry<DiscoverMovieResponse>({
        method: 'GET',
        url: '/3/discover/movie',
        params: this.removeUndefined(params),
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, 'discoverMovies');
    }
  }

  async discoverTv(params: DiscoverTvQuery = {}): Promise<DiscoverTvResponse> {
    try {
      const response = await this.requestWithRetry<DiscoverTvResponse>({
        method: 'GET',
        url: '/3/discover/tv',
        params: this.removeUndefined(params),
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, 'discoverTv');
    }
  }

  async getGenres(mediaType: TmdbMediaType, language?: string): Promise<GenreMovieResponse | GenreTvResponse> {
    try {
      const url = mediaType === 'movie' ? '/3/genre/movie/list' : '/3/genre/tv/list';
      const response = await this.requestWithRetry<GenreMovieResponse | GenreTvResponse>({
        method: 'GET',
        url,
        params: this.removeUndefined({ language }),
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, `getGenres:${mediaType}`);
    }
  }

  async getDetails(mediaType: 'movie', tmdbId: number, options?: GetDetailsOptions): Promise<MovieDetailsWithExtrasResponse>;
  async getDetails(mediaType: 'tv', tmdbId: number, options?: GetDetailsOptions): Promise<TvDetailsWithExtrasResponse>;
  async getDetails(
    mediaType: TmdbMediaType,
    tmdbId: number,
    options: GetDetailsOptions = {},
  ): Promise<MovieDetailsWithExtrasResponse | TvDetailsWithExtrasResponse> {
    try {
      const url = mediaType === 'movie' ? `/3/movie/${tmdbId}` : `/3/tv/${tmdbId}`;
      const { language, appendToResponse } = options;
      const response = await this.requestWithRetry<MovieDetailsResponse | TvDetailsResponse>({
        method: 'GET',
        url,
        params: this.removeUndefined({
          language,
          append_to_response: appendToResponse?.length ? appendToResponse.join(',') : undefined,
        }),
      });

      return response.data as MovieDetailsWithExtrasResponse | TvDetailsWithExtrasResponse;
    } catch (error) {
      return this.handleError(error, `getDetails:${mediaType}`);
    }
  }

  async getImages(mediaType: 'movie', tmdbId: number, language?: string): Promise<MovieImagesResponse>;
  async getImages(mediaType: 'tv', tmdbId: number, language?: string): Promise<TvImagesResponse>;
  async getImages(mediaType: TmdbMediaType, tmdbId: number, language?: string): Promise<MovieImagesResponse | TvImagesResponse> {
    try {
      const url = mediaType === 'movie' ? `/3/movie/${tmdbId}/images` : `/3/tv/${tmdbId}/images`;
      const response = await this.requestWithRetry<MovieImagesResponse | TvImagesResponse>({
        method: 'GET',
        url,
        params: this.removeUndefined({ language }),
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, `getImages:${mediaType}`);
    }
  }

  async getWatchProviders(mediaType: 'movie', tmdbId: number): Promise<MovieWatchProvidersResponse>;
  async getWatchProviders(mediaType: 'tv', tmdbId: number): Promise<TvWatchProvidersResponse>;
  async getWatchProviders(
    mediaType: TmdbMediaType,
    tmdbId: number,
  ): Promise<MovieWatchProvidersResponse | TvWatchProvidersResponse> {
    try {
      const url = mediaType === 'movie' ? `/3/movie/${tmdbId}/watch/providers` : `/3/tv/${tmdbId}/watch/providers`;
      const response = await this.requestWithRetry<MovieWatchProvidersResponse | TvWatchProvidersResponse>({
        method: 'GET',
        url,
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, `getWatchProviders:${mediaType}`);
    }
  }

  async getVideos(mediaType: 'movie', tmdbId: number, language?: string): Promise<MovieVideosResponse>;
  async getVideos(mediaType: 'tv', tmdbId: number, language?: string): Promise<TvVideosResponse>;
  async getVideos(mediaType: TmdbMediaType, tmdbId: number, language?: string): Promise<MovieVideosResponse | TvVideosResponse> {
    try {
      const url = mediaType === 'movie' ? `/3/movie/${tmdbId}/videos` : `/3/tv/${tmdbId}/videos`;
      const response = await this.requestWithRetry<MovieVideosResponse | TvVideosResponse>({
        method: 'GET',
        url,
        params: this.removeUndefined({ language }),
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, `getVideos:${mediaType}`);
    }
  }

  async searchMulti(params: SearchMultiQuery): Promise<SearchMultiResponse> {
    if (!params || typeof params.query !== 'string' || !params.query.trim()) {
      throw new TmdbConnectorError('Search query is required.', 400);
    }

    try {
      const response = await this.requestWithRetry<SearchMultiResponse>({
        method: 'GET',
        url: '/3/search/multi',
        params: this.removeUndefined(params),
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, 'searchMulti');
    }
  }
}
