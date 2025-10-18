import { BaseConnector } from "@/connectors/base/BaseConnector";
import type { SearchOptions } from "@/connectors/base/IConnector";
import { handleApiError, ApiError } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";
import { type AxiosRequestConfig, isAxiosError } from "axios";
import { useSettingsStore } from "@/store/settingsStore";
import type {
  components,
  paths,
} from "@/connectors/client-schemas/jellyseerr-openapi";
// Use generated OpenAPI types from the bundled client schema instead of the
// legacy custom `jellyseerr.types`. We create local aliases here so the
// rest of the connector can continue to reference familiar names while the
// underlying types come from the generated spec (no new standalone types
// are introduced).

type CreateJellyseerrRequest =
  paths["/request"]["post"]["requestBody"]["content"]["application/json"];
type JellyseerrApprovalOptions =
  paths["/request/{requestId}"]["put"]["requestBody"]["content"]["application/json"];
type JellyseerrDeclineOptions =
  paths["/request/{requestId}"]["put"]["requestBody"]["content"]["application/json"];
type RequestListResponse =
  paths["/request"]["get"]["responses"]["200"]["content"]["application/json"];
type RequestDetailsResponse =
  paths["/request/{requestId}"]["get"]["responses"]["200"]["content"]["application/json"];
type MovieDetailsResponse =
  paths["/movie/{movieId}"]["get"]["responses"]["200"]["content"]["application/json"];
type TvDetailsResponse =
  paths["/tv/{tvId}"]["get"]["responses"]["200"]["content"]["application/json"];
type JellyseerrMediaSummary =
  | (MovieDetailsResponse & { readonly mediaType: "movie" })
  | (TvDetailsResponse & { readonly mediaType: "tv" });
type JellyseerrPagedResult<T> = {
  items: T[];
  total: number;
  pageInfo?: components["schemas"]["PageInfo"];
};
type JellyseerrRequest = components["schemas"]["MediaRequest"];
type JellyseerrRequestList = JellyseerrPagedResult<JellyseerrRequest>;
type JellyseerrRequestQueryOptions =
  paths["/request"]["get"]["parameters"]["query"];
type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

const API_PREFIX = "/api/v1";
const REQUEST_ENDPOINT = `${API_PREFIX}/request`;
const SEARCH_ENDPOINT = `${API_PREFIX}/search`;
const TRENDING_ENDPOINT = `${API_PREFIX}/discover/trending`;
const DISCOVER_TV_ENDPOINT = `${API_PREFIX}/discover/tv`;
const DISCOVER_MOVIES_ENDPOINT = `${API_PREFIX}/discover/movies`;
const STATUS_ENDPOINT = `${API_PREFIX}/status`;
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
const ANIME_GENRE_ID = 16; // Animation genre in TMDB

type ApiPagination = components["schemas"]["PageInfo"];

interface ApiPaginatedResponse<TItem> {
  readonly pageInfo?: ApiPagination;
  readonly results: TItem[];
  readonly page?: number;
  readonly totalPages?: number;
  readonly totalResults?: number;
}

type ApiUser = components["schemas"]["User"] & {
  readonly displayName?: string;
};

type ApiSeasonRequest = components["schemas"]["Season"] & {
  readonly status?: number;
  readonly status4k?: number;
  readonly seasonNumber?: number;
};

type ApiMedia = Omit<components["schemas"]["MediaInfo"], "tvdbId"> & {
  readonly mediaType: "movie" | "tv";
  readonly title?: string;
  readonly originalTitle?: string;
  readonly name?: string;
  readonly originalName?: string;
  readonly externalUrl?: string;
  readonly overview?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly posterPath?: string;
  readonly backdropPath?: string;
  readonly status4k?: number;
  readonly popularity?: number;
  readonly voteAverage?: number;
  readonly voteCount?: number;
  readonly runtime?: number;
  readonly network?: string;
  readonly studio?: string;
  readonly studios?: { readonly name: string }[];
  readonly genres?: components["schemas"]["Genre"][];
  readonly tvdbId?: number;
  readonly imdbId?: string;
};

type ApiRequest = components["schemas"]["MediaRequest"] & {
  readonly media: ApiMedia;
  readonly seasons?: ApiSeasonRequest[];
  readonly requestedBy?: ApiUser;
  readonly modifiedBy?: ApiUser;
};

