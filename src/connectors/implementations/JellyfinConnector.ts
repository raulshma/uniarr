import { BaseConnector } from "@/connectors/base/BaseConnector";
import type { SearchOptions } from "@/connectors/base/IConnector";
import type { ServiceConfig } from "@/models/service.types";
import type {
  JellyfinItem,
  JellyfinItemsResponse,
  JellyfinLatestItem,
  JellyfinLibraryView,
  JellyfinResumeItem,
  JellyfinServerInfo,
  JellyfinUserProfile,
  JellyfinImageOptions,
  JellyfinSession,
  JellyfinSearchHintResult,
  JellyfinSearchOptions,
} from "@/models/jellyfin.types";
import { ServiceAuthHelper } from "@/services/auth/ServiceAuthHelper";
import { logger } from "@/services/logger/LoggerService";

const DEFAULT_RESUME_TYPES = ["Movie", "Episode"];
const DEFAULT_SEARCH_TYPES = ["Movie", "Series", "Episode"];
const DEFAULT_ITEM_FIELDS = [
  "PrimaryImageAspectRatio",
  "Overview",
  "ParentId",
  "SeriesInfo",
  "ProviderIds",
  "Genres",
  "Taglines",
  "People",
  "Studios",
  "RunTimeTicks",
  "PremiereDate",
  "ProductionYear",
  "OfficialRating",
].join(",");

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
    return this.serverVersion ?? "Unknown";
  }

  async getLibraries(): Promise<JellyfinLibraryView[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    try {
      const response = await this.client.get<{ Items?: JellyfinLibraryView[] }>(
        `/Users/${userId}/Views`,
        {
          params: {
            IncludeHidden: false,
          },
        },
      );

      return response.data?.Items ?? [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getResumeItems(
    limit = 20,
    includeTypes: string[] = DEFAULT_RESUME_TYPES,
  ): Promise<JellyfinResumeItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const params: Record<string, unknown> = {
      UserId: userId,
      Limit: limit,
      Fields:
        "PrimaryImageAspectRatio,MediaSources,Overview,ParentId,SeriesInfo",
      IncludeItemTypes: includeTypes.join(","),
      EnableImages: true,
      MediaTypes: "Video",
    };

    try {
      const response = await this.client.get<JellyfinItemsResponse>(
        `/Users/${userId}/Items/Resume`,
        { params },
      );

      return Array.isArray(response.data?.Items)
        ? [...response.data.Items]
        : [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getLatestItems(
    parentId: string,
    limit = 12,
  ): Promise<JellyfinLatestItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const params: Record<string, unknown> = {
      ParentId: parentId,
      Limit: limit,
      Fields: "PrimaryImageAspectRatio,Overview,ParentId,ProviderIds",
      IncludeItemTypes: DEFAULT_RESUME_TYPES.join(","),
      EnableImages: true,
      UserId: userId,
    };

    try {
      const response = await this.client.get<readonly JellyfinLatestItem[]>(
        `/Users/${userId}/Items/Latest`,
        {
          params,
        },
      );

      return Array.isArray(response.data) ? [...response.data] : [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getLibraryItems(
    libraryId: string,
    options: {
      readonly searchTerm?: string;
      readonly includeItemTypes?: readonly string[];
      readonly mediaTypes?: readonly string[];
      readonly sortBy?: string;
      readonly sortOrder?: "Ascending" | "Descending";
      readonly limit?: number;
      readonly startIndex?: number;
    } = {},
  ): Promise<JellyfinItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const params: Record<string, unknown> = {
      ParentId: libraryId,
      Recursive: true,
      EnableImages: true,
      Fields: DEFAULT_ITEM_FIELDS,
      SortBy: options.sortBy ?? "SortName",
      SortOrder: options.sortOrder ?? "Ascending",
      IncludeItemTypes: options.includeItemTypes?.length
        ? options.includeItemTypes.join(",")
        : undefined,
      MediaTypes: options.mediaTypes?.length
        ? options.mediaTypes.join(",")
        : undefined,
      SearchTerm: options.searchTerm?.trim().length
        ? options.searchTerm.trim()
        : undefined,
      Limit: options.limit,
      StartIndex: options.startIndex,
    };

    Object.keys(params).forEach((key) => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    try {
      const response = await this.client.get<JellyfinItemsResponse>(
        `/Users/${userId}/Items`,
        { params },
      );
      return Array.isArray(response.data?.Items)
        ? [...response.data.Items]
        : [];
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getItem(itemId: string): Promise<JellyfinItem> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    try {
      const response = await this.client.get<JellyfinItem>(
        `/Users/${userId}/Items/${itemId}`,
        {
          params: {
            Fields: DEFAULT_ITEM_FIELDS,
            EnableImages: true,
          },
        },
      );

      if (!response.data) {
        throw new Error("Jellyfin did not return item details.");
      }

      return response.data;
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async refreshItemMetadata(
    itemId: string,
    replaceAllMetadata = false,
  ): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.client.post(`/Items/${itemId}/Refresh`, undefined, {
        params: {
          ReplaceAllMetadata: replaceAllMetadata,
          ReplaceImages: false,
        },
      });
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<JellyfinItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const limit = options?.pagination?.pageSize ?? 25;
    const filters = options?.filters ?? {};

    // Build search parameters using the /Search/Hints endpoint which is the proper Jellyfin search endpoint
    const params: Record<string, unknown> & JellyfinSearchOptions = {
      searchTerm: query,
      userId, // Optional. Supply a user id to search within a user's library
      limit,
      startIndex:
        options?.pagination?.page && options.pagination.page > 1
          ? (options.pagination.page - 1) * limit
          : undefined,
      includeItemTypes: DEFAULT_SEARCH_TYPES as any,
      includePeople: false,
      includeMedia: true,
      includeGenres: false,
      includeStudios: false,
      includeArtists: false,
      ...filters,
    };

    // Remove undefined values
    Object.keys(params).forEach((key) => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    try {
      const response = await this.client.get<JellyfinSearchHintResult>(
        `/Search/Hints`,
        { params },
      );

      // Convert search hints back to JellyfinItem-like format for compatibility
      // SearchHint has limited info, so we map available fields and cast to JellyfinItem
      const items: JellyfinItem[] = (response.data?.SearchHints ?? []).map(
        (hint) => {
          const item: Partial<JellyfinItem> = {
            Id: hint.Id || hint.ItemId,
            Name: hint.Name,
            Type: hint.Type as any,
            MediaType: hint.MediaType as any,
            ProductionYear: hint.ProductionYear ?? undefined,
            ImageTags: hint.PrimaryImageTag
              ? { Primary: hint.PrimaryImageTag }
              : undefined,
            RunTimeTicks: hint.RunTimeTicks ?? undefined,
            // SearchHint doesn't include ProviderIds, Overview, or Genres
            // These will be undefined but that's acceptable for search results
          };
          return item as JellyfinItem;
        },
      );

      return items;
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  getImageUrl(
    itemId: string,
    imageType: "Primary" | "Backdrop" | "Thumb" = "Primary",
    options: JellyfinImageOptions = {},
  ): string {
    const base = this.getBaseUrl();
    const params = new URLSearchParams();

    if (options.tag) params.append("tag", options.tag);
    if (options.width) params.append("width", String(options.width));
    if (options.height) params.append("height", String(options.height));
    if (options.quality) params.append("quality", String(options.quality));
    if (options.fillWidth)
      params.append("fillWidth", String(options.fillWidth));
    if (options.fillHeight)
      params.append("fillHeight", String(options.fillHeight));
    if (options.blur) params.append("blur", String(options.blur));

    const query = params.toString();
    return `${base}/Items/${itemId}/Images/${imageType}${query.length ? `?${query}` : ""}`;
  }

  getPersonImageUrl(
    personId: string,
    tag?: string,
    options: JellyfinImageOptions = {},
  ): string {
    // The OpenAPI spec exposes person images at: /Persons/{name}/Images/{imageType}
    // Clients may supply a person name or identifier. Ensure the identifier
    // is URL-encoded so names with spaces or special characters are valid.
    const base = this.getBaseUrl();
    const params = new URLSearchParams();

    if (tag) params.append("tag", tag);
    if (options.width) params.append("width", String(options.width));
    if (options.height) params.append("height", String(options.height));
    if (options.quality) params.append("quality", String(options.quality));
    if (options.fillWidth)
      params.append("fillWidth", String(options.fillWidth));
    if (options.fillHeight)
      params.append("fillHeight", String(options.fillHeight));
    if (options.blur) params.append("blur", String(options.blur));

    const query = params.toString();
    const encodedPerson = encodeURIComponent(personId);
    return `${base}/Persons/${encodedPerson}/Images/Primary${query.length ? `?${query}` : ""}`;
  }

  async getNowPlayingSessions(): Promise<JellyfinSession[]> {
    await this.ensureAuthenticated();

    try {
      // Request recent sessions from the server. Previously we filtered by
      // ControllableByUserId which caused many legitimate playback sessions
      // (for example sessions the user owns but cannot remote-control) to be
      // excluded by the server. Instead, request sessions in general and
      // perform client-side filtering to include sessions that belong to the
      // current user (or list them as active).
      const response = await this.client.get<readonly JellyfinSession[]>(
        "/Sessions",
        {
          params: {
            ActiveWithinSeconds: 600,
            EnableImages: true,
            Fields: DEFAULT_ITEM_FIELDS,
          },
        },
      );

      if (!Array.isArray(response.data)) {
        return [];
      }

      // The server may return both `NowPlayingItem` and `NowViewingItem`.
      // Consumers of our API expect `NowPlayingItem` to contain the media
      // that's actually playing. For some clients the item will instead be
      // present on `NowViewingItem` — copy that over as a convenience so the
      // UI doesn't have to special-case both fields. Return the list as-is
      // to avoid dropping sessions the server returned (this keeps behavior
      // stable across refetches and avoids transient "Nothing is playing"
      // UX when the server omits certain filters).
      return response.data.map((session) => {
        const s = { ...session } as any;
        if (!s.NowPlayingItem && s.NowViewingItem) {
          s.NowPlayingItem = s.NowViewingItem;
        }
        return s as JellyfinSession;
      });
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async sendPlaystateCommand(
    sessionId: string,
    command:
      | "Stop"
      | "Pause"
      | "Unpause"
      | "NextTrack"
      | "PreviousTrack"
      | "Seek"
      | "Rewind"
      | "FastForward"
      | "PlayPause",
    options: {
      readonly seekPositionTicks?: number;
      readonly controllingUserId?: string;
    } = {},
  ): Promise<void> {
    await this.ensureAuthenticated();

    const params: Record<string, unknown> = {};
    if (options.seekPositionTicks !== undefined) {
      params.seekPositionTicks = options.seekPositionTicks;
    }
    if (options.controllingUserId) {
      params.controllingUserId = options.controllingUserId;
    }

    try {
      await this.client.post(
        `/Sessions/${sessionId}/Playing/${command}`,
        undefined,
        { params },
      );
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async setVolume(sessionId: string, volumePercent: number): Promise<void> {
    await this.ensureAuthenticated();

    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));

    try {
      await this.client.post(`/Sessions/${sessionId}/Command`, {
        Name: "SetVolume",
        Arguments: {
          Volume: String(clamped),
        },
      });
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  getUserDisplayName(): string | undefined {
    return this.userName;
  }

  private async bootstrapUserContext(): Promise<void> {
    const session = ServiceAuthHelper.getServiceSession(this.config);

    const context = session?.context ?? {};

    if (typeof context.userId === "string" && context.userId.length > 0) {
      this.userId = context.userId;
    }

    if (typeof context.userName === "string" && context.userName.length > 0) {
      this.userName = context.userName;
    }

    if (!this.userId) {
      const profile = await this.fetchCurrentUser();
      if (profile?.Id) {
        this.userId = profile.Id;
        if (typeof profile.Name === "string" && profile.Name.length > 0) {
          this.userName = profile.Name;
        }
      }
    }
  }

  private async fetchServerInfo(): Promise<void> {
    try {
      const response = await this.client.get<JellyfinServerInfo>(
        "/System/Info/Public",
      );
      // ProductVersion may be present under different keys depending on server; coerce nulls to undefined
      const productVersion =
        (response.data as any)?.ProductVersion ?? undefined;
      this.serverVersion =
        response.data?.Version ?? productVersion ?? this.serverVersion;
      this.serverName =
        response.data?.ServerName ??
        response.data?.ProductName ??
        this.serverName;
    } catch (error) {
      void logger.debug("Failed to fetch Jellyfin server info.", {
        serviceId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async fetchCurrentUser(): Promise<JellyfinUserProfile | undefined> {
    try {
      const response = await this.client.get<JellyfinUserProfile>("/Users/Me", {
        params: {
          Fields: "PrimaryImageAspectRatio",
        },
      });

      return response.data;
    } catch (error) {
      void logger.debug("Failed to fetch Jellyfin user profile.", {
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
      throw new Error(
        "Unable to resolve Jellyfin user context. Re-authenticate and try again.",
      );
    }

    return this.userId;
  }

  private getBaseUrl(): string {
    return this.config.url.replace(/\/$/, "");
  }

  protected override getDefaultHeaders(): Record<string, string> {
    const headers = super.getDefaultHeaders();
    delete headers["X-Api-Key"];
    const authHeaders = ServiceAuthHelper.getServiceAuthHeaders(this.config);
    return {
      ...headers,
      ...authHeaders,
    };
  }

  protected override getAuthConfig(): {
    auth?: { username: string; password: string };
  } {
    // Jellyfin manages authentication via tokens, so no basic auth configuration is required here.
    return {};
  }
}
