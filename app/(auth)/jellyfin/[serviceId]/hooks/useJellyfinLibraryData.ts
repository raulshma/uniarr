import { useMemo } from "react";
import { useQueries, useInfiniteQuery } from "@tanstack/react-query";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { useJellyfinLibraries } from "@/hooks/useJellyfinLibraries";
import { useJellyfinNowPlaying } from "@/hooks/useJellyfinNowPlaying";
import { queryKeys } from "@/hooks/queryKeys";
import type { JellyfinItem } from "@/models/jellyfin.types";
import type { CollectionSegmentKey } from "./useJellyfinLibraryState";

export const collectionSegments = [
  {
    key: "movies" as const,
    label: "Movies",
    types: ["movies", "unknown", "folders"] as const,
    includeItemTypes: ["Movie"] as const,
    mediaTypes: ["Video"] as const,
  },
  {
    key: "tv" as const,
    label: "TV Shows",
    types: ["tvshows", "series"] as const,
    includeItemTypes: ["Series"] as const,
    mediaTypes: ["Video"] as const,
  },
  {
    key: "music" as const,
    label: "Music",
    types: ["music"] as const,
    includeItemTypes: ["Audio"] as const,
    mediaTypes: ["Audio"] as const,
  },
] as const;

interface UseJellyfinLibraryDataParams {
  serviceId: string | undefined;
  selectedLibraryId: string | null;
  activeSegment: CollectionSegmentKey;
  debouncedSearch: string;
}

export const useJellyfinLibraryData = ({
  serviceId,
  selectedLibraryId,
  activeSegment,
  debouncedSearch,
}: UseJellyfinLibraryDataParams) => {
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const librariesQuery = useJellyfinLibraries(serviceId);

  const activeSegmentConfig = useMemo(
    () =>
      collectionSegments.find((segment) => segment.key === activeSegment) ??
      collectionSegments[0]!,
    [activeSegment],
  );

  // Consolidated queries for better performance
  const consolidatedQueries = useQueries({
    queries: [
      {
        queryKey: serviceId
          ? [
              ...queryKeys.jellyfin.resume(serviceId, { limit: 12 }),
              "consolidated",
            ]
          : [...queryKeys.jellyfin.base, "resume"],
        enabled: Boolean(serviceId),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        queryFn: async () => {
          if (!serviceId) return [];
          const connector = manager.getConnector(serviceId) as
            | JellyfinConnector
            | undefined;
          if (!connector) return [];
          return connector.getResumeItems(12);
        },
      },
    ],
  });

  // Infinite query for library items with pagination
  const libraryItemsInfiniteQuery = useInfiniteQuery({
    queryKey:
      serviceId && selectedLibraryId
        ? [
            ...queryKeys.jellyfin.libraryItems(serviceId, selectedLibraryId, {
              search: debouncedSearch.toLowerCase(),
              includeItemTypes: activeSegmentConfig.includeItemTypes,
              mediaTypes: activeSegmentConfig.mediaTypes,
              sortBy: "SortName",
              sortOrder: "Ascending",
            }),
            "infinite",
          ]
        : [...queryKeys.jellyfin.base, "libraryItems"],
    enabled: Boolean(serviceId && selectedLibraryId),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    queryFn: async ({ pageParam = 1 }) => {
      if (!serviceId || !selectedLibraryId) {
        return { items: [], hasNextPage: false };
      }

      const connector = manager.getConnector(serviceId) as
        | JellyfinConnector
        | undefined;
      if (!connector) {
        return { items: [], hasNextPage: false };
      }

      const limit = 20;
      const startIndex = (pageParam - 1) * limit;

      try {
        let result: JellyfinItem[] = [];

        if (debouncedSearch) {
          const searchResults = await connector.search(debouncedSearch, {
            pagination: {
              page: pageParam,
              pageSize: limit,
            },
            filters: {
              includeItemTypes: activeSegmentConfig.includeItemTypes,
            },
          });
          result = searchResults;
        } else {
          const queryOptions: any = {
            mediaTypes: activeSegmentConfig.mediaTypes,
            sortBy: "SortName",
            sortOrder: "Ascending" as const,
            limit,
            startIndex,
            includeItemTypes: activeSegmentConfig.includeItemTypes,
          };

          result = await connector.getLibraryItems(
            selectedLibraryId!,
            queryOptions,
          );

          if ((!result || result.length === 0) && activeSegment === "tv") {
            result = await connector.getLibraryItems(selectedLibraryId!, {
              sortBy: "SortName",
              sortOrder: "Ascending" as const,
              limit,
              startIndex,
            });
          }
        }

        return {
          items: result ?? [],
          hasNextPage: (result?.length ?? 0) === limit,
        };
      } catch {
        return { items: [], hasNextPage: false };
      }
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasNextPage ? pages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const nowPlayingQuery = useJellyfinNowPlaying({
    serviceId,
    refetchInterval: 10_000,
  });

  const [resumeQuery] = consolidatedQueries;

  return {
    librariesQuery,
    libraryItemsInfiniteQuery,
    resumeQuery,
    nowPlayingQuery,
    activeSegmentConfig,
  };
};