type ApiStatusResponse =
  paths["/status"]["get"]["responses"]["200"]["content"]["application/json"];

type ApiCreditPerson = components["schemas"]["Cast"];

type ApiSearchResult =
  | {
      readonly id: number;
      readonly mediaType: "movie";
      readonly title?: string;
      readonly originalTitle?: string;
      readonly overview?: string;
      readonly posterPath?: string;
      readonly backdropPath?: string;
      readonly releaseDate?: string;
      readonly popularity?: number;
      readonly voteAverage?: number;
      readonly voteCount?: number;
      readonly genreIds?: number[];
      readonly mediaInfo?: ApiMedia;
    }
  | {
      readonly id?: number;
      readonly mediaType: "tv";
      readonly name?: string;
      readonly originalName?: string;
      readonly overview?: string;
      readonly posterPath?: string;
      readonly backdropPath?: string;
      readonly firstAirDate?: string;
      readonly popularity?: number;
      readonly voteAverage?: number;
      readonly voteCount?: number;
      readonly genreIds?: number[];
      readonly mediaInfo?: ApiMedia;
    };

// OpenAPI uses numeric status codes. Normalize incoming status (string or number)
// to the numeric codes expected by the generated schema. Unknown values map to 0.

// Media statuses are numeric in the generated types. Return the code or 0.

