import type { MediaRelease, CalendarFilters } from "@/models/calendar.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { secureStorage } from "@/services/storage/SecureStorage";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";

// Import SonarrEpisode type to ensure proper typing
/**
 * Service for fetching and managing calendar data from various media services
 */
export class CalendarService {
  private static instance: CalendarService;
  private connectorManager: ConnectorManager;

  private constructor() {
    this.connectorManager = ConnectorManager.getInstance();
  }

  public static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  /**
   * Fetch all media releases for the calendar
   */
  public async getReleases(filters: CalendarFilters): Promise<MediaRelease[]> {
    try {
      await this.connectorManager.loadSavedServices();
      const configs = await secureStorage.getServiceConfigs();

      const releases: MediaRelease[] = [];

      const allowedTypes = new Set(filters.serviceTypes ?? []);
      const fetchAllTypes = allowedTypes.size === 0;

      // Fetch from Sonarr services when allowed
      if (fetchAllTypes || allowedTypes.has("sonarr")) {
        const sonarrConfigs = configs.filter(
          (config) => config.type === "sonarr" && config.enabled,
        );

        for (const config of sonarrConfigs) {
          try {
            const sonarrReleases = await this.getSonarrReleases(
              config.id,
              filters,
            );
            releases.push(...sonarrReleases);
          } catch (error) {
            console.warn(
              `Failed to fetch releases from Sonarr ${config.name}:`,
              error,
            );
          }
        }
      }

      // Fetch from Radarr services when allowed
      if (fetchAllTypes || allowedTypes.has("radarr")) {
        const radarrConfigs = configs.filter(
          (config) => config.type === "radarr" && config.enabled,
        );

        for (const config of radarrConfigs) {
          try {
            const radarrReleases = await this.getRadarrReleases(
              config.id,
              filters,
            );
            releases.push(...radarrReleases);
          } catch (error) {
            console.warn(
              `Failed to fetch releases from Radarr ${config.name}:`,
              error,
            );
          }
        }
      }

      return releases;
    } catch (error) {
      console.error("Failed to fetch calendar releases:", error);
      throw new Error("Unable to load calendar data");
    }
  }

  /**
   * Get releases from Sonarr service
   */
  private async getSonarrReleases(
    serviceId: string,
    filters: CalendarFilters,
  ): Promise<MediaRelease[]> {
    const connector = this.connectorManager.getConnector(serviceId);
    if (!connector || connector.config.type !== "sonarr") {
      throw new Error(`Sonarr connector not found for service ${serviceId}`);
    }

    const sonarrConnector = connector as SonarrConnector;

    // Determine date range
    const { startDate, endDate } = this.getDateRange(filters);

    // Fetch calendar episodes
    const episodes = await sonarrConnector.getCalendar(
      startDate,
      endDate,
      filters.monitoredStatus === "unmonitored",
    );

    const seriesCache = new Map<
      number,
      {
        title: string;
        posterUrl?: string;
        genres?: string[];
        year?: number;
        network?: string;
      }
    >();

    const releases: MediaRelease[] = [];

    for (const episode of episodes) {
      if (episode.airDate) {
        let seriesTitle = episode.series?.title;
        let seriesPosterUrl: string | undefined;
        let seriesGenres = episode.series?.genres;
        let seriesYear = episode.series?.year;
        let seriesNetwork = episode.series?.network;
        // If series information is not included in the calendar response, fetch it
        if (!seriesTitle && episode.seriesId) {
          if (!seriesCache.has(episode.seriesId)) {
            try {
              const series = await sonarrConnector.getById(episode.seriesId);
              seriesCache.set(episode.seriesId, {
                title: series.title,
                posterUrl: series.posterUrl,
                genres: series.genres,
                year: series.year,
                network: series.network,
              });
            } catch (error) {
              console.warn(
                `Failed to fetch series ${episode.seriesId}:`,
                error,
              );
              // Fallback to seriesId as string
              seriesCache.set(episode.seriesId, {
                title: `Series ${episode.seriesId}`,
              });
            }
          }

          const cachedSeries = seriesCache.get(episode.seriesId)!;
          seriesTitle = cachedSeries.title;
          seriesPosterUrl = cachedSeries.posterUrl;
          seriesGenres = cachedSeries.genres;
          seriesYear = cachedSeries.year;
          seriesNetwork = cachedSeries.network;
        } else if (episode.series?.images) {
          // If series is included, extract poster URL from images (accept nullable coverType/url)
          seriesPosterUrl = this.findSonarrImageUrl(
            episode.series.images,
            "poster",
          );
        }

        const episodeTitle = (episode.title ?? "") as string;
        const release: MediaRelease = {
          id: `sonarr-${serviceId}-episode-${episode.id ?? "unknown"}`,
          title: seriesTitle
            ? `${seriesTitle} - ${episodeTitle}`
            : episodeTitle || `Episode ${episode.id ?? "unknown"}`,
          type: "episode",
          releaseDate: (episode.airDate ?? "").split("T")[0]!,
          status: this.determineReleaseStatus(episode.airDate ?? ""),
          posterUrl: seriesPosterUrl,
          overview: episode.overview ?? undefined,
          genres: seriesGenres ?? undefined,
          year: seriesYear ?? undefined,
          network: seriesNetwork ?? undefined,
          monitored: Boolean(episode.monitored),
          serviceId,
          serviceType: "sonarr",
          seriesId: episode.seriesId?.toString(),
          seriesTitle: seriesTitle ?? undefined,
          seasonNumber: episode.seasonNumber ?? undefined,
          episodeNumber: episode.episodeNumber ?? undefined,
        };

        releases.push(release);
      }
    }

    return this.filterReleases(releases, filters);
  }

