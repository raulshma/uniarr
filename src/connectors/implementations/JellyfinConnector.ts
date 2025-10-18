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
import type {
  IDownloadConnector,
  DownloadCapability,
  QualityOption,
  DownloadContentMetadata,
  DownloadInfo,
} from "@/connectors/base/IDownloadConnector";
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

export class JellyfinConnector
  extends BaseConnector<JellyfinItem>
  implements IDownloadConnector
{
  private userId?: string;
  private userName?: string;
  private serverVersion?: string;
  private serverName?: string;

  // Download connector properties
  public readonly supportsDownloads = true;

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

  // ==================== DOWNLOAD CONNECTOR METHODS ====================

  /**
   * Check if a specific content item can be downloaded
   */
  async canDownload(contentId: string): Promise<DownloadCapability> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    try {
      // Get the item details to check if it can be downloaded
      const item = await this.getItem(contentId);

      // Only movies and episodes can be downloaded for now
      if (item.Type !== "Movie" && item.Type !== "Episode") {
        return {
          canDownload: false,
          resumable: false,
          restrictions: [
            `Content type '${item.Type}' is not supported for download`,
          ],
        };
      }

      // Check if user has permission to download this content
      const canDownload = await this.checkDownloadPermission(item, userId);

      if (!canDownload) {
        return {
          canDownload: false,
          resumable: false,
          restrictions: ["You don't have permission to download this content"],
        };
      }

      // Get media sources to determine download capabilities
      const mediaSources = await this.getMediaSources(contentId);

      if (!mediaSources || mediaSources.length === 0) {
        return {
          canDownload: false,
          resumable: false,
          restrictions: ["No media sources available for download"],
        };
      }

      // Get available quality options
      const qualityOptions = await this.getDownloadQualities(contentId);

      // Estimate file size based on quality and duration
      const estimatedSize = this.estimateFileSize(item, qualityOptions[0]);

      return {
        canDownload: true,
        format: this.getMediaFormat(mediaSources[0]),
        qualityOptions,
        estimatedSize,
        resumable: true, // Jellyfin supports byte range requests
        restrictions: this.getDownloadRestrictions(item),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to check download capability", {
        contentId,
        error: message,
      });

      return {
        canDownload: false,
        resumable: false,
        restrictions: [message],
      };
    }
  }

  /**
   * Get download information for a specific content item
   */
  async getDownloadInfo(
    contentId: string,
    quality?: string,
  ): Promise<DownloadInfo> {
    await this.ensureAuthenticated();

    try {
      // Get item details
      const item = await this.getItem(contentId);

      // Get media sources
      const mediaSources = await this.getMediaSources(contentId);
      if (!mediaSources || mediaSources.length === 0) {
        throw new Error("No media sources available for download");
      }

      // Select the appropriate media source based on quality preference
      const selectedSource = this.selectMediaSource(mediaSources, quality);

      // Get download URL
      const downloadUrl = await this.getDownloadUrl(
        contentId,
        selectedSource.Id,
      );

      // Generate filename
      const fileName = this.generateFileName(item);

      // Get MIME type
      const mimeType = this.getMimeType(selectedSource);

      // Get file size if available
      const size = selectedSource.Size ?? undefined;

      return {
        sourceUrl: downloadUrl,
        fileName,
        mimeType,
        size,
        resumable: true, // Jellyfin supports resumable downloads
        headers: {
          // Add any necessary headers for the download request
          "User-Agent": "UniArr/1.0",
        },
        auth: {
          // Include authentication information
          ...this.getDownloadAuth(),
          type: "bearer" as const,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to get download info", {
        contentId,
        error: message,
      });
      throw new Error(`Failed to get download info: ${message}`);
    }
  }

  /**
   * Get metadata about a content item for download purposes
   */
  async getContentMetadata(
    contentId: string,
  ): Promise<DownloadContentMetadata> {
    await this.ensureAuthenticated();

    try {
      const item = await this.getItem(contentId);

      const metadata: DownloadContentMetadata = {
        id: item.Id || "",
        title: item.Name || "",
        type: item.Type?.toLowerCase() || "unknown",
        description: item.Overview || undefined,
        thumbnailUrl: this.getImageUrl(item.Id || "", "Primary"),
        duration: item.RunTimeTicks
          ? Math.floor(item.RunTimeTicks / 10_000_000)
          : undefined,
        year: item.ProductionYear || undefined,
      };

      // Add series information for TV episodes
      if (item.Type === "Episode" && item.SeriesName) {
        return {
          ...metadata,
          seriesInfo: {
            seriesName: item.SeriesName,
            season: item.ParentIndexNumber ?? 0,
            episode: item.IndexNumber ?? 0,
            episodeTitle: item.Name || "",
          },
        };
      }

      return metadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to get content metadata", {
        contentId,
        error: message,
      });
      throw new Error(`Failed to get content metadata: ${message}`);
    }
  }

  /**
   * Get a preview or thumbnail URL for the content
   */
  async getContentThumbnail(
    contentId: string,
    options?: { readonly width?: number; readonly height?: number },
  ): Promise<string | undefined> {
    try {
      const imageOptions: any = {};
      if (options?.width) imageOptions.width = options.width;
      if (options?.height) imageOptions.height = options.height;

      return this.getImageUrl(contentId, "Primary", imageOptions);
    } catch (error) {
      logger.warn("Failed to get content thumbnail", {
        contentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Get available download quality options for a content item
   */
  async getDownloadQualities(
    contentId: string,
  ): Promise<readonly QualityOption[]> {
    await this.ensureAuthenticated();

    try {
      const mediaSources = await this.getMediaSources(contentId);
      if (!mediaSources || mediaSources.length === 0) {
        return [];
      }

      return mediaSources.map((source) => ({
        label: this.getQualityLabel(source),
        value: source.Id,
        estimatedSize: source.Size,
        url: "", // Will be generated when needed
      }));
    } catch (error) {
      logger.error("Failed to get download qualities", {
        contentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Validate that a download URL is still valid and accessible
   */
  async validateDownloadUrl(downloadUrl: string): Promise<boolean> {
    try {
      // Make a HEAD request to check if the URL is accessible
      const response = await this.client.head(downloadUrl);
      return response.status === 200;
    } catch (error) {
      logger.warn("Download URL validation failed", {
        downloadUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Refresh an expiring download URL
   */
  async refreshDownloadUrl(
    contentId: string,
    currentUrl: string,
  ): Promise<string> {
    // For Jellyfin, we can generate a fresh URL
    const mediaSources = await this.getMediaSources(contentId);
    if (!mediaSources || mediaSources.length === 0) {
      throw new Error("No media sources available");
    }

    // Find the media source that matches the current URL
    const currentSource = mediaSources.find((source) =>
      currentUrl.includes(source.Id),
    );

    if (!currentSource) {
      throw new Error("Could not find matching media source for current URL");
    }

    return this.getDownloadUrl(contentId, currentSource.Id);
  }

  /**
   * Get download requirements or restrictions for the user
   */
  async getDownloadRequirements(contentId: string): Promise<readonly string[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    try {
      const item = await this.getItem(contentId);
      const requirements: string[] = [];

      // Check if user has appropriate permissions
      const canDownload = await this.checkDownloadPermission(item, userId);
      if (!canDownload) {
        requirements.push(
          "You must have download permissions for this content",
        );
      }

      // Check storage requirements
      const mediaSources = await this.getMediaSources(contentId);
      if (mediaSources && mediaSources.length > 0) {
        const estimatedSize = this.estimateFileSize(item, mediaSources[0]);
        requirements.push(
          `Requires approximately ${this.formatBytes(estimatedSize)} of storage space`,
        );
      }

      // Add content-specific requirements
      if (item.Type === "Movie") {
        requirements.push("Movies can be downloaded for offline viewing");
      } else if (item.Type === "Episode") {
        requirements.push("TV episodes can be downloaded for offline viewing");
      }

      return requirements;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [`Failed to check download requirements: ${message}`];
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if user has permission to download the item
   */
  private async checkDownloadPermission(
    item: any,
    userId: string,
  ): Promise<boolean> {
    // For now, assume all authenticated users can download
    // In a real implementation, you would check user permissions
    return true;
  }

  /**
   * Get media sources for an item
   */
  private async getMediaSources(itemId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/Items/${itemId}/PlaybackInfo`);
      return response.data?.MediaSources ?? [];
    } catch (error) {
      logger.error("Failed to get media sources", {
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get download URL for a media source
   */
  private async getDownloadUrl(
    itemId: string,
    mediaSourceId: string,
  ): Promise<string> {
    const baseUrl = this.getBaseUrl();

    // Generate a download URL using Jellyfin's streaming endpoint
    return `${baseUrl}/Videos/${itemId}/stream?static=true&mediaSourceId=${mediaSourceId}&deviceId=UniApp&api_key=${this.getApiKey()}`;
  }

  /**
   * Select the appropriate media source based on quality preference
   */
  private selectMediaSource(sources: any[], quality?: string): any {
    if (!quality || sources.length === 0) {
      return sources[0];
    }

    // Try to find a source matching the requested quality
    const matchingSource = sources.find(
      (source) =>
        source.Id === quality || this.getQualityLabel(source).includes(quality),
    );

    return matchingSource || sources[0];
  }

  /**
   * Generate a filename for the download
   */
  private generateFileName(item: any): string {
    let filename = item.Name;

    // Sanitize filename
    filename = filename.replace(/[<>:"/\\|?*]/g, "_");

    // Add year for movies
    if (item.Type === "Movie" && item.ProductionYear) {
      filename += ` (${item.ProductionYear})`;
    }

    // Add season/episode for TV shows
    if (item.Type === "Episode") {
      const season =
        item.ParentIndexNumber?.toString().padStart(2, "0") ?? "00";
      const episode = item.IndexNumber?.toString().padStart(2, "0") ?? "00";
      filename = `S${season}E${episode} - ${filename}`;
    }

    // Add extension
    const mediaSources = item.MediaSources ?? [];
    if (mediaSources.length > 0) {
      const container = mediaSources[0].Container;
      if (
        container &&
        !filename.toLowerCase().endsWith(`.${container.toLowerCase()}`)
      ) {
        filename += `.${container}`;
      }
    } else {
      filename += ".mp4"; // Default extension
    }

    return filename;
  }

  /**
   * Get MIME type for a media source
   */
  private getMimeType(mediaSource: any): string {
    const container = mediaSource.Container?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      mp4: "video/mp4",
      mkv: "video/x-matroska",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      wmv: "video/x-ms-wmv",
      flv: "video/x-flv",
      webm: "video/webm",
      m4v: "video/x-m4v",
    };

    return mimeTypes[container] || "video/mp4";
  }

  /**
   * Get media format from media source
   */
  private getMediaFormat(mediaSource: any): string {
    return mediaSource.Container?.toUpperCase() || "MP4";
  }

  /**
   * Get quality label for a media source
   */
  private getQualityLabel(mediaSource: any): string {
    const height = mediaSource.Height;

    if (!height) return "Unknown";

    if (height >= 2160) return "4K";
    if (height >= 1440) return "1440p";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";
    if (height >= 360) return "360p";

    return `${height}p`;
  }

  /**
   * Estimate file size based on item and quality
   */
  private estimateFileSize(item: any, mediaSource?: any): number {
    if (mediaSource?.Size) {
      return mediaSource.Size;
    }

    // Estimate based on duration and quality
    const durationMinutes = item.RunTimeTicks
      ? Math.floor(item.RunTimeTicks / 600_000_000) // Convert ticks to minutes
      : 90; // Default 90 minutes

    const height = mediaSource?.Height ?? 720;

    // Bitrate estimates in bits per second
    const bitrates: Record<number, number> = {
      2160: 15_000_000, // 15 Mbps for 4K
      1440: 9_000_000, // 9 Mbps for 1440p
      1080: 6_000_000, // 6 Mbps for 1080p
      720: 3_000_000, // 3 Mbps for 720p
      480: 1_500_000, // 1.5 Mbps for 480p
      360: 800_000, // 800 kbps for 360p
    };

    const bitrate = bitrates[height] ?? bitrates[720];
    const estimatedSizeBytes = (durationMinutes * 60 * (bitrate ?? 0)) / 8; // Convert to bytes

    return Math.floor(estimatedSizeBytes);
  }

  /**
   * Get download restrictions for an item
   */
  private getDownloadRestrictions(item: any): string[] {
    const restrictions: string[] = [];

    // Add content-specific restrictions
    if (!item.CanDownload) {
      restrictions.push(
        "This content cannot be downloaded due to restrictions",
      );
    }

    // Add quality restrictions
    const mediaSources = item.MediaSources ?? [];
    if (mediaSources.length === 0) {
      restrictions.push("No media sources available");
    }

    return restrictions;
  }

  /**
   * Get authentication for download requests
   */
  private getDownloadAuth(): {
    cookies?: string;
    token?: string;
    type?: "bearer" | "basic" | "custom";
  } {
    // Since we don't have access to the actual session type, we'll use API key
    if (this.config.apiKey) {
      return {
        token: this.config.apiKey,
        type: "bearer",
      };
    }

    return {};
  }

  /**
   * Get API key from config
   */
  private getApiKey(): string {
    return this.config.apiKey ?? "";
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