const resolveImageUrl = (path?: string): string | undefined => {
  if (!path) {
    return undefined;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

const mapRequest = (request: ApiRequest): JellyseerrRequest => {
  // The OpenAPI schema is the source of truth. Return the API request
  // payload primarily unchanged and cast to the generated MediaRequest type.
  return request as unknown as JellyseerrRequest;
};

const mapPagedRequests = (data: RequestListResponse): JellyseerrRequestList => {
  const rawResults = Array.isArray(data.results)
    ? (data.results as unknown as ApiRequest[])
    : [];
  const items = rawResults.map(mapRequest);
  const total = data.pageInfo?.results ?? rawResults.length;

  return {
    items,
    total,
    pageInfo: data.pageInfo,
  };
};

const mapMediaDetails = (
  mediaType: "movie" | "tv",
  media: MovieDetailsResponse | TvDetailsResponse,
): JellyseerrMediaSummary => {
  return {
    ...media,
    mediaType,
  } as JellyseerrMediaSummary;
};

const mapCastMember = (p: ApiCreditPerson) => ({
  id: p.id,
  name: p.name,
  character: p.character,
  profileUrl: p.profilePath ? resolveImageUrl(p.profilePath) : undefined,
});

const mapSearchResults = (
  results: ApiSearchResult[],
): JellyseerrSearchResult[] =>
  // The OpenAPI search result schemas are the canonical shapes. Cast the
  // API response items to the generated union and return them so consumers
  // can be updated to rely on the generated properties.
  results.filter(
    (item) => item.mediaType === "movie" || item.mediaType === "tv",
  ) as unknown as JellyseerrSearchResult[];

const normalizeRequestQuery = (
  options?: JellyseerrRequestQueryOptions,
): Record<string, unknown> => {
  if (!options) {
    return {};
  }

  const params: Record<string, unknown> = {};

  if (typeof options.take === "number") {
    params.take = options.take;
  }

  if (typeof options.skip === "number") {
    params.skip = options.skip;
  }

  if (typeof options.filter === "string") {
    params.filter = options.filter;
  }

  if (typeof options.sort === "string") {
    params.sort = options.sort;
  }

  if (typeof options.sortDirection === "string") {
    params.sortDirection = options.sortDirection;
  }

  if (typeof options.requestedBy === "number") {
    params.requestedBy = options.requestedBy;
  }

  if (typeof options.mediaType === "string") {
    params.mediaType = options.mediaType;
  }

  // Note: The Jellyseerr /request endpoint does not accept a free-text
  // `search` query parameter according to the bundled OpenAPI spec.
  // Free-text searches should use the dedicated /search endpoint. Do not
  // include `search` here to avoid server-side validation 400 responses.

  return params;
};

const buildCreatePayload = (
  payload: CreateJellyseerrRequest,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    mediaId: payload.mediaId,
    mediaType: payload.mediaType,
  };

  if (payload.tvdbId) {
    body.tvdbId = payload.tvdbId;
  }

  if (typeof payload.is4k === "boolean") {
    body.is4k = payload.is4k;
  }

  if (payload.mediaType === "tv") {
    if (payload.seasons && payload.seasons !== "all") {
      body.seasons = payload.seasons;
    } else if (payload.seasons === "all") {
      body.seasons = "all";
    }
  }

  if (typeof payload.serverId === "number") {
    body.serverId = payload.serverId;
  }

  if (typeof payload.profileId === "number") {
    body.profileId = payload.profileId;
  }

  if (payload.rootFolder) {
    body.rootFolder = payload.rootFolder;
  }

  if (typeof payload.languageProfileId === "number") {
    body.languageProfileId = payload.languageProfileId;
  }

  if (typeof payload.userId === "number") {
    body.userId = payload.userId;
  }

  // tags are not part of the OpenAPI create request payload; ignore if present

  return body;
};

export class JellyseerrConnector extends BaseConnector<
  JellyseerrRequest,
  CreateJellyseerrRequest
> {
  /**
   * Returns the direct Jellyseerr media detail page URL for a given mediaId and type.
   * Example: /movie/123 or /tv/456
   * If you need the full URL, prepend the Jellyseerr base URL from config.
   */
  getMediaDetailUrl(mediaId: number, mediaType: "movie" | "tv"): string {
    if (!mediaId || !mediaType) return "";
    return `/${mediaType}/${mediaId}`;
  }

  /**
   * Generic request runner that will retry transient server (5xx) failures
   * a configurable number of times as set in the application settings. The
   * function accepts a request lambda so callers can pass the exact axios
   * invocation (including params / timeout) and still benefit from the
   * retry behaviour.
   *
   * NOTE: This helper deliberately rethrows the original error so callers
   * can use their existing error handling logic (including calls to
   * handleApiError which will attach context & perform logging).
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<{ data: T }>,
    operation: string,
    endpoint: string,
  ): Promise<{ data: T }> {
    const settings = useSettingsStore.getState();
    const maxRetries =
      typeof settings.jellyseerrRetryAttempts === "number"
        ? Math.max(0, Math.floor(settings.jellyseerrRetryAttempts))
        : 3;

    let attempt = 0;
    while (true) {
      try {
        return await requestFn();
      } catch (error) {
        const isAxios = isAxiosError(error);
        const status = isAxios ? error.response?.status : undefined;

        // Only retry for server-side errors (5xx). Do not retry on client
        // errors or network errors to avoid unexpected behaviour.
        const shouldRetry =
          typeof status === "number" && status >= 500 && status < 600;

        if (shouldRetry && attempt < maxRetries) {
          attempt += 1;
          const backoff = Math.min(500 * Math.pow(2, attempt - 1), 2000);
          void logger.warn("Jellyseerr request failed; retrying", {
            location: "JellyseerrConnector.requestWithRetry",
            serviceId: this.config.id,
            serviceType: this.config.type,
            operation,
            endpoint,
            attempt,
            maxRetries,
            status,
          });

          // Small exponential backoff before the next attempt
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // Exhausted retries or non-retryable error — rethrow and let caller
        // perform its own error wrapping / handling so the contextual
        // messages already in each method remain intact.
        throw error;
      }
    }
  }

  private getWithRetry<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
    operation?: string,
  ) {
    return this.requestWithRetry<T>(
      () => this.client.get<T>(endpoint, config),
      operation ?? "get",
      endpoint,
    );
  }

  private postWithRetry<T>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig,
    operation?: string,
  ) {
    return this.requestWithRetry<T>(
      () => this.client.post<T>(endpoint, data, config),
      operation ?? "post",
      endpoint,
    );
  }

  private deleteWithRetry<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
    operation?: string,
  ) {
    return this.requestWithRetry<T>(
      () => this.client.delete<T>(endpoint, config),
      operation ?? "delete",
      endpoint,
    );
  }
  async initialize(): Promise<void> {
    await this.ensureAuthenticated();
    await this.getVersion();
  }

  async getVersion(): Promise<string> {
    await this.ensureAuthenticated();

    try {
      const response = await this.getWithRetry<ApiStatusResponse>(
        STATUS_ENDPOINT,
        undefined,
        "getVersion",
      );
      return response.data.version ?? response.data.commitTag ?? "unknown";
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
        endpoint: STATUS_ENDPOINT,
      });
    }
  }

  async getRequests(
    options?: JellyseerrRequestQueryOptions,
  ): Promise<JellyseerrRequestList> {
    await this.ensureAuthenticated();

    try {
      const params = normalizeRequestQuery(options);
      const response = await this.getWithRetry<RequestListResponse>(
        REQUEST_ENDPOINT,
        { params },
        "getRequests",
      );
      let requests = mapPagedRequests(response.data);

      if (requests.items.length > 0) {
        const enrichedResults = await Promise.all(
          requests.items.map(async (request: JellyseerrRequest) => {
            try {
              const requestDetails =
                await this.getWithRetry<RequestDetailsResponse>(
                  `${REQUEST_ENDPOINT}/${request.id}`,
                  undefined,
                  "getRequestDetails",
                );

              const requestPayload = requestDetails.data as ApiRequest & {
                readonly mediaType?: string;
                readonly type?: string;
                readonly mediaId?: number;
              };
              const media = requestPayload.media as ApiMedia | undefined;
              const tmdbId =
                typeof media?.tmdbId === "number" ? media.tmdbId : undefined;
              const fallbackId =
                typeof requestPayload.mediaId === "number"
                  ? requestPayload.mediaId
                  : typeof media?.id === "number"
                    ? media.id
                    : undefined;
              const mediaId = tmdbId ?? fallbackId;

              if (typeof mediaId !== "number") {
                void logger.warn(
                  "Missing Jellyseerr media identifier; skipping enrichment",
                  {
                    location: "JellyseerrConnector.getRequests",
                    requestId: request.id,
                    serviceId: this.config.id,
                  },
                );
                return null;
              }

              const candidates: (string | undefined)[] = [
                requestPayload.mediaType,
                requestPayload.type,
                media?.mediaType,
                (media as { readonly type?: string } | undefined)?.type,
              ];

              let mediaType: "movie" | "tv" | undefined;
              for (const candidate of candidates) {
                if (candidate === "movie" || candidate === "tv") {
                  mediaType = candidate;
                  break;
                }
              }

              if (!mediaType) {
                if (
                  typeof media?.firstAirDate === "string" ||
                  typeof media?.name === "string" ||
                  typeof media?.originalName === "string"
                ) {
                  mediaType = "tv";
                } else if (
                  typeof media?.releaseDate === "string" ||
                  typeof media?.title === "string" ||
                  typeof media?.originalTitle === "string"
                ) {
                  mediaType = "movie";
                }
              }

              if (!mediaType) {
                void logger.warn(
                  "Unable to determine Jellyseerr media type for request; skipping enrichment",
                  {
                    location: "JellyseerrConnector.getRequests",
                    requestId: request.id,
                    mediaId,
                    serviceId: this.config.id,
                  },
                );
                return null;
              }

              const mediaDetails = await this.getMediaDetails(
                mediaId,
                mediaType,
              );

              return {
                requestId: request.id,
                mediaDetails,
              };
            } catch (detailsError) {
              void logger.warn("Failed to fetch request details", {
                requestId: request.id,
                error: detailsError,
              });
              return null;
            }
          }),
        );

        const mediaDetailsMap = new Map<number, JellyseerrMediaSummary>();
        for (const result of enrichedResults) {
          if (result) {
            mediaDetailsMap.set(result.requestId, result.mediaDetails);
          }
        }

        if (mediaDetailsMap.size > 0) {
          requests = {
            ...requests,
            items: requests.items.map((item: JellyseerrRequest) => {
              const mediaDetails = mediaDetailsMap.get(item.id);
              if (!mediaDetails) {
                return item;
              }

              return {
                ...item,
                mediaDetails,
              } as JellyseerrRequest;
            }),
          };
        }
      }

      // Return the (possibly enriched) requests list
      return requests;
    } catch (error) {
      // The OpenAPI /request query parameters do not include is4k/includePending4k
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getRequests",
        endpoint: REQUEST_ENDPOINT,
      });
    }
  }

  async getMediaDetails(
    mediaId: number,
    mediaType: "movie" | "tv",
  ): Promise<JellyseerrMediaSummary> {
    await this.ensureAuthenticated();

    try {
      const endpoint =
        mediaType === "movie"
          ? `${API_PREFIX}/movie/${mediaId}`
          : `${API_PREFIX}/tv/${mediaId}`;

      if (mediaType === "movie") {
        const response = await this.getWithRetry<MovieDetailsResponse>(
          endpoint,
          undefined,
          "getMediaDetails",
        );
        return mapMediaDetails("movie", response.data);
      }

      const response = await this.getWithRetry<TvDetailsResponse>(
        endpoint,
        undefined,
        "getMediaDetails",
      );
      return mapMediaDetails("tv", response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMediaDetails",
        endpoint:
          mediaType === "movie"
            ? `${API_PREFIX}/movie/${mediaId}`
            : `${API_PREFIX}/tv/${mediaId}`,
      });
    }
  }

  async getMediaCredits(
    mediaId: number,
    mediaType: "movie" | "tv",
  ): Promise<
    { id?: number; name?: string; character?: string; profileUrl?: string }[]
  > {
    await this.ensureAuthenticated();

    try {
      // Jellyseerr exposes credits as part of the full media details
      // response (see /movie/{movieId} and /tv/{tvId} in the OpenAPI spec).
      const endpoint =
        mediaType === "movie"
          ? `${API_PREFIX}/movie/${mediaId}`
          : `${API_PREFIX}/tv/${mediaId}`;

      if (mediaType === "movie") {
        const response = await this.getWithRetry<MovieDetailsResponse>(
          endpoint,
          undefined,
          "getMediaCredits",
        );
        const cast = response.data.credits?.cast ?? [];
        return cast.map(mapCastMember);
      }

      const response = await this.getWithRetry<TvDetailsResponse>(
        endpoint,
        undefined,
        "getMediaCredits",
      );
      const cast = response.data.credits?.cast ?? [];
      return cast.map(mapCastMember);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMediaCredits",
        endpoint:
          mediaType === "movie"
            ? `${API_PREFIX}/movie/${mediaId}`
            : `${API_PREFIX}/tv/${mediaId}`,
      });
    }
  }

  async createRequest(
    payload: CreateJellyseerrRequest,
  ): Promise<JellyseerrRequest> {
    await this.ensureAuthenticated();

    try {
      const response = await this.postWithRetry<ApiRequest>(
        REQUEST_ENDPOINT,
        buildCreatePayload(payload),
        undefined,
        "createRequest",
      );
      return mapRequest(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "createRequest",
        endpoint: REQUEST_ENDPOINT,
      });
    }
  }

  async approveRequest(
    requestId: number,
    options?: JellyseerrApprovalOptions,
  ): Promise<JellyseerrRequest> {
    await this.ensureAuthenticated();

    try {
      const response = await this.postWithRetry<ApiRequest>(
        `${REQUEST_ENDPOINT}/${requestId}/approve`,
        undefined,
        undefined,
        "approveRequest",
      );
      return mapRequest(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "approveRequest",
        endpoint: `${REQUEST_ENDPOINT}/${requestId}/approve`,
      });
    }
  }

  async declineRequest(
    requestId: number,
    options?: JellyseerrDeclineOptions,
  ): Promise<JellyseerrRequest> {
    await this.ensureAuthenticated();

    try {
      const response = await this.postWithRetry<ApiRequest>(
        `${REQUEST_ENDPOINT}/${requestId}/decline`,
        undefined,
        undefined,
        "declineRequest",
      );
      return mapRequest(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "declineRequest",
        endpoint: `${REQUEST_ENDPOINT}/${requestId}/decline`,
      });
    }
  }

  async deleteRequest(requestId: number): Promise<boolean> {
    await this.ensureAuthenticated();

    try {
      await this.deleteWithRetry(
        `${REQUEST_ENDPOINT}/${requestId}`,
        undefined,
        "deleteRequest",
      );
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteRequest",
        endpoint: `${REQUEST_ENDPOINT}/${requestId}`,
      });
    }
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<JellyseerrSearchResult[]> {
    await this.ensureAuthenticated();

    // Jellyseerr's search endpoint returns 400 for certain invalid
    // input (for example, very short search terms). Validate early so
    // we can return a clearer message and avoid noisy error logs.
    if (!query || query.trim().length < 3) {
      throw new ApiError({
        message: "Search term must be at least 3 characters for Jellyseerr.",
        details: { providedQuery: query },
      });
    }

    let trimmedQuery = query.trim();

    // Additional validation for special characters that might cause issues
    if (trimmedQuery.length === 0) {
      throw new ApiError({
        message: "Search term cannot be empty after trimming.",
        details: { providedQuery: query },
      });
    }

    // Check for potential problematic characters
    const hasOnlyWhitespace = /^\s*$/.test(trimmedQuery);
    if (hasOnlyWhitespace) {
      throw new ApiError({
        message: "Search term cannot contain only whitespace.",
        details: { providedQuery: query },
      });
    }

    // Sanitize query to avoid potential API issues
    // Remove excessive whitespace and limit to reasonable length
    trimmedQuery = trimmedQuery.replace(/\s+/g, " ").substring(0, 100);

    try {
      const params: Record<string, string | number> = {
        query: encodeURIComponent(trimmedQuery),
      };

      // Only add page if it's a valid positive number
      const page = options?.pagination?.page;
      if (typeof page === "number" && page > 0) {
        params.page = page;
      }

      // Only add language if it's a valid non-empty string
      const filters = options?.filters ?? {};
      const languageValue = (filters as Record<string, unknown>).language;
      if (
        typeof languageValue === "string" &&
        languageValue.trim().length > 0
      ) {
        params.language = languageValue.trim();
      }

      logger.debug("Jellyseerr search request", {
        location: "JellyseerrConnector.search",
        serviceId: this.config.id,
        params,
        endpoint: SEARCH_ENDPOINT,
      });

      const response = await this.getWithRetry<
        ApiPaginatedResponse<ApiSearchResult>
      >(
        SEARCH_ENDPOINT,
        {
          params,
          // Use standard axios parameter serialization
          timeout: 10000, // 10 second timeout for search requests
        },
        "search",
      );

      const results = mapSearchResults(response.data.results);

      logger.debug("Jellyseerr search response", {
        location: "JellyseerrConnector.search",
        serviceId: this.config.id,
        resultCount: results.length,
        totalResults: response.data.totalResults,
      });

      return results;
    } catch (error) {
      // Add more context to the error for debugging
      const contextualError = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "search",
        endpoint: SEARCH_ENDPOINT,
      });

      // Add search context to error details
      if (contextualError.details) {
        contextualError.details.searchQuery = trimmedQuery;
        contextualError.details.originalQuery = query;
        contextualError.details.hasOptions = Boolean(options);
        contextualError.details.optionsKeys = options
          ? Object.keys(options)
          : [];
      }

      // Provide more helpful error messages for common issues
      if (contextualError.statusCode === 400) {
        let helpfulMessage =
          "Jellyseerr search failed with a bad request error.";

        // Check for common issues
        if (trimmedQuery.length < 3) {
          helpfulMessage +=
            " Search term too short (minimum 3 characters required).";
        } else if (trimmedQuery.length > 100) {
          helpfulMessage += " Search term too long (maximum 100 characters).";
        } else if (/[^\w\s\-'".!?]/.test(trimmedQuery)) {
          helpfulMessage +=
            " Search term contains special characters that may not be supported.";
        } else {
          helpfulMessage +=
            " This could be due to server validation rules, rate limiting, or API compatibility issues.";
        }

        helpfulMessage += ` Original error: ${contextualError.message}`;
        contextualError.message = helpfulMessage;
      }

      logger.error("Jellyseerr search failed", {
        location: "JellyseerrConnector.search",
        serviceId: this.config.id,
        query: trimmedQuery,
        originalQuery: query,
        error: contextualError.message,
        statusCode: contextualError.statusCode,
      });

      throw contextualError;
    }
  }

  async getTrending(options?: {
    page?: number;
    language?: string;
  }): Promise<JellyseerrPagedResult<JellyseerrSearchResult>> {
    await this.ensureAuthenticated();

    try {
      const params: Record<string, unknown> = {};

      if (typeof options?.page === "number" && options.page > 0) {
        params.page = options.page;
      }

      if (options?.language) {
        params.language = options.language;
      }

      const response = await this.getWithRetry<
        ApiPaginatedResponse<ApiSearchResult>
      >(
        TRENDING_ENDPOINT,
        {
          params,
        },
        "getTrending",
      );

      const items = mapSearchResults(response.data.results);
      const totalResults =
        response.data.totalResults ??
        response.data.pageInfo?.results ??
        items.length;

      return {
        items,
        total: totalResults,
        pageInfo: {
          page: response.data.page ?? response.data.pageInfo?.page,
          pages: response.data.totalPages ?? response.data.pageInfo?.pages,
          results: totalResults,
        },
      };
    } catch (error) {
      const apiError = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTrending",
        endpoint: TRENDING_ENDPOINT,
      });

      // For server-side failures (5xx) we prefer to degrade gracefully and
      // return an empty result set instead of bubbling the exception. The
      // caller will still receive a logged warning from handleApiError.
      if (apiError.statusCode && apiError.statusCode >= 500) {
        void logger.warn(
          "Failed to load trending titles from jellyseerr; returning empty result due to server error.",
          {
            location: "JellyseerrConnector.getTrending",
            serviceId: this.config.id,
            serviceType: this.config.type,
            statusCode: apiError.statusCode,
          },
        );

        return {
          items: [],
          total: 0,
          pageInfo: { page: options?.page ?? 1, pages: 0, results: 0 },
        };
      }

      throw apiError;
    }
  }

  async getAnimeRecommendations(options?: {
    page?: number;
  }): Promise<JellyseerrPagedResult<JellyseerrSearchResult>> {
    await this.ensureAuthenticated();

    try {
      // Do not request a specific genre from the server. Instead we will
      // request popular TV entries and filter client-side by the TMDB
      // Animation genre id (ANIME_GENRE_ID). This avoids relying on
      // server-side genre filtering and keeps behaviour consistent.
      const params: Record<string, unknown> = {
        sortBy: "popularity.desc",
        language: "ja",
      };

      if (typeof options?.page === "number" && options.page > 0) {
        params.page = options.page;
      }

      const response = await this.getWithRetry<
        ApiPaginatedResponse<ApiSearchResult>
      >(
        DISCOVER_TV_ENDPOINT,
        {
          params,
        },
        "getAnimeRecommendations",
      );

      const allItems = mapSearchResults(response.data.results);
      const items = allItems.filter((it) => {
        const ids = it.genreIds ?? [];
        return Array.isArray(ids) && ids.includes(ANIME_GENRE_ID);
      });
      const totalResults = items.length;

      return {
        items,
        total: totalResults,
        pageInfo: {
          page: response.data.page ?? response.data.pageInfo?.page,
          pages: response.data.totalPages ?? response.data.pageInfo?.pages,
          results: totalResults,
        },
      };
    } catch (error) {
      const apiError = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAnimeRecommendations",
        endpoint: DISCOVER_TV_ENDPOINT,
      });

      if (apiError.statusCode && apiError.statusCode >= 500) {
        void logger.warn(
          "Failed to load anime recommendations; returning empty result due to server error.",
          {
            location: "JellyseerrConnector.getAnimeRecommendations",
            serviceId: this.config.id,
            serviceType: this.config.type,
            statusCode: apiError.statusCode,
          },
        );

        return {
          items: [],
          total: 0,
          pageInfo: { page: options?.page ?? 1, pages: 0, results: 0 },
        };
      }

      throw apiError;
    }
  }

  async getAnimeUpcoming(options?: {
    page?: number;
  }): Promise<JellyseerrPagedResult<JellyseerrSearchResult>> {
    await this.ensureAuthenticated();

    try {
      // Query upcoming TV entries and perform client-side filtering for
      // the Animation genre id so we only present anime to users.
      const params: Record<string, unknown> = {
        language: "ja",
      };

      if (typeof options?.page === "number" && options.page > 0) {
        params.page = options.page;
      }

      const response = await this.getWithRetry<
        ApiPaginatedResponse<ApiSearchResult>
      >(
        `${DISCOVER_TV_ENDPOINT}/upcoming`,
        {
          params,
        },
        "getAnimeUpcoming",
      );

      const allItems = mapSearchResults(response.data.results);
      const items = allItems.filter((it) => {
        const ids = it.genreIds ?? [];
        return Array.isArray(ids) && ids.includes(ANIME_GENRE_ID);
      });
      const totalResults = items.length;

      return {
        items,
        total: totalResults,
        pageInfo: {
          page: response.data.page ?? response.data.pageInfo?.page,
          pages: response.data.totalPages ?? response.data.pageInfo?.pages,
          results: totalResults,
        },
      };
    } catch (error) {
      const apiError = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAnimeUpcoming",
        endpoint: `${DISCOVER_TV_ENDPOINT}/upcoming`,
      });

      if (apiError.statusCode && apiError.statusCode >= 500) {
        void logger.warn(
          "Failed to load upcoming anime; returning empty result due to server error.",
          {
            location: "JellyseerrConnector.getAnimeUpcoming",
            serviceId: this.config.id,
            serviceType: this.config.type,
            statusCode: apiError.statusCode,
          },
        );

        return {
          items: [],
          total: 0,
          pageInfo: { page: options?.page ?? 1, pages: 0, results: 0 },
        };
      }

      throw apiError;
    }
  }

  async getTrendingAnime(options?: {
    page?: number;
  }): Promise<JellyseerrPagedResult<JellyseerrSearchResult>> {
    await this.ensureAuthenticated();

    try {
      // For trending we prefer the server's trending endpoint but perform
      // client-side filtering using genre ids so the caller only receives
      // anime TV series.
      const response = await this.getWithRetry<
        ApiPaginatedResponse<ApiSearchResult>
      >(
        TRENDING_ENDPOINT,
        {
          params: options,
        },
        "getTrendingAnime",
      );

      const allResults = mapSearchResults(response.data.results);
      const items = allResults.filter((it) => {
        if (it.mediaType !== "tv") return false;
        const ids = it.genreIds ?? [];
        return Array.isArray(ids) && ids.includes(ANIME_GENRE_ID);
      });

      return {
        items,
        total: items.length,
        pageInfo: {
          page: response.data.page ?? response.data.pageInfo?.page,
          pages: response.data.totalPages ?? response.data.pageInfo?.pages,
          results: items.length,
        },
      };
    } catch (error) {
      const apiError = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTrendingAnime",
        endpoint: TRENDING_ENDPOINT,
      });

      if (apiError.statusCode && apiError.statusCode >= 500) {
        void logger.warn(
          "Failed to load trending anime; returning empty result due to server error.",
          {
            location: "JellyseerrConnector.getTrendingAnime",
            serviceId: this.config.id,
            serviceType: this.config.type,
            statusCode: apiError.statusCode,
          },
        );

        return {
          items: [],
          total: 0,
          pageInfo: { page: options?.page ?? 1, pages: 0, results: 0 },
        };
      }

      throw apiError;
    }
  }

  async getAnimeMovies(options?: {
    page?: number;
  }): Promise<JellyseerrPagedResult<JellyseerrSearchResult>> {
    await this.ensureAuthenticated();

    try {
      // Request popular movies and filter client-side to animation genre ids
      // so our caller receives only anime movies.
      const params: Record<string, unknown> = {
        sortBy: "popularity.desc",
        language: "ja",
      };

      if (typeof options?.page === "number" && options.page > 0) {
        params.page = options.page;
      }

      const response = await this.getWithRetry<
        ApiPaginatedResponse<ApiSearchResult>
      >(
        DISCOVER_MOVIES_ENDPOINT,
        {
          params,
        },
        "getAnimeMovies",
      );

      const allItems = mapSearchResults(response.data.results);
      const items = allItems.filter((it) => {
        const ids = it.genreIds ?? [];
        return Array.isArray(ids) && ids.includes(ANIME_GENRE_ID);
      });
      const totalResults = items.length;

      return {
        items,
        total: totalResults,
        pageInfo: {
          page: response.data.page ?? response.data.pageInfo?.page,
          pages: response.data.totalPages ?? response.data.pageInfo?.pages,
          results: totalResults,
        },
      };
    } catch (error) {
      const apiError = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAnimeMovies",
        endpoint: DISCOVER_MOVIES_ENDPOINT,
      });

      if (apiError.statusCode && apiError.statusCode >= 500) {
        void logger.warn(
          "Failed to load anime movies; returning empty result due to server error.",
          {
            location: "JellyseerrConnector.getAnimeMovies",
            serviceId: this.config.id,
            serviceType: this.config.type,
            statusCode: apiError.statusCode,
          },
        );

        return {
          items: [],
          total: 0,
          pageInfo: { page: options?.page ?? 1, pages: 0, results: 0 },
        };
      }

      throw apiError;
    }
  }
}
