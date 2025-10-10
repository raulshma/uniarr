import { BaseConnector } from '@/connectors/base/BaseConnector';
import type { SearchOptions } from '@/connectors/base/IConnector';
import type { ServiceConfig } from '@/models/service.types';
import type {
  JellyfinItem,
  JellyfinItemsResponse,
  JellyfinLatestItem,
  JellyfinLibraryView,
  JellyfinResumeItem,
  JellyfinServerInfo,
  JellyfinUserProfile,
  JellyfinImageOptions,
} from '@/models/jellyfin.types';
import { ServiceAuthHelper } from '@/services/auth/ServiceAuthHelper';
import { logger } from '@/services/logger/LoggerService';

const DEFAULT_RESUME_TYPES = ['Movie', 'Episode'];
const DEFAULT_SEARCH_TYPES = ['Movie', 'Series', 'Episode'];

export class JellyfinConnector extends BaseConnector<JellyfinItem> {
  private userId?: string;
  private userName?: string;
  private serverVersion?: string;
  private serverName?: string;

  constructor(config: ServiceConfig) {
    super(config);

    this.client.interceptors.request.use((requestConfig) => {
      const authHeaders = ServiceAuthHelper.getServiceAuthHeaders(this.config);
      const headers = requestConfig.headers ?? {};
      Object.entries(authHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          (headers as Record<string, unknown>)[key] = value;
        }
      });
      requestConfig.headers = headers;
      return requestConfig;
    });
  }

  async initialize(): Promise<void> {
    await this.ensureAuthenticated();
    await this.bootstrapUserContext();
    await this.fetchServerInfo();
  }

  async getVersion(): Promise<string> {
    if (this.serverVersion) {
      return this.serverVersion;
    }

    await this.fetchServerInfo();
    return this.serverVersion ?? 'Unknown';
  }

  async getLibraries(): Promise<JellyfinLibraryView[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    try {
      const response = await this.client.get<{ Items?: JellyfinLibraryView[] }>(`/Users/${userId}/Views`, {
        params: {
          IncludeHidden: false,
        },
      });

      return response.data?.Items ?? [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getResumeItems(limit = 20, includeTypes: string[] = DEFAULT_RESUME_TYPES): Promise<JellyfinResumeItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const params: Record<string, unknown> = {
      UserId: userId,
      Limit: limit,
      Fields: 'PrimaryImageAspectRatio,MediaSources,Overview,ParentId,SeriesInfo',
      IncludeItemTypes: includeTypes.join(','),
      EnableImages: true,
      MediaTypes: 'Video',
    };

    try {
      const response = await this.client.get<JellyfinItemsResponse<JellyfinResumeItem>>(
        `/Users/${userId}/Items/Resume`,
        { params },
      );

      return Array.isArray(response.data?.Items) ? [...response.data.Items] : [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getLatestItems(parentId: string, limit = 12): Promise<JellyfinLatestItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const params: Record<string, unknown> = {
      ParentId: parentId,
      Limit: limit,
      Fields: 'PrimaryImageAspectRatio,Overview,ParentId,ProviderIds',
      IncludeItemTypes: DEFAULT_RESUME_TYPES.join(','),
      EnableImages: true,
      UserId: userId,
    };

    try {
      const response = await this.client.get<readonly JellyfinLatestItem[]>(`/Users/${userId}/Items/Latest`, {
        params,
      });

      return Array.isArray(response.data) ? [...response.data] : [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async search(query: string, options?: SearchOptions): Promise<JellyfinItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const limit = options?.pagination?.pageSize ?? 25;
    const filters = options?.filters ?? {};

    const params: Record<string, unknown> = {
      SearchTerm: query,
      UserId: userId,
      Limit: limit,
      Recursive: true,
      IncludeItemTypes: DEFAULT_SEARCH_TYPES.join(','),
      Fields: 'PrimaryImageAspectRatio,Overview,ParentId,SeriesInfo,ProviderIds',
      EnableImages: true,
      ...filters,
    };

    if (options?.pagination?.page && options.pagination.page > 1) {
      params.StartIndex = (options.pagination.page - 1) * limit;
    }

    try {
      const response = await this.client.get<JellyfinItemsResponse>(`/Items/Search`, { params });
      return Array.isArray(response.data?.Items) ? [...response.data.Items] : [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  getImageUrl(itemId: string, imageType: 'Primary' | 'Backdrop' | 'Thumb' = 'Primary', options: JellyfinImageOptions = {}): string {
    const base = this.getBaseUrl();
    const params = new URLSearchParams();

    if (options.tag) params.append('tag', options.tag);
    if (options.width) params.append('width', String(options.width));
    if (options.height) params.append('height', String(options.height));
    if (options.quality) params.append('quality', String(options.quality));
    if (options.fillWidth) params.append('fillWidth', String(options.fillWidth));
    if (options.fillHeight) params.append('fillHeight', String(options.fillHeight));
    if (options.blur) params.append('blur', String(options.blur));

    const query = params.toString();
    return `${base}/Items/${itemId}/Images/${imageType}${query.length ? `?${query}` : ''}`;
  }

  getUserDisplayName(): string | undefined {
    return this.userName;
  }

  private async bootstrapUserContext(): Promise<void> {
    const session = ServiceAuthHelper.getServiceSession(this.config);

    const context = session?.context ?? {};

    if (typeof context.userId === 'string' && context.userId.length > 0) {
      this.userId = context.userId;
    }

    if (typeof context.userName === 'string') {
      this.userName = context.userName;
    }

    if (!this.userId) {
      const profile = await this.fetchCurrentUser();
      if (profile?.Id) {
        this.userId = profile.Id;
        this.userName = profile.Name;
      }
    }
  }

  private async fetchServerInfo(): Promise<void> {
    try {
      const response = await this.client.get<JellyfinServerInfo>('/System/Info/Public');
      this.serverVersion = response.data?.Version ?? response.data?.ProductVersion ?? this.serverVersion;
      this.serverName = response.data?.ServerName ?? response.data?.ProductName ?? this.serverName;
    } catch (error) {
      void logger.debug('Failed to fetch Jellyfin server info.', {
        serviceId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async fetchCurrentUser(): Promise<JellyfinUserProfile | undefined> {
    try {
      const response = await this.client.get<JellyfinUserProfile>('/Users/Me', {
        params: {
          Fields: 'PrimaryImageAspectRatio',
        },
      });

      return response.data;
    } catch (error) {
      void logger.debug('Failed to fetch Jellyfin user profile.', {
        serviceId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private async ensureUserId(): Promise<string> {
    if (this.userId) {
      return this.userId;
    }

    await this.bootstrapUserContext();

    if (!this.userId) {
      throw new Error('Unable to resolve Jellyfin user context. Re-authenticate and try again.');
    }

    return this.userId;
  }

  private getBaseUrl(): string {
    return this.config.url.replace(/\/$/, '');
  }

  protected override getDefaultHeaders(): Record<string, string> {
    const headers = super.getDefaultHeaders();
    const authHeaders = ServiceAuthHelper.getServiceAuthHeaders(this.config);
    return {
      ...headers,
      ...authHeaders,
    };
  }

  protected override getAuthConfig(): { auth?: { username: string; password: string } } {
    // Jellyfin manages authentication via tokens, so no basic auth configuration is required here.
    return {};
  }
}
