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
  JellyfinMediaSource,
  JellyfinPlaybackInfoResponse,
  JellyfinPlaybackStopInfo,
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
  "IndexNumber",
  "ParentIndexNumber",
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

  async getPlaybackInfo(
    itemId: string,
    options: {
      readonly mediaSourceId?: string;
      readonly audioStreamIndex?: number;
      readonly subtitleStreamIndex?: number;
      readonly maxStreamingBitrate?: number;
    } = {},
  ): Promise<{
    readonly playback: JellyfinPlaybackInfoResponse;
    readonly mediaSource: JellyfinMediaSource;
    readonly streamUrl: string;
  }> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    try {
      const params: Record<string, unknown> = {
        userId,
      };

      if (options.mediaSourceId) {
        params.mediaSourceId = options.mediaSourceId;
      }
      if (options.audioStreamIndex !== undefined) {
        params.audioStreamIndex = options.audioStreamIndex;
      }
      if (options.subtitleStreamIndex !== undefined) {
        params.subtitleStreamIndex = options.subtitleStreamIndex;
      }
      if (options.maxStreamingBitrate !== undefined) {
        params.maxStreamingBitrate = options.maxStreamingBitrate;
      }

      const response = await this.client.get<JellyfinPlaybackInfoResponse>(
        `/Items/${itemId}/PlaybackInfo`,
        { params },
      );

      const playback = response.data;

      if (!playback) {
        throw new Error("Jellyfin did not return playback information.");
      }

      const sources = Array.isArray(playback.MediaSources)
        ? (playback.MediaSources as JellyfinMediaSource[])
        : [];

      if (sources.length === 0) {
        throw new Error("No playable media sources were returned by Jellyfin.");
      }

      const mediaSource = options.mediaSourceId
        ? (sources.find(
            (candidate) => candidate?.Id === options.mediaSourceId,
          ) ?? sources[0]!)
        : sources[0]!;

      const selectedMediaSourceId = this.resolveMediaSourceId(
        mediaSource,
        itemId,
      );

      const requiresTranscoding = Boolean(
        mediaSource?.TranscodingUrl && mediaSource?.SupportsTranscoding,
      );
      const supportsDirectPlayback = Boolean(
        mediaSource?.SupportsDirectPlay ?? mediaSource?.SupportsDirectStream,
      );
      const useStaticStream = Boolean(
        supportsDirectPlayback &&
          !requiresTranscoding &&
          !mediaSource?.IsInfiniteStream,
      );

      const streamUrl = this.buildStreamUrl(itemId, selectedMediaSourceId, {
        isStatic: useStaticStream,
        context: useStaticStream ? "Static" : "Streaming",
        playSessionId: playback.PlaySessionId ?? undefined,
        audioStreamIndex: options.audioStreamIndex,
        subtitleStreamIndex: options.subtitleStreamIndex,
        maxStreamingBitrate: options.maxStreamingBitrate,
      });

      return {
        playback,
        mediaSource,
        streamUrl,
      };
    } catch (error) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async reportPlaybackStopped(options: {
    readonly itemId: string;
    readonly mediaSourceId: string;
    readonly playSessionId?: string;
    readonly positionTicks?: number;
  }): Promise<void> {
    await this.ensureAuthenticated();

    const payload: JellyfinPlaybackStopInfo = {
      ItemId: options.itemId,
      MediaSourceId: options.mediaSourceId,
      PositionTicks: options.positionTicks ?? 0,
      PlaySessionId: options.playSessionId ?? null,
      Failed: false,
    };

    try {
      await this.client.post("/Sessions/Playing/Stopped", payload);
    } catch (error) {
      await logger.warn("Failed to report Jellyfin playback stop.", {
        serviceId: this.config.id,
        itemId: options.itemId,
        mediaSourceId: options.mediaSourceId,
        error,
      });
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

      // Movies, episodes, and series can be downloaded
      if (
        item.Type !== "Movie" &&
        item.Type !== "Episode" &&
        item.Type !== "Series"
      ) {
        return {
          canDownload: false,
          resumable: false,
          restrictions: [
            `Content type '${item.Type}' is not supported for download`,
          ],
        };
      }

      // For series, check if there are episodes available
      if (item.Type === "Series") {
        const episodes = await this.getSeriesEpisodes(contentId);
        if (!episodes || episodes.length === 0) {
          return {
            canDownload: false,
            resumable: false,
            restrictions: ["No episodes available for download"],
            isSeries: true,
          };
        }

        return {
          canDownload: true,
          format: "Multiple Episodes",
          estimatedSize: undefined,
          resumable: true,
          restrictions: [],
          isSeries: true,
          episodeCount: episodes.length,
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
    episodeIds?: readonly string[],
  ): Promise<DownloadInfo> {
    await this.ensureAuthenticated();

    try {
      // Get item details
      const item = await this.getItem(contentId);

      // If this is a series and episodeIds are provided, download the first episode
      // and let the download manager queue the rest as individual downloads
      if (item.Type === "Series" && (!episodeIds || episodeIds.length === 0)) {
        throw new Error(
          "Cannot download series container. Download individual episodes instead.",
        );
      }

      // For series downloads with episodeIds, use the first episode
      let downloadItemId = contentId;
      if (item.Type === "Series" && episodeIds && episodeIds.length > 0) {
        const firstEpisodeId = episodeIds[0];
        if (firstEpisodeId) {
          downloadItemId = firstEpisodeId;
        }
      }

      // Get media sources for the download item
      const mediaSources = await this.getMediaSources(downloadItemId);
      if (!mediaSources || mediaSources.length === 0) {
        throw new Error("No media sources available for download");
      }

      // Select the appropriate media source based on quality preference
      const selectedSource = this.selectMediaSource(mediaSources, quality);

      // Get download URL
      const downloadUrl = await this.getDownloadUrl(
        downloadItemId,
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

  private buildStreamUrl(
    itemId: string,
    mediaSourceId: string,
    options: {
      readonly isStatic?: boolean;
      readonly context?: "Streaming" | "Static";
      readonly playSessionId?: string;
      readonly audioStreamIndex?: number;
      readonly subtitleStreamIndex?: number;
      readonly maxStreamingBitrate?: number;
      readonly startTimeTicks?: number;
    } = {},
  ): string {
    const base = this.getBaseUrl();
    const params = new URLSearchParams();

    params.append("mediaSourceId", mediaSourceId);
    params.append("deviceId", this.config.id || "UniArr");

    if (options.isStatic) {
      params.append("static", "true");
    }
    if (options.context) {
      params.append("context", options.context);
    }
    if (options.playSessionId) {
      params.append("playSessionId", options.playSessionId);
    }
    if (options.audioStreamIndex !== undefined) {
      params.append("audioStreamIndex", String(options.audioStreamIndex));
    }
    if (options.subtitleStreamIndex !== undefined) {
      params.append("subtitleStreamIndex", String(options.subtitleStreamIndex));
    }
    if (options.maxStreamingBitrate !== undefined) {
      params.append("maxStreamingBitrate", String(options.maxStreamingBitrate));
    }
    if (options.startTimeTicks !== undefined) {
      params.append("startTimeTicks", String(options.startTimeTicks));
    }

    const apiKey = this.getApiKey();
    if (apiKey) {
      params.append("api_key", apiKey);
    }

    return `${base}/Videos/${itemId}/stream?${params.toString()}`;
  }

  private resolveMediaSourceId(
    mediaSource: JellyfinMediaSource | undefined,
    itemId: string,
  ): string {
    if (mediaSource?.Id && mediaSource.Id.length > 0) {
      return mediaSource.Id;
    }

    return itemId;
  }

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
   * Note: This endpoint only works for playable items (movies, episodes).
   * Series and other container types will return an empty array.
   */
  private async getMediaSources(itemId: string): Promise<any[]> {
    try {
      // First check if the item is a Series or other non-playable type
      const item = await this.getItem(itemId);

      // Series and other container types don't have media sources
      if (
        item.Type === "Series" ||
        item.Type === "Folder" ||
        item.Type === "BoxSet"
      ) {
        return [];
      }

      // Only playable items (Movie, Episode, etc.) have PlaybackInfo
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
   * Get episodes for a TV series
   */
  async getSeriesEpisodes(seriesId: string): Promise<JellyfinItem[]> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const episodes: JellyfinItem[] = [];
    const pageSize = 200;
    let startIndex = 0;

    try {
      // Jellyfin exposes a dedicated endpoint to enumerate all episodes for a series.
      // Page through results to avoid truncation on shows with large libraries.
      while (true) {
        const response = await this.client.get<JellyfinItemsResponse>(
          `/Shows/${seriesId}/Episodes`,
          {
            params: {
              userId,
              fields: DEFAULT_ITEM_FIELDS.split(","),
              enableImages: true,
              sortBy: "ParentIndexNumber,IndexNumber",
              sortOrder: "Ascending",
              startIndex,
              limit: pageSize,
            },
          },
        );

        const batch = Array.isArray(response.data?.Items)
          ? (response.data?.Items as JellyfinItem[])
          : [];

        if (batch.length === 0) {
          break;
        }

        episodes.push(...batch);

        const total = response.data?.TotalRecordCount;
        startIndex += batch.length;

        if (!total || episodes.length >= total || batch.length < pageSize) {
          break;
        }
      }

      return episodes;
    } catch (error) {
      logger.error("Failed to get series episodes", {
        seriesId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async getNextUpEpisode(
    seriesId: string,
    currentItemId?: string,
  ): Promise<JellyfinItem | undefined> {
    await this.ensureAuthenticated();
    const userId = await this.ensureUserId();

    const params: Record<string, unknown> = {
      userId,
      seriesId,
      enableImages: true,
      fields: DEFAULT_ITEM_FIELDS,
      limit: 3,
    };

    if (currentItemId) {
      params.startItemId = currentItemId;
    }

    try {
      const response = await this.client.get<JellyfinItemsResponse>(
        "/Shows/NextUp",
        { params },
      );

      const items = Array.isArray(response.data?.Items)
        ? (response.data.Items as JellyfinItem[])
        : [];

      const candidate = items.find((item) => item?.Id !== currentItemId);
      if (candidate) {
        return candidate;
      }
    } catch (error) {
      void logger.debug("Failed to fetch Jellyfin next up episode", {
        seriesId,
        currentItemId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!currentItemId) {
      return undefined;
    }

    try {
      const episodes = await this.getSeriesEpisodes(seriesId);
      if (episodes.length === 0) {
        return undefined;
      }

      const currentIndex = episodes.findIndex(
        (episode) => episode?.Id === currentItemId,
      );

      if (currentIndex >= 0 && currentIndex + 1 < episodes.length) {
        return episodes[currentIndex + 1]!;
      }
    } catch (error) {
      void logger.debug("Failed to resolve Jellyfin next episode fallback", {
        seriesId,
        currentItemId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return undefined;
  }

  /**
   * Get download URL for a media source
   */
  private async getDownloadUrl(
    itemId: string,
    mediaSourceId: string,
  ): Promise<string> {
    const effectiveMediaSourceId =
      typeof mediaSourceId === "string" && mediaSourceId.length > 0
        ? mediaSourceId
        : itemId;

    return this.buildStreamUrl(itemId, effectiveMediaSourceId, {
      isStatic: true,
    });
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
