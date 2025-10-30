import type { ServiceType } from "@/models/service.types";

/**
 * Mapping of service types to Homarr dashboard icon names (kebab-case).
 * Based on Homarr dashboard icons collection.
 */
const homarrIconNames: Record<ServiceType, string> = {
  sonarr: "sonarr",
  radarr: "radarr",
  lidarr: "lidarr",
  jellyseerr: "jellyseerr",
  jellyfin: "jellyfin",
  qbittorrent: "qbittorrent",
  transmission: "transmission",
  deluge: "deluge",
  sabnzbd: "sabnzbd",
  nzbget: "nzbget",
  rtorrent: "rtorrent",
  prowlarr: "prowlarr",
  bazarr: "bazarr",
  adguard: "adguard",
};

/**
 * Base URL for Homarr dashboard icons CDN.
 */
const HOMARR_ICONS_BASE_URL =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons";

/**
 * Gets the Homarr dashboard icon URL for a service type.
 * @param serviceType - The service type.
 * @param isDarkTheme - Whether the current theme is dark.
 * @returns The full URL to the SVG icon, or null if not available.
 */
export function getHomarrIconUrl(
  serviceType: ServiceType,
  isDarkTheme: boolean,
): string | null {
  const iconName = homarrIconNames[serviceType];
  if (!iconName) {
    return null;
  }

  // Use -light for dark themes, -dark for light themes
  const variant = isDarkTheme ? "-light" : "-dark";
  return `${HOMARR_ICONS_BASE_URL}/svg/${iconName}${variant}.svg`;
}

/**
 * Gets all unique Homarr icon URLs for the given service types and theme.
 * @param serviceTypes - Array of service types.
 * @param isDarkTheme - Whether the current theme is dark.
 * @returns Array of unique icon URLs.
 */
export function getHomarrIconUrls(
  serviceTypes: ServiceType[],
  isDarkTheme: boolean,
): string[] {
  const urls = serviceTypes
    .map((type) => getHomarrIconUrl(type, isDarkTheme))
    .filter((url): url is string => url !== null);

  // Remove duplicates
  return [...new Set(urls)];
}
