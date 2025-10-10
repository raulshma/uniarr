import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IConnector } from '@/connectors/base/IConnector';
import type { RadarrConnector } from '@/connectors/implementations/RadarrConnector';
import type { SonarrConnector } from '@/connectors/implementations/SonarrConnector';
import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { Series } from '@/models/media.types';
import type { Movie } from '@/models/movie.types';
import type { JellyseerrSearchResult } from '@/models/jellyseerr.types';
import type {
  SearchHistoryEntry,
  SearchableServiceSummary,
  UnifiedSearchError,
  UnifiedSearchMediaType,
  UnifiedSearchOptions,
  UnifiedSearchResponse,
  UnifiedSearchResult,
} from '@/models/search.types';
import { logger } from '@/services/logger/LoggerService';
import { isApiError } from '@/utils/error.utils';

const HISTORY_STORAGE_KEY = 'UnifiedSearch_history';
const HISTORY_LIMIT = 12;
const SEARCH_TIMEOUT_MS = 2000;

const normalizeTerm = (term: string): string => term.trim();

const sortIdentifiers = <T extends string>(values: readonly T[] | undefined): T[] | undefined =>
  values && values.length ? Array.from(new Set(values)).sort((first, second) => first.localeCompare(second)) : undefined;

export const createUnifiedSearchHistoryKey = (
  term: string,
  serviceIds?: string[],
  mediaTypes?: UnifiedSearchMediaType[],
): string => {
  const normalizedTerm = normalizeTerm(term).toLowerCase();
  const servicesKey = sortIdentifiers(serviceIds)?.join(',') ?? '';
  const mediaKey = sortIdentifiers(mediaTypes)?.join(',') ?? '';
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

  async search(term: string, options: UnifiedSearchOptions = {}): Promise<UnifiedSearchResponse> {
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
      .filter((connector) => typeof connector.search === 'function');

    const filteredConnectors = options.serviceIds?.length
      ? connectors.filter((connector) => options.serviceIds!.includes(connector.config.id))
      : connectors;

    const start = Date.now();

    const settled = await Promise.all(
      filteredConnectors.map((connector) => this.searchConnector(normalizedTerm, connector, options)),
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

    return {
      results,
      errors: aggErrors,
      durationMs: Date.now() - start,
    };
  }

  async getSearchableServices(): Promise<SearchableServiceSummary[]> {
    await this.manager.loadSavedServices();

    return this.manager
      .getAllConnectors()
      .filter((connector) => typeof connector.search === 'function')
      .map((connector) => ({
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        serviceType: connector.config.type,
      }))
      .sort((first, second) => first.serviceName.localeCompare(second.serviceName));
  }

  async getHistory(): Promise<SearchHistoryEntry[]> {
    await this.ensureHistoryLoaded();

    return this.history
      .slice()
      .sort((first, second) => second.lastSearchedAt.localeCompare(first.lastSearchedAt));
  }

  async recordSearch(term: string, serviceIds?: string[], mediaTypes?: UnifiedSearchMediaType[]): Promise<void> {
    const normalizedTerm = normalizeTerm(term);
    if (normalizedTerm.length < 2) {
      return;
    }

    await this.ensureHistoryLoaded();

    const normalizedServices = sortIdentifiers(serviceIds);
    const normalizedMedia = sortIdentifiers(mediaTypes);
    const key = createUnifiedSearchHistoryKey(normalizedTerm, normalizedServices, normalizedMedia);
    const entry: SearchHistoryEntry = {
      term: normalizedTerm,
      lastSearchedAt: new Date().toISOString(),
      serviceIds: normalizedServices,
      mediaTypes: normalizedMedia,
    };

    const existingIndex = this.history.findIndex(
      (item) => createUnifiedSearchHistoryKey(item.term, item.serviceIds, item.mediaTypes) === key,
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

    const key = createUnifiedSearchHistoryKey(entry.term, entry.serviceIds, entry.mediaTypes);
    const nextHistory = this.history.filter(
      (item) => createUnifiedSearchHistoryKey(item.term, item.serviceIds, item.mediaTypes) !== key,
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
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      await logger.error('Failed to clear unified search history.', {
        location: 'UnifiedSearchService.clearHistory',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async ensureHistoryLoaded(): Promise<void> {
    if (this.historyLoaded) {
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        this.history = [];
      } else {
        const parsed = JSON.parse(raw) as SearchHistoryEntry[];
        this.history = Array.isArray(parsed)
          ? parsed
              .filter((entry) => typeof entry.term === 'string' && entry.term.trim().length > 0)
              .map((entry) => ({
                term: normalizeTerm(entry.term),
                lastSearchedAt: entry.lastSearchedAt ?? new Date(0).toISOString(),
                serviceIds: sortIdentifiers(entry.serviceIds),
                mediaTypes: sortIdentifiers(entry.mediaTypes),
              }))
          : [];
      }
    } catch (error) {
      this.history = [];
      await logger.error('Failed to load unified search history.', {
        location: 'UnifiedSearchService.ensureHistoryLoaded',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.historyLoaded = true;
    }
  }

  private async persistHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      await logger.error('Failed to persist unified search history.', {
        location: 'UnifiedSearchService.persistHistory',
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
      const rawResults = await this.withTimeout(searchFn(term), SEARCH_TIMEOUT_MS);
      const mapped = this.mapResults(rawResults, connector, options.mediaTypes);
      const limit = options.limitPerService ?? 25;
      return { results: mapped.slice(0, limit) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown search error.';

      // Avoid double-logging and reduce noise for expected API errors
      // (for example, a 400 when a search term is too short). For ApiError
      // instances we record debug-level info here because the error utils
      // already emits an appropriate log entry with the correct severity.
      if (isApiError(error)) {
        await logger.debug('Unified search connector encountered API error.', {
          location: 'UnifiedSearchService.searchConnector',
          serviceId: connector.config.id,
          serviceType: connector.config.type,
          error: message,
        });
      } else {
        await logger.warn('Unified search connector failed.', {
          location: 'UnifiedSearchService.searchConnector',
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
      case 'sonarr':
        mapped = this.mapSonarrResults(rawResults as Series[], connector as SonarrConnector);
        break;
      case 'radarr':
        mapped = this.mapRadarrResults(rawResults as Movie[], connector as RadarrConnector);
        break;
      case 'jellyseerr':
        mapped = this.mapJellyseerrResults(rawResults as JellyseerrSearchResult[], connector as JellyseerrConnector);
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

  private mapSonarrResults(seriesList: Series[], connector: SonarrConnector): UnifiedSearchResult[] {
    return seriesList.map((series) => ({
      id: `${connector.config.id}:sonarr:${series.tvdbId ?? series.tmdbId ?? series.id}`,
      title: series.title,
      overview: series.overview,
      releaseDate: series.added,
      year: series.year,
      posterUrl: series.posterUrl,
      backdropUrl: series.backdropUrl,
      popularity: series.statistics?.percentOfEpisodes,
      mediaType: 'series',
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

  private mapRadarrResults(movies: Movie[], connector: RadarrConnector): UnifiedSearchResult[] {
    return movies.map((movie) => ({
      id: `${connector.config.id}:radarr:${movie.tmdbId ?? movie.imdbId ?? movie.id}`,
      title: movie.title,
      overview: movie.overview,
      releaseDate: movie.releaseDate ?? movie.inCinemas ?? movie.digitalRelease,
      year: movie.year,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      rating: movie.ratings?.value,
      popularity: movie.statistics?.percentAvailable,
      mediaType: 'movie',
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
    return results.map((result) => ({
      id: `${connector.config.id}:jellyseerr:${result.tmdbId ?? result.id}`,
      title: result.title,
      overview: result.overview,
      releaseDate: result.mediaType === 'movie' ? result.releaseDate : result.firstAirDate,
      posterUrl: result.posterUrl,
      backdropUrl: result.backdropUrl,
      rating: result.rating,
      popularity: result.popularity,
      mediaType: result.mediaType === 'tv' ? 'series' : 'movie',
      serviceType: connector.config.type,
      serviceId: connector.config.id,
      serviceName: connector.config.name,
      isRequested: result.isRequested,
      externalIds: {
        tmdbId: result.tmdbId ?? result.id,
        tvdbId: result.tvdbId,
        imdbId: result.imdbId,
        serviceNativeId: result.id,
      },
      extra: {
        mediaStatus: result.mediaStatus,
      },
    }));
  }

  private deduplicateAndSort(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
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

    return parts.join('::');
  }

  private parseDate(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Search timeout'));
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
