import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type { JellyfinItem } from "@/models/jellyfin.types";
import type { CollectionSegmentKey } from "../hooks/useJellyfinLibraryState";

export const extractPrimaryImageTag = (obj?: unknown): string | undefined => {
  if (!obj || typeof obj !== "object") return undefined;
  const r = obj as Record<string, unknown>;
  const direct = r["PrimaryImageTag"];
  if (typeof direct === "string") return direct;
  const imageTags = r["ImageTags"];
  if (imageTags && typeof imageTags === "object") {
    const it = imageTags as Record<string, unknown>;
    const primary = it["Primary"];
    if (typeof primary === "string") return primary;
  }
  return undefined;
};

export const getInternalStringField = (
  obj?: unknown,
  key?: string,
): string | undefined => {
  if (!obj || typeof obj !== "object" || !key) return undefined;
  const r = obj as Record<string, unknown>;
  const v = r[key];
  return typeof v === "string" ? v : undefined;
};

export const formatRuntimeMinutes = (
  ticks?: number | null,
): number | undefined => {
  const normalized = ticks ?? undefined;
  if (!normalized || normalized <= 0) {
    return undefined;
  }

  const minutes = Math.round(normalized / 600_000_000);
  return minutes > 0 ? minutes : undefined;
};

export const deriveSubtitle = (
  item: JellyfinItem,
  segment: CollectionSegmentKey,
): string | undefined => {
  if (segment === "movies") {
    const minutes = formatRuntimeMinutes(item.RunTimeTicks);
    const year =
      item.ProductionYear ??
      (item.PremiereDate
        ? new Date(item.PremiereDate).getFullYear()
        : undefined);

    if (year && minutes) {
      return `${year} • ${minutes}m`;
    }

    if (year) {
      return `${year}`;
    }

    if (minutes) {
      return `${minutes}m`;
    }

    return undefined;
  }

  if (segment === "tv") {
    if (item.Type === "Series") {
      const year =
        item.ProductionYear ??
        (item.PremiereDate
          ? new Date(item.PremiereDate).getFullYear()
          : undefined);
      return year ? `${year}` : undefined;
    }

    if (item.SeriesName) {
      return item.SeriesName;
    }

    const year =
      item.ProductionYear ??
      (item.PremiereDate
        ? new Date(item.PremiereDate).getFullYear()
        : undefined);
    return year ? `${year}` : undefined;
  }

  if (segment === "music") {
    const artist = item.Studios?.[0]?.Name ?? item.SeriesName;
    return artist ?? undefined;
  }

  return undefined;
};

export const buildPosterUri = (
  connector: JellyfinConnector | undefined,
  item: JellyfinItem,
  fallbackWidth: number,
  imageItemIdOverride?: string,
): string | undefined => {
  if (!connector) {
    return undefined;
  }

  const tag = extractPrimaryImageTag(item) ?? undefined;
  if (!tag) {
    return undefined;
  }

  const idToUse = imageItemIdOverride ?? item.Id ?? "";
  if (!idToUse) {
    return undefined;
  }

  const url = connector.getImageUrl(idToUse, "Primary", {
    tag,
    width: fallbackWidth,
  });

  return url;
};
