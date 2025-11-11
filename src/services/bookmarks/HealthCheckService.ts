import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/services/logger/LoggerService";
import type {
  Bookmark,
  HealthCheckConfig,
  BookmarkHealth,
} from "@/components/widgets/BookmarksWidget/BookmarksWidget.types";

class HealthCheckService {
  private static instance: HealthCheckService | null = null;
  private readonly STORAGE_KEY = "BookmarkHealthCheck:health";
  private healthCache: Map<string, BookmarkHealth> = new Map();
  private activeChecks: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadHealthCache();
      this.isInitialized = true;
      logger.debug("[HealthCheckService] Initialized");
    } catch (error) {
      logger.error("[HealthCheckService] Failed to initialize", { error });
    }
  }

  private async loadHealthCache(): Promise<void> {
    try {
      const serialized = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (serialized) {
        const health = JSON.parse(serialized) as BookmarkHealth[];
        this.healthCache.clear();
        health.forEach((h) => this.healthCache.set(h.bookmarkId, h));
      }
    } catch (error) {
      logger.error("[HealthCheckService] Failed to load health cache", {
        error,
      });
      this.healthCache.clear();
    }
  }

  private async saveHealthCache(): Promise<void> {
    try {
      const health = Array.from(this.healthCache.values());
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(health));
    } catch (error) {
      logger.error("[HealthCheckService] Failed to save health cache", {
        error,
      });
    }
  }

  /**
   * Check the health of a bookmark by making a HEAD or GET request
   */
  async checkBookmarkHealth(
    bookmark: Bookmark,
    config: HealthCheckConfig,
  ): Promise<BookmarkHealth> {
    await this.ensureInitialized();

    const health: BookmarkHealth = {
      bookmarkId: bookmark.id,
      status: "loading",
      lastChecked: Date.now(),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        // Try HEAD request first (lighter weight)
        let response = await fetch(bookmark.url, {
          method: "HEAD",
          signal: controller.signal,
        });

        // Some servers don't support HEAD, try GET
        if (
          response.status === 405 ||
          response.status === 404 ||
          response.status === 403
        ) {
          response = await fetch(bookmark.url, {
            method: "GET",
            signal: controller.signal,
          });
        }

        clearTimeout(timeoutId);

        health.statusCode = response.status;
        health.status = config.healthyCodes.includes(response.status)
          ? "healthy"
          : "unhealthy";

        if (!config.healthyCodes.includes(response.status)) {
          health.errorMessage = `HTTP ${response.status}`;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      health.status = "unhealthy";
      health.errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.debug(
        `[HealthCheckService] Health check failed for ${bookmark.label}`,
        {
          error,
        },
      );
    }

    // Cache the result
    this.healthCache.set(bookmark.id, health);
    await this.saveHealthCache();

    return health;
  }

  /**
   * Get cached health status for a bookmark
   */
  getBookmarkHealth(bookmarkId: string): BookmarkHealth | undefined {
    return this.healthCache.get(bookmarkId);
  }

  /**
   * Start periodic health checks for a bookmark
   */
  startHealthCheck(
    bookmark: Bookmark,
    config: HealthCheckConfig,
    onHealthChange?: (health: BookmarkHealth) => void,
  ): void {
    if (!config.enabled) return;

    // Clear existing check if any
    this.stopHealthCheck(bookmark.id);

    // Perform initial check
    this.checkBookmarkHealth(bookmark, config)
      .then((health) => onHealthChange?.(health))
      .catch((error) =>
        logger.error("[HealthCheckService] Initial health check failed", {
          error,
        }),
      );

    // Set up recurring checks
    const intervalId = setInterval(() => {
      this.checkBookmarkHealth(bookmark, config)
        .then((health) => onHealthChange?.(health))
        .catch((error) =>
          logger.error("[HealthCheckService] Recurring health check failed", {
            error,
          }),
        );
    }, config.interval * 1000);

    this.activeChecks.set(bookmark.id, intervalId);
  }

  /**
   * Stop periodic health checks for a bookmark
   */
  stopHealthCheck(bookmarkId: string): void {
    const intervalId = this.activeChecks.get(bookmarkId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeChecks.delete(bookmarkId);
    }
  }

  /**
   * Stop all health checks
   */
  stopAllHealthChecks(): void {
    this.activeChecks.forEach((intervalId) => clearInterval(intervalId));
    this.activeChecks.clear();
  }

  /**
   * Clear health cache for a bookmark
   */
  clearBookmarkHealth(bookmarkId: string): void {
    this.healthCache.delete(bookmarkId);
  }

  /**
   * Clear all health cache
   */
  clearAllHealth(): void {
    this.healthCache.clear();
  }

  /**
   * Cleanup all active health checks (call on service shutdown)
   */
  destroy(): void {
    this.stopAllHealthChecks();
    this.healthCache.clear();
    this.isInitialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

export const healthCheckService = HealthCheckService.getInstance();
export { HealthCheckService };
