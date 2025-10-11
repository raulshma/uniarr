export type ServiceType =
  | 'sonarr'
  | 'radarr'
  | 'jellyseerr'
  | 'jellyfin'
  | 'qbittorrent'
  | 'transmission'
  | 'deluge'
  | 'sabnzbd'
  | 'nzbget'
  | 'rtorrent'
  | 'prowlarr'
  | 'bazarr';

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
