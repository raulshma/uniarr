/**
 * Builds search context by aggregating data from multiple sources
 * This context is used to enhance AI search interpretations with user preferences
 */

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";
import { UnifiedSearchService } from "./UnifiedSearchService";

export interface UserSearchContext {
  // User preferences and profile
  favoriteGenres: string[];
  dislikedGenres: string[];
  preferredMediaTypes: string[];
  qualityPreference?: string; // '4K', '1080p', '720p', etc.
  languagePreference?: string;
  subtitlePreferences?: {
    preferred?: string[];
    exclude?: string[];
  };

  // Library information
  librarySize: {
    series: number;
    movies: number;
    total: number;
  };

  // Service information
  availableServices: {
    id: string;
    name: string;
    type: string;
    isHealthy: boolean;
  }[];

  // Storage information
  storageInfo?: {
    available: number; // in MB
    used: number; // in MB
    total: number; // in MB
  };

  // User metadata
  timezone?: string;
  language?: string;
  watchHistory?: {
    recentGenres: string[];
    completionRate?: number;
    averageRating?: number;
  };

  // Quality profiles available
  qualityProfiles?: {
    serviceName: string;
    profiles: string[];
  }[];

  // Cache metadata
  builtAt: number;
  expiresAt: number;
}

/**
 * Default context when no user data is available
 */
const DEFAULT_CONTEXT: Omit<UserSearchContext, "builtAt" | "expiresAt"> = {
  favoriteGenres: [],
  dislikedGenres: [],
  preferredMediaTypes: ["series", "movie"],
  availableServices: [],
  librarySize: {
    series: 0,
    movies: 0,
    total: 0,
  },
};

/**
 * Service for building and caching user search context
 */
export class SearchContextBuilder {
  private static instance: SearchContextBuilder;
  private connectorManager = ConnectorManager.getInstance();
  private searchService = UnifiedSearchService.getInstance();

  // Cache with 30-minute TTL
  private contextCache: UserSearchContext | null = null;
  private cacheTTL = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  static getInstance(): SearchContextBuilder {
    if (!SearchContextBuilder.instance) {
      SearchContextBuilder.instance = new SearchContextBuilder();
    }
    return SearchContextBuilder.instance;
  }

  /**
   * Build or retrieve cached user search context
   */
  async buildContext(): Promise<UserSearchContext> {
    try {
      // Return cached context if still valid
      if (this.contextCache && Date.now() < this.contextCache.expiresAt) {
        logger.debug("Using cached search context");
        return this.contextCache;
      }

      const now = Date.now();
      const context: UserSearchContext = {
        ...DEFAULT_CONTEXT,
        builtAt: now,
        expiresAt: now + this.cacheTTL,
        availableServices: await this.buildServiceContext(),
        librarySize: await this.buildLibraryContext(),
      };

      // Cache the result
      this.contextCache = context;

      logger.info("Search context built successfully", {
        servicesCount: context.availableServices.length,
        librarySize: context.librarySize.total,
      });

      return context;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to build search context", { error: errorMessage });

      // Return default context on error
      const now = Date.now();
      return {
        ...DEFAULT_CONTEXT,
        builtAt: now,
        expiresAt: now + this.cacheTTL,
      };
    }
  }

  /**
   * Build service availability context
   */
  private async buildServiceContext() {
    try {
      await this.connectorManager.loadSavedServices();
      const searchableServices =
        await this.searchService.getSearchableServices();

      return searchableServices.map((service) => ({
        id: service.serviceId,
        name: service.serviceName,
        type: service.serviceType,
        isHealthy: true, // Could add health checks here if needed
      }));
    } catch (error) {
      logger.warn("Failed to build service context", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Build library information context
   */
  private async buildLibraryContext() {
    try {
      await this.connectorManager.loadSavedServices();
      const allConnectors = this.connectorManager.getAllConnectors();

      // Count items in each service
      let totalSeries = 0;
      let totalMovies = 0;

      for (const connector of allConnectors) {
        if (connector.config.type === "sonarr" && "getSeries" in connector) {
          try {
            const series = await (connector as any).getSeries?.();
            if (Array.isArray(series)) {
              totalSeries += series.length;
            }
          } catch (
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            e
          ) {
            // Continue on individual connector errors
          }
        }

        if (connector.config.type === "radarr" && "getMovies" in connector) {
          try {
            const movies = await (connector as any).getMovies?.();
            if (Array.isArray(movies)) {
              totalMovies += movies.length;
            }
          } catch (
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            e
          ) {
            // Continue on individual connector errors
          }
        }
      }

      return {
        series: totalSeries,
        movies: totalMovies,
        total: totalSeries + totalMovies,
      };
    } catch (error) {
      logger.warn("Failed to build library context", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        series: 0,
        movies: 0,
        total: 0,
      };
    }
  }

  /**
   * Clear the cached context to force a rebuild
   */
  clearCache(): void {
    this.contextCache = null;
    logger.debug("Search context cache cleared");
  }

  /**
   * Get cache expiration time
   */
  getCacheTTL(): number {
    return this.cacheTTL;
  }

  /**
   * Set cache expiration time (in milliseconds)
   */
  setCacheTTL(ttl: number): void {
    if (ttl > 0) {
      this.cacheTTL = ttl;
    }
  }
}
