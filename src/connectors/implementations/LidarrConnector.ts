import { BaseConnector } from "@/connectors/base/BaseConnector";
import { logger } from "@/services/logger/LoggerService";
import type {
  AddArtistRequest,
  Album,
  AlbumStatistics,
  Artist,
  ArtistStatistics,
  MetadataProfile,
  MusicQualityProfile,
  Quality,
  RootFolder,
  Track,
} from "@/models/media.types";
import type { SearchOptions } from "@/connectors/base/IConnector";
import { handleApiError } from "@/utils/error.utils";

export interface LidarrQueueItem {
  readonly id: number;
  readonly artistId: number;
  readonly artistName?: string;
  readonly albumId?: number;
  readonly albumTitle?: string;
  readonly trackId?: number;
  readonly trackTitle?: string;
  readonly status?: string;
  readonly trackedDownloadState?: string;
  readonly trackedDownloadStatus?: string;
  readonly downloadId?: string;
  readonly protocol?: string;
  readonly size?: number;
  readonly sizeleft?: number;
  readonly timeleft?: string;
}

interface LidarrArtistEditor {
  readonly artistIds: number[];
  readonly monitored?: boolean;
  readonly qualityProfileId?: number;
  readonly metadataProfileId?: number;
  readonly tags?: number[];
}

interface LidarrAlbumEditor {
  readonly albumIds: number[];
  readonly monitored?: boolean;
  readonly tags?: number[];
}

export class LidarrConnector extends BaseConnector<Artist, AddArtistRequest> {
  async initialize(): Promise<void> {
    logger.debug("[LidarrConnector] Initializing", {
      serviceId: this.config.id,
    });
    await this.getVersion();
    logger.debug("[LidarrConnector] Initialization completed", {
      serviceId: this.config.id,
    });
  }

