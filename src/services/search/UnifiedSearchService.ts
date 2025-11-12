import type { IConnector, SearchOptions } from "@/connectors/base/IConnector";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { Series } from "@/models/media.types";
import type { Movie } from "@/models/movie.types";
import type { JellyfinItem } from "@/models/jellyfin.types";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
import type {
  SearchHistoryEntry,
  SearchableServiceSummary,
  UnifiedSearchError,
  UnifiedSearchMediaType,
  UnifiedSearchOptions,
  UnifiedSearchResponse,
  UnifiedSearchResult,
} from "@/models/search.types";
import { logger } from "@/services/logger/LoggerService";
import { isApiError, type ApiError } from "@/utils/error.utils";
import {
  getOpenApiOperationHint,
  hasOpenApiForService,
} from "@/connectors/openapi/OpenApiHelper";
type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

const HISTORY_STORAGE_KEY = "UnifiedSearch_history";
const HISTORY_LIMIT = 12;

// Mobile networks and VPN tunnels can introduce noticeable latency. Keep
// per-connector search requests reasonably responsive without failing too fast.
const DEFAULT_SEARCH_TIMEOUT_MS = 10_000;
const MAX_SEARCH_TIMEOUT_MS = 20_000;

const normalizeTerm = (term: string): string => term.trim();

const sortIdentifiers = <T extends string>(
  values: readonly T[] | undefined,
): T[] | undefined =>
  values && values.length
    ? Array.from(new Set(values)).sort((first, second) =>
        first.localeCompare(second),
      )
    : undefined;

export const createUnifiedSearchHistoryKey = (
  term: string,
  serviceIds?: string[],
  mediaTypes?: UnifiedSearchMediaType[],
): string => {
  const normalizedTerm = normalizeTerm(term).toLowerCase();
  const servicesKey = sortIdentifiers(serviceIds)?.join(",") ?? "";
  const mediaKey = sortIdentifiers(mediaTypes)?.join(",") ?? "";
  return `${normalizedTerm}__${servicesKey}__${mediaKey}`;
};

interface ConnectorSearchResult {
  readonly results: UnifiedSearchResult[];
  readonly error?: UnifiedSearchError;
}

export class UnifiedSearchService {
  private static instance: UnifiedSearchService | null = null;

  private readonly manager = ConnectorManager.getInstance();

  private history: SearchHistoryEntry[] = [];

  private historyLoaded = false;

  static getInstance(): UnifiedSearchService {
    if (!UnifiedSearchService.instance) {
      UnifiedSearchService.instance = new UnifiedSearchService();
    }

    return UnifiedSearchService.instance;
  }

  async search(
    term: string,
    options: UnifiedSearchOptions = {},
  ): Promise<UnifiedSearchResponse> {
    const normalizedTerm = normalizeTerm(term);

    if (normalizedTerm.length < 2) {
      return {
        results: [],
        errors: [],
        durationMs: 0,
      };
    }

    await this.manager.loadSavedServices();

    const connectors = this.manager
      .getAllConnectors()
      .filter((connector) => typeof connector.search === "function");

    // Use AI interpretation to determine which services to search if provided
    let targetServiceIds = options.serviceIds;
    if (options.aiInterpretation?.recommendedServices && !options.serviceIds) {
      // Filter to only services that are configured
      const configuredIds = new Set(
        connectors
          .map((c) => c.config.id)
          .concat(options.aiInterpretation.recommendedServices),
      );
      targetServiceIds = options.aiInterpretation.recommendedServices.filter(
        (serviceId) => configuredIds.has(serviceId),
      );
    }

    const filteredConnectors = targetServiceIds?.length
      ? connectors.filter((connector) =>
          targetServiceIds!.includes(connector.config.id),
        )
      : connectors;

    const start = Date.now();

    const settled = await Promise.all(
      filteredConnectors.map((connector) =>
        this.searchConnector(normalizedTerm, connector, options),
      ),
    );

    const aggregateResults: UnifiedSearchResult[] = [];
    const aggErrors: UnifiedSearchError[] = [];

    for (const item of settled) {
      aggregateResults.push(...item.results);
      if (item.error) {
        aggErrors.push(item.error);
      }
    }

    const results = this.deduplicateAndSort(aggregateResults);
    const filtered = this.applyAdvancedFilters(results, options);

    return {
      results: filtered,
      errors: aggErrors,
      durationMs: Date.now() - start,
    };
  }

