export type ServiceType =
  | "sonarr"
  | "radarr"
  | "lidarr"
  | "jellyseerr"
  | "jellyfin"
  | "qbittorrent"
  | "transmission"
  | "deluge"
  | "sabnzbd"
  | "nzbget"
  | "rtorrent"
  | "prowlarr"
  | "bazarr"
  | "adguard";

/**
 * Service capability flags
 */
export interface ServiceCapabilities {
  /** Whether the service supports downloading content */
  readonly supportsDownloads: boolean;
  /** Whether the service supports searching content */
  readonly supportsSearch: boolean;
  /** Whether the service provides media metadata */
  readonly providesMetadata: boolean;
  /** Whether the service can manage torrents/downloads */
  readonly managesDownloads: boolean;
  /** Whether the service provides notifications */
  readonly providesNotifications: boolean;
  /** Whether the service supports remote control */
  readonly supportsRemoteControl: boolean;
}

/**
 * Predefined capability sets for different service types
 */
export const SERVICE_CAPABILITIES: Record<ServiceType, ServiceCapabilities> = {
  // Media management services
  sonarr: {
    supportsDownloads: false,
    supportsSearch: true,
    providesMetadata: true,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: false,
  },
  radarr: {
    supportsDownloads: false,
    supportsSearch: true,
    providesMetadata: true,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: false,
  },
  lidarr: {
    supportsDownloads: false,
    supportsSearch: true,
    providesMetadata: true,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: false,
  },

  // Request services
  jellyseerr: {
    supportsDownloads: false,
    supportsSearch: true,
    providesMetadata: true,
    managesDownloads: false,
    providesNotifications: true,
    supportsRemoteControl: false,
  },

  // Media servers
  jellyfin: {
    supportsDownloads: true,
    supportsSearch: true,
    providesMetadata: true,
    managesDownloads: false,
    providesNotifications: true,
    supportsRemoteControl: true,
  },

  // Download clients
  qbittorrent: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: true,
  },
  transmission: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: true,
  },
  deluge: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: true,
  },
  sabnzbd: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: true,
  },
  nzbget: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: true,
  },
  rtorrent: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: true,
    providesNotifications: true,
    supportsRemoteControl: true,
  },

  // Indexing/search services
  prowlarr: {
    supportsDownloads: false,
    supportsSearch: true,
    providesMetadata: true,
    managesDownloads: false,
    providesNotifications: false,
    supportsRemoteControl: false,
  },

  // Subtitle services
  bazarr: {
    supportsDownloads: true, // Can download subtitles
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: false,
    providesNotifications: true,
    supportsRemoteControl: false,
  },

  // Network services
  adguard: {
    supportsDownloads: false,
    supportsSearch: false,
    providesMetadata: false,
    managesDownloads: false,
    providesNotifications: false,
    supportsRemoteControl: true,
  },
};

/**
 * Helper function to check if a service type supports downloads
 */
export function serviceSupportsDownloads(serviceType: ServiceType): boolean {
  return SERVICE_CAPABILITIES[serviceType]?.supportsDownloads ?? false;
}

/**
 * Helper function to get all service types that support downloads
 */
export function getDownloadSupportedServiceTypes(): ServiceType[] {
  return Object.entries(SERVICE_CAPABILITIES)
    .filter(([, capabilities]) => capabilities.supportsDownloads)
    .map(([serviceType]) => serviceType as ServiceType);
}

/**
 * Helper function to get capabilities for a service type
 */
export function getServiceCapabilities(
  serviceType: ServiceType,
): ServiceCapabilities {
  return (
    SERVICE_CAPABILITIES[serviceType] ?? {
      supportsDownloads: false,
      supportsSearch: false,
      providesMetadata: false,
      managesDownloads: false,
      providesNotifications: false,
      supportsRemoteControl: false,
    }
  );
}

export interface ServiceConfig {
  id: string;
  name: string;
  type: ServiceType;
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  proxyUrl?: string;
  timeout?: number;
  defaultProfileId?: number;
  defaultRootFolderPath?: string;
  /**
   * Jellyseerr-specific mapping of downstream target server id -> defaults
   * The keys are downstream server ids (stringified), values hold optional
   * profileId and rootFolderPath to apply when creating requests for that
   * specific target inside a Jellyseerr server.
   */
  jellyseerrTargetDefaults?: Record<
    string,
    { profileId?: number; rootFolderPath?: string }
  >;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended service configuration with capability information
 */
export interface ExtendedServiceConfig extends ServiceConfig {
  /** Pre-computed capabilities for this service */
  readonly capabilities: ServiceCapabilities;
}

/**
 * Helper function to create an extended service config
 */
export function createExtendedServiceConfig(
  config: ServiceConfig,
): ExtendedServiceConfig {
  return {
    ...config,
    capabilities: getServiceCapabilities(config.type),
  };
}
