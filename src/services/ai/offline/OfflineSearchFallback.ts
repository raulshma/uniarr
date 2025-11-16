import type { SearchInterpretation } from "@/utils/validation/searchSchemas";
import { logger } from "@/services/logger/LoggerService";

/**
 * Offline search fallback service using rule-based interpretation
 * When AI APIs are unavailable, this service provides degraded but functional search
 */
export class OfflineSearchFallback {
  private static instance: OfflineSearchFallback | null = null;

  // Cache recent interpretations for offline use
  private cache: Map<string, SearchInterpretation> = new Map();

  // Track offline status
  private isOffline = false;

  static getInstance(): OfflineSearchFallback {
    if (!OfflineSearchFallback.instance) {
      OfflineSearchFallback.instance = new OfflineSearchFallback();
    }
    return OfflineSearchFallback.instance;
  }

  /**
   * Set offline status
   */
  setOffline(offline: boolean): void {
    this.isOffline = offline;
    if (offline) {
      logger.info("AI service offline - using fallback interpretation", {
        cacheSize: this.cache.size,
      });
    } else {
      logger.info("AI service online - resuming normal operation");
    }
  }

  /**
   * Interpret query offline using rule-based approach
   */
  async interpretQueryOffline(query: string): Promise<SearchInterpretation> {
    // Check cache for exact/similar queries
    const cached = this.findCachedInterpretation(query);
    if (cached) {
      logger.debug("Using cached offline interpretation", {
        query,
        cacheMatch: true,
      });
      return {
        ...cached,
        searchWarnings: [
          ...(cached.searchWarnings || []),
          "Using cached interpretation (offline mode)",
        ],
      };
    }

    // Apply regex-based pattern matching
    const interpretation = this.applyRuleBasedInterpretation(query);
    logger.debug("Generated offline interpretation", {
      query,
      confidence: interpretation.confidence,
    });

    return interpretation;
  }

  /**
   * Rule-based interpretation for offline use
   */
  private applyRuleBasedInterpretation(query: string): SearchInterpretation {
    const lowerQuery = query.toLowerCase();

    // Media type patterns
    const mediaTypePatterns: {
      regex: RegExp;
      type: "anime" | "series" | "movie";
    }[] = [
      { regex: /\b(anime|manga|webtoon)\b/i, type: "anime" },
      { regex: /\b(movie|film|flick)\b/i, type: "movie" },
      { regex: /\b(series|show|tv|television|sitcom)\b/i, type: "series" },
    ];

    // Genre patterns
    const genrePatterns: { regex: RegExp; genre: string }[] = [
      { regex: /\baction\b/i, genre: "action" },
      { regex: /\bromance\b/i, genre: "romance" },
      { regex: /\bdrama\b/i, genre: "drama" },
      { regex: /\b(comedy|funny|humorous)\b/i, genre: "comedy" },
      { regex: /\b(horror|scary|spooky)\b/i, genre: "horror" },
      { regex: /\bthriller\b/i, genre: "thriller" },
      { regex: /\bscience fiction|sci-?fi\b/i, genre: "sci-fi" },
      { regex: /\bfantasy\b/i, genre: "fantasy" },
      { regex: /\badventure\b/i, genre: "adventure" },
      { regex: /\bmystery\b/i, genre: "mystery" },
    ];

    // Detect media types
    const mediaTypes = mediaTypePatterns
      .filter((p) => p.regex.test(lowerQuery))
      .map((p) => p.type) as ("anime" | "series" | "movie")[];

    // Detect genres
    const genres = genrePatterns
      .filter((p) => p.regex.test(lowerQuery))
      .map((p) => p.genre);

    // Extract year range
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    const yearRange = yearMatch
      ? { start: parseInt(yearMatch[0], 10), end: parseInt(yearMatch[0], 10) }
      : undefined;

    // Detect quality preferences
    let qualityPreference: string | undefined;
    if (/\b4k|uhd\b/i.test(lowerQuery)) {
      qualityPreference = "4k";
    } else if (/\b1080p?|full hd|fhd\b/i.test(lowerQuery)) {
      qualityPreference = "1080p";
    } else if (/\b720p?|hd\b/i.test(lowerQuery)) {
      qualityPreference = "720p";
    }

    // Extract keywords (limit to 5)
    const keywords = query
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 5);

    return {
      mediaTypes: mediaTypes.length > 0 ? mediaTypes : ["series", "movie"],
      genres: Array.from(new Set(genres)),
      keywords,
      yearRange,
      qualityPreference,
      recommendedServices: ["jellyseerr", "sonarr", "radarr"],
      searchWarnings: [
        "Offline mode: Limited interpretation accuracy",
        "Using rule-based pattern matching",
        "Confidence reduced due to offline status",
      ],
      confidence: 0.4, // Lower confidence for offline
    };
  }

  /**
   * Find cached interpretation for a query
   */
  private findCachedInterpretation(query: string): SearchInterpretation | null {
    // Exact match
    if (this.cache.has(query)) {
      return this.cache.get(query) || null;
    }

    // Similarity match (simple threshold-based approach)
    for (const [cached, interpretation] of this.cache) {
      if (this.calculateSimilarity(query, cached) > 0.7) {
        return interpretation;
      }
    }

    return null;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: Record<number, number> = {};

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;

      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1] ?? 0;
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue =
              Math.min(Math.min(newValue, lastValue), costs[j] ?? 0) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }

      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }

    return costs[s2.length] ?? 0;
  }

  /**
   * Cache an interpretation for offline use
   */
  cacheInterpretation(
    query: string,
    interpretation: SearchInterpretation,
  ): void {
    this.cache.set(query, interpretation);

    // Keep cache size reasonable (max 100 entries)
    if (this.cache.size > 100) {
      const firstKey = Array.from(this.cache.keys())[0];
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    logger.debug("Cached search interpretation", {
      query,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug("Offline search cache cleared");
  }

  /**
   * Get cache size and status
   */
  getCacheStatus(): {
    isOffline: boolean;
    cacheSize: number;
    maxCacheSize: number;
  } {
    return {
      isOffline: this.isOffline,
      cacheSize: this.cache.size,
      maxCacheSize: 100,
    };
  }
}
