import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import { QUERY_CONFIG } from "@/hooks/queryConfig";
import {
  useConnectorsStore,
  selectConnectorsByType,
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
  enabled?: boolean;
  preferQuality?: boolean;
  minSeeders?: number;
  tvdbId?: number;
  imdbId?: string;
  title?: string;
  year?: number;
}

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
          onPress: () => resolve(undefined),
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
  const radarrConnectors = useConnectorsStore(
    selectConnectorsByType("radarr"),
  ) as RadarrConnector[];
  const sonarrConnectors = useConnectorsStore(
    selectConnectorsByType("sonarr"),
  ) as SonarrConnector[];
  const prowlarrConnectors = useConnectorsStore(
    selectConnectorsByType("prowlarr"),
  ) as ProwlarrConnector[];
  const jellyseerrConnectors = useConnectorsStore(
    selectConnectorsByType("jellyseerr"),
  ) as any[];

  return useQuery<NormalizedRelease[], Error>({
    queryKey: queryKeys.discover.releases({
      mediaType,
      tmdbId,
      tvdbId,
      imdbId,
      preferQuality,
      minSeeders,
    }),
    enabled: enabled && Boolean(tmdbId || tvdbId || imdbId),
    ...QUERY_CONFIG.DISCOVER_RELEASES,
    queryFn: async (context) => {
      if (!tmdbId && !tvdbId && !imdbId) {
        throw new Error(
          "TMDB ID, TVDB ID, or IMDB ID is required for release lookup.",
        );
      }

      const signal = context.signal;
      const allReleases: NormalizedRelease[] = [];

      try {
        if (mediaType === "movie") {
          const radarrResults = await Promise.allSettled(
            radarrConnectors.map(async (connector) => {
              if (signal.aborted) {
                return [] as NormalizedRelease[];
              }

              try {
                let internalMovieId: number | undefined;

                if (tmdbId) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Radarr TMDB lookup",
                    {
                      tmdbId,
                      connectorId: connector.config.id,
                    },
                  );
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

          const prowlarrResults = await Promise.allSettled(
            prowlarrConnectors.map(async (connector) => {
              if (signal.aborted) {
                return [] as NormalizedRelease[];
              }
              return connector.searchReleases({
                tmdbId,
                imdbId,
                title,
                year,
                minSeeders,
              });
            }),
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

        if (mediaType === "series") {
          const sonarrResults = await Promise.allSettled(
            sonarrConnectors.map(async (connector) => {
              if (signal.aborted) {
                return [] as NormalizedRelease[];
              }

              try {
                let internalSeriesId: number | undefined;

                if (tmdbId && jellyseerrConnectors.length > 0) {
                  logger.debug(
                    "[useDiscoverReleases] Attempting Jellyseerr Sonarr mapping",
                    {
                      tmdbId,
                    },
                  );

                  let selectedJellyServiceId =
                    useSettingsStore.getState().preferredJellyseerrServiceId;

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

          const prowlarrResults = await Promise.allSettled(
            prowlarrConnectors.map(async (connector) => {
              if (signal.aborted) {
                return [] as NormalizedRelease[];
              }
              return connector.searchReleases({
                tmdbId,
                title,
                year,
                minSeeders,
              });
            }),
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
        if (!(error instanceof Error && error.name === "AbortError")) {
          logger.error("Error fetching discover releases", {
            mediaType,
            tmdbId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return mergeAndRankReleases(allReleases, { preferQuality });
    },
  });
};
