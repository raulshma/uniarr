/**
 * Utility functions for Jellyfin integration
 */

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type { JellyfinItem } from "@/models/jellyfin.types";
import { logger } from "@/services/logger/LoggerService";

export interface ExternalIds {
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;
}

export interface FindJellyfinItemOptions extends ExternalIds {
  /** Episode number for series episodes */
  episodeNumber?: number;
  /** Season number for series episodes */
  seasonNumber?: number;
  /** Item type to filter by */
  type?: "Movie" | "Series" | "Episode";
}

/**
 * Find a Jellyfin item by external IDs (TMDB, TVDB, IMDB)
 * @param jellyfinServiceId The Jellyfin service ID
 * @param options Search options including external IDs
 * @returns The matching Jellyfin item or null if not found
 */
export async function findJellyfinItemByExternalIds(
  jellyfinServiceId: string,
  options: FindJellyfinItemOptions,
): Promise<JellyfinItem | null> {
  try {
    const connector = ConnectorManager.getInstance().getConnector(
      jellyfinServiceId,
    ) as JellyfinConnector;

    if (!connector) {
      void logger.warn("Jellyfin connector not found", { jellyfinServiceId });
      return null;
    }

    // Ensure connector is initialized and authenticated
    await connector.initialize();

    // For episodes, we need to find the series first, then get the specific episode
    if (
      options.type === "Episode" &&
      options.episodeNumber !== undefined &&
      options.seasonNumber !== undefined
    ) {
      // First, find the series
      const seriesItem = await findSeriesByExternalIds(connector, options);
      if (!seriesItem?.Id) {
        void logger.warn("Series not found in Jellyfin for episode lookup", {
          tmdbId: options.tmdbId,
          tvdbId: options.tvdbId,
          imdbId: options.imdbId,
        });
        return null;
      }

      // Now get the episodes for this series
      const episodes = await getSeriesEpisodes(
        connector,
        seriesItem.Id,
        options.seasonNumber,
      );

      // Find the specific episode
      const episode = episodes.find(
        (ep) => ep.IndexNumber === options.episodeNumber,
      );

      if (episode) {
        void logger.debug("Found episode in Jellyfin", {
          episodeId: episode.Id,
          seasonNumber: options.seasonNumber,
          episodeNumber: options.episodeNumber,
        });
        return episode;
      }

      void logger.warn("Episode not found in Jellyfin", {
        seriesId: seriesItem.Id,
        seasonNumber: options.seasonNumber,
        episodeNumber: options.episodeNumber,
        availableEpisodes: episodes.length,
      });
      return null;
    }

    // For movies and series, search directly
    const searchResults = await searchByExternalIds(connector, options);
    if (searchResults.length > 0) {
      return findBestMatch(searchResults, options);
    }

    // If search didn't work, try scanning libraries for matching provider IDs
    if (options.type === "Movie") {
      const movie = await findMovieByProviderIds(connector, options);
      if (movie) return movie;
    } else if (options.type === "Series") {
      const series = await findSeriesByExternalIds(connector, options);
      if (series) return series;
    }

    void logger.warn("No Jellyfin item found for external IDs", {
      tmdbId: options.tmdbId,
      tvdbId: options.tvdbId,
      imdbId: options.imdbId,
      type: options.type,
    });
    return null;
  } catch (error) {
    void logger.error("Error finding Jellyfin item by external IDs", {
      error,
      tmdbId: options.tmdbId,
      tvdbId: options.tvdbId,
      imdbId: options.imdbId,
      type: options.type,
    });
    return null;
  }
}

/**
 * Search for a series by external IDs
 */
async function findSeriesByExternalIds(
  connector: JellyfinConnector,
  options: ExternalIds,
): Promise<JellyfinItem | null> {
  // First try the search API
  const searchResults = await searchByExternalIds(connector, {
    ...options,
    type: "Series",
  });

  if (searchResults.length > 0) {
    // Prefer Series type
    const series = searchResults.find((item) => item.Type === "Series");
    if (series) return series;
  }

  // If search didn't work, try scanning all libraries for matching provider IDs
  try {
    const libraries = await connector.getLibraries();

    for (const library of libraries) {
      if (!library.Id) continue;

      try {
        const items = await connector.getLibraryItems(library.Id, {
          includeItemTypes: ["Series"],
          includeFullDetails: true,
        });

        // Find series with matching provider IDs
        for (const item of items) {
          if (item.Type !== "Series" || !item.ProviderIds) continue;

          // Check if any provider ID matches
          if (
            (options.tmdbId &&
              item.ProviderIds.Tmdb === String(options.tmdbId)) ||
            (options.tvdbId &&
              item.ProviderIds.Tvdb === String(options.tvdbId)) ||
            (options.imdbId && item.ProviderIds.Imdb === options.imdbId)
          ) {
            void logger.debug("Found series by provider ID match", {
              seriesId: item.Id,
              seriesName: item.Name,
              providerIds: item.ProviderIds,
            });
            return item;
          }
        }
      } catch (error) {
        void logger.debug("Error searching library for series", {
          libraryId: library.Id,
          error,
        });
      }
    }
  } catch (error) {
    void logger.error("Error scanning libraries for series", { error });
  }

  return null;
}

