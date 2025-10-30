import AsyncStorage from "@react-native-async-storage/async-storage";
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
 * Storage key for caching icons tree data.
 */
const ICONS_CACHE_STORAGE_KEY = "@homarr_icons_cache";

/**
 * Cache duration for icons tree (6 hours in milliseconds).
 */
const ICONS_CACHE_DURATION = 6 * 60 * 60 * 1000;

/**
 * Cached icons tree data structure.
 */
interface IconsCache {
  data: Record<string, string[]>;
  timestamp: number;
}

/**
 * Fetches and caches the Homarr icons tree from CDN using AsyncStorage.
 */
async function fetchIconsTree(): Promise<Record<string, string[]> | null> {
  try {
    const now = Date.now();

    // Try to get cached data from AsyncStorage
    const cachedJson = await AsyncStorage.getItem(ICONS_CACHE_STORAGE_KEY);
    if (cachedJson) {
      const cache: IconsCache = JSON.parse(cachedJson);
      // Return cached data if still valid
      if (now - cache.timestamp < ICONS_CACHE_DURATION) {
        return cache.data;
      }
    }

    // Fetch fresh data
    const response = await fetch(`${HOMARR_ICONS_BASE_URL}/tree.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch icons tree: ${response.status}`);
    }

    const data = await response.json();

    // Cache the data in AsyncStorage
    const cacheToStore: IconsCache = {
      data,
      timestamp: now,
    };
    await AsyncStorage.setItem(
      ICONS_CACHE_STORAGE_KEY,
      JSON.stringify(cacheToStore),
    );

    return data;
  } catch (error) {
    console.warn("Failed to fetch Homarr icons tree:", error);

    // Try to return stale cached data if available
    try {
      const cachedJson = await AsyncStorage.getItem(ICONS_CACHE_STORAGE_KEY);
      if (cachedJson) {
        const cache: IconsCache = JSON.parse(cachedJson);
        return cache.data;
      }
    } catch (cacheError) {
      console.warn("Failed to read cached icons data:", cacheError);
    }

    return null;
  }
}

/**
 * Checks if a specific icon variant exists in the Homarr icons collection.
 * @param iconName - The base icon name.
 * @param variant - The variant suffix (e.g., "-light", "-dark").
 * @param format - The format to check ("svg" by default).
 * @returns True if the variant exists.
 */
async function iconVariantExists(
  iconName: string,
  variant: string,
  format = "png",
): Promise<boolean> {
  try {
    const iconsTree = await fetchIconsTree();
    if (!iconsTree || !iconsTree[format]) {
      return false;
    }

    const variantName = `${iconName}${variant}.${format}`;
    return iconsTree[format].includes(variantName);
  } catch (error) {
    console.warn("Failed to check icon variant existence:", error);
    return false;
  }
}

/**
 * Gets the Homarr dashboard icon URL for a service type.
 * @param serviceType - The service type.
 * @param isDarkTheme - Whether the current theme is dark.
 * @returns The full URL to the SVG icon, or null if not available.
 */
export async function getHomarrIconUrl(
  serviceType: ServiceType,
  isDarkTheme: boolean,
): Promise<string | null> {
  const iconName = homarrIconNames[serviceType];
  if (!iconName) {
    return null;
  }

  // Use PNG format since SVG has issues in React Native
  // Use -light for dark themes, -dark for light themes
  const variant = isDarkTheme ? "-light" : "-dark";

  const pngVariantExists = await iconVariantExists(iconName, variant, "png");
  if (pngVariantExists) {
    return `${HOMARR_ICONS_BASE_URL}/png/${iconName}${variant}.png`;
  }

  // Fall back to base PNG name if variant doesn't exist
  const pngBaseExists = await iconVariantExists(iconName, "", "png");
  if (pngBaseExists) {
    return `${HOMARR_ICONS_BASE_URL}/png/${iconName}.png`;
  }

  return null;
}

/**
 * Gets all unique Homarr icon URLs for the given service types and theme.
 * @param serviceTypes - Array of service types.
 * @param isDarkTheme - Whether the current theme is dark.
 * @returns Promise resolving to array of unique icon URLs.
 */
export async function getHomarrIconUrls(
  serviceTypes: ServiceType[],
  isDarkTheme: boolean,
): Promise<string[]> {
  const urlPromises = serviceTypes.map((type) =>
    getHomarrIconUrl(type, isDarkTheme),
  );
  const urls: (string | null)[] = await Promise.all(urlPromises);
  const filteredUrls = urls.filter((url): url is string => url !== null);

  // Remove duplicates
  return [...new Set(filteredUrls)];
}
