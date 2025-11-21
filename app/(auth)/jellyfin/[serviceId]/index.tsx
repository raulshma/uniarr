import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Chip,
  HelperText,
  IconButton,
  Searchbar,
  Text,
  Icon,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { SeriesListItemSkeleton } from "@/components/media/skeletons";

import { EmptyState } from "@/components/common/EmptyState";
import { MediaPoster } from "@/components/media/MediaPoster";
import DownloadButton from "@/components/downloads/DownloadButton";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { useJellyfinLibraries } from "@/hooks/useJellyfinLibraries";
import LatestMediaSection from "@/components/jellyfin/LatestMediaSection";
import { useQueries, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import { useJellyfinNowPlaying } from "@/hooks/useJellyfinNowPlaying";
import type {
  JellyfinItem,
  JellyfinLibraryView,
  JellyfinResumeItem,
  JellyfinSession,
  JellyfinSessionPlayState,
} from "@/models/jellyfin.types";
import { spacing } from "@/theme/spacing";

// Safely extract a Primary image tag from either a top-level PrimaryImageTag
// property or an ImageTags.Primary entry without using `as any`.
const extractPrimaryImageTag = (obj?: unknown): string | undefined => {
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

const getInternalStringField = (
  obj?: unknown,
  key?: string,
): string | undefined => {
  if (!obj || typeof obj !== "object" || !key) return undefined;
  const r = obj as Record<string, unknown>;
  const v = r[key];
  return typeof v === "string" ? v : undefined;
};

type CollectionSegmentKey = "movies" | "tv" | "music";

type EnrichedJellyfinItem = JellyfinItem & { __posterSourceId?: string };

const collectionSegments: readonly {
  readonly key: CollectionSegmentKey;
  readonly label: string;
  readonly types: readonly string[];
  readonly includeItemTypes: readonly string[];
  readonly mediaTypes: readonly string[];
}[] = [
  {
    key: "movies",
    label: "Movies",
    types: ["movies", "unknown", "folders"],
    includeItemTypes: ["Movie"],
    mediaTypes: ["Video"],
  },
  {
    key: "tv",
    label: "TV Shows",
    types: ["tvshows", "series"],
    includeItemTypes: ["Series"],
    mediaTypes: ["Video"],
  },
  {
    key: "music",
    label: "Music",
    types: ["music"],
    includeItemTypes: ["Audio"],
    mediaTypes: ["Audio"],
  },
];

const formatRuntimeMinutes = (ticks?: number | null): number | undefined => {
  const normalized = ticks ?? undefined;
  if (!normalized || normalized <= 0) {
    return undefined;
  }

  const minutes = Math.round(normalized / 600_000_000);
  return minutes > 0 ? minutes : undefined;
};

const deriveSubtitle = (
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
    // For series-level items prefer showing the production/premiere year as
    // the subtitle so the title (series name) doesn't repeat itself beneath
    // the poster. For episodes, show the parent series name.
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

const buildPosterUri = (
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

const JellyfinLibraryScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : undefined;
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const { width: windowWidth } = useWindowDimensions();
  const numColumns = 2;

  // Consolidated state management with useReducer for better performance
  interface LibraryState {
    isBootstrapping: boolean;
    activeSegment: CollectionSegmentKey;
    selectedLibraryId: string | null;
    searchTerm: string;
    debouncedSearch: string;
    showSkeletonLayer: boolean;
    contentInteractive: boolean;
  }

  type LibraryAction =
    | { type: "SET_BOOTSTRAPPING"; payload: boolean }
    | { type: "SET_SEGMENT"; payload: CollectionSegmentKey }
    | { type: "SET_LIBRARY_ID"; payload: string | null }
    | { type: "SET_SEARCH_TERM"; payload: string }
    | { type: "SET_DEBOUNCED_SEARCH"; payload: string }
    | {
        type: "SET_SKELETON_STATE";
        payload: { showSkeleton: boolean; interactive: boolean };
      };

  const libraryReducer = (
    state: LibraryState,
    action: LibraryAction,
  ): LibraryState => {
    switch (action.type) {
      case "SET_BOOTSTRAPPING":
        return { ...state, isBootstrapping: action.payload };
      case "SET_SEGMENT":
        return { ...state, activeSegment: action.payload };
      case "SET_LIBRARY_ID":
        return { ...state, selectedLibraryId: action.payload };
      case "SET_SEARCH_TERM":
        return { ...state, searchTerm: action.payload };
      case "SET_DEBOUNCED_SEARCH":
        return { ...state, debouncedSearch: action.payload };
      case "SET_SKELETON_STATE":
        return {
          ...state,
          showSkeletonLayer: action.payload.showSkeleton,
          contentInteractive: action.payload.interactive,
        };
      default:
        return state;
    }
  };

  const [libraryState, dispatch] = useReducer(libraryReducer, {
    isBootstrapping: true,
    activeSegment: "movies",
    selectedLibraryId: null,
    searchTerm: "",
    debouncedSearch: "",
    showSkeletonLayer: true,
    contentInteractive: false,
  });

  const connector = useMemo(() => {
    if (!serviceId) {
      return undefined;
    }

    return manager.getConnector(serviceId) as JellyfinConnector | undefined;
  }, [manager, serviceId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!serviceId) {
        if (!cancelled) {
          dispatch({ type: "SET_BOOTSTRAPPING", payload: false });
        }
        return;
      }

      try {
        if (!manager.getConnector(serviceId)) {
          await manager.loadSavedServices();
        }
      } finally {
        if (!cancelled) {
          dispatch({ type: "SET_BOOTSTRAPPING", payload: false });
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [manager, serviceId]);

  useEffect(() => {
    // Reduced debounce for snappier feel - 150ms instead of 300ms
    const timer = setTimeout(() => {
      const trimmed = libraryState.searchTerm.trim();
      if (trimmed !== libraryState.debouncedSearch) {
        dispatch({ type: "SET_DEBOUNCED_SEARCH", payload: trimmed });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [libraryState.searchTerm, libraryState.debouncedSearch]);

  const librariesQuery = useJellyfinLibraries(serviceId);
  const groupedLibraries = useMemo(() => {
    const groups: Record<CollectionSegmentKey, JellyfinLibraryView[]> = {
      movies: [],
      tv: [],
      music: [],
    };

    (librariesQuery.data ?? []).forEach((library) => {
      const type = ((library as any)?.CollectionType ?? "").toLowerCase();
      const segment = collectionSegments.find((candidate) =>
        candidate.types.includes(type),
      );
      if (segment) {
        groups[segment.key].push(library);
      }
    });

    return groups;
  }, [librariesQuery.data]);

  useEffect(() => {
    const firstAvailable = collectionSegments.find(
      (segment) => groupedLibraries[segment.key].length > 0,
    );

    if (
      firstAvailable &&
      groupedLibraries[libraryState.activeSegment].length === 0
    ) {
      dispatch({ type: "SET_SEGMENT", payload: firstAvailable.key });
      dispatch({
        type: "SET_LIBRARY_ID",
        payload: groupedLibraries[firstAvailable.key][0]?.Id ?? null,
      });
      return;
    }

    if (groupedLibraries[libraryState.activeSegment].length > 0) {
      const libraryIds = groupedLibraries[libraryState.activeSegment].map(
        (library) => library?.Id ?? "",
      );
      if (
        !libraryState.selectedLibraryId ||
        !libraryIds.includes(libraryState.selectedLibraryId)
      ) {
        dispatch({
          type: "SET_LIBRARY_ID",
          payload: groupedLibraries[libraryState.activeSegment][0]?.Id ?? null,
        });
      }
    }
  }, [
    libraryState.activeSegment,
    groupedLibraries,
    libraryState.selectedLibraryId,
  ]);

  const activeSegmentConfig = useMemo(
    () =>
      collectionSegments.find(
        (segment) => segment.key === libraryState.activeSegment,
      ) ?? collectionSegments[0]!,
    [libraryState.activeSegment],
  );

  // Consolidated queries for better performance - batch related queries together
  const consolidatedQueries = useQueries({
    queries: [
      // Resume items (shown above the fold)
      {
        queryKey: serviceId
          ? [
              ...queryKeys.jellyfin.resume(serviceId, { limit: 12 }),
              "consolidated",
            ]
          : [...queryKeys.jellyfin.base, "resume"],
        enabled: Boolean(serviceId),
        staleTime: 60_000, // 1 minute - resume data changes frequently
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
      serviceId && libraryState.selectedLibraryId
        ? [
            ...queryKeys.jellyfin.libraryItems(
              serviceId,
              libraryState.selectedLibraryId,
              {
                search: libraryState.debouncedSearch.toLowerCase(),
                includeItemTypes: activeSegmentConfig.includeItemTypes,
                mediaTypes: activeSegmentConfig.mediaTypes,
                sortBy: "SortName",
                sortOrder: "Ascending",
              },
            ),
            "infinite",
          ]
        : [...queryKeys.jellyfin.base, "libraryItems"],
    enabled: Boolean(serviceId && libraryState.selectedLibraryId),
    staleTime: 30_000,
    queryFn: async ({ pageParam = 1 }) => {
      if (!serviceId || !libraryState.selectedLibraryId) {
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

      const queryOptions = {
        searchTerm: libraryState.debouncedSearch,
        includeItemTypes: activeSegmentConfig.includeItemTypes,
        mediaTypes: activeSegmentConfig.mediaTypes,
        sortBy: "SortName",
        sortOrder: "Ascending" as const,
        limit,
        startIndex,
      };

      try {
        let result = await connector.getLibraryItems(
          libraryState.selectedLibraryId!,
          queryOptions,
        );

        // If no results with filters and this is TV segment, try without filters
        if (
          (!result || result.length === 0) &&
          libraryState.activeSegment === "tv"
        ) {
          result = await connector.getLibraryItems(
            libraryState.selectedLibraryId!,
            {
              sortBy: "SortName",
              sortOrder: "Ascending" as const,
              limit,
              startIndex,
            },
          );
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

  // Extract query results for cleaner usage
  const [resumeQuery] = consolidatedQueries;

  // Keep now playing separate due to real-time polling requirement
  const nowPlayingQuery = useJellyfinNowPlaying({
    serviceId,
    refetchInterval: 10_000,
  });

  // Removed fallback query for better performance - handle TV series grouping in the main library query

  const serviceName = connector?.config.name ?? "Jellyfin";

  const isInitialLoad =
    libraryState.isBootstrapping ||
    librariesQuery.isLoading ||
    libraryItemsInfiniteQuery.isLoading ||
    resumeQuery.isLoading ||
    nowPlayingQuery.isLoading;
  const isRefreshing =
    (libraryItemsInfiniteQuery.isFetching ||
      resumeQuery.isFetching ||
      librariesQuery.isFetching ||
      nowPlayingQuery.isFetching) &&
    !isInitialLoad;

  // Optimized skeleton state management using the consolidated state
  useEffect(() => {
    if (isInitialLoad) {
      dispatch({
        type: "SET_SKELETON_STATE",
        payload: { showSkeleton: true, interactive: false },
      });
    } else {
      dispatch({
        type: "SET_SKELETON_STATE",
        payload: { showSkeleton: false, interactive: true },
      });
    }
  }, [isInitialLoad]);

  const aggregatedError =
    librariesQuery.error ??
    libraryItemsInfiniteQuery.error ??
    resumeQuery.error ??
    nowPlayingQuery.error;
  const errorMessage =
    aggregatedError instanceof Error
      ? aggregatedError.message
      : aggregatedError
        ? "Unable to load Jellyfin data."
        : null;

  const items = useMemo(
    () => libraryItemsInfiniteQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [libraryItemsInfiniteQuery.data],
  );

  // Optimized displayItems: cache series grouping and reduce expensive operations
  const displayItems = useMemo(() => {
    if (libraryState.activeSegment !== "tv") return items;

    // Fast path: if we already have series items, return them immediately
    const seriesItems = items.filter((it) => it.Type === "Series");
    if (seriesItems.length > 0) return seriesItems;

    // Group episodes by series with optimized map operations
    const grouped = new Map<
      string,
      JellyfinItem & { __navigationId?: string; __posterSourceId?: string }
    >();

    // Pre-allocate map capacity for better performance (if supported)
    // Note: Map.reserve is not standard, so we'll skip this optimization for compatibility

    for (const it of items) {
      // Use optimized key extraction with fallbacks
      const seriesKey =
        it.SeriesId || it.ParentId || it.SeriesName || it.Id || "";
      if (!seriesKey) continue;

      if (!grouped.has(seriesKey)) {
        // Create representative item with minimal copying
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

        // Only extract primary image tag if needed
        const tag = extractPrimaryImageTag(it);
        if (tag) {
          (rep as any).PrimaryImageTag = tag;
        }

        grouped.set(seriesKey, rep);
      }
    }

    const result = Array.from(grouped.values());
    return result;
  }, [items, libraryState.activeSegment]);

  // Optimized series metadata fetching - batch fetch with better caching and concurrency limiting
  // Limit to 20 items to avoid overwhelming the network with too many concurrent requests
  const MAX_SERIES_METADATA_BATCH = 20;

  const seriesIds = useMemo(() => {
    if (libraryState.activeSegment !== "tv") return [];

    // Use Set for deduplication and convert to array at the end
    const ids = new Set<string>();
    for (const it of displayItems) {
      const navId = getInternalStringField(it, "__navigationId") || it.Id;
      if (navId) ids.add(navId);
    }

    // Limit to the first N items to avoid network overload
    // This prevents hundreds of concurrent requests when user first loads a large TV library
    return Array.from(ids).slice(0, MAX_SERIES_METADATA_BATCH);
  }, [displayItems, libraryState.activeSegment]);

  // Batch fetch series metadata with optimized caching and error handling
  const seriesQueries = useQueries({
    queries: seriesIds.map((seriesId) => ({
      queryKey: queryKeys.jellyfin.item(serviceId ?? "unknown", seriesId),
      enabled: Boolean(serviceId && seriesId),
      staleTime: 24 * 60 * 60_000, // 24 hours - series metadata is very stable
      refetchOnWindowFocus: false,
      retry: 1, // Only retry once to avoid long loading times
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
          // Log errors silently and return null to avoid breaking the UI
          console.warn(
            `Failed to fetch series metadata for ${seriesId}:`,
            error,
          );
          return null;
        }
      },
    })),
  });

  // Optimized series metadata mapping with reduced iterations
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

  const displayItemsEnriched = useMemo<EnrichedJellyfinItem[]>(() => {
    if (libraryState.activeSegment !== "tv") {
      return displayItems as EnrichedJellyfinItem[];
    }

    const enriched = displayItems.map((it) => {
      const navId = getInternalStringField(it, "__navigationId") ?? it.Id;
      const meta = navId ? seriesMetaMap.get(navId) : undefined;
      if (!meta) return it as EnrichedJellyfinItem;

      // Create a stable enriched item to prevent unnecessary re-renders
      const existingPosterSourceId = getInternalStringField(
        it,
        "__posterSourceId",
      );

      // Only update poster source if the series actually has a poster image
      const seriesHasPoster =
        extractPrimaryImageTag(meta) ||
        (meta as unknown as { ImageTags?: Record<string, string> })?.ImageTags
          ?.Primary;

      const newPosterSourceId =
        seriesHasPoster && meta.Id ? meta.Id : existingPosterSourceId || it.Id;

      // Only update if we have meaningful new data
      if (
        newPosterSourceId === existingPosterSourceId &&
        !meta.Name &&
        !seriesHasPoster
      ) {
        return it;
      }

      return {
        ...it,
        // Use the series item's id for poster requests only if series has poster
        __posterSourceId: newPosterSourceId,
        // Prefer series-level title if available
        Name: meta.Name ?? it.Name,
        // CRITICAL: When using series as poster source, use ONLY the series' tags.
        // This prevents ID/tag mismatches where we request a series image with
        // an episode's tag (which doesn't exist for that item).
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
  }, [displayItems, seriesMetaMap, libraryState.activeSegment]);

  const librariesForActiveSegment = useMemo(
    () => groupedLibraries[libraryState.activeSegment] ?? [],
    [groupedLibraries, libraryState.activeSegment],
  );

  const handleNavigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenSettings = useCallback(() => {
    if (!serviceId) {
      return;
    }
    router.push({ pathname: "/(auth)/edit-service", params: { serviceId } });
  }, [router, serviceId]);

  const handleOpenNowPlaying = useCallback(() => {
    if (!serviceId) {
      return;
    }

    router.push({
      pathname: "/(auth)/jellyfin/[serviceId]/now-playing",
      params: { serviceId },
    });
  }, [router, serviceId]);

  const handleOpenItem = useCallback(
    (itemId?: string) => {
      if (!serviceId) {
        return;
      }
      if (!itemId) return;

      router.push({
        pathname: "/(auth)/jellyfin/[serviceId]/details/[itemId]",
        params: { serviceId, itemId },
      });
    },
    [router, serviceId],
  );

  const openPlayer = useCallback(
    (itemId: string, resumeTicks?: number | null) => {
      if (!serviceId || !itemId) {
        return;
      }

      const params: Record<string, string> = {
        serviceId,
        itemId,
      };

      if (typeof resumeTicks === "number" && resumeTicks > 0) {
        params.startTicks = String(Math.floor(resumeTicks));
      }

      router.push({
        pathname: "/(auth)/jellyfin/[serviceId]/player/[itemId]",
        params,
      });
    },
    [router, serviceId],
  );

  const handlePlayItem = useCallback(
    (item: JellyfinItem, resumeTicks?: number | null) => {
      if (!item?.Id) {
        return;
      }

      const ticksCandidate =
        resumeTicks ?? item.UserData?.PlaybackPositionTicks ?? null;

      openPlayer(item.Id, ticksCandidate);
    },
    [openPlayer],
  );

  const handleRefresh = useCallback(async () => {
    // Refresh all queries in parallel for better performance
    await Promise.all([
      librariesQuery.refetch(),
      libraryItemsInfiniteQuery.refetch(),
      resumeQuery.refetch(),
      nowPlayingQuery.refetch(),
    ]);
  }, [librariesQuery, libraryItemsInfiniteQuery, resumeQuery, nowPlayingQuery]);

  // Filter sessions to only those that actually have a NowPlayingItem. Some
  // connectors may return sessions without an active NowPlayingItem; avoid
  // showing the Now Playing section for those.
  const nowPlayingSessions = useMemo(
    () => (nowPlayingQuery.data ?? []).filter((s) => Boolean(s.NowPlayingItem)),
    [nowPlayingQuery.data],
  );

  const nowPlayingItemIds = useMemo(
    () =>
      new Set(
        nowPlayingSessions
          .map((s) => s.NowPlayingItem?.Id)
          .filter(Boolean) as string[],
      ),
    [nowPlayingSessions],
  );

  const continueWatchingItems = useMemo(
    () =>
      (resumeQuery.data ?? []).filter((it: JellyfinResumeItem) =>
        it.Id ? !nowPlayingItemIds.has(it.Id) : true,
      ),
    [resumeQuery.data, nowPlayingItemIds],
  );

  // Optimized render functions with stable dependencies
  const renderNowPlayingItem = useCallback(
    ({ item, index }: { item: JellyfinSession; index: number }) => {
      const playing = item.NowPlayingItem;
      if (!playing) return null;

      const title = playing.Name ?? "Untitled";
      const posterUri = buildPosterUri(connector, playing, 240);

      return (
        <Pressable
          key={item.Id}
          style={({ pressed }) => [
            styles.nowPlayingRow,
            pressed && styles.cardPressed,
          ]}
          onPress={() => handleOpenItem(playing.Id)}
        >
          <MediaPoster
            key={`now-playing-${item.Id || playing.Id || "unknown"}-${index}`}
            uri={posterUri}
            size={72}
            borderRadius={10}
          />
          <View style={styles.nowPlayingMeta}>
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={styles.nowPlayingTitle}
            >
              {title}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={styles.nowPlayingSubtitle}
            >
              {item.DeviceName ?? "Unknown Device"}
            </Text>
          </View>
          <IconButton
            icon="play-circle"
            accessibilityLabel="Play locally"
            onPress={() =>
              handlePlayItem(
                playing as JellyfinItem,
                (item.PlayState as JellyfinSessionPlayState | undefined)
                  ?.PositionTicks ?? null,
              )
            }
          />
          <IconButton
            icon="dots-vertical"
            accessibilityLabel="Session actions"
            onPress={() => void handleOpenNowPlaying()}
          />
        </Pressable>
      );
    },
    [
      connector,
      handleOpenItem,
      handleOpenNowPlaying,
      handlePlayItem,
      styles.cardPressed,
      styles.nowPlayingRow,
      styles.nowPlayingMeta,
      styles.nowPlayingTitle,
      styles.nowPlayingSubtitle,
    ],
  );

  const renderResumeItem = useCallback(
    ({ item, index }: { item: JellyfinResumeItem; index: number }) => {
      const title = item.SeriesName ?? item.Name ?? "Untitled";
      const posterUri = buildPosterUri(connector, item, 420);

      // Optimized progress calculation with early returns
      let progress: number | undefined;
      if (
        typeof item.UserData?.PlaybackPositionTicks === "number" &&
        typeof item.RunTimeTicks === "number"
      ) {
        const rawProgress =
          item.UserData.PlaybackPositionTicks / item.RunTimeTicks;
        progress = Math.min(Math.max(rawProgress, 0), 1);
      }

      // Responsive poster sizing - memoized calculation
      const posterSize = Math.max(
        120,
        Math.min(
          240,
          Math.floor((windowWidth - spacing.lg * 2 - spacing.md) / 2),
        ),
      );

      return (
        <View style={{ width: posterSize }}>
          <Pressable
            style={({ pressed }) => [
              styles.resumePosterWrap,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleOpenItem(item.Id)}
          >
            <View style={styles.resumePosterContainer}>
              <MediaPoster
                key={`resume-poster-${item.Id || item.Name || "unknown"}-${index}`}
                uri={posterUri}
                size={posterSize - 8}
                borderRadius={12}
                accessibilityLabel={`Continue watching ${title}`}
              />
              <Pressable
                style={styles.playOverlay}
                hitSlop={10}
                onPress={() =>
                  handlePlayItem(
                    item as JellyfinItem,
                    item.UserData?.PlaybackPositionTicks ?? null,
                  )
                }
              >
                <Icon source="play" size={28} color={theme.colors.onPrimary} />
              </Pressable>
              {typeof progress === "number" ? (
                <View style={styles.resumePosterProgressRail}>
                  <View
                    style={[
                      styles.resumePosterProgressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
              ) : null}
              {/* Download button for resume items */}
              {connector && serviceId && item.Id && (
                <View style={styles.resumeDownloadOverlay}>
                  <DownloadButton
                    serviceConfig={connector.config}
                    contentId={item.Id}
                    size="small"
                    variant="icon"
                    onDownloadStart={() => {}}
                    onDownloadError={() => {}}
                  />
                </View>
              )}
            </View>
          </Pressable>
          <Text
            numberOfLines={1}
            variant="bodySmall"
            style={styles.resumePosterTitle}
          >
            {title}
          </Text>
        </View>
      );
    },
    [
      connector,
      handleOpenItem,
      handlePlayItem,
      serviceId,
      windowWidth,
      theme,
      styles.cardPressed,
      styles.resumePosterWrap,
      styles.resumePosterContainer,
      styles.playOverlay,
      styles.resumePosterProgressRail,
      styles.resumePosterProgressFill,
      styles.resumeDownloadOverlay,
      styles.resumePosterTitle,
    ],
  );

  const renderLibraryItem = useCallback(
    ({ item, index }: { item: JellyfinItem; index: number }) => {
      // For TV segment representatives we may have attached internal
      // metadata: __navigationId (series id to navigate to) and
      // __posterSourceId (item id to use for the poster image). Use these
      // when present so we show a series-level grid even when the server
      // returned episodes.
      const posterUri = buildPosterUri(
        connector,
        item,
        480,
        (item as any).__posterSourceId as string | undefined,
      );
      const subtitle = deriveSubtitle(item, libraryState.activeSegment);
      const positionStyle =
        index % 2 === 0 ? styles.gridCardLeft : styles.gridCardRight;
      const isPlayable =
        item.Type === "Movie" ||
        item.Type === "Episode" ||
        item.Type === "Video" ||
        item.MediaType === "Video";

      // Optimized column sizing with pre-computed values
      const contentHorizontalPadding = spacing.lg * 2;
      const totalGaps = spacing.xl;
      const effectiveColumnWidth = Math.max(
        0,
        Math.floor(
          (windowWidth - contentHorizontalPadding - totalGaps) / numColumns,
        ),
      );
      const posterSize = Math.max(140, effectiveColumnWidth - spacing.md * 2);

      const navigationId = (item as any).__navigationId ?? item.Id;

      return (
        <AnimatedListItem index={index}>
          <View>
            <Pressable
              style={({ pressed }) => [
                styles.gridCard,
                positionStyle,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleOpenItem(navigationId)}
            >
              <View style={styles.posterFrame}>
                <MediaPoster
                  key={`poster-${item.Id || item.Name || "unknown"}-${index}`}
                  uri={posterUri}
                  size={posterSize}
                  borderRadius={12}
                />
                {isPlayable ? (
                  <Pressable
                    style={styles.gridPlayOverlay}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${item.Name ?? "item"}`}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      handlePlayItem(
                        item,
                        item.UserData?.PlaybackPositionTicks ?? null,
                      );
                    }}
                  >
                    <View style={styles.gridPlayButton}>
                      <Icon
                        source="play"
                        size={20}
                        color={theme.colors.onPrimary}
                      />
                    </View>
                  </Pressable>
                ) : null}
                {/* Download button overlay on poster */}
                {connector && serviceId && item.Id && (
                  <View style={styles.downloadOverlay}>
                    <DownloadButton
                      serviceConfig={connector.config}
                      contentId={item.Id}
                      size="small"
                      variant="icon"
                      onDownloadStart={() => {}}
                      onDownloadError={() => {}}
                    />
                  </View>
                )}
              </View>
              <Text
                variant="bodyMedium"
                numberOfLines={2}
                style={styles.gridTitle}
              >
                {item.Name ?? "Untitled"}
              </Text>
              {subtitle ? (
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={styles.gridSubtitle}
                >
                  {subtitle}
                </Text>
              ) : null}
            </Pressable>
          </View>
        </AnimatedListItem>
      );
    },
    [
      libraryState.activeSegment,
      connector,
      handlePlayItem,
      handleOpenItem,
      serviceId,
      windowWidth,
      styles.cardPressed,
      styles.gridCard,
      styles.gridCardLeft,
      styles.gridCardRight,
      styles.posterFrame,
      styles.downloadOverlay,
      styles.gridPlayOverlay,
      styles.gridPlayButton,
      styles.gridTitle,
      styles.gridSubtitle,
      theme.colors.onPrimary,
    ],
  );

  const listHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.toolbar}>
          <IconButton
            icon="arrow-left"
            accessibilityLabel="Go back"
            onPress={handleNavigateBack}
          />
          <View style={styles.toolbarTitleGroup}>
            <Text variant="titleLarge" style={styles.toolbarTitle}>
              Jellyfin Library
            </Text>
            <Text variant="bodySmall" style={styles.toolbarSubtitle}>
              {serviceName}
            </Text>
          </View>
          <View>
            <View style={styles.toolbarActions}>
              <IconButton
                icon="play-circle-outline"
                accessibilityLabel="Open now playing"
                onPress={handleOpenNowPlaying}
              />
              <IconButton
                icon="cog"
                accessibilityLabel="Edit service"
                onPress={handleOpenSettings}
              />
            </View>
          </View>
        </View>
        {/* Search + Tabs will be placed below Now Playing to match design */}
        {librariesForActiveSegment.length > 1 ? (
          <View>
            <View style={styles.libraryChipsRow}>
              {librariesForActiveSegment.map((library, i) => (
                <Chip
                  key={library.Id ?? String(i)}
                  mode={
                    libraryState.selectedLibraryId === library.Id
                      ? "flat"
                      : "outlined"
                  }
                  selected={libraryState.selectedLibraryId === library.Id}
                  onPress={() =>
                    dispatch({
                      type: "SET_LIBRARY_ID",
                      payload: library.Id ?? null,
                    })
                  }
                  style={styles.libraryChip}
                >
                  {library.Name}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        {continueWatchingItems && continueWatchingItems.length > 0 ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Continue Watching
              </Text>
              <IconButton
                icon="refresh"
                size={20}
                accessibilityLabel="Refresh continue watching"
                onPress={() => void resumeQuery.refetch()}
              />
            </View>

            <FlashList<JellyfinResumeItem>
              data={continueWatchingItems}
              keyExtractor={(item: JellyfinResumeItem, index: number) => {
                // Create a unique key using item Id and index to prevent virtualized list recycling issues
                const baseKey = item.Id || item.Name || "unknown";
                return `${baseKey}-${index}`;
              }}
              renderItem={renderResumeItem}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.resumeList}
            />
          </View>
        ) : null}

        {nowPlayingSessions && nowPlayingSessions.length > 0 ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Now Playing
              </Text>
              <IconButton
                icon="refresh"
                size={20}
                accessibilityLabel="Refresh now playing"
                onPress={() => void nowPlayingQuery.refetch()}
              />
            </View>

            <View style={styles.nowPlayingList}>
              {nowPlayingSessions.map((s, i) => (
                <View key={s.Id} style={{ marginBottom: spacing.sm }}>
                  {renderNowPlayingItem({
                    item: s as JellyfinSession,
                    index: i,
                  })}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <LatestMediaSection
          serviceId={serviceId!}
          libraries={librariesQuery.data ?? []}
          onOpenItem={handleOpenItem}
        />

        {/* Searchbar and Tabs placed here per design */}
        <View>
          <Searchbar
            placeholder="Search for movies, shows, or music"
            value={libraryState.searchTerm}
            onChangeText={(text) =>
              dispatch({ type: "SET_SEARCH_TERM", payload: text })
            }
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            accessibilityLabel="Search library"
          />
        </View>

        <View style={styles.segmentRow}>
          {collectionSegments.map((segment) => {
            const isActive = libraryState.activeSegment === segment.key;
            return (
              <Pressable
                key={segment.key}
                onPress={() =>
                  dispatch({ type: "SET_SEGMENT", payload: segment.key })
                }
                style={({ pressed }) => [
                  styles.segmentItem,
                  pressed && styles.segmentPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    isActive && styles.segmentLabelActive,
                  ]}
                >
                  {segment.label}
                </Text>
                <View
                  style={[
                    styles.segmentIndicator,
                    isActive && styles.segmentIndicatorActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }, [
    libraryState.activeSegment,
    handleNavigateBack,
    handleOpenItem,
    librariesQuery.data,
    serviceId,
    handleOpenNowPlaying,
    handleOpenSettings,
    renderResumeItem,
    continueWatchingItems,
    resumeQuery,
    nowPlayingSessions,
    nowPlayingQuery,
    renderNowPlayingItem,
    libraryState.searchTerm,
    libraryState.selectedLibraryId,
    serviceName,
    styles,
    librariesForActiveSegment,
  ]);

  const listEmptyComponent = useMemo(() => {
    if (!serviceId) {
      return (
        <EmptyState
          title="Service not specified"
          description="Select a Jellyfin connection from the dashboard before browsing the library."
        />
      );
    }

    if (librariesForActiveSegment.length === 0) {
      return (
        <EmptyState
          title="No library for this category"
          description="Add a matching Jellyfin library or switch categories to continue."
        />
      );
    }

    if (libraryState.debouncedSearch.length > 0) {
      return (
        <EmptyState
          title="No results found"
          description="Try a different search query or clear the filter."
        />
      );
    }

    // Check if we're in the middle of loading TV series metadata
    if (
      libraryState.activeSegment === "tv" &&
      displayItemsEnriched.length === 0 &&
      items.length > 0
    ) {
      return (
        <EmptyState
          title="Processing TV shows..."
          description="Organizing series information. This may take a moment."
        />
      );
    }

    return (
      <EmptyState
        title="Library is empty"
        description="Add media to this Jellyfin library and it will appear here."
      />
    );
  }, [
    libraryState.debouncedSearch.length,
    librariesForActiveSegment.length,
    serviceId,
    libraryState.activeSegment,
    displayItemsEnriched.length,
    items.length,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Content layer: always rendered but faded in when ready */}
      <View
        style={[
          styles.contentLayer,
          { opacity: libraryState.contentInteractive ? 1 : 0 },
        ]}
        pointerEvents={libraryState.contentInteractive ? "auto" : "none"}
      >
        <FlashList<EnrichedJellyfinItem>
          data={displayItemsEnriched}
          keyExtractor={(item: EnrichedJellyfinItem, index: number) => {
            // Create a unique key using item Id and index to prevent virtualized list recycling issues
            const baseKey = item.Id || item.Name || "unknown";
            return `${baseKey}-${index}`;
          }}
          renderItem={renderLibraryItem}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmptyComponent}
          onEndReached={() => {
            if (
              libraryItemsInfiniteQuery.hasNextPage &&
              !libraryItemsInfiniteQuery.isFetchingNextPage
            ) {
              void libraryItemsInfiniteQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <ListRefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
            />
          }
        />
      </View>

      {/* Skeleton overlay: mounted while visible and cross-fades out */}
      {libraryState.showSkeletonLayer ? (
        <View
          style={[styles.overlay]}
          pointerEvents={libraryState.showSkeletonLayer ? "auto" : "none"}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.xxl,
              }}
            >
              <View style={styles.headerContainer}>
                <View style={styles.toolbar}>
                  <View>
                    <SkeletonPlaceholder
                      width={32}
                      height={32}
                      borderRadius={16}
                    />
                  </View>
                  <SkeletonPlaceholder
                    width="40%"
                    height={28}
                    borderRadius={10}
                  />
                  <SkeletonPlaceholder
                    width={44}
                    height={44}
                    borderRadius={22}
                  />
                </View>
                <SkeletonPlaceholder
                  width="100%"
                  height={48}
                  borderRadius={24}
                  style={{ marginBottom: spacing.md }}
                />
                <SkeletonPlaceholder
                  width="55%"
                  height={36}
                  borderRadius={18}
                />
              </View>
              {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} style={{ marginBottom: spacing.md }}>
                  <SeriesListItemSkeleton />
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      ) : null}
      {errorMessage ? (
        <HelperText type="error" visible>
          {errorMessage}
        </HelperText>
      ) : null}
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    listContent: {
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    headerContainer: {
      gap: spacing.lg,
      paddingBottom: spacing.lg,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toolbarTitleGroup: {
      flex: 1,
      marginHorizontal: spacing.xs,
      // Center the title while keeping left/right actions aligned to edges
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      alignItems: "center",
    },
    toolbarTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    toolbarSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    toolbarActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    searchBar: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
    },
    searchInput: {
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    segmentedControl: {
      marginTop: -spacing.sm,
    },
    segmentRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.sm,
      alignItems: "center",
    },
    segmentItem: {
      alignItems: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    segmentPressed: {
      opacity: 0.85,
    },
    segmentLabel: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "600",
    },
    segmentLabelActive: {
      color: theme.colors.primary,
    },
    segmentIndicator: {
      height: 3,
      width: "100%",
      borderRadius: 3,
      marginTop: spacing.xs,
      backgroundColor: "transparent",
    },
    segmentIndicatorActive: {
      backgroundColor: theme.colors.primary,
    },
    libraryChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    libraryChip: {
      borderRadius: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    resumeList: {
      marginTop: spacing.sm,
      gap: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    resumePosterWrap: {
      alignItems: "center",
    },
    resumePosterContainer: {
      position: "relative",
      alignItems: "center",
    },
    playOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -18 }, { translateY: -18 }],
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: 6,
      borderRadius: 20,
    },
    resumePosterProgressRail: {
      position: "absolute",
      left: 8,
      right: 8,
      bottom: 8,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: "hidden",
    },
    resumeDownloadOverlay: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: 12,
    },
    resumePosterProgressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: 2,
    },
    resumePosterTitle: {
      marginTop: spacing.xs,
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    resumeCard: {
      flexDirection: "row",
      alignItems: "center",
      width: 280,
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceVariant,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    resumeMeta: {
      flex: 1,
      gap: spacing.xs,
    },
    resumeTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    resumeSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    progressContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    progressRail: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: 2,
    },
    progressText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      minWidth: 32,
      textAlign: "right",
    },
    listSeparator: {
      height: spacing.sm,
    },
    latestCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceVariant,
    },
    latestMeta: {
      flex: 1,
      gap: spacing.xxxs,
    },
    latestTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    latestSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    episodeChip: {
      alignSelf: "flex-start",
    },
    emptyStateInline: {
      marginTop: spacing.sm,
    },
    gridCard: {
      flex: 1,
      gap: spacing.xs,
      marginBottom: spacing.md,
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: "transparent",
      overflow: "visible",
    },
    posterFrame: {
      // Make poster the dominant element; minimal frame chrome
      padding: 0,
      borderRadius: 12,
      alignItems: "center",
    },
    gridPlayOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -18 }, { translateY: -18 }],
      zIndex: 2,
    },
    gridPlayButton: {
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      borderRadius: 20,
      padding: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
    },
    downloadOverlay: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: 16,
    },
    gridCardLeft: {
      marginRight: spacing.md,
    },
    gridCardRight: {
      marginLeft: spacing.md,
    },
    gridTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      textAlign: "center",
      marginTop: spacing.xs,
    },
    gridSubtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    nowPlayingList: {
      marginTop: spacing.sm,
    },
    nowPlayingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.sm,
      borderRadius: 10,
      backgroundColor: "transparent",
    },
    nowPlayingMeta: {
      flex: 1,
    },
    nowPlayingTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    nowPlayingSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    cardPressed: {
      opacity: 0.9,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
    },
    contentLayer: {
      flex: 1,
    },
  });

export default JellyfinLibraryScreen;
