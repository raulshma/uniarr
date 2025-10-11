import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { IConnector } from "@/connectors/base/IConnector";
import type { ServiceType } from "@/models/service.types";
import { useConnectorsStore } from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type {
  DiscoverMediaItem,
  DiscoverSection,
  UnifiedDiscoverPayload,
  UnifiedDiscoverServices,
} from "@/models/discover.types";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

import type { ServiceConfig } from "@/models/service.types";

const emptyServices: UnifiedDiscoverServices = {
  sonarr: [],
  radarr: [],
  jellyseerr: [],
};

const mapServiceSummaries = (configs: ServiceConfig[]) =>
  configs.map((config) => ({
    id: config.id,
    name: config.name,
    type: config.type,
  }));

const mapTrendingResult = (
  result: JellyseerrSearchResult,
  mediaType: DiscoverMediaItem["mediaType"],
  sourceServiceId?: string
): DiscoverMediaItem => {
  // Explicitly handle the MovieResult | TvResult union and fallback to mediaInfo

  const tmdbCandidate = result.mediaInfo?.tmdbId ?? result.id;
  const tmdbId = typeof tmdbCandidate === "number" ? tmdbCandidate : undefined;
  const tvdbCandidate = result.mediaInfo?.tvdbId;
  const tvdbId = typeof tvdbCandidate === "number" ? tvdbCandidate : undefined;

  const title = (() => {
    if ("title" in result && typeof result.title === "string")
      return result.title;
    if ("name" in result && typeof result.name === "string") return result.name;
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    if (typeof mi.title === "string") return mi.title as string;
    if (typeof mi.name === "string") return mi.name as string;
    return undefined;
  })();
  const { poster, backdrop } = (() => {
    const poster =
      typeof result.posterPath === "string" ? result.posterPath : undefined;
    const backdrop =
      typeof result.backdropPath === "string" ? result.backdropPath : undefined;
    if (poster && backdrop) return { poster, backdrop };
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return {
      poster:
        poster ??
        (typeof mi.posterPath === "string"
          ? (mi.posterPath as string)
          : undefined),
      backdrop:
        backdrop ??
        (typeof mi.backdropPath === "string"
          ? (mi.backdropPath as string)
          : undefined),
    };
  })();
  const voteAverage =
    typeof result.voteAverage === "number" ? result.voteAverage : undefined;
  const popularity =
    typeof result.popularity === "number" ? result.popularity : undefined;
  const releaseDate = (() => {
    if (
      "firstAirDate" in result &&
      typeof (result as any).firstAirDate === "string"
    )
      return (result as any).firstAirDate as string;
    if (
      "releaseDate" in result &&
      typeof (result as any).releaseDate === "string"
    )
      return (result as any).releaseDate as string;
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return typeof mi.releaseDate === "string"
      ? (mi.releaseDate as string)
      : undefined;
  })();
  const overview = (() => {
    if (typeof result.overview === "string") return result.overview;
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return typeof mi.overview === "string"
      ? (mi.overview as string)
      : undefined;
  })();
  const imdbId = (() => {
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return typeof mi.imdbId === "string" ? (mi.imdbId as string) : undefined;
  })();
  const voteCount =
    typeof result.voteCount === "number" ? result.voteCount : undefined;

  return {
    id: `${mediaType}-${String(tmdbId ?? result.id ?? "")}`,
    title: title ?? "Untitled",
    mediaType,
    overview,
    posterUrl: poster
      ? `https://image.tmdb.org/t/p/original${poster}`
      : undefined,
    backdropUrl: backdrop
      ? `https://image.tmdb.org/t/p/original${backdrop}`
      : undefined,
    rating: voteAverage,
    popularity,
    releaseDate,
    year: (() => {
      const dateString = releaseDate as string | undefined;
      if (!dateString) return undefined;
      const parsed = Number.parseInt(dateString.slice(0, 4), 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    })(),
    sourceId: result.id,
    tmdbId,
    tvdbId,
    imdbId,
    voteCount,
    sourceServiceId: sourceServiceId,
    source: "jellyseerr",
  };
};

const fetchUnifiedDiscover = async (
  getConnectorsByType: (type: ServiceType) => IConnector[]
): Promise<UnifiedDiscoverPayload> => {
  const jellyConnectors = getConnectorsByType(
    "jellyseerr"
  ) as JellyseerrConnector[];
  const sonarrConnectors = getConnectorsByType("sonarr") as SonarrConnector[];
  const radarrConnectors = getConnectorsByType("radarr") as RadarrConnector[];

  const services: UnifiedDiscoverServices = {
    sonarr: mapServiceSummaries(
      sonarrConnectors.map((connector) => connector.config)
    ),
    radarr: mapServiceSummaries(
      radarrConnectors.map((connector) => connector.config)
    ),
    jellyseerr: mapServiceSummaries(
      jellyConnectors.map((connector) => connector.config)
    ),
  };

  const trendingResponses = await Promise.all(
    jellyConnectors.map(async (connector) => {
      try {
        const response = await connector.getTrending({ page: 1 });
        return {
          connectorId: connector.config.id,
          items: response.items,
        } as const;
      } catch (error) {
        console.warn(
          `Failed to load trending titles from ${connector.config.name}:`,
          error
        );
        return {
          connectorId: connector.config.id,
          items: [] as JellyseerrSearchResult[],
        } as const;
      }
    })
  );

  // Flatten while keeping a reference to which connector the item came from so
  // that we can pre-fill sourceServiceId for subsequent detailed fetches.
  const trendingItems = trendingResponses.flatMap((r) =>
    r.items.map(
      (it) =>
        ({
          ...it,
          __sourceServiceId: r.connectorId,
        } as unknown as JellyseerrSearchResult & { __sourceServiceId?: string })
    )
  );

  if (trendingItems.length === 0) {
    return {
      sections: [],
      services,
    };
  }

  const deduped = new Map<
    string,
    JellyseerrSearchResult & { __sourceServiceId?: string }
  >();
  for (const item of trendingItems) {
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const r = toRecord(item) ?? {};
    const tmdb =
      typeof r.tmdbId === "number"
        ? (r.tmdbId as number)
        : r.mediaInfo && typeof (r.mediaInfo as any).tmdbId === "number"
        ? ((r.mediaInfo as any).tmdbId as number)
        : undefined;
    const key = tmdb ? `tmdb-${tmdb}` : `${item.mediaType}-${item.id}`;
    if (!deduped.has(key)) {
      deduped.set(
        key,
        item as JellyseerrSearchResult & { __sourceServiceId?: string }
      );
    }
  }

  const tvResults: DiscoverMediaItem[] = [];
  const movieResults: DiscoverMediaItem[] = [];

  deduped.forEach((value) => {
    const connectorId =
      ((value as unknown as Record<string, unknown>)
        ?.__sourceServiceId as string) ?? undefined;
    if (value.mediaType === "tv") {
      tvResults.push(mapTrendingResult(value, "series", connectorId));
    } else if (value.mediaType === "movie") {
      movieResults.push(mapTrendingResult(value, "movie", connectorId));
    }
  });

  const sections: DiscoverSection[] = [];

  if (tvResults.length) {
    sections.push({
      id: "popular-tv",
      title: "Popular TV Shows",
      mediaType: "series",
      source: "jellyseerr",
      items: tvResults.slice(0, 12),
    });
  }

  if (movieResults.length) {
    sections.push({
      id: "trending-movies",
      title: "Trending Movies",
      mediaType: "movie",
      source: "jellyseerr",
      items: movieResults.slice(0, 12),
    });
  }

  return {
    sections,
    services,
  };
};

export const useUnifiedDiscover = () => {
  const { getConnectorsByType } = useConnectorsStore();
  const query = useQuery<UnifiedDiscoverPayload>({
    queryKey: queryKeys.discover.unified,
    queryFn: () => fetchUnifiedDiscover(getConnectorsByType),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const services = useMemo(
    () => query.data?.services ?? emptyServices,
    [query.data?.services]
  );
  const sections = useMemo(
    () => query.data?.sections ?? [],
    [query.data?.sections]
  );

  return {
    sections,
    services,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
