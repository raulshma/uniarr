/**
 * Search History Service
 * Manages AI search history with privacy and analytics
 */

import { storageAdapter } from "@/services/storage/StorageAdapter";
import { logger } from "@/services/logger/LoggerService";

export interface AISearchHistoryEntry {
  id: string;
  query: string;
  timestamp: number;

  // Interpretation results
  mediaTypes?: string[];
  genres?: string[];
  confidence?: number;

  // Results metadata
  resultsCount?: number;
  resultServices?: string[];
  resultMediaTypes?: string[];

  // User interaction
  userSelected?: boolean;
  selectedResultId?: string;
  durationMs?: number;

  // Optional notes
  notes?: string;
}

export interface SearchHistoryStats {
  totalSearches: number;
  uniqueQueries: number;
  averageConfidence: number;
  successRate: number; // percentage of searches that returned results
  mostSearchedGenres: { genre: string; count: number }[];
  averageSearchDuration: number; // in milliseconds
}

const HISTORY_STORAGE_KEY = "ai_search_history";
const STATS_STORAGE_KEY = "ai_search_stats";
const HISTORY_LIMIT = 100; // Keep last 100 searches

/**
 * Service for managing AI search history with privacy controls
 */
export class SearchHistoryService {
  private static instance: SearchHistoryService;
  private history: AISearchHistoryEntry[] = [];
  private historyLoaded = false;
  private privacyEnabled = true; // Users can disable history

  private constructor() {}

  static getInstance(): SearchHistoryService {
    if (!SearchHistoryService.instance) {
      SearchHistoryService.instance = new SearchHistoryService();
    }
    return SearchHistoryService.instance;
  }

  /**
   * Add a search to history
   */
  async addSearch(
    entry: Omit<AISearchHistoryEntry, "id" | "timestamp">,
  ): Promise<AISearchHistoryEntry> {
    try {
      await this.ensureHistoryLoaded();

      if (!this.privacyEnabled) {
        logger.debug("History tracking disabled - search not recorded");
        return { ...entry, id: "", timestamp: Date.now() };
      }

      const fullEntry: AISearchHistoryEntry = {
        ...entry,
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };

      // Add to front of history
      this.history.unshift(fullEntry);

      // Maintain size limit
      if (this.history.length > HISTORY_LIMIT) {
        this.history = this.history.slice(0, HISTORY_LIMIT);
      }

      await this.persistHistory();

      logger.debug("Search added to history", {
        query: entry.query,
        id: fullEntry.id,
      });

      return fullEntry;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to add search to history", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get all search history
   */
  async getHistory(): Promise<AISearchHistoryEntry[]> {
    try {
      await this.ensureHistoryLoaded();

      if (!this.privacyEnabled) {
        return [];
      }

      return [...this.history]; // Return copy to prevent mutations
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to get search history", { error: errorMessage });
      return [];
    }
  }

  /**
   * Get paginated history
   */
  async getHistoryPaginated(
    page: number = 0,
    pageSize: number = 20,
  ): Promise<{
    entries: AISearchHistoryEntry[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      await this.ensureHistoryLoaded();

      if (!this.privacyEnabled) {
        return { entries: [], totalCount: 0, hasMore: false };
      }

      const totalCount = this.history.length;
      const start = page * pageSize;
      const end = start + pageSize;
      const entries = this.history.slice(start, end);
      const hasMore = end < totalCount;

      return { entries, totalCount, hasMore };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to get paginated history", { error: errorMessage });
      return { entries: [], totalCount: 0, hasMore: false };
    }
  }

  /**
   * Search history by query
   */
  async searchHistory(query: string): Promise<AISearchHistoryEntry[]> {
    try {
      await this.ensureHistoryLoaded();

      if (!this.privacyEnabled) {
        return [];
      }

      const lowerQuery = query.toLowerCase();
      return this.history.filter((entry) =>
        entry.query.toLowerCase().includes(lowerQuery),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to search history", { error: errorMessage });
      return [];
    }
  }

  /**
   * Remove a specific history entry
   */
  async removeEntry(id: string): Promise<void> {
    try {
      await this.ensureHistoryLoaded();

      const initialLength = this.history.length;
      this.history = this.history.filter((entry) => entry.id !== id);

      if (this.history.length < initialLength) {
        await this.persistHistory();
        logger.debug("History entry removed", { id });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to remove history entry", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    try {
      await this.ensureHistoryLoaded();

      this.history = [];
      await storageAdapter.removeItem(HISTORY_STORAGE_KEY);

      logger.info("Search history cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to clear history", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get search statistics
   */
  async getStatistics(): Promise<SearchHistoryStats> {
    try {
      await this.ensureHistoryLoaded();

      const totalSearches = this.history.length;
      const uniqueQueries = new Set(this.history.map((e) => e.query)).size;

      const withResults = this.history.filter((e) => (e.resultsCount ?? 0) > 0);
      const successRate =
        totalSearches > 0 ? (withResults.length / totalSearches) * 100 : 0;

      const confidences = this.history
        .filter((e) => e.confidence !== undefined)
        .map((e) => e.confidence as number);
      const averageConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

      // Calculate average duration
      const durations = this.history
        .filter((e) => e.durationMs !== undefined)
        .map((e) => e.durationMs as number);
      const averageSearchDuration =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

      // Find most searched genres
      const genreMap = new Map<string, number>();
      for (const entry of this.history) {
        if (entry.genres) {
          for (const genre of entry.genres) {
            genreMap.set(genre, (genreMap.get(genre) ?? 0) + 1);
          }
        }
      }

      const mostSearchedGenres = Array.from(genreMap.entries())
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalSearches,
        uniqueQueries,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        mostSearchedGenres,
        averageSearchDuration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to calculate statistics", { error: errorMessage });

      return {
        totalSearches: 0,
        uniqueQueries: 0,
        averageConfidence: 0,
        successRate: 0,
        mostSearchedGenres: [],
        averageSearchDuration: 0,
      };
    }
  }

  /**
   * Export history as JSON
   */
  async exportHistory(): Promise<string> {
    try {
      await this.ensureHistoryLoaded();

      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          entries: this.history,
        },
        null,
        2,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to export history", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Set privacy mode (enable/disable history tracking)
   */
  setPrivacyMode(enabled: boolean): void {
    this.privacyEnabled = enabled;
    logger.info("History privacy mode", { enabled });
  }

  /**
   * Check if history tracking is enabled
   */
  isPrivacyEnabled(): boolean {
    return this.privacyEnabled;
  }

  /**
   * Private: Ensure history is loaded
   */
  private async ensureHistoryLoaded(): Promise<void> {
    if (this.historyLoaded) {
      return;
    }

    try {
      const raw = await storageAdapter.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        this.history = [];
      } else {
        const parsed = JSON.parse(raw) as AISearchHistoryEntry[];
        this.history = Array.isArray(parsed)
          ? parsed.filter(
              (entry) =>
                typeof entry.query === "string" &&
                entry.query.trim().length > 0,
            )
          : [];
      }
    } catch (error) {
      this.history = [];
      logger.error("Failed to load search history", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.historyLoaded = true;
    }
  }

  /**
   * Private: Persist history to storage
   */
  private async persistHistory(): Promise<void> {
    try {
      await storageAdapter.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(this.history),
      );
    } catch (error) {
      logger.error("Failed to persist search history", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