  async getVersion(): Promise<string> {
    try {
      const fullUrl = `${this.config.url}/api/v1/system/status`;
      logger.debug("[LidarrConnector] Getting version", {
        serviceId: this.config.id,
        url: fullUrl,
      });

      const response = await this.client.get("/api/v1/system/status");
      const version = response.data.version ?? "unknown";
      logger.debug("[LidarrConnector] Version retrieved", {
        serviceId: this.config.id,
        version,
        status: response.status,
      });
      return version;
    } catch (error) {
      logger.error("[LidarrConnector] Version request failed", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
        endpoint: "/api/v1/system/status",
      });
    }
  }

  async getArtists(): Promise<Artist[]> {
    try {
      const response = await this.client.get("/api/v1/artist");
      return response.data.map((item: any) => this.mapArtist(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getArtists",
        endpoint: "/api/v1/artist",
      });
    }
  }

  async search(query: string, options?: SearchOptions): Promise<Artist[]> {
    try {
      const params: Record<string, unknown> = { term: query };

      if (options?.filters) {
        Object.assign(params, options.filters);
      }

      const response = await this.client.get("/api/v1/artist/lookup", {
        params,
      });

      return response.data.map((item: any) => this.mapArtist(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "search",
        endpoint: "/api/v1/artist/lookup",
      });
    }
  }

  async getById(id: number): Promise<Artist> {
    try {
      const [artistResponse, albumsResponse] = await Promise.all([
        this.client.get(`/api/v1/artist/${id}`),
        this.client.get("/api/v1/album", {
          params: { artistId: id, includeAllArtistAlbums: true },
        }),
      ]);

      const artistData = this.mapArtist(artistResponse.data);
      const albums = albumsResponse.data.map((album: any) => ({
        ...this.mapAlbum(album),
        tracks: [], // Tracks loaded separately when needed
      }));

      return {
        ...artistData,
        albums,
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getById",
        endpoint: `/api/v1/artist/${id}`,
      });
    }
  }

  async add(request: AddArtistRequest): Promise<Artist> {
    try {
      const payload = this.buildAddPayload(request);
      const response = await this.client.post("/api/v1/artist", payload);
      return this.mapArtist(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "add",
        endpoint: "/api/v1/artist",
      });
    }
  }

  async triggerSearch(artistId: number): Promise<void> {
    try {
      await this.client.post("/api/v1/command", {
        name: "ArtistSearch",
        artistId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "triggerSearch",
        endpoint: "/api/v1/command",
      });
    }
  }

  async setMonitored(artistId: number, monitored: boolean): Promise<void> {
    try {
      await this.client.put(`/api/v1/artist/${artistId}`, {
        monitored,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setMonitored",
        endpoint: `/api/v1/artist/${artistId}`,
      });
    }
  }

  async deleteArtist(
    artistId: number,
    options: { deleteFiles?: boolean; addImportListExclusion?: boolean } = {},
  ): Promise<void> {
    try {
      const params = {
        deleteFiles: options.deleteFiles ?? false,
        addImportListExclusion: options.addImportListExclusion ?? false,
      };

      await this.client.delete(`/api/v1/artist/${artistId}`, {
        params,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteArtist",
        endpoint: `/api/v1/artist/${artistId}`,
      });
    }
  }

  async updateArtist(
    artistId: number,
    updates: Partial<Omit<any, "id" | "statistics" | "albums">>,
  ): Promise<Artist> {
    try {
      const response = await this.client.put(
        `/api/v1/artist/${artistId}`,
        updates,
      );
      return this.mapArtist(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateArtist",
        endpoint: `/api/v1/artist/${artistId}`,
      });
    }
  }

  async refreshArtist(artistId: number): Promise<void> {
    try {
      await this.client.post("/api/v1/command", {
        name: "RefreshArtist",
        artistId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "refreshArtist",
        endpoint: "/api/v1/command",
      });
    }
  }

  async rescanArtist(artistId: number): Promise<void> {
    try {
      await this.client.post("/api/v1/command", {
        name: "RescanArtist",
        artistId,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanArtist",
        endpoint: "/api/v1/command",
      });
    }
  }

  async getAlbums(artistId?: number): Promise<Album[]> {
    try {
      const params: Record<string, unknown> = {};
      if (artistId) {
        params.artistId = artistId;
      }

      const response = await this.client.get("/api/v1/album", { params });
      return response.data.map((album: any) => this.mapAlbum(album));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAlbums",
        endpoint: "/api/v1/album",
      });
    }
  }

  async getAlbumById(albumId: number): Promise<Album> {
    try {
      const [albumResponse, tracksResponse] = await Promise.all([
        this.client.get(`/api/v1/album/${albumId}`),
        this.client.get("/api/v1/track", {
          params: { albumId },
        }),
      ]);

      const albumData = this.mapAlbum(albumResponse.data);
      const tracks = tracksResponse.data.map((track: any) =>
        this.mapTrack(track),
      );

      return {
        ...albumData,
        tracks,
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getAlbumById",
        endpoint: `/api/v1/album/${albumId}`,
      });
    }
  }

  async searchAlbums(query: string): Promise<Album[]> {
    try {
      const response = await this.client.get("/api/v1/album/lookup", {
        params: { term: query },
      });

      return response.data.map((album: any) => this.mapAlbum(album));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "searchAlbums",
        endpoint: "/api/v1/album/lookup",
      });
    }
  }

  async setAlbumMonitored(albumId: number, monitored: boolean): Promise<void> {
    try {
      await this.client.put(`/api/v1/album/${albumId}`, {
        monitored,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "setAlbumMonitored",
        endpoint: `/api/v1/album/${albumId}`,
      });
    }
  }

  async getTags(): Promise<any[]> {
    try {
      const response = await this.client.get("/api/v1/tag");
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTags",
        endpoint: "/api/v1/tag",
      });
    }
  }

  async createTag(label: string): Promise<any> {
    try {
      const response = await this.client.post("/api/v1/tag", { label });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "createTag",
        endpoint: "/api/v1/tag",
      });
    }
  }

  async updateTag(tagId: number, label: string): Promise<any> {
    try {
      const response = await this.client.put(`/api/v1/tag/${tagId}`, {
        id: tagId,
        label,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateTag",
        endpoint: `/api/v1/tag/${tagId}`,
      });
    }
  }

  async deleteTag(tagId: number): Promise<void> {
    try {
      await this.client.delete(`/api/v1/tag/${tagId}`);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTag",
        endpoint: `/api/v1/tag/${tagId}`,
      });
    }
  }

  async getQualityProfiles(): Promise<MusicQualityProfile[]> {
    try {
      const response = await this.client.get("/api/v1/qualityprofile");
      return response.data.map((profile: any) =>
        this.mapQualityProfile(profile),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQualityProfiles",
        endpoint: "/api/v1/qualityprofile",
      });
    }
  }

  async getMetadataProfiles(): Promise<MetadataProfile[]> {
    try {
      const response = await this.client.get("/api/v1/metadataProfile");
      return response.data.map((profile: any) =>
        this.mapMetadataProfile(profile),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getMetadataProfiles",
        endpoint: "/api/v1/metadataProfile",
      });
    }
  }

  async getRootFolders(): Promise<RootFolder[]> {
    try {
      const response = await this.client.get("/api/v1/rootfolder");
      return response.data.map((folder: any) => this.mapRootFolder(folder));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getRootFolders",
        endpoint: "/api/v1/rootfolder",
      });
    }
  }

  async getCalendar(
    start?: string,
    end?: string,
    unmonitored?: boolean,
  ): Promise<any[]> {
    try {
      const params: Record<string, unknown> = {
        includeArtist: true,
        includeAlbum: true,
      };
      if (start) params.start = start;
      if (end) params.end = end;
      if (unmonitored !== undefined) params.unmonitored = unmonitored;

      const response = await this.client.get("/api/v1/calendar", { params });
      return response.data ?? [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getCalendar",
        endpoint: "/api/v1/calendar",
      });
    }
  }

  async getQueue(): Promise<LidarrQueueItem[]> {
    try {
      const response = await this.client.get("/api/v1/queue");
      return (response.data.records ?? []).map((record: any) =>
        this.mapQueueRecord(record),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQueue",
        endpoint: "/api/v1/queue",
      });
    }
  }

  async getHistory(options?: {
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    try {
      const params: Record<string, unknown> = {};
      if (options?.page) params.page = options.page;
      if (options?.pageSize) params.pageSize = options.pageSize;
      params.includeArtist = true;
      params.includeAlbum = true;
      params.sortKey = "date";
      params.sortDirection = "descending";

      const response = await this.client.get("/api/v1/history", { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHistory",
        endpoint: "/api/v1/history",
      });
    }
  }

  async bulkUpdateArtists(editor: LidarrArtistEditor): Promise<void> {
    try {
      await this.client.put("/api/v1/artist/editor", editor);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateArtists",
        endpoint: "/api/v1/artist/editor",
      });
    }
  }

  async bulkUpdateAlbums(editor: LidarrAlbumEditor): Promise<void> {
    try {
      await this.client.put("/api/v1/album/editor", editor);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateAlbums",
        endpoint: "/api/v1/album/editor",
      });
    }
  }

  private buildAddPayload(request: AddArtistRequest): Record<string, unknown> {
    return {
      foreignArtistId: request.foreignArtistId,
      artistName: request.artistName,
      overview: request.overview,
      path: request.path,
      qualityProfileId: request.qualityProfileId,
      metadataProfileId: request.metadataProfileId,
      monitored: request.monitored ?? true,
      rootFolderPath: request.rootFolderPath,
      tags: request.tags,
      addOptions: {
        monitor: request.addOptions?.monitor ?? "all",
        searchForMissingAlbums:
          request.searchNow ??
          request.addOptions?.searchForMissingAlbums ??
          false,
      },
    };
  }

  private mapArtist(data: any): Artist {
    const posterUrl = this.findImageUrl(data.images, "poster");
    const fanartUrl = this.findImageUrl(data.images, "fanart");

    return {
      id: data.id ?? 0,
      title: data.artistName ?? data.title ?? "",
      sortTitle: data.sortTitle ?? undefined,
      status: data.status ?? "unknown",
      ended: data.ended ?? false,
      artistName: data.artistName ?? "",
      overview: data.overview ?? undefined,
      disambiguation: data.disambiguation ?? undefined,
      foreignArtistId: data.foreignArtistId ?? undefined,
      path: data.path ?? undefined,
      qualityProfileId: data.qualityProfileId ?? undefined,
      metadataProfileId: data.metadataProfileId ?? undefined,
      monitored: Boolean(data.monitored),
      images: data.images ?? undefined,
      links: data.links ?? undefined,
      genres: data.genres ?? undefined,
      added: data.added ?? undefined,
      ratings: data.ratings ?? undefined,
      albumCount: data.statistics?.albumCount,
      statistics: this.mapArtistStatistics(data.statistics),
      posterUrl,
      fanartUrl,
    };
  }

  private mapAlbum(data: any): Album {
    const posterUrl = this.findImageUrl(data.images, "cover");
    const fanartUrl = this.findImageUrl(data.images, "backdrop");

    return {
      id: data.id ?? 0,
      title: data.title ?? "",
      sortTitle: data.sortTitle ?? undefined,
      releaseDate: data.releaseDate ?? undefined,
      albumType: data.albumType ?? "Album",
      status: data.status ?? "unknown",
      overview: data.overview ?? undefined,
      disambiguation: data.disambiguation ?? undefined,
      foreignAlbumId: data.foreignAlbumId ?? undefined,
      artistId: data.artistId ?? 0,
      artist: data.artist ? this.mapArtist(data.artist) : undefined,
      qualityProfileId: data.qualityProfileId ?? undefined,
      monitored: Boolean(data.monitored),
      anyReleaseOk: data.anyReleaseOk ?? false,
      profileId: data.profileId ?? undefined,
      path: data.path ?? undefined,
      tags: data.tags ?? undefined,
      images: data.images ?? undefined,
      links: data.links ?? undefined,
      genres: data.genres ?? undefined,
      added: data.added ?? undefined,
      ratings: data.ratings ?? undefined,
      trackCount: data.statistics?.trackCount,
      releaseCount: data.releaseCount ?? undefined,
      statistics: this.mapAlbumStatistics(data.statistics),
      posterUrl,
      fanartUrl,
    };
  }

  private mapTrack(data: any): Track {
    return {
      id: data.id ?? 0,
      title: data.title ?? "",
      duration: data.duration ?? undefined,
      mediumNumber: data.mediumNumber ?? undefined,
      trackNumber: data.trackNumber ?? undefined,
      absoluteTrackNumber: data.absoluteTrackNumber ?? undefined,
      artistId: data.artistId ?? 0,
      artist: data.artist ? this.mapArtist(data.artist) : undefined,
      albumId: data.albumId ?? 0,
      album: data.album ? this.mapAlbum(data.album) : undefined,
      releaseId: data.releaseId ?? undefined,
      mediumId: data.mediumId ?? undefined,
      hasFile: Boolean(data.hasFile),
      trackFileId: data.trackFileId ?? undefined,
      quality: data.quality ? this.mapQuality(data.quality) : undefined,
      monitored: Boolean(data.monitored),
      ratings: data.ratings ?? undefined,
      genre: data.genre ?? undefined,
      relativePath: data.relativePath ?? undefined,
      sizeInMB: data.size ? data.size / (1024 * 1024) : undefined,
    };
  }

  private mapArtistStatistics(statistics?: any): ArtistStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      albumCount: statistics.albumCount ?? 0,
      trackFileCount: statistics.trackFileCount ?? 0,
      trackCount: statistics.trackCount ?? 0,
      totalTrackCount: statistics.totalTrackCount ?? 0,
      sizeOnDisk: statistics.sizeOnDisk ?? 0,
      percentOfTracks: statistics.percentOfTracks ?? 0,
    };
  }

  private mapAlbumStatistics(statistics?: any): AlbumStatistics | undefined {
    if (!statistics) {
      return undefined;
    }

    return {
      trackFileCount: statistics.trackFileCount ?? 0,
      trackCount: statistics.trackCount ?? 0,
      sizeOnDisk: statistics.sizeOnDisk ?? 0,
      percentOfTracks: statistics.percentOfTracks ?? 0,
    };
  }

  private mapQuality(data: any): Quality {
    return {
      id: data.id ?? 0,
      name: data.name ?? "Unknown",
      source: data.source ?? undefined,
      resolution: data.resolution ?? 0,
      sort: data.sort ?? 0,
    };
  }

  private mapQualityProfile(profile: any): MusicQualityProfile {
    return {
      id: profile.id ?? 0,
      name: profile.name ?? "",
      upgradeAllowed: profile.upgradeAllowed ?? false,
      cutoff: profile.cutoff ? this.mapQuality(profile.cutoff) : undefined,
      items: profile.items?.map((item: any) =>
        this.mapQualityProfileItem(item),
      ),
    };
  }

  private mapQualityProfileItem(item: any): any {
    return {
      allowed: Boolean(item.allowed),
      quality: item.quality ? this.mapQuality(item.quality) : undefined,
      items: item.items?.map((subItem: any) =>
        this.mapQualityProfileItem(subItem),
      ),
    };
  }

  private mapMetadataProfile(profile: any): MetadataProfile {
    return {
      id: profile.id ?? 0,
      name: profile.name ?? "",
      primaryAlbumType: profile.primaryAlbumType ?? "Album",
      secondaryAlbumTypes: profile.secondaryAlbumTypes ?? [],
    };
  }

  private mapRootFolder(folder: any): RootFolder {
    return {
      id: folder.id ?? 0,
      path: folder.path ?? "",
      accessible: folder.accessible ?? undefined,
      freeSpace: folder.freeSpace ?? undefined,
    };
  }

  private findImageUrl(
    images: any[] | null | undefined,
    type: string,
  ): string | undefined {
    return (
      images?.find((image) => image.coverType === type)?.remoteUrl ?? undefined
    );
  }

  private mapQueueRecord(record: any): LidarrQueueItem {
    return {
      id: record.id ?? 0,
      artistId: record.artist?.id ?? 0,
      artistName: record.artist?.artistName ?? record.artist?.name ?? undefined,
      albumId: record.album?.id,
      albumTitle: record.album?.title ?? undefined,
      trackId: record.track?.id,
      trackTitle: record.track?.title ?? undefined,
      status: record.status,
      trackedDownloadState: record.trackedDownloadState,
      trackedDownloadStatus: record.trackedDownloadStatus,
      downloadId: record.downloadId ?? undefined,
      protocol: record.protocol,
      size: record.size,
      sizeleft: record.sizeleft,
      timeleft: record.timeleft ?? undefined,
    };
  }
}
