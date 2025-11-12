import { useCallback, useEffect, useState } from "react";
import {
  SearchHistoryService,
  AISearchHistoryEntry,
  SearchHistoryStats,
} from "@/services/search/SearchHistoryService";
import { logger } from "@/services/logger/LoggerService";

interface UseSearchHistoryReturn {
  history: AISearchHistoryEntry[];
  stats: SearchHistoryStats | null;
  addToHistory: (query: string, metadata: any) => Promise<AISearchHistoryEntry>;
  clearHistory: () => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  searchHistory: (query: string) => Promise<AISearchHistoryEntry[]>;
  getPagedHistory: (
    page: number,
    pageSize?: number,
  ) => Promise<{
    entries: AISearchHistoryEntry[];
    totalCount: number;
    hasMore: boolean;
  }>;
  exportHistory: () => Promise<string>;
  setPrivacyMode: (enabled: boolean) => void;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing search history
 */
export function useSearchHistory(): UseSearchHistoryReturn {
  const historyService = SearchHistoryService.getInstance();

  const [history, setHistory] = useState<AISearchHistoryEntry[]>([]);
  const [stats, setStats] = useState<SearchHistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load search history
   */
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const entries = await historyService.getHistory();
      setHistory(entries);

      const stats = await historyService.getStatistics();
      setStats(stats);

      logger.debug("Search history loaded", {
        count: entries.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = new Error(errorMessage);
      setError(error);
      logger.error("Failed to load search history", { error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [historyService]);

  /**
   * Add search to history
   */
  const addToHistory = useCallback(
    async (query: string, metadata: any): Promise<AISearchHistoryEntry> => {
      try {
        const entry = await historyService.addSearch({
          query,
          ...metadata,
        });

        // Reload history
        await loadHistory();

        logger.debug("Search added to history", {
          query,
          id: entry.id,
        });

        return entry;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("Failed to add search to history", {
          error: errorMessage,
        });
        throw err;
      }
    },
    [historyService, loadHistory],
  );

  /**
   * Remove history entry
   */
  const removeItem = useCallback(
    async (id: string): Promise<void> => {
      try {
        await historyService.removeEntry(id);

        // Reload history
        await loadHistory();

        logger.debug("History entry removed", { id });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("Failed to remove history entry", { error: errorMessage });
        throw err;
      }
    },
    [historyService, loadHistory],
  );

  /**
   * Clear all history
   */
  const clearHistoryCallback = useCallback(async (): Promise<void> => {
    try {
      await historyService.clearHistory();

      // Reload history
      await loadHistory();

      logger.debug("Search history cleared");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("Failed to clear history", { error: errorMessage });
      throw err;
    }
  }, [historyService, loadHistory]);

  /**
   * Search history by query
   */
  const searchHistoryCallback = useCallback(
    async (query: string): Promise<AISearchHistoryEntry[]> => {
      try {
        const results = await historyService.searchHistory(query);
        logger.debug("History search completed", {
          query,
          resultsCount: results.length,
        });
        return results;
      } catch (err) {
        logger.error("Failed to search history", {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },
    [historyService],
  );

  /**
   * Get paginated history
   */
  const getPagedHistory = useCallback(
    async (page: number, pageSize: number = 20) => {
      try {
        const result = await historyService.getHistoryPaginated(page, pageSize);
        logger.debug("Paginated history retrieved", {
          page,
          pageSize,
          totalCount: result.totalCount,
        });
        return result;
      } catch (err) {
        logger.error("Failed to get paginated history", {
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          entries: [],
          totalCount: 0,
          hasMore: false,
        };
      }
    },
    [historyService],
  );

  /**
   * Export history as JSON
   */
  const exportHistory = useCallback(async (): Promise<string> => {
    try {
      const json = await historyService.exportHistory();
      logger.debug("History exported");
      return json;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("Failed to export history", { error: errorMessage });
      throw err;
    }
  }, [historyService]);

  /**
   * Set privacy mode
   */
  const setPrivacyMode = useCallback(
    (enabled: boolean) => {
      historyService.setPrivacyMode(enabled);
      logger.debug("Privacy mode set", { enabled });
    },
    [historyService],
  );

  /**
   * Load history on mount
   */
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    history,
    stats,
    addToHistory,
    clearHistory: clearHistoryCallback,
    removeItem,
    searchHistory: searchHistoryCallback,
    getPagedHistory,
    exportHistory,
    setPrivacyMode,
    isLoading,
    error,
  };
}