  async getSearchableServices(): Promise<SearchableServiceSummary[]> {
    await this.manager.loadSavedServices();

    const allConnectors = this.manager.getAllConnectors();

    const searchableServices = allConnectors
      .filter((connector) => typeof connector.search === "function")
      .map((connector) => ({
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        serviceType: connector.config.type,
      }))
      .sort((first, second) =>
        first.serviceName.localeCompare(second.serviceName),
      );

    return searchableServices;
  }

  async getHistory(): Promise<SearchHistoryEntry[]> {
    await this.ensureHistoryLoaded();

    return this.history
      .slice()
      .sort((first, second) =>
        second.lastSearchedAt.localeCompare(first.lastSearchedAt),
      );
  }

  async recordSearch(
    term: string,
    serviceIds?: string[],
    mediaTypes?: UnifiedSearchMediaType[],
  ): Promise<void> {
    const normalizedTerm = normalizeTerm(term);
    if (normalizedTerm.length < 2) {
      return;
    }

    await this.ensureHistoryLoaded();

    const normalizedServices = sortIdentifiers(serviceIds);
    const normalizedMedia = sortIdentifiers(mediaTypes);
    const key = createUnifiedSearchHistoryKey(
      normalizedTerm,
      normalizedServices,
      normalizedMedia,
    );
    const entry: SearchHistoryEntry = {
      term: normalizedTerm,
      lastSearchedAt: new Date().toISOString(),
      serviceIds: normalizedServices,
      mediaTypes: normalizedMedia,
    };

    const existingIndex = this.history.findIndex(
      (item) =>
        createUnifiedSearchHistoryKey(
          item.term,
          item.serviceIds,
          item.mediaTypes,
        ) === key,
    );

    if (existingIndex >= 0) {
      this.history[existingIndex] = entry;
    } else {
      this.history.unshift(entry);
    }

    if (this.history.length > HISTORY_LIMIT) {
      this.history = this.history.slice(0, HISTORY_LIMIT);
    }

    await this.persistHistory();
  }

  async removeHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
    await this.ensureHistoryLoaded();

    const key = createUnifiedSearchHistoryKey(
      entry.term,
      entry.serviceIds,
      entry.mediaTypes,
    );
    const nextHistory = this.history.filter(
      (item) =>
        createUnifiedSearchHistoryKey(
          item.term,
          item.serviceIds,
          item.mediaTypes,
        ) !== key,
    );

    if (nextHistory.length === this.history.length) {
      return;
    }

