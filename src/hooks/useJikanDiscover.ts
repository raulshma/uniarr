import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { JikanClient } from "@/services/jikan/JikanClient";
import type { JikanAnime } from "@/models/jikan.types";
import { queryKeys } from "@/hooks/queryKeys";

type DiscoverItem = {
  id: number;
  title: string;
  posterUrl?: string;
  rating?: number;
  mediaType?: "tv" | "movie" | "other";
  synopsis?: string | null;
};

const mapAnime = (a: JikanAnime): DiscoverItem => {
  const title = a.title_english ?? a.title ?? `MAL #${a.mal_id}`;
  const posterUrl = (a.images?.jpg &&
    (a.images.jpg.large_image_url ??
      a.images.jpg.image_url ??
      a.images.jpg.small_image_url)) as string | undefined;
  const type = a.type
    ? a.type.toLowerCase().includes("movie")
      ? "movie"
      : "tv"
    : "tv";

  return {
    id: a.mal_id,
    title,
    posterUrl,
    rating: a.score ?? undefined,
    mediaType: type,
    synopsis: a.synopsis ?? null,
  };
};

const uniqueById = (items: DiscoverItem[]) => {
  const seen = new Set<number>();
  const out: DiscoverItem[] = [];
  for (const it of items) {
    if (!it || typeof it.id !== 'number') continue;
    if (!seen.has(it.id)) {
      seen.add(it.id);
      out.push(it);
    }
  }
  return out;
};

export const useJikanTopAnime = ({
  page = 1,
  enabled = true,
}: {
  page?: number;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [...queryKeys.discover.base, "jikan", "top", page],
    queryFn: async () => {
      const data = await JikanClient.getTopAnime(page);
      const list = Array.isArray((data as any).data)
        ? ((data as any).data as JikanAnime[])
        : [data as any as JikanAnime];
      const mapped = list.map(mapAnime);
      return uniqueById(mapped);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useJikanRecommendations = ({
  page = 1,
  enabled = true,
}: {
  page?: number;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [...queryKeys.discover.base, "jikan", "recommendations", page],
    queryFn: async () => {
      const data = await JikanClient.getRecommendations(page);
      const list = Array.isArray((data as any).data)
        ? ((data as any).data as any[])
        : [data as any];
      // recommendations endpoints return a different shape; try to locate the anime object
      const mapped = list
        .map((r) => {
          // Recommendation items commonly contain an `entry` array with two elements
          // (the source and the recommended entry). Ensure we pick the recommended
          // object when an array is present and normalize the shape so `mapAnime`
          // can extract title / image / id safely.
          let candidate: any = r.entry ?? r.anime ?? r.item ?? r;

          if (Array.isArray(candidate)) {
            candidate = candidate.length > 1 ? candidate[1] : candidate[0];
          }

          if (!candidate) return undefined;

          const normalized: JikanAnime = {
            mal_id: candidate.mal_id ?? candidate.id ?? candidate.malId,
            url: candidate.url ?? candidate.link ?? candidate.uri,
            images: candidate.images ?? (candidate.image_url ? { jpg: { image_url: candidate.image_url } } : undefined),
            title: candidate.title ?? candidate.name ?? candidate.title_english ?? undefined,
            title_english: candidate.title_english ?? null,
            title_japanese: candidate.title_japanese ?? null,
            type: candidate.type ?? null,
            episodes: candidate.episodes ?? null,
            score: candidate.score ?? null,
            synopsis: candidate.synopsis ?? null,
            aired: candidate.aired ?? null,
          };

          return normalized.mal_id ? mapAnime(normalized) : undefined;
        })
        .filter(Boolean) as DiscoverItem[];
  return uniqueById(mapped);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useJikanSeasonNow = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...queryKeys.discover.base, "jikan", "seasons", "now"],
    queryFn: async () => {
      const data = await JikanClient.getSeasonNow();
      const list = Array.isArray((data as any).data)
        ? ((data as any).data as JikanAnime[])
        : [data as any as JikanAnime];
      const mapped = list.map(mapAnime);
      return uniqueById(mapped);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useJikanSeasonUpcoming = ({
  enabled = true,
}: {
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [...queryKeys.discover.base, "jikan", "seasons", "upcoming"],
    queryFn: async () => {
      const data = await JikanClient.getSeasonUpcoming();
      const list = Array.isArray((data as any).data)
        ? ((data as any).data as JikanAnime[])
        : [data as any as JikanAnime];
      const mapped = list.map(mapAnime);
      return uniqueById(mapped);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useJikanDiscover = () => {
  const top = useJikanTopAnime({ page: 1 });
  const recommendations = useJikanRecommendations({ page: 1 });
  const now = useJikanSeasonNow({});
  const upcoming = useJikanSeasonUpcoming({});

  const isLoading = useMemo(
    () =>
      top.isLoading ||
      recommendations.isLoading ||
      now.isLoading ||
      upcoming.isLoading,
    [
      top.isLoading,
      recommendations.isLoading,
      now.isLoading,
      upcoming.isLoading,
    ]
  );
  const isError = useMemo(
    () =>
      top.isError || recommendations.isError || now.isError || upcoming.isError,
    [top.isError, recommendations.isError, now.isError, upcoming.isError]
  );

  return {
    top: top.data ?? [],
    recommendations: recommendations.data ?? [],
    now: now.data ?? [],
    upcoming: upcoming.data ?? [],
    isLoading,
    isError,
    refetch: async () => {
      await Promise.all([
        top.refetch(),
        recommendations.refetch(),
        now.refetch(),
        upcoming.refetch(),
      ]);
    },
  };
};

export type { DiscoverItem };
