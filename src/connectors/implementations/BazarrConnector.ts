import { BaseConnector } from '@/connectors/base/BaseConnector';
import type { SearchOptions } from '@/connectors/base/IConnector';
import type {
  BazarrMovie,
  BazarrEpisode,
  BazarrSubtitle,
  BazarrMissingSubtitle,
  BazarrLanguage,
  BazarrProvider,
  BazarrProfile,
  BazarrSystemStatus,
  BazarrQueueItem,
  BazarrHistoryItem,
  BazarrSearchResult,
  BazarrSearchRequest,
  BazarrDownloadRequest,
  BazarrStatistics,
} from '@/models/bazarr.types';
import { handleApiError } from '@/utils/error.utils';

/**
 * Bazarr connector for subtitle management
 */
export class BazarrConnector extends BaseConnector<
  BazarrMovie | BazarrEpisode,
  BazarrSearchRequest,
  Partial<BazarrMovie | BazarrEpisode>
> {
  async initialize(): Promise<void> {
    // Bazarr initialization - mainly authentication check
    await this.ensureAuthenticated();
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get('/api/system/status');
      return response.data?.bazarrVersion || response.data?.version || 'Unknown';
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
      });

      throw new Error(`Failed to get Bazarr version: ${diagnostic.message}`);
    }
  }

  // Movie Management Methods

  /**
   * Get all movies with subtitle information
   */
  async getMovies(): Promise<BazarrMovie[]> {
    try {
      const response = await this.client.get('/api/movies');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getMovies',
      });

      throw new Error(`Failed to get movies: ${diagnostic.message}`);
    }
  }

  /**
   * Get a specific movie by ID
   */
  async getMovieById(id: number): Promise<BazarrMovie> {
    try {
      const response = await this.client.get(`/api/movies/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getMovieById',
      });

      throw new Error(`Failed to get movie ${id}: ${diagnostic.message}`);
    }
  }

  // Episode Management Methods

  /**
   * Get all episodes with subtitle information
   */
  async getEpisodes(): Promise<BazarrEpisode[]> {
    try {
      const response = await this.client.get('/api/episodes');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getEpisodes',
      });

      throw new Error(`Failed to get episodes: ${diagnostic.message}`);
    }
  }

  /**
   * Get episodes for a specific series
   */
  async getEpisodesBySeriesId(seriesId: number): Promise<BazarrEpisode[]> {
    try {
      const response = await this.client.get(`/api/episodes/series/${seriesId}`);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getEpisodesBySeriesId',
      });

      throw new Error(`Failed to get episodes for series ${seriesId}: ${diagnostic.message}`);
    }
  }

  /**
   * Get a specific episode by ID
   */
  async getEpisodeById(id: number): Promise<BazarrEpisode> {
    try {
      const response = await this.client.get(`/api/episodes/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getEpisodeById',
      });

      throw new Error(`Failed to get episode ${id}: ${diagnostic.message}`);
    }
  }

  // Subtitle Management Methods

  /**
   * Get all subtitles
   */
  async getSubtitles(): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get('/api/subtitles');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getSubtitles',
      });

      throw new Error(`Failed to get subtitles: ${diagnostic.message}`);
    }
  }

  /**
   * Get subtitles for a specific movie
   */
  async getSubtitlesByMovieId(movieId: number): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(`/api/subtitles/movie/${movieId}`);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getSubtitlesByMovieId',
      });

      throw new Error(`Failed to get subtitles for movie ${movieId}: ${diagnostic.message}`);
    }
  }

  /**
   * Get subtitles for a specific episode
   */
  async getSubtitlesByEpisodeId(episodeId: number): Promise<BazarrSubtitle[]> {
    try {
      const response = await this.client.get(`/api/subtitles/episode/${episodeId}`);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getSubtitlesByEpisodeId',
      });

      throw new Error(`Failed to get subtitles for episode ${episodeId}: ${diagnostic.message}`);
    }
  }

  /**
   * Search for subtitles for a movie/episode
   */
  async searchSubtitles(searchRequest: BazarrSearchRequest): Promise<BazarrSearchResult[]> {
    try {
      const response = await this.client.post('/api/subtitles/search', searchRequest);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'searchSubtitles',
      });

      throw new Error(`Failed to search subtitles: ${diagnostic.message}`);
    }
  }

  /**
   * Download a subtitle
   */
  async downloadSubtitle(downloadRequest: BazarrDownloadRequest): Promise<boolean> {
    try {
      await this.client.post('/api/subtitles/download', downloadRequest);
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'downloadSubtitle',
      });

      throw new Error(`Failed to download subtitle: ${diagnostic.message}`);
    }
  }

  // Language Management Methods

  /**
   * Get all available languages
   */
  async getLanguages(): Promise<BazarrLanguage[]> {
    try {
      const response = await this.client.get('/api/languages');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getLanguages',
      });

      throw new Error(`Failed to get languages: ${diagnostic.message}`);
    }
  }

  /**
   * Get enabled languages
   */
  async getEnabledLanguages(): Promise<BazarrLanguage[]> {
    try {
      const languages = await this.getLanguages();
      return languages.filter(lang => lang.enabled);
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getEnabledLanguages',
      });

      throw new Error(`Failed to get enabled languages: ${diagnostic.message}`);
    }
  }

  // Provider Management Methods

  /**
   * Get all subtitle providers
   */
  async getProviders(): Promise<BazarrProvider[]> {
    try {
      const response = await this.client.get('/api/providers');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getProviders',
      });

      throw new Error(`Failed to get providers: ${diagnostic.message}`);
    }
  }

  /**
   * Get enabled providers
   */
  async getEnabledProviders(): Promise<BazarrProvider[]> {
    try {
      const providers = await this.getProviders();
      return providers.filter(provider => provider.enabled);
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getEnabledProviders',
      });

      throw new Error(`Failed to get enabled providers: ${diagnostic.message}`);
    }
  }

  // Profile Management Methods

  /**
   * Get all subtitle profiles
   */
  async getProfiles(): Promise<BazarrProfile[]> {
    try {
      const response = await this.client.get('/api/profiles');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getProfiles',
      });

      throw new Error(`Failed to get profiles: ${diagnostic.message}`);
    }
  }

  // Queue and History Methods

  /**
   * Get download queue
   */
  async getQueue(): Promise<BazarrQueueItem[]> {
    try {
      const response = await this.client.get('/api/queue');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getQueue',
      });

      throw new Error(`Failed to get queue: ${diagnostic.message}`);
    }
  }

  /**
   * Get download history
   */
  async getHistory(): Promise<BazarrHistoryItem[]> {
    try {
      const response = await this.client.get('/api/history');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getHistory',
      });

      throw new Error(`Failed to get history: ${diagnostic.message}`);
    }
  }

  // Statistics Methods

  /**
   * Get overall statistics
   */
  async getStatistics(): Promise<BazarrStatistics> {
    try {
      const [movies, episodes, subtitles] = await Promise.all([
        this.getMovies(),
        this.getEpisodes(),
        this.getSubtitles(),
      ]);

      const missingSubtitles = [...movies, ...episodes]
        .flatMap(item => item.missingSubtitles || [])
        .length;

      return {
        moviesTotal: movies.length,
        episodesTotal: episodes.length,
        subtitlesTotal: subtitles.length,
        missingSubtitles,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getStatistics',
      });

      throw new Error(`Failed to get statistics: ${diagnostic.message}`);
    }
  }

  // Utility Methods

  /**
   * Get missing subtitles for all movies and episodes
   */
  async getAllMissingSubtitles(): Promise<BazarrMissingSubtitle[]> {
    try {
      const [movies, episodes] = await Promise.all([
        this.getMovies(),
        this.getEpisodes(),
      ]);

      return [
        ...(movies.flatMap(movie => movie.missingSubtitles || [])),
        ...(episodes.flatMap(episode => episode.missingSubtitles || [])),
      ];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getAllMissingSubtitles',
      });

      throw new Error(`Failed to get missing subtitles: ${diagnostic.message}`);
    }
  }

  /**
   * Search functionality for unified search integration
   */
  async search(query: string, options?: SearchOptions): Promise<Array<BazarrMovie | BazarrEpisode>> {
    // Bazarr doesn't have traditional search like Sonarr/Radarr
    // Return empty array for now - could be extended to search movies/episodes by title
    return [];
  }
}