/**
 * Search for a movie by provider IDs
 */
async function findMovieByProviderIds(
  connector: JellyfinConnector,
  options: ExternalIds,
): Promise<JellyfinItem | null> {
  try {
    const libraries = await connector.getLibraries();

    for (const library of libraries) {
      if (!library.Id) continue;

      try {
        const items = await connector.getLibraryItems(library.Id, {
          includeItemTypes: ["Movie"],
          includeFullDetails: true,
        });

        // Find movie with matching provider IDs
        for (const item of items) {
          if (item.Type !== "Movie" || !item.ProviderIds) continue;

          // Check if any provider ID matches
          if (
            (options.tmdbId &&
              item.ProviderIds.Tmdb === String(options.tmdbId)) ||
            (options.imdbId && item.ProviderIds.Imdb === options.imdbId)
          ) {
            void logger.debug("Found movie by provider ID match", {
              movieId: item.Id,
              movieName: item.Name,
              providerIds: item.ProviderIds,
            });
            return item;
          }
        }
      } catch (error) {
        void logger.debug("Error searching library for movie", {
          libraryId: library.Id,
          error,
        });
      }
    }
  } catch (error) {
    void logger.error("Error scanning libraries for movie", { error });
  }

  return null;
}

/**
 * Get episodes for a series, optionally filtered by season
 */
async function getSeriesEpisodes(
  connector: JellyfinConnector,
  seriesId: string,
  seasonNumber?: number,
): Promise<JellyfinItem[]> {
  try {
    // Get all libraries
    const libraries = await connector.getLibraries();

    // Search in all libraries for episodes of this series
    const allEpisodes: JellyfinItem[] = [];

    for (const library of libraries) {
      if (!library.Id) continue;

      try {
        const items = await connector.getLibraryItems(library.Id, {
          includeItemTypes: ["Episode"],
          includeFullDetails: true,
        });

        // Filter episodes that belong to this series
        const seriesEpisodes = items.filter(
          (item) =>
            item.Type === "Episode" &&
            item.SeriesId === seriesId &&
            (seasonNumber === undefined ||
              item.ParentIndexNumber === seasonNumber),
        );

        allEpisodes.push(...seriesEpisodes);
      } catch (error) {
        void logger.debug("Error getting episodes from library", {
          libraryId: library.Id,
          error,
        });
      }
    }

    return allEpisodes;
  } catch (error) {
    void logger.error("Error getting series episodes", { seriesId, error });
    return [];
  }
}

/**
 * Search by external IDs using various methods
 */
async function searchByExternalIds(
  connector: JellyfinConnector,
  options: FindJellyfinItemOptions,
): Promise<JellyfinItem[]> {
  // Try searching by IMDB ID first (most reliable)
  if (options.imdbId) {
    const results = await connector.search(`imdb:${options.imdbId}`, {
      filters: options.type
        ? ({ includeItemTypes: [options.type] } as Record<string, unknown>)
        : {},
    });
    if (results.length > 0) {
      return results;
    }
  }

  // Try TMDB ID
  if (options.tmdbId) {
    const results = await connector.search(`tmdb:${options.tmdbId}`, {
      filters: options.type
        ? ({ includeItemTypes: [options.type] } as Record<string, unknown>)
        : {},
    });
    if (results.length > 0) {
      return results;
    }
  }

  // Try TVDB ID
  if (options.tvdbId) {
    const results = await connector.search(`tvdb:${options.tvdbId}`, {
      filters: options.type
        ? ({ includeItemTypes: [options.type] } as Record<string, unknown>)
        : {},
    });
    if (results.length > 0) {
      return results;
    }
  }

  return [];
}

/**
 * Find the best matching item from search results
 */
function findBestMatch(
  items: JellyfinItem[],
  options: FindJellyfinItemOptions,
): JellyfinItem | null {
  if (items.length === 0) return null;

  // If looking for a specific episode, filter by type and episode/season numbers
  if (
    options.type === "Episode" &&
    options.episodeNumber !== undefined &&
    options.seasonNumber !== undefined
  ) {
    const episode = items.find(
      (item) =>
        item.Type === "Episode" &&
        item.IndexNumber === options.episodeNumber &&
        item.ParentIndexNumber === options.seasonNumber,
    );
    if (episode) return episode;
  }

  // If looking for a series, prefer Series type
  if (options.type === "Series") {
    const series = items.find((item) => item.Type === "Series");
    if (series) return series;
  }

  // If looking for a movie, prefer Movie type
  if (options.type === "Movie") {
    const movie = items.find((item) => item.Type === "Movie");
    if (movie) return movie;
  }

  // Return first result as fallback
  return items[0] ?? null;
}

/**
 * Get the first configured Jellyfin service ID
 * @returns The first Jellyfin service ID or null if none configured
 */
export function getFirstJellyfinServiceId(): string | null {
  const connectorManager = ConnectorManager.getInstance();
  const connectors = connectorManager.getAllConnectors();

  for (const connector of connectors) {
    if (connector.config.type === "jellyfin") {
      return connector.config.id;
    }
  }

  return null;
}
