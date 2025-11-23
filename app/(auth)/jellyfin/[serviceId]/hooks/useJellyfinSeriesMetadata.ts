import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinItem } from "@/models/jellyfin.types";
import { getInternalStringField } from "../utils/jellyfinHelpers";

const MAX_SERIES_METADATA_BATCH = 20;

interface UseJellyfinSeriesMetadataParams {
  serviceId: string | undefined;
  displayItems: JellyfinItem[];
  activeSegment: string;
}

export const useJellyfinSeriesMetadata = ({
  serviceId,
  displayItems,
  activeSegment,
}: UseJellyfinSeriesMetadataParams) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const seriesIds = useMemo(() => {
    if (activeSegment !== "tv") return [];

    const ids = new Set<string>();
    for (const it of displayItems) {
      const navId = getInternalStringField(it, "__navigationId") || it.Id;
      if (navId) ids.add(navId);
    }

    return Array.from(ids).slice(0, MAX_SERIES_METADATA_BATCH);
  }, [displayItems, activeSegment]);

  const seriesQueries = useQueries({
    queries: seriesIds.map((seriesId) => ({
      queryKey: queryKeys.jellyfin.item(serviceId ?? "unknown", seriesId),
      enabled: Boolean(serviceId && seriesId),
      staleTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
      queryFn: async () => {
        if (!serviceId || !seriesId) return null;

        let connector = manager.getConnector(serviceId) as
          | JellyfinConnector
          | undefined;
        if (!connector) {
          await manager.loadSavedServices();
          connector = manager.getConnector(serviceId) as
            | JellyfinConnector
            | undefined;
        }

        if (!connector) return null;

        try {
          const result = await connector.getItem(seriesId);
          return result;
        } catch (error) {
          console.warn(
            `Failed to fetch series metadata for ${seriesId}:`,
            error,
          );
          return null;
        }
      },
    })),
  });

  const seriesMetaMap = useMemo(() => {
    const map = new Map<string, JellyfinItem>();
    seriesQueries.forEach((query, index) => {
      const id = seriesIds[index];
      if (id && query.data) {
        map.set(id, query.data);
      }
    });
    return map;
  }, [seriesIds, seriesQueries]);

  return seriesMetaMap;
};
