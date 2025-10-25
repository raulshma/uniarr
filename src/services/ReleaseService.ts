import type { NormalizedRelease } from "@/models/discover.types";
import { logger } from "@/services/logger/LoggerService";

/**
 * Scoring heuristics for ranking releases.
 * Quality is prioritized over seeders to encourage best quality selection.
 */
interface RankingPreferences {
  preferQuality?: boolean; // Default true: rank by quality first, then seeders
  minSeeders?: number; // Minimum seeders threshold (default: 0, no filter)
}

/**
 * Extracts a numeric quality score from a quality name.
 * Used for ranking releases by quality tier.
 */
const getQualityScore = (qualityName?: string): number => {
  if (!qualityName) return 0;
  const lower = qualityName.toLowerCase();

  // Higher scores = better quality
  const scoreMap: Record<string, number> = {
    "4k": 100,
    "1080p": 90,
    "720p": 75,
    "480p": 50,
    "320p": 25,
    web: 70,
    bluray: 95,
    dvd: 60,
    h264: 60,
    h265: 80,
    hevc: 80,
  };

  // Try exact match first
  if (lower in scoreMap) {
    return scoreMap[lower] ?? 50;
  }

  // Try substring match
  for (const [key, score] of Object.entries(scoreMap)) {
    if (lower.includes(key)) {
      return score;
    }
  }

  return 50; // Default neutral score
};

/**
 * Computes a single numeric score for a release based on quality and seeders.
 */
const computeReleaseScore = (
  release: NormalizedRelease,
  preferences: RankingPreferences,
): number => {
  if (!release) return -Infinity;

  const qualityScore = getQualityScore(release.quality?.name);
  const seederScore = Math.min(
    (release.seeders ?? 0) / 10, // Normalize seeders to 0-10 range
    10,
  ); // Cap at 10

  if (preferences.preferQuality) {
    // Quality weighted 70%, seeders 30%
    return qualityScore * 0.7 + seederScore * 0.3;
  }

  // Seeders weighted 70%, quality 30%
  return seederScore * 0.7 + qualityScore * 0.3;
};

/**
 * Merges releases from multiple sources, deduplicates by title, and ranks by score.
 */
export const mergeAndRankReleases = (
  releases: NormalizedRelease[],
  preferences: RankingPreferences = { preferQuality: true },
): NormalizedRelease[] => {
  if (!Array.isArray(releases)) {
    logger.warn("mergeAndRankReleases: invalid releases input", {
      type: typeof releases,
    });
    return [];
  }

  // Deduplicate by title + indexer (allow same title from different indexers)
  const deduped = new Map<string, NormalizedRelease>();
  for (const release of releases) {
    if (!release || !release.title) continue;

    const key = `${release.title}|${release.indexer ?? "unknown"}`;
    if (!deduped.has(key)) {
      deduped.set(key, release);
    } else {
      // If duplicate, keep the one with higher seeders
      const existing = deduped.get(key)!;
      const existingSeeds = existing.seeders ?? 0;
      const newSeeds = release.seeders ?? 0;
      if (newSeeds > existingSeeds) {
        deduped.set(key, release);
      }
    }
  }

  // Compute scores and filter by minimum seeders
  const scored = Array.from(deduped.values())
    .filter((release) => {
      if (
        preferences.minSeeders !== undefined &&
        (release.seeders ?? 0) < preferences.minSeeders
      ) {
        return false;
      }
      return true;
    })
    .map((release) => ({
      ...release,
      score: computeReleaseScore(release, preferences),
    }));

  // Sort by score descending
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return scored;
};

/**
 * Filters releases by a minimum quality threshold (e.g., "720p" or better).
 */
export const filterReleasesByQuality = (
  releases: NormalizedRelease[],
  minQuality?: string,
): NormalizedRelease[] => {
  if (!minQuality) return releases;

  const minScore = getQualityScore(minQuality);

  return releases.filter((release) => {
    const releaseScore = getQualityScore(release.quality?.name);
    return releaseScore >= minScore;
  });
};

/**
 * Normalizes a Radarr ReleaseResource response to NormalizedRelease shape.
 */
export const normalizeRadarrRelease = (
  release: any,
  sourceConnector: string = "radarr",
): NormalizedRelease => {
  return {
    id: release.id,
    title: release.title,
    indexer: release.indexer,
    indexerId: release.indexerId,
    releaseGroup: release.releaseGroup,
    quality: release.quality
      ? {
          name: release.quality.quality?.name,
          resolution: release.quality.quality?.resolution,
        }
      : undefined,
    size: release.size,
    seeders: release.seeders,
    leechers: release.leechers,
    downloadUrl: release.downloadUrl,
    magnetUrl: release.magnetUrl,
    infoUrl: release.infoUrl,
    protocol: release.protocol,
    publishDate: release.publishDate,
    sourceConnector,
  };
};

/**
 * Normalizes a Sonarr ReleaseResource response to NormalizedRelease shape.
 */
export const normalizeSonarrRelease = (
  release: any,
  sourceConnector: string = "sonarr",
): NormalizedRelease => {
  return {
    id: release.id,
    title: release.title,
    indexer: release.indexer,
    indexerId: release.indexerId,
    releaseGroup: release.releaseGroup,
    quality: release.quality
      ? {
          name: release.quality.quality?.name,
          resolution: release.quality.quality?.resolution,
        }
      : undefined,
    size: release.size,
    seeders: release.seeders,
    leechers: release.leechers,
    downloadUrl: release.downloadUrl,
    magnetUrl: release.magnetUrl,
    infoUrl: release.infoUrl,
    protocol: release.protocol,
    publishDate: release.publishDate,
    sourceConnector,
  };
};

/**
 * Normalizes a Prowlarr search result to NormalizedRelease shape.
 */
export const normalizeProwlarrRelease = (
  result: any,
  sourceConnector: string = "prowlarr",
): NormalizedRelease => {
  return {
    id: result.guid || result.infoHash,
    title: result.title,
    indexer: result.indexerName,
    indexerId: result.indexerId,
    releaseGroup: result.releaseGroup,
    quality: {
      name: result.quality,
    },
    size: result.size,
    seeders: result.seeders,
    leechers: result.leechers,
    downloadUrl: result.downloadUrl,
    magnetUrl: result.magnetUrl,
    infoUrl: result.infoUrl,
    protocol: result.protocol,
    publishDate: result.publishDate,
    sourceConnector,
  };
};

/**
 * Normalizes a QBittorrent torrent info object to NormalizedRelease shape.
 */
export const normalizeQBittorrentTorrent = (
  torrent: any,
  sourceConnector: string = "qbittorrent",
): NormalizedRelease => {
  return {
    id: torrent.hash,
    title: torrent.name,
    indexer: torrent.category || "qBittorrent",
    size: torrent.size,
    seeders: torrent.seeds || torrent.num_complete,
    leechers: torrent.peers || torrent.num_incomplete,
    downloadUrl: torrent.magnet_uri,
    magnetUrl: torrent.magnet_uri,
    publishDate: torrent.added_on
      ? new Date(torrent.added_on).toISOString()
      : undefined,
    sourceConnector,
  };
};
