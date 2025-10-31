/**
 * Skeleton loading timing presets for different data complexity scenarios.
 * Used with useSkeletonLoading hook to prevent UI flashing and ensure
 * smooth transitions between skeleton and content states.
 */

/**
 * High complexity: External APIs with rich data (ratings, cast, multiple sections)
 * Examples: Jellyseerr media details, Anime Hub MAL details
 * Min load time: 900ms to account for network latency and API response times
 */
export const highComplexity = {
  minLoadingTime: 900,
};

/**
 * Medium complexity: TMDB-based queries with moderate data volume
 * Examples: Discover detail pages with related items, recommendations
 * Min load time: 700ms for typical TMDB response times
 */
export const mediumComplexity = {
  minLoadingTime: 700,
};

/**
 * Low complexity: Local service queries with fast response times
 * Examples: Radarr movie details, Sonarr series details
 * Min load time: 500ms for sub-second local service responses
 */
export const lowComplexity = {
  minLoadingTime: 500,
};

/**
 * Centralized skeleton timing configuration
 * Import specific presets based on page complexity
 */
export const skeletonTiming = {
  highComplexity,
  mediumComplexity,
  lowComplexity,
};
