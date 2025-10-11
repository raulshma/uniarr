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
    id: a.mal_id ?? 0,
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
    if (!it || typeof it.id !== "number") continue;
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
      const toRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === "object" ? (v as Record<string, unknown>) : null;
      const d = toRecord(data);
      const list = Array.isArray(d?.data)
        ? (d!.data as unknown[]).map((i) => i as JikanAnime)
        : d
        ? [d as unknown as JikanAnime]
        : [];
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
      const toRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === "object" ? (v as Record<string, unknown>) : null;
      const d = toRecord(data);
      const list = Array.isArray(d?.data)
        ? (d!.data as unknown[])
        : d
        ? [d as unknown]
        : [];
      // recommendations endpoints return a different shape; try to locate the anime object
      const mapped = list
        .map((r) => {
          const toRecord = (v: unknown): Record<string, unknown> | null =>
            v && typeof v === "object" ? (v as Record<string, unknown>) : null;
          const rec = toRecord(r) ?? {};
          let candidateRec =
            toRecord(rec.entry ?? rec.anime ?? rec.item ?? rec) ?? {};

          if (Array.isArray(rec.entry ?? rec.anime ?? rec.item)) {
            const arr = (rec.entry ?? rec.anime ?? rec.item) as unknown[];
            candidateRec = toRecord(arr.length > 1 ? arr[1] : arr[0]) ?? {};
          }

          const normalized: JikanAnime = {
            mal_id: (candidateRec.mal_id ??
              candidateRec.id ??
              candidateRec.malId) as number,
            url: (candidateRec.url ?? candidateRec.link ?? candidateRec.uri) as
              | string
              | undefined,
            images: ((): JikanAnime["images"] | undefined => {
              const imgs =
                candidateRec.images ??
                candidateRec.images_url ??
                candidateRec.image_url ??
                undefined;
              if (!imgs) return undefined;
              // If it's already in expected shape, trust it
              if (typeof imgs === "object" && ("jpg" in imgs || "webp" in imgs))
                return imgs as JikanAnime["images"];
              // If it's a single url string, coerce to the minimal expected shape
              if (typeof imgs === "string") {
                return { jpg: { image_url: imgs } } as JikanAnime["images"];
              }
              return undefined;
            })(),
            title: (candidateRec.title ??
              candidateRec.name ??
              candidateRec.title_english) as string | undefined,
            title_english: (candidateRec.title_english ?? null) as
              | string
              | null,
            title_japanese: (candidateRec.title_japanese ?? null) as
              | string
              | null,
            type: (candidateRec.type ?? null) as unknown as JikanAnime["type"],
            episodes: (candidateRec.episodes ?? null) as number | null,
            score: (candidateRec.score ?? null) as number | null,
            synopsis: (candidateRec.synopsis ?? null) as string | null,
            aired: (():
              | { from?: string | null; to?: string | null }
              | undefined => {
              const a = candidateRec.aired ?? candidateRec.airing ?? null;
              if (!a || typeof a !== "object") return undefined;
              const aRec = a as Record<string, unknown>;
              const from = (
                typeof aRec.from === "string"
                  ? (aRec.from as string)
                  : typeof aRec.start_date === "string"
                  ? (aRec.start_date as string)
                  : undefined
              ) as string | null | undefined;
              const to = (
                typeof aRec.to === "string"
                  ? (aRec.to as string)
                  : typeof aRec.end_date === "string"
                  ? (aRec.end_date as string)
                  : undefined
              ) as string | null | undefined;
              return { from: from ?? null, to: to ?? null };
            })(),
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
      const toRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === "object" ? (v as Record<string, unknown>) : null;
      const d = toRecord(data);
      const list = Array.isArray(d?.data)
        ? (d!.data as unknown[]).map((i) => i as JikanAnime)
        : d
        ? [d as unknown as JikanAnime]
        : [];
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
      const toRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === "object" ? (v as Record<string, unknown>) : null;
      const d = toRecord(data);
      const list = Array.isArray(d?.data)
        ? (d!.data as unknown[]).map((i) => i as JikanAnime)
        : d
        ? [d as unknown as JikanAnime]
        : [];
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
