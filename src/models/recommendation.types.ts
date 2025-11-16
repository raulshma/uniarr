import type { FeedbackPattern } from "./recommendation.schemas";

// Re-export FeedbackPattern for convenience
export type { FeedbackPattern };

/**
 * Represents a single item from the user's watch history
 */
export interface WatchHistoryItem {
  /** Title of the watched content */
  title: string;
  /** Release year */
  year: number;
  /** Type of media */
  type: "series" | "movie" | "anime";
  /** User's rating (0-10 scale), if provided */
  rating?: number;
  /** List of genres */
  genres: string[];
  /** Completion status of the content */
  completionStatus: "completed" | "in-progress" | "dropped";
  /** When the user watched this content */
  watchDate: Date;
}

/**
 * Statistical analysis of the user's media library
 */
export interface LibraryStatistics {
  /** Total number of items in the library */
  totalItems: number;
  /** Distribution of genres across the library */
  genreDistribution: Record<string, number>;
  /** Average rating across all rated content */
  averageRating: number;
  /** Preferred quality profile (e.g., "1080p", "4K") */
  qualityPreference: string;
  /** Storage space used in bytes */
  storageUsed: number;
  /** Available storage space in bytes */
  storageAvailable: number;
}

/**
 * User preferences for content recommendations
 */
export interface UserPreferences {
  /** Genres the user enjoys */
  favoriteGenres: string[];
  /** Genres the user wants to avoid */
  dislikedGenres: string[];
  /** Preferred content length */
  preferredContentLength: "short" | "medium" | "long";
  /** Preferred language for content */
  languagePreference: string;
  /** Maximum content rating (e.g., "PG-13", "R") */
  contentRatingLimit?: string;
}

/**
 * Complete user context for generating recommendations
 */
export interface UserContext {
  /** User's watch history */
  watchHistory: WatchHistoryItem[];
  /** Statistical analysis of user's library */
  libraryStats: LibraryStatistics;
  /** User's explicit preferences */
  preferences: UserPreferences;
  /** Learned patterns from user feedback */
  feedbackPatterns: FeedbackPattern[];
}

/**
 * Request parameters for generating recommendations
 */
export interface RecommendationRequest {
  /** User ID requesting recommendations */
  userId: string;
  /** Number of recommendations to generate (default 5, max 10) */
  limit?: number;
  /** Whether to include hidden gem recommendations */
  includeHiddenGems?: boolean;
  /** Force refresh, bypassing cache */
  forceRefresh?: boolean;
}

/**
 * Response containing generated recommendations
 */
export interface RecommendationResponseData {
  /** List of recommendations */
  recommendations: {
    id: string;
    title: string;
    type: "series" | "movie" | "anime";
    year?: number;
    matchScore: number;
    reasonsForMatch: string[];
    whereToWatch: string;
    similarToWatched: string[];
    metadata: {
      genres: string[];
      rating: number;
      popularity: number;
      posterUrl?: string;
      overview?: string;
    };
    availability?: {
      inLibrary: boolean;
      inQueue: boolean;
      availableServices: ("sonarr" | "radarr" | "jellyseerr")[];
    };
    isHiddenGem: boolean;
  }[];
  /** When these recommendations were generated */
  generatedAt: Date;
  /** Age of cached data in milliseconds (if from cache) */
  cacheAge?: number;
  /** Context used to generate recommendations */
  context: {
    /** Number of watch history items analyzed */
    watchHistoryCount: number;
    /** User's favorite genres */
    favoriteGenres: string[];
    /** Version of the analysis algorithm */
    analysisVersion: string;
  };
  /** Whether the response was served in offline mode */
  isOffline?: boolean;
}

/**
 * Cache entry for storing recommendations
 */
export interface CacheEntry {
  /** User ID */
  userId: string;
  /** Cached recommendations */
  recommendations: RecommendationResponseData["recommendations"];
  /** When the cache was created */
  generatedAt: Date;
  /** Hash of the context used to generate these recommendations */
  contextHash: string;
  /** Version of the recommendation system */
  version: string;
}

/**
 * Learning weights for recommendation scoring
 */
export interface LearningWeights {
  /** Weight for genre matching (0-100) */
  genreWeight: number;
  /** Weight for rating similarity (0-100) */
  ratingWeight: number;
  /** Weight for popularity (0-100) */
  popularityWeight: number;
  /** Weight for theme similarity (0-100) */
  themeWeight: number;
  /** Weight for content freshness (0-100) */
  freshnessWeight: number;
}