    this.history = nextHistory;
    await this.persistHistory();
  }

  async clearHistory(): Promise<void> {
    await this.ensureHistoryLoaded();

    this.history = [];

    try {
      await storageAdapter.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      await logger.error("Failed to clear unified search history.", {
        location: "UnifiedSearchService.clearHistory",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async ensureHistoryLoaded(): Promise<void> {
    if (this.historyLoaded) {
      return;
    }

    try {
      const raw = await storageAdapter.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        this.history = [];
      } else {
        const parsed = JSON.parse(raw) as SearchHistoryEntry[];
        this.history = Array.isArray(parsed)
          ? parsed
              .filter(
                (entry) =>
                  typeof entry.term === "string" &&
                  entry.term.trim().length > 0,
              )
              .map((entry) => ({
                term: normalizeTerm(entry.term),
                lastSearchedAt:
                  entry.lastSearchedAt ?? new Date(0).toISOString(),
                serviceIds: sortIdentifiers(entry.serviceIds),
                mediaTypes: sortIdentifiers(entry.mediaTypes),
              }))
          : [];
      }
    } catch (error) {
      this.history = [];
      await logger.error("Failed to load unified search history.", {
        location: "UnifiedSearchService.ensureHistoryLoaded",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.historyLoaded = true;
    }
  }

  private async persistHistory(): Promise<void> {
    try {
      await storageAdapter.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(this.history),
      );
    } catch (error) {
      await logger.error("Failed to persist unified search history.", {
        location: "UnifiedSearchService.persistHistory",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async searchConnector(
    term: string,
    connector: IConnector,
    options: UnifiedSearchOptions,
  ): Promise<ConnectorSearchResult> {
    const searchFn = connector.search?.bind(connector);

    if (!searchFn) {
      return { results: [] };
    }

    try {
      // Create SearchOptions from UnifiedSearchOptions for the connector
      const searchOptions: SearchOptions = {
        ...(options.limitPerService && {
          pagination: {
            pageSize: options.limitPerService,
          },
        }),
        ...(options.mediaTypes &&
          options.mediaTypes.length > 0 && {
            filters: {
              mediaTypes: options.mediaTypes,
            },
          }),
      };

      const timeoutMs = this.resolveSearchTimeout(connector);
      const timeoutLabel =
        connector.config.name ??
        `${connector.config.type} (${connector.config.id})`;
      const rawResults = await this.withTimeout(
        searchFn(
          term,
          Object.keys(searchOptions).length > 0 ? searchOptions : undefined,
        ),
        timeoutMs,
        `Search timed out after ${timeoutMs}ms for ${timeoutLabel}.`,
      );
      const mapped = this.mapResults(rawResults, connector, options.mediaTypes);
      const limit = options.limitPerService ?? 25;
      return { results: mapped.slice(0, limit) };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown search error.";

      // Avoid double-logging and reduce noise for expected API errors
      // (for example, a 400 when a search term is too short). For ApiError
      // instances we record debug-level info here because the error utils
      // already emits an appropriate log entry with the correct severity.
      if (isApiError(error)) {
        // Try to enrich API errors with a short, actionable hint from any
        // bundled OpenAPI spec we have for the connector type. This helps
        // surface validation expectations (for example minimum search
        // term lengths) to the user without requiring them to inspect logs.
        const apiErr = error as ApiError;
        const ctx = apiErr.details?.context as
          | Record<string, unknown>
          | undefined;
        try {
          const endpoint = ctx?.endpoint as string | undefined;
          const operation = ctx?.operation as string | undefined;
          const serviceType = ctx?.serviceType as string | undefined;
          if (
            endpoint &&
            operation &&
            serviceType &&
            hasOpenApiForService(serviceType)
          ) {
            const hint = getOpenApiOperationHint(
              serviceType,
              endpoint,
              operation,
            );
            if (hint) {
              apiErr.details = { ...(apiErr.details ?? {}), openApiHint: hint };
              // Keep the original message short but append a compact hint so
              // UI layers and logs can surface a helpful suggestion.
              apiErr.message = `${apiErr.message} ${hint}`;
            }
          }
        } catch (e) {
          // If anything goes wrong while enriching the error we don't want
          // to hide the original error; record the enrichment failure at
          // debug level and continue.
          void logger.debug("OpenAPI hint enrichment failed.", {
            location: "UnifiedSearchService.searchConnector",
            serviceId: connector.config.id,
            serviceType: connector.config.type,
            error: e instanceof Error ? e.message : String(e),
          });
        }

        // For jellyseerr search errors, provide specific troubleshooting hints
        if (
          connector.config.type === "jellyseerr" &&
          apiErr.statusCode === 400
        ) {
          const originalMessage = apiErr.message;
          apiErr.message = `${originalMessage} Try using a different search term or check your Jellyseerr configuration.`;
        }

        await logger.debug("Unified search connector encountered API error.", {
          location: "UnifiedSearchService.searchConnector",
          serviceId: connector.config.id,
          serviceType: connector.config.type,
          error: message,
        });
      } else {
        await logger.warn("Unified search connector failed.", {
          location: "UnifiedSearchService.searchConnector",
          serviceId: connector.config.id,
          serviceType: connector.config.type,
          error: message,
        });
      }

      return {
        results: [],
        error: {
          serviceId: connector.config.id,
          serviceType: connector.config.type,
          message,
        },
      };
    }
  }

  private mapResults(
    rawResults: unknown,
    connector: IConnector,
    mediaFilter?: UnifiedSearchMediaType[],
  ): UnifiedSearchResult[] {
    const { config } = connector;

    let mapped: UnifiedSearchResult[] = [];

    switch (config.type) {
      case "sonarr":
        mapped = this.mapSonarrResults(
          rawResults as Series[],
          connector as SonarrConnector,
        );
        break;
      case "radarr":
        mapped = this.mapRadarrResults(
          rawResults as Movie[],
          connector as RadarrConnector,
        );
        break;
      case "jellyseerr":
        mapped = this.mapJellyseerrResults(
          rawResults as JellyseerrSearchResult[],
          connector as JellyseerrConnector,
        );
        break;
      case "jellyfin":
        mapped = this.mapJellyfinResults(
          rawResults as JellyfinItem[],
          connector as JellyfinConnector,
        );
        break;
      default:
        mapped = [];
        break;
    }

    if (!mediaFilter || mediaFilter.length === 0) {
      return mapped;
    }

    const filterSet = new Set(mediaFilter);
    return mapped.filter((item) => filterSet.has(item.mediaType));
  }

  private mapSonarrResults(
    seriesList: Series[],
    connector: SonarrConnector,
  ): UnifiedSearchResult[] {
    return seriesList.map((series) => ({
      id: `${connector.config.id}:sonarr:${
        series.tvdbId ?? series.tmdbId ?? series.id
      }`,
      title: series.title,
      overview: series.overview,
      releaseDate: series.added,
      year: series.year,
      posterUrl: series.posterUrl,
      backdropUrl: series.backdropUrl,
      popularity: series.statistics?.percentOfEpisodes,
      mediaType: "series",
      serviceType: connector.config.type,
      serviceId: connector.config.id,
      serviceName: connector.config.name,
      isInLibrary: Boolean(series.id && series.id > 0),
      externalIds: {
        tmdbId: series.tmdbId,
        tvdbId: series.tvdbId,
        imdbId: series.imdbId,
        serviceNativeId: series.id,
      },
      extra: {
        network: series.network,
        status: series.status,
        nextAiring: series.nextAiring,
        seasonCount: series.seasons?.length ?? 0,
      },
    }));
  }

  private mapRadarrResults(
    movies: Movie[],
    connector: RadarrConnector,
  ): UnifiedSearchResult[] {
    return movies.map((movie) => ({
      id: `${connector.config.id}:radarr:${
        movie.tmdbId ?? movie.imdbId ?? movie.id
      }`,
      title: movie.title,
      overview: movie.overview,
      releaseDate: movie.releaseDate ?? movie.inCinemas ?? movie.digitalRelease,
      year: movie.year,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      rating: movie.ratings?.value,
      popularity: movie.statistics?.percentAvailable,
      mediaType: "movie",
      serviceType: connector.config.type,
      serviceId: connector.config.id,
      serviceName: connector.config.name,
      isInLibrary: Boolean(movie.id && movie.id > 0),
      isAvailable: movie.isAvailable,
      externalIds: {
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
        serviceNativeId: movie.id,
      },
      extra: {
        minimumAvailability: movie.minimumAvailability,
        runtime: movie.runtime,
        studio: movie.studio,
      },
    }));
  }

  private mapJellyseerrResults(
    results: JellyseerrSearchResult[],
    connector: JellyseerrConnector,
  ): UnifiedSearchResult[] {
    return results.map((result) => {
      // The generated OpenAPI shapes for Jellyseerr can differ between movie
      // and tv results. Read common fields defensively (no `any` casts).
      const toRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === "object" ? (v as Record<string, unknown>) : null;

      const r = toRecord(result) ?? {};
      const mediaInfo = toRecord((r.mediaInfo as unknown) ?? undefined);

      const tmdbId =
        typeof mediaInfo?.tmdbId === "number"
          ? (mediaInfo!.tmdbId as number)
          : typeof r.tmdbId === "number"
            ? (r.tmdbId as number)
            : undefined;
      const tvdbId =
        typeof mediaInfo?.tvdbId === "number"
          ? (mediaInfo!.tvdbId as number)
          : typeof r.tvdbId === "number"
            ? (r.tvdbId as number)
            : undefined;
      const imdbId =
        typeof mediaInfo?.imdbId === "string"
          ? (mediaInfo!.imdbId as string)
          : typeof r.imdbId === "string"
            ? (r.imdbId as string)
            : undefined;

      const serviceNativeId =
        typeof r.id === "number" ? (r.id as number) : undefined;

      const title =
        (typeof r.title === "string" && (r.title as string)) ||
        (typeof r.name === "string" && (r.name as string)) ||
        (mediaInfo &&
          typeof mediaInfo.title === "string" &&
          (mediaInfo.title as string)) ||
        (mediaInfo &&
          typeof mediaInfo.name === "string" &&
          (mediaInfo.name as string)) ||
        "";
      const overview =
        typeof r.overview === "string"
          ? (r.overview as string)
          : mediaInfo && typeof mediaInfo.overview === "string"
            ? (mediaInfo.overview as string)
            : undefined;

      const mediaType =
        typeof r.mediaType === "string" ? (r.mediaType as string) : undefined;
      const releaseDate =
        mediaType === "movie"
          ? typeof r.releaseDate === "string"
            ? (r.releaseDate as string)
            : mediaInfo && typeof mediaInfo.releaseDate === "string"
              ? (mediaInfo.releaseDate as string)
              : undefined
          : typeof r.firstAirDate === "string"
            ? (r.firstAirDate as string)
            : mediaInfo && typeof mediaInfo.firstAirDate === "string"
              ? (mediaInfo.firstAirDate as string)
              : undefined;

      const poster =
        typeof r.posterPath === "string"
          ? (r.posterPath as string)
          : mediaInfo && typeof mediaInfo.posterPath === "string"
            ? (mediaInfo.posterPath as string)
            : undefined;
      const backdrop =
        typeof r.backdropPath === "string"
          ? (r.backdropPath as string)
          : mediaInfo && typeof mediaInfo.backdropPath === "string"
            ? (mediaInfo.backdropPath as string)
            : undefined;

      const posterUrl = poster
        ? `https://image.tmdb.org/t/p/original${poster}`
        : undefined;
      const backdropUrl = backdrop
        ? `https://image.tmdb.org/t/p/original${backdrop}`
        : undefined;

      const rating =
        typeof r.voteAverage === "number"
          ? (r.voteAverage as number)
          : mediaInfo && typeof mediaInfo.voteAverage === "number"
            ? (mediaInfo.voteAverage as number)
            : undefined;
      const popularity =
        typeof r.popularity === "number"
          ? (r.popularity as number)
          : mediaInfo && typeof mediaInfo.popularity === "number"
            ? (mediaInfo.popularity as number)
            : undefined;

      const isRequested = Boolean(
        (Array.isArray(r.requests as unknown) &&
          (r.requests as unknown as unknown[]).length > 0) ||
          (mediaInfo &&
            Array.isArray(mediaInfo.requests as unknown) &&
            (mediaInfo.requests as unknown as unknown[]).length > 0),
      );

      const mediaStatus =
        typeof mediaInfo?.status === "number"
          ? (mediaInfo!.status as number)
          : typeof r.mediaStatus === "number"
            ? (r.mediaStatus as number)
            : undefined;

      return {
        id: `${connector.config.id}:jellyseerr:${tmdbId ?? serviceNativeId}`,
        title,
        overview,
        releaseDate,
        posterUrl,
        backdropUrl,
        rating,
        popularity,
        mediaType: mediaType === "tv" ? "series" : "movie",
        serviceType: connector.config.type,
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        isRequested,
        externalIds: {
          tmdbId,
          tvdbId,
          imdbId,
          serviceNativeId,
        },
        extra: {
          mediaStatus,
        },
      } as UnifiedSearchResult;
    });
  }

  private mapJellyfinResults(
    items: JellyfinItem[],
    connector: JellyfinConnector,
  ): UnifiedSearchResult[] {
    return items.map((item) => {
      const providerIds = item.ProviderIds ?? {};
      const tmdbId = providerIds.Tmdb ? Number(providerIds.Tmdb) : undefined;
      const tvdbId = providerIds.Tvdb ? Number(providerIds.Tvdb) : undefined;
      const imdbId = providerIds.Imdb as string | undefined;

      // Determine media type based on Jellyfin item type
      let mediaType: UnifiedSearchMediaType = "unknown";
      if (item.Type === "Series" || item.Type === "Episode") {
        mediaType = "series";
      } else if (item.Type === "Movie") {
        mediaType = "movie";
      }

      const releaseDate = item.PremiereDate ?? item.ProductionYear?.toString();

      let posterUrl: string | undefined;
      if (item.ImageTags?.Primary && item.Id) {
        posterUrl = connector.getImageUrl(item.Id, "Primary", { width: 200 });
      }

      let backdropUrl: string | undefined;
      if (item.ImageTags?.Backdrop && item.Id) {
        backdropUrl = connector.getImageUrl(item.Id, "Backdrop", {
          width: 400,
        });
      }

      return {
        id: `${connector.config.id}:jellyfin:${item.Id}`,
        title: item.Name ?? "",
        overview: item.Overview,
        releaseDate,
        year: item.ProductionYear,
        posterUrl,
        backdropUrl,
        runtime: item.RunTimeTicks
          ? Math.floor(item.RunTimeTicks / 10_000_000 / 60)
          : undefined,
        mediaType,
        serviceType: connector.config.type,
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        isInLibrary: true, // Items from search are assumed to be in the library
        externalIds: {
          tmdbId,
          tvdbId,
          imdbId,
          serviceNativeId: item.Id,
        },
        extra: {
          genres: item.Genres?.join(", "),
          studios: item.Studios?.join(", "),
        },
      } as UnifiedSearchResult;
    });
  }

  private applyAdvancedFilters(
    results: UnifiedSearchResult[],
    options: UnifiedSearchOptions,
  ): UnifiedSearchResult[] {
    return results.filter((result) => {
      // Apply AI interpretation filters if provided
      if (options.aiInterpretation) {
        const interp = options.aiInterpretation;

        // Filter by media types from AI interpretation
        if (interp.mediaTypes && interp.mediaTypes.length > 0) {
          const aiMediaTypes = interp.mediaTypes as UnifiedSearchMediaType[];
          if (!aiMediaTypes.includes(result.mediaType)) {
            return false;
          }
        }

        // Filter by year range from AI interpretation
        if (interp.yearRange && result.year) {
          if (result.year < interp.yearRange.start) {
            return false;
          }
          if (result.year > interp.yearRange.end) {
            return false;
          }
        }

        // Filter by quality preference
        if (interp.qualityPreference && result.rating !== undefined) {
          const qualityMap: Record<string, number> = {
            "1080p": 6.0,
            "720p": 5.5,
            "480p": 5.0,
            "4k": 7.0,
            "8k": 8.0,
          };
          const threshold = qualityMap[interp.qualityPreference] ?? 6.0;
          if (result.rating < threshold) {
            return false;
          }
        }

        // Filter by AI-interpreted filters
        if (interp.filters) {
          if (
            interp.filters.minRating &&
            (result.rating ?? 0) < interp.filters.minRating
          ) {
            return false;
          }
        }
      }

      // Filter by status
      if (options.status && options.status !== "Any") {
        const status = options.status.toLowerCase();

        if (status === "owned" || status === "available") {
          if (!result.isInLibrary) return false;
        } else if (status === "monitored") {
          // Monitored items exist in the system (sonarr/radarr metadata)
          if (!result.isInLibrary) return false;
        } else if (status === "missing") {
          // Missing items are in the system but not fully available
          if (result.isInLibrary !== false) return false;
        } else if (status === "requested") {
          // Requested items have isRequested flag set
          if (!result.isRequested) return false;
        }
      }

      // Filter by quality (rating)
      if (options.quality && options.quality !== "Any") {
        const qualityThreshold = Number(options.quality);
        if (!Number.isNaN(qualityThreshold)) {
          if ((result.rating ?? 0) < qualityThreshold) {
            return false;
          }
        }
      }

      // Filter by release year range
      if (
        options.releaseYearMin !== undefined ||
        options.releaseYearMax !== undefined
      ) {
        const year = result.year;
        if (year !== undefined) {
          if (
            options.releaseYearMin !== undefined &&
            year < options.releaseYearMin
          ) {
            return false;
          }
          if (
            options.releaseYearMax !== undefined &&
            year > options.releaseYearMax
          ) {
            return false;
          }
        }
      }

      // Filter by genres
      if (options.genres && options.genres.length > 0) {
        const genresStr = result.extra?.genres as string | undefined;
        if (genresStr) {
          const itemGenres = genresStr
            .split(",")
            .map((g) => g.trim().toLowerCase());
          const filterGenres = options.genres.map((g) => g.toLowerCase());
          const hasMatchingGenre = filterGenres.some((fg) =>
            itemGenres.some((ig) => ig.includes(fg) || fg.includes(ig)),
          );
          if (!hasMatchingGenre) {
            return false;
          }
        } else {
          // If genres filter is applied but item has no genres, exclude it
          return false;
        }
      }

      return true;
    });
  }

  private deduplicateAndSort(
    results: UnifiedSearchResult[],
  ): UnifiedSearchResult[] {
    const deduped = new Map<string, UnifiedSearchResult>();

    for (const item of results) {
      const key = this.createResultKey(item);
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    }

    const ordered = Array.from(deduped.values());

    ordered.sort((first, second) => {
      const firstInLibrary = first.isInLibrary ?? false;
      const secondInLibrary = second.isInLibrary ?? false;
      if (firstInLibrary !== secondInLibrary) {
        return firstInLibrary ? 1 : -1;
      }

      const firstDate = this.parseDate(first.releaseDate);
      const secondDate = this.parseDate(second.releaseDate);
      if (firstDate && secondDate && firstDate !== secondDate) {
        return secondDate - firstDate;
      }

      const firstYear = first.year ?? 0;
      const secondYear = second.year ?? 0;
      if (firstYear !== secondYear) {
        return secondYear - firstYear;
      }

      return first.title.localeCompare(second.title);
    });

    return ordered;
  }

  private createResultKey(result: UnifiedSearchResult): string {
    const parts: string[] = [result.serviceId, result.mediaType];

    const ids = result.externalIds;
    if (ids?.serviceNativeId !== undefined) {
      parts.push(String(ids.serviceNativeId));
    } else if (ids?.tmdbId !== undefined) {
      parts.push(`tmdb:${ids.tmdbId}`);
    } else if (ids?.tvdbId !== undefined) {
      parts.push(`tvdb:${ids.tvdbId}`);
    } else if (ids?.imdbId) {
      parts.push(`imdb:${ids.imdbId}`);
    } else {
      parts.push(result.title.toLowerCase());
    }

    return parts.join("::");
  }

  private parseDate(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }

  private resolveSearchTimeout(connector: IConnector): number {
    const configuredTimeout = connector.config.timeout;

    if (
      typeof configuredTimeout === "number" &&
      Number.isFinite(configuredTimeout) &&
      configuredTimeout > 0
    ) {
      return Math.min(configuredTimeout, MAX_SEARCH_TIMEOUT_MS);
    }

    return DEFAULT_SEARCH_TIMEOUT_MS;
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message?: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message ?? "Search timeout"));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
