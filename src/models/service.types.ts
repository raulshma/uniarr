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
  createdAt: Date;
  updatedAt: Date;
}
