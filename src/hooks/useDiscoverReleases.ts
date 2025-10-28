import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { ProwlarrConnector } from "@/connectors/implementations/ProwlarrConnector";
import type { NormalizedRelease } from "@/models/discover.types";
import { mergeAndRankReleases } from "@/services/ReleaseService";
import { logger } from "@/services/logger/LoggerService";
import { alert } from "@/services/dialogService";

export interface UseDiscoverReleasesOptions {
  /** Enable the query (default: true) */
  enabled?: boolean;
  /** Prefer quality over seeders when ranking (default: true) */
  preferQuality?: boolean;
  /** Minimum seeders filter (default: 0) */
  minSeeders?: number;
  /** TVDB ID for series lookup in Sonarr */
  tvdbId?: number;
  /** IMDB ID as alternative lookup */
  imdbId?: string;
  /** Series title for fallback search */
  title?: string;
  /** Release year for fallback search */
  year?: number;
}

/**
 * Show a modal quick-picker for selecting a Jellyseerr service.
 * Returns the selected service ID or undefined if cancelled/error.
 */
async function promptJellyseerrSelection(
  availableServiceIds: string[],
): Promise<string | undefined> {
  return new Promise((resolve) => {
    alert(
      "Select Jellyseerr Service",
      "Multiple Jellyseerr services found. Select one to use for series lookup:",
      [
        ...availableServiceIds.map((serviceId) => ({
          text: serviceId,
          onPress: () => resolve(serviceId),
          style: "default" as const,
        })),
        {
          text: "Open Settings",
          onPress: () => resolve(undefined), // Would navigate to settings in real app
          style: "default" as const,
        },
        {
          text: "Cancel",
          onPress: () => resolve(undefined),
          style: "cancel" as const,
        },
      ],
    );
  });
}

/**
 * Fetches available releases for a given media item from configured connectors.
 * For Radarr/Sonarr, first looks up the media by TMDB/TVDB/IMDB to get internal IDs,
 * then fetches releases. For Prowlarr, uses TMDB ID directly.
 */
