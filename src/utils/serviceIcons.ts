export const serviceIcons: Record<string, string> = {
  sonarr: "television-classic",
  radarr: "movie-open",
  lidarr: "music-note",
  jellyseerr: "account-search",
  jellyfin: "play-circle",
  qbittorrent: "download-network",
  transmission: "download-network",
  deluge: "download-network",
  sabnzbd: "download-network",
  nzbget: "download-network",
  rtorrent: "download-network",
  prowlarr: "radar",
  bazarr: "subtitles",
  adguard: "shield-check",
  readarr: "book-open-variant",
  whisparr: "filmstrip",
  jackett: "magnify-expand",
  nzbhydra: "magnify",
  homarr: "view-dashboard",
  overseerr: "application-variable-outline",
};

export const getIconForServiceType = (serviceType: string): string => {
  return serviceIcons[serviceType] || "server";
};
