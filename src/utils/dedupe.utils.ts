/**
 * Cross-service deduplication utilities for media items.
 * Deduplicates items based on external IDs (TMDB, TVDB, IMDB) and falls back to service-native IDs.
 */

import type { ServiceType } from "@/models/service.types";

export interface DedupeItem {
  serviceId: string;
  serviceType: ServiceType;
  serviceName?: string;
  externalIds?: {
    tmdb?: number;
    imdb?: string;
    tvdb?: number;
  };
  // Service-native identifier
  nativeId?: string | number;
  // For episodes: the series ID to group them together
  seriesId?: number;
  // For episodes: episode number
  episodeNumber?: number;
}

/**
 * Creates a normalized cross-service deduplication key from external IDs and native IDs.
 * Prioritizes external IDs (TMDB > TVDB > IMDB) and falls back to service-native ID.
 * For episodes, appends the episode number to create unique keys per episode.
 *
 * @param item - The item to create a key for
 * @param isEpisode - Whether this is an episode (uses seriesId if true)
 * @returns A normalized string key for deduplication
 */
export function createCrossServiceKey(
  item: DedupeItem,
  isEpisode: boolean = false,
): string {
  const parts: string[] = [];

  // For episodes, use the series ID as the primary key
  if (isEpisode && item.seriesId) {
    parts.push(`series-${item.seriesId}`);
    if (item.episodeNumber !== undefined) {
      parts.push(`ep-${item.episodeNumber}`);
    }
  } else {
    // For non-episodes, prefer external IDs in order: TMDB > TVDB > IMDB > native ID
    if (item.externalIds?.tmdb) {
      parts.push(`tmdb-${item.externalIds.tmdb}`);
    } else if (item.externalIds?.tvdb) {
      parts.push(`tvdb-${item.externalIds.tvdb}`);
    } else if (item.externalIds?.imdb) {
      parts.push(`imdb-${item.externalIds.imdb}`);
    } else if (item.nativeId) {
      // Fall back to service-native ID
      parts.push(`${item.serviceType}-${item.nativeId}`);
    }
  }

  // If we still have no key, create a unique one based on service and native ID
  if (parts.length === 0) {
    if (item.nativeId) {
      parts.push(`${item.serviceType}-${item.nativeId}`);
    } else {
      // Fallback to service ID (shouldn't happen in practice)
      parts.push(item.serviceId);
    }
  }

  return parts.join(":").toLowerCase();
}

/**
 * Merges multiple origins into a single aggregated record.
 * This is used when the same media item appears across multiple services.
 *
 * @param existingOrigins - Already collected origins
 * @param newOrigin - The new origin to potentially add
 * @returns Updated origins array, avoiding duplicates by serviceId
 */
export function mergeOrigins(
  existingOrigins: DedupeItem[],
  newOrigin: DedupeItem,
): DedupeItem[] {
  // Check if this service already has this item recorded
  const isDuplicate = existingOrigins.some(
    (origin) => origin.serviceId === newOrigin.serviceId,
  );

  if (!isDuplicate) {
    existingOrigins.push(newOrigin);
  }

  return existingOrigins;
}