export const useDiscoverReleases = (
  mediaType: "movie" | "series",
  tmdbId?: number,
  options: UseDiscoverReleasesOptions = {},
) => {
  const {
    enabled = true,
    preferQuality = true,
    minSeeders = 0,
    tvdbId,
    imdbId,
    title,
    year,
  } = options;
  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);

  return useQuery<NormalizedRelease[], Error>({
    queryKey: [
      ...queryKeys.discover.releases,
      { mediaType, tmdbId, tvdbId, imdbId, preferQuality, minSeeders },
    ] as const,
    enabled: enabled && Boolean(tmdbId || tvdbId || imdbId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (!tmdbId && !tvdbId && !imdbId) {
        throw new Error(
          "TMDB ID, TVDB ID, or IMDB ID is required for release lookup.",
        );
      }

      const allReleases: NormalizedRelease[] = [];

      try {
        // Fetch from Radarr if searching for movies
        if (mediaType === "movie") {
          const radarrConnectors = getConnectorsByType(
            "radarr",
          ) as RadarrConnector[];

          const radarrResults = await Promise.allSettled(
            radarrConnectors.map(async (connector) => {
              try {
                let internalMovieId: number | undefined;

                // Priority 1: Try TMDB lookup if available (direct & accurate)
                if (tmdbId) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Radarr TMDB lookup",
                    {
                      tmdbId,
                      connectorId: connector.config.id,
                    },
                  );
                  // Check if connector has lookupByTmdbId (implementation-only method)
                  const connectorWithTmdb = connector as any;
                  if (connectorWithTmdb.lookupByTmdbId) {
                    const movie =
                      await connectorWithTmdb.lookupByTmdbId(tmdbId);
                    if (movie) {
                      internalMovieId = movie.id;
                      logger.debug(
                        "[useDiscoverReleases] Radarr TMDB lookup succeeded",
                        {
                          tmdbId,
                          movieId: internalMovieId,
                        },
                      );
                    }
                  }
                }

                // Priority 2: Fall back to title-based search
                if (!internalMovieId && title) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Radarr title-based lookup",
                    {
                      title,
                      tmdbId,
                    },
                  );
                  const searchResults = await connector.search(title);
                  const match = searchResults.find(
                    (m) =>
                      m.tmdbId === tmdbId ||
                      (m.title.toLowerCase() === title.toLowerCase() &&
                        (!year || m.year === year)),
                  );
                  if (match) {
                    internalMovieId = match.id;
                  }
                }

                // Priority 3: Fall back to IMDB search
                if (!internalMovieId && imdbId) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Radarr IMDB lookup",
                    {
                      imdbId,
                    },
                  );
                  const searchResults = await connector.search(imdbId);
                  const match = searchResults.find((m) => m.imdbId === imdbId);
                  if (match) {
                    internalMovieId = match.id;
                  }
                }

                if (!internalMovieId) {
                  logger.warn(
                    "[useDiscoverReleases] Could not find movie in Radarr after all lookup attempts",
                    {
                      tmdbId,
                      imdbId,
                      title,
                    },
                  );
                  return [];
                }

                // Now fetch releases using the internal ID
                return connector.getReleases(internalMovieId, { minSeeders });
              } catch (error) {
                logger.warn("Radarr movie lookup or release fetch failed", {
                  error: error instanceof Error ? error.message : String(error),
                  tmdbId,
                });
                return [];
              }
            }),
          );

          radarrResults.forEach((result) => {
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              allReleases.push(...result.value);
            } else if (result.status === "rejected") {
              logger.warn("Radarr release fetch rejected", {
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              });
            }
          });

          // Also try Prowlarr for indexer search on movies
          const prowlarrConnectors = getConnectorsByType(
            "prowlarr",
          ) as ProwlarrConnector[];

          const prowlarrResults = await Promise.allSettled(
            prowlarrConnectors.map((connector) =>
              connector.searchReleases({
                tmdbId,
                imdbId,
                title,
                year,
                minSeeders,
              }),
            ),
          );

          prowlarrResults.forEach((result) => {
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              allReleases.push(...result.value);
            } else if (result.status === "rejected") {
              logger.warn("Prowlarr release search failed", {
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              });
            }
          });
        }

        // Fetch from Sonarr if searching for series
        if (mediaType === "series") {
          const sonarrConnectors = getConnectorsByType(
            "sonarr",
          ) as SonarrConnector[];

          // Get all Jellyseerr connectors for Sonarr ID mapping via TMDB
          const jellyseerrConnectors = getConnectorsByType(
            "jellyseerr",
          ) as any[];

          const sonarrResults = await Promise.allSettled(
            sonarrConnectors.map(async (connector) => {
              try {
                let internalSeriesId: number | undefined;

                // Priority 1: Try Jellyseerr service lookup for TMDB -> Sonarr mapping
                if (tmdbId && jellyseerrConnectors.length > 0) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Jellyseerr Sonarr mapping",
                    {
                      tmdbId,
                    },
                  );

                  let selectedJellyServiceId =
                    useSettingsStore.getState().preferredJellyseerrServiceId;

                  // If no preference set and multiple Jellyseerr services, ask user
                  if (
                    !selectedJellyServiceId &&
                    jellyseerrConnectors.length > 1
                  ) {
                    logger.debug(
                      "[useDiscoverReleases] Multiple Jellyseerr services; prompting user",
                    );
                    const serviceIds = jellyseerrConnectors.map(
                      (j) => j.config.id,
                    );
                    selectedJellyServiceId =
                      await promptJellyseerrSelection(serviceIds);
                    if (selectedJellyServiceId) {
                      useSettingsStore
                        .getState()
                        .setPreferredJellyseerrServiceId(
                          selectedJellyServiceId,
                        );
                    }
                  } else if (
                    !selectedJellyServiceId &&
                    jellyseerrConnectors.length === 1
                  ) {
                    selectedJellyServiceId = jellyseerrConnectors[0].config.id;
                  }

                  if (selectedJellyServiceId) {
                    const jellyConnector = jellyseerrConnectors.find(
                      (j) => j.config.id === selectedJellyServiceId,
                    );
                    if (jellyConnector) {
                      // Check if connector has serviceLookupForSonarr
                      if (jellyConnector.serviceLookupForSonarr) {
                        const sonarrId =
                          await jellyConnector.serviceLookupForSonarr(tmdbId);
                        if (sonarrId) {
                          internalSeriesId = sonarrId;
                          logger.debug(
                            "[useDiscoverReleases] Jellyseerr Sonarr mapping succeeded",
                            {
                              tmdbId,
                              sonarrId,
                            },
                          );
                        }
                      }
                    }
                  }
                }

                // Priority 2: Fall back to title-based search
                if (!internalSeriesId && title) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Sonarr title-based lookup",
                    {
                      title,
                      tmdbId,
                    },
                  );
                  const searchResults = await connector.search(title);
                  const match = searchResults.find(
                    (s) =>
                      s.tvdbId === tvdbId ||
                      s.tmdbId === tmdbId ||
                      (s.title.toLowerCase() === title.toLowerCase() &&
                        (!year || s.year === year)),
                  );
                  if (match) {
                    internalSeriesId = match.id;
                  }
                }

                // Priority 3: Fall back to IMDB search
                if (!internalSeriesId && imdbId) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Sonarr IMDB lookup",
                    {
                      imdbId,
                    },
                  );
                  const searchResults = await connector.search(imdbId);
                  const match = searchResults.find((s) => s.imdbId === imdbId);
                  if (match) {
                    internalSeriesId = match.id;
                  }
                }

                if (!internalSeriesId) {
                  logger.warn(
                    "[useDiscoverReleases] Could not find series in Sonarr after all lookup attempts",
                    {
                      tvdbId,
                      tmdbId,
                      imdbId,
                      title,
                    },
                  );
                  return [];
                }

                // Now fetch releases using the internal ID
                return connector.getReleases(internalSeriesId, { minSeeders });
              } catch (error) {
                logger.warn("Sonarr series lookup or release fetch failed", {
                  error: error instanceof Error ? error.message : String(error),
                  tmdbId,
                });
                return [];
              }
            }),
          );

          sonarrResults.forEach((result) => {
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              allReleases.push(...result.value);
            } else if (result.status === "rejected") {
              logger.warn("Sonarr release fetch rejected", {
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              });
            }
          });

          // Also try Prowlarr for indexer search on series
          const prowlarrConnectors = getConnectorsByType(
            "prowlarr",
          ) as ProwlarrConnector[];

          const prowlarrResults = await Promise.allSettled(
            prowlarrConnectors.map((connector) =>
              connector.searchReleases({
                tmdbId,
                title,
                year,
                minSeeders,
              }),
            ),
          );

          prowlarrResults.forEach((result) => {
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              allReleases.push(...result.value);
            } else if (result.status === "rejected") {
              logger.warn("Prowlarr release search failed", {
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              });
            }
          });
        }
      } catch (error) {
        logger.error("Error fetching discover releases", {
          mediaType,
          tmdbId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Merge, deduplicate, and rank releases
      return mergeAndRankReleases(allReleases, { preferQuality });
    },
  });
};