  /**
   * Get releases from Radarr service
   */
  private async getRadarrReleases(
    serviceId: string,
    filters: CalendarFilters,
  ): Promise<MediaRelease[]> {
    const connector = this.connectorManager.getConnector(serviceId);
    if (!connector || connector.config.type !== "radarr") {
      throw new Error(`Radarr connector not found for service ${serviceId}`);
    }

    const radarrConnector = connector as RadarrConnector;

    // Determine date range
    const { startDate, endDate } = this.getDateRange(filters);

    // Fetch calendar movies
    const movies = await radarrConnector.getCalendar(
      startDate,
      endDate,
      filters.monitoredStatus === "unmonitored",
    );

    const releases: MediaRelease[] = [];

    for (const movie of movies) {
      // Use the movie's release date or inCinemas date
      const releaseDate =
        movie.releaseDate || movie.inCinemas || movie.digitalRelease;
      if (releaseDate) {
        const movieTitle = (movie.title ?? "") as string;
        const release: MediaRelease = {
          id: `radarr-${serviceId}-movie-${movie.id ?? "unknown"}`,
          title: movieTitle || `Movie ${movie.id ?? "unknown"}`,
          type: "movie",
          releaseDate: releaseDate.split("T")[0]!,
          status: this.determineReleaseStatus(releaseDate),
          posterUrl: movie.images
            ? this.findRadarrImageUrl(movie.images, "poster")
            : undefined,
          backdropUrl: movie.images
            ? this.findRadarrImageUrl(movie.images, "fanart")
            : undefined,
          overview: movie.overview ?? undefined,
          genres: movie.genres ?? undefined,
          year: movie.year ?? undefined,
          monitored: Boolean(movie.monitored),
          serviceId,
          serviceType: "radarr",
        };

        releases.push(release);
      }
    }

    return this.filterReleases(releases, filters);
  }

  /**
   * Determine release status based on date
   */
  private determineReleaseStatus(
    releaseDate: string,
  ): "upcoming" | "released" | "delayed" | "cancelled" {
    const now = new Date();
    const release = new Date(releaseDate);
    const diffTime = release.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "released";
    if (diffDays <= 7) return "upcoming";
    return "upcoming";
  }

  /**
   * Filter releases based on provided filters
   */
  private filterReleases(
    releases: MediaRelease[],
    filters: CalendarFilters,
  ): MediaRelease[] {
    return releases.filter((release) => {
      // Filter by media type
      if (!filters.mediaTypes.includes(release.type)) return false;

      // Filter by status
      if (!filters.statuses.includes(release.status)) return false;

      // Filter by service
      if (
        filters.services.length > 0 &&
        release.serviceId &&
        !filters.services.includes(release.serviceId)
      ) {
        return false;
      }

      // Filter by service type
      if (
        (filters.serviceTypes?.length ?? 0) > 0 &&
        release.serviceType &&
        !filters.serviceTypes.includes(release.serviceType)
      ) {
        return false;
      }

      // Filter by monitored status
      if (filters.monitoredStatus === "monitored" && !release.monitored) {
        return false;
      }

      if (filters.monitoredStatus === "unmonitored" && release.monitored) {
        return false;
      }

      // Filter by search query
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        if (
          !release.title.toLowerCase().includes(searchLower) &&
          !release.seriesTitle?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Filter by date range
      if (filters.dateRange) {
        const releaseDate = new Date(release.releaseDate);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);

        if (releaseDate < startDate || releaseDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get calendar statistics
   */
  public async getStats(filters: CalendarFilters): Promise<{
    totalReleases: number;
    upcomingReleases: number;
    releasedThisWeek: number;
    monitoredReleases: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const releases = await this.getReleases(filters);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const stats = {
      totalReleases: releases.length,
      upcomingReleases: releases.filter((r) => r.status === "upcoming").length,
      releasedThisWeek: releases.filter((r) => {
        if (r.status !== "released") return false;
        const releaseDate = new Date(r.releaseDate);
        return releaseDate >= weekStart && releaseDate <= weekEnd;
      }).length,
      monitoredReleases: releases.filter((r) => r.monitored).length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    // Count by type
    releases.forEach((release) => {
      stats.byType[release.type] = (stats.byType[release.type] || 0) + 1;
    });

    // Count by status
    releases.forEach((release) => {
      stats.byStatus[release.status] =
        (stats.byStatus[release.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get date range for calendar fetching
   */
  private getDateRange(filters: CalendarFilters): {
    startDate?: string;
    endDate?: string;
  } {
    if (filters.dateRange) {
      return {
        startDate: filters.dateRange.start,
        endDate: filters.dateRange.end,
      };
    }

    // Default: last 30 days to next 90 days
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 90);

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  }

  /**
   * Find image URL from Sonarr images array
   */
  private findSonarrImageUrl(
    images:
      | (
          | {
              coverType?: string | null;
              url?: string | null;
              remoteUrl?: string | null;
            }
          | undefined
        )[]
      | null
      | undefined,
    type: string,
  ): string | undefined {
    return (
      images?.find((image) => (image?.coverType ?? "") === type)?.remoteUrl ??
      undefined
    );
  }

  /**
   * Find image URL from Radarr images array
   */
  private findRadarrImageUrl(
    images:
      | (
          | {
              coverType?: string | null;
              url?: string | null;
              remoteUrl?: string | null;
            }
          | undefined
        )[]
      | null
      | undefined,
    type: string,
  ): string | undefined {
    return (
      images?.find((image) => (image?.coverType ?? "") === type)?.remoteUrl ??
      undefined
    );
  }
}
