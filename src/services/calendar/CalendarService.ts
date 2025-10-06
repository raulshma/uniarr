import type { MediaRelease, CalendarFilters } from '@/models/calendar.types';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { secureStorage } from '@/services/storage/SecureStorage';
import type { Series } from '@/models/media.types';
import type { Movie } from '@/models/movie.types';

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
      
      // Fetch from Sonarr services
      const sonarrConfigs = configs.filter(config => 
        config.type === 'sonarr' && config.enabled
      );
      
      for (const config of sonarrConfigs) {
        try {
          const sonarrReleases = await this.getSonarrReleases(config.id, filters);
          releases.push(...sonarrReleases);
        } catch (error) {
          console.warn(`Failed to fetch releases from Sonarr ${config.name}:`, error);
        }
      }
      
      // Fetch from Radarr services
      const radarrConfigs = configs.filter(config => 
        config.type === 'radarr' && config.enabled
      );
      
      for (const config of radarrConfigs) {
        try {
          const radarrReleases = await this.getRadarrReleases(config.id, filters);
          releases.push(...radarrReleases);
        } catch (error) {
          console.warn(`Failed to fetch releases from Radarr ${config.name}:`, error);
        }
      }
      
      return releases;
    } catch (error) {
      console.error('Failed to fetch calendar releases:', error);
      throw new Error('Unable to load calendar data');
    }
  }

  /**
   * Get releases from Sonarr service
   */
  private async getSonarrReleases(serviceId: string, filters: CalendarFilters): Promise<MediaRelease[]> {
    const connector = this.connectorManager.getConnector(serviceId);
    if (!connector || connector.config.type !== 'sonarr') {
      throw new Error(`Sonarr connector not found for service ${serviceId}`);
    }

    const sonarrConnector = connector as any; // Type assertion for now
    const series = await sonarrConnector.getSeries();
    
    const releases: MediaRelease[] = [];
    
    for (const seriesItem of series) {
      // Convert series to releases
      if (seriesItem.nextAiring) {
        const release: MediaRelease = {
          id: `sonarr-${serviceId}-series-${seriesItem.id}`,
          title: seriesItem.title,
          type: 'series',
          releaseDate: seriesItem.nextAiring.split('T')[0],
          status: this.determineReleaseStatus(seriesItem.nextAiring),
          posterUrl: seriesItem.posterUrl,
          backdropUrl: seriesItem.backdropUrl,
          overview: seriesItem.overview,
          genres: seriesItem.genres,
          year: seriesItem.year,
          network: seriesItem.network,
          monitored: seriesItem.monitored,
          serviceId,
          serviceType: 'sonarr',
          seriesId: seriesItem.id.toString(),
          seriesTitle: seriesItem.title,
        };
        
        releases.push(release);
      }
      
      // Add episodes if available
      if (seriesItem.seasons) {
        for (const season of seriesItem.seasons) {
          if (season.episodes) {
            for (const episode of season.episodes) {
              if (episode.airDate) {
                const release: MediaRelease = {
                  id: `sonarr-${serviceId}-episode-${episode.id}`,
                  title: episode.title,
                  type: 'episode',
                  releaseDate: episode.airDate.split('T')[0],
                  status: this.determineReleaseStatus(episode.airDate),
                  posterUrl: seriesItem.posterUrl,
                  overview: episode.overview,
                  genres: seriesItem.genres,
                  year: seriesItem.year,
                  network: seriesItem.network,
                  monitored: episode.monitored,
                  serviceId,
                  serviceType: 'sonarr',
                  seriesId: seriesItem.id.toString(),
                  seriesTitle: seriesItem.title,
                  seasonNumber: episode.seasonNumber,
                  episodeNumber: episode.episodeNumber,
                };
                
                releases.push(release);
              }
            }
          }
        }
      }
    }
    
    return this.filterReleases(releases, filters);
  }

  /**
   * Get releases from Radarr service
   */
  private async getRadarrReleases(serviceId: string, filters: CalendarFilters): Promise<MediaRelease[]> {
    const connector = this.connectorManager.getConnector(serviceId);
    if (!connector || connector.config.type !== 'radarr') {
      throw new Error(`Radarr connector not found for service ${serviceId}`);
    }

    const radarrConnector = connector as any; // Type assertion for now
    const movies = await radarrConnector.getMovies();
    
    const releases: MediaRelease[] = [];
    
    for (const movie of movies) {
      // For now, we'll use the movie's added date as a placeholder
      // In a real implementation, you'd fetch upcoming releases from TMDB or similar
      if (movie.added) {
        const release: MediaRelease = {
          id: `radarr-${serviceId}-movie-${movie.id}`,
          title: movie.title,
          type: 'movie',
          releaseDate: movie.added.split('T')[0],
          status: 'released', // Movies in Radarr are typically already released
          posterUrl: movie.posterUrl,
          backdropUrl: movie.backdropUrl,
          overview: movie.overview,
          genres: movie.genres,
          year: movie.year,
          monitored: movie.monitored,
          serviceId,
          serviceType: 'radarr',
        };
        
        releases.push(release);
      }
    }
    
    return this.filterReleases(releases, filters);
  }

  /**
   * Determine release status based on date
   */
  private determineReleaseStatus(releaseDate: string): 'upcoming' | 'released' | 'delayed' | 'cancelled' {
    const now = new Date();
    const release = new Date(releaseDate);
    const diffTime = release.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'released';
    if (diffDays <= 7) return 'upcoming';
    return 'upcoming';
  }

  /**
   * Filter releases based on provided filters
   */
  private filterReleases(releases: MediaRelease[], filters: CalendarFilters): MediaRelease[] {
    return releases.filter(release => {
      // Filter by media type
      if (!filters.mediaTypes.includes(release.type)) return false;
      
      // Filter by status
      if (!filters.statuses.includes(release.status)) return false;
      
      // Filter by service
      if (filters.services.length > 0 && release.serviceId && !filters.services.includes(release.serviceId)) {
        return false;
      }
      
      // Filter by search query
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        if (!release.title.toLowerCase().includes(searchLower) &&
            !release.seriesTitle?.toLowerCase().includes(searchLower)) {
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
      upcomingReleases: releases.filter(r => r.status === 'upcoming').length,
      releasedThisWeek: releases.filter(r => {
        if (r.status !== 'released') return false;
        const releaseDate = new Date(r.releaseDate);
        return releaseDate >= weekStart && releaseDate <= weekEnd;
      }).length,
      monitoredReleases: releases.filter(r => r.monitored).length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };
    
    // Count by type
    releases.forEach(release => {
      stats.byType[release.type] = (stats.byType[release.type] || 0) + 1;
    });
    
    // Count by status
    releases.forEach(release => {
      stats.byStatus[release.status] = (stats.byStatus[release.status] || 0) + 1;
    });
    
    return stats;
  }
}