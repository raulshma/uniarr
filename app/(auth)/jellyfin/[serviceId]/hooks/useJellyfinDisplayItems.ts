import { useMemo } from "react";
import type { JellyfinItem } from "@/models/jellyfin.types";
import {
  extractPrimaryImageTag,
  getInternalStringField,
} from "../utils/jellyfinHelpers";
import type { CollectionSegmentKey } from "./useJellyfinLibraryState";

export type EnrichedJellyfinItem = JellyfinItem & { __posterSourceId?: string };

interface UseJellyfinDisplayItemsParams {
  items: JellyfinItem[];
  activeSegment: CollectionSegmentKey;
  debouncedSearch: string;
  seriesMetaMap: Map<string, JellyfinItem>;
}

export const useJellyfinDisplayItems = ({
  items,
  activeSegment,
  debouncedSearch,
  seriesMetaMap,
}: UseJellyfinDisplayItemsParams) => {
  // Group items by series for TV segment
  const displayItems = useMemo(() => {
    if (activeSegment !== "tv") return items;

    const hasSearchTerm = debouncedSearch.length > 0;

    if (!hasSearchTerm) {
      const seriesItems = items.filter((it) => it.Type === "Series");
      if (seriesItems.length > 0) return seriesItems;
    }

    const grouped = new Map<
      string,
      JellyfinItem & { __navigationId?: string; __posterSourceId?: string }
    >();

    for (const it of items) {
      if (it.Type === "Series") {
        const seriesKey = it.Id || "";
        if (seriesKey && !grouped.has(seriesKey)) {
          grouped.set(seriesKey, {
            ...it,
            __navigationId: it.Id,
            __posterSourceId: it.Id,
          });
        }
        continue;
      }

      const seriesKey =
        it.SeriesId || it.ParentId || it.SeriesName || it.Id || "";
      if (!seriesKey) continue;

      if (!grouped.has(seriesKey)) {
        const rep: JellyfinItem & {
          __navigationId?: string;
          __posterSourceId?: string;
        } = {
          ...it,
          Name: it.SeriesName || it.Name,
          Type: "Series",
          __navigationId: it.SeriesId || it.ParentId || it.Id,
          __posterSourceId: it.Id,
        };

        const tag = extractPrimaryImageTag(it);
        if (tag) {
          (rep as any).PrimaryImageTag = tag;
        }

        grouped.set(seriesKey, rep);
      }
    }

    return Array.from(grouped.values());
  }, [items, activeSegment, debouncedSearch]);

  // Enrich items with series metadata
  const displayItemsEnriched = useMemo<EnrichedJellyfinItem[]>(() => {
    if (activeSegment !== "tv") {
      return displayItems as EnrichedJellyfinItem[];
    }

    const enriched = displayItems.map((it) => {
      const navId = getInternalStringField(it, "__navigationId") ?? it.Id;
      const meta = navId ? seriesMetaMap.get(navId) : undefined;
      if (!meta) return it as EnrichedJellyfinItem;

      const existingPosterSourceId = getInternalStringField(
        it,
        "__posterSourceId",
      );

      const seriesHasPoster =
        extractPrimaryImageTag(meta) ||
        (meta as unknown as { ImageTags?: Record<string, string> })?.ImageTags
          ?.Primary;

      const newPosterSourceId =
        seriesHasPoster && meta.Id ? meta.Id : existingPosterSourceId || it.Id;

      if (
        newPosterSourceId === existingPosterSourceId &&
        !meta.Name &&
        !seriesHasPoster
      ) {
        return it;
      }

      return {
        ...it,
        __posterSourceId: newPosterSourceId,
        Name: meta.Name ?? it.Name,
        PrimaryImageTag: seriesHasPoster
          ? extractPrimaryImageTag(meta)
          : extractPrimaryImageTag(it),
        ImageTags: seriesHasPoster
          ? (meta as unknown as { ImageTags?: Record<string, string> })
              ?.ImageTags
          : (it as unknown as { ImageTags?: Record<string, string> })
              ?.ImageTags,
      } as EnrichedJellyfinItem;
    });

    return enriched;
  }, [displayItems, seriesMetaMap, activeSegment]);

  return { displayItems, displayItemsEnriched };
};
