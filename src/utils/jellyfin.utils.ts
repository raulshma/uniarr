import type { ServiceConfig } from "@/models/service.types";

/**
 * Extracts the Jellyfin server URL from a service configuration.
 * This URL can be used as both local and public address for Jellyfin deep linking.
 *
 * @param config - The Jellyfin service configuration
 * @returns The base URL for Jellyfin, or undefined if the configuration is invalid
 */
export const extractJellyfinAddress = (
  config: ServiceConfig,
): string | undefined => {
  if (config.type !== "jellyfin" || !config.url) {
    return undefined;
  }

  // Ensure the URL has a valid scheme
  if (!config.url.startsWith("http://") && !config.url.startsWith("https://")) {
    return undefined;
  }

  return config.url;
};
