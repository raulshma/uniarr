import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
// Animations removed: using plain Views instead of reanimated Animated.Views
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { SeriesListItemSkeleton } from "@/components/media/skeletons";

import { EmptyState } from "@/components/common/EmptyState";
import { MediaPoster } from "@/components/media/MediaPoster";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { useJellyfinLatestItems } from "@/hooks/useJellyfinLatestItems";
import { useJellyfinLibraries } from "@/hooks/useJellyfinLibraries";
import { useJellyfinLibraryItems } from "@/hooks/useJellyfinLibraryItems";
import { useQuery, useQueries } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import { useJellyfinResume } from "@/hooks/useJellyfinResume";
import { useJellyfinNowPlaying } from "@/hooks/useJellyfinNowPlaying";
import type {
  JellyfinItem,
  JellyfinLibraryView,
  JellyfinResumeItem,
  JellyfinSession,
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
  if (!idToUse) return undefined;
  return connector.getImageUrl(idToUse, "Primary", {
    tag,
    width: fallbackWidth,
  });
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

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [activeSegment, setActiveSegment] =
    useState<CollectionSegmentKey>("movies");
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        if (!manager.getConnector(serviceId)) {
          await manager.loadSavedServices();
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [manager, serviceId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

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

    if (firstAvailable && groupedLibraries[activeSegment].length === 0) {
      setActiveSegment(firstAvailable.key);
      setSelectedLibraryId(groupedLibraries[firstAvailable.key][0]?.Id ?? null);
      return;
    }

    if (groupedLibraries[activeSegment].length > 0) {
      const libraryIds = groupedLibraries[activeSegment].map(
        (library) => library?.Id ?? "",
      );
      if (!selectedLibraryId || !libraryIds.includes(selectedLibraryId)) {
        setSelectedLibraryId(groupedLibraries[activeSegment][0]?.Id ?? null);
      }
    }
  }, [activeSegment, groupedLibraries, selectedLibraryId]);

  const activeSegmentConfig = useMemo(
    () =>
      collectionSegments.find((segment) => segment.key === activeSegment) ??
      collectionSegments[0]!,
    [activeSegment],
  );

  const resumeQuery = useJellyfinResume({ serviceId, limit: 12 });
  const nowPlayingQuery = useJellyfinNowPlaying({
    serviceId,
    refetchInterval: 10_000,
  });
  const latestQuery = useJellyfinLatestItems({
    serviceId,
    libraryId: selectedLibraryId ?? undefined,
    limit: 16,
  });
  const libraryItemsQuery = useJellyfinLibraryItems({
    serviceId,
    libraryId: selectedLibraryId ?? undefined,
    searchTerm: debouncedSearch,
    includeItemTypes: activeSegmentConfig.includeItemTypes,
    mediaTypes: activeSegmentConfig.mediaTypes,
    sortBy: "SortName",
    sortOrder: "Ascending",
    limit: 60,
  });

  // If the primary filtered query returns no items, fetch a fallback set
  // without an explicit IncludeItemTypes filter so we can surface content
  // for libraries that expose Seasons/Episodes rather than Series at the
  // immediate parent level.
  const fallbackLibraryItemsQuery = useQuery<JellyfinItem[]>({
    queryKey:
      serviceId && selectedLibraryId
        ? queryKeys.jellyfin.libraryItems(serviceId, selectedLibraryId, {
            search: debouncedSearch.toLowerCase(),
          })
        : queryKeys.jellyfin.base,
    enabled: Boolean(
      serviceId &&
        selectedLibraryId &&
        libraryItemsQuery.isSuccess &&
        (libraryItemsQuery.data?.length ?? 0) === 0,
    ),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous?: JellyfinItem[] | undefined) => previous ?? [],
    queryFn: async () => {
      if (!serviceId || !selectedLibraryId) return [] as JellyfinItem[];

      let connector = manager.getConnector(serviceId) as
        | JellyfinConnector
        | undefined;
      if (!connector) {
        await manager.loadSavedServices();
        connector = manager.getConnector(serviceId) as
          | JellyfinConnector
          | undefined;
      }

      if (!connector) return [] as JellyfinItem[];

      return connector.getLibraryItems(selectedLibraryId, {
        searchTerm: debouncedSearch,
        // intentionally omit includeItemTypes to widen results
        mediaTypes: activeSegmentConfig.mediaTypes,
        sortBy: "SortName",
        sortOrder: "Ascending",
        limit: 60,
      });
    },
  });

  const serviceName = connector?.config.name ?? "Jellyfin";

  const isInitialLoad =
    isBootstrapping ||
    librariesQuery.isLoading ||
    libraryItemsQuery.isLoading ||
    resumeQuery.isLoading ||
    nowPlayingQuery.isLoading ||
    latestQuery.isLoading;
  const isRefreshing =
    (libraryItemsQuery.isFetching ||
      fallbackLibraryItemsQuery.isFetching ||
      resumeQuery.isFetching ||
      latestQuery.isFetching ||
      librariesQuery.isFetching ||
      nowPlayingQuery.isFetching) &&
    !isInitialLoad;

  // Simplified: show skeleton overlay while initial load. No animated
  // cross-fade; toggling happens synchronously to keep UI snappy.
  const [showSkeletonLayer, setShowSkeletonLayer] = useState(isInitialLoad);
  const [contentInteractive, setContentInteractive] = useState(!isInitialLoad);

  useEffect(() => {
    if (isInitialLoad) {
      setShowSkeletonLayer(true);
      setContentInteractive(false);
    } else {
      setShowSkeletonLayer(false);
      setContentInteractive(true);
    }
  }, [isInitialLoad]);

  const aggregatedError =
    librariesQuery.error ??
    libraryItemsQuery.error ??
    fallbackLibraryItemsQuery.error ??
    resumeQuery.error ??
    nowPlayingQuery.error ??
    latestQuery.error;
  const errorMessage =
    aggregatedError instanceof Error
      ? aggregatedError.message
      : aggregatedError
        ? "Unable to load Jellyfin data."
        : null;

  const items = useMemo(
    () =>
      libraryItemsQuery.data && libraryItemsQuery.data.length > 0
        ? libraryItemsQuery.data
        : (fallbackLibraryItemsQuery.data ?? []),
    [libraryItemsQuery.data, fallbackLibraryItemsQuery.data],
  );

  // Derive displayItems: for the TV segment, prefer actual 'Series' items. If
  // none are returned (some libraries expose Seasons/Episodes instead), group
  // episodes by SeriesId/SeriesName and create representative entries so the
  // UI shows series-level cards instead of individual episodes.
  const displayItems = useMemo(() => {
    if (activeSegment !== "tv") return items;

    const seriesItems = items.filter((it) => it.Type === "Series");
    if (seriesItems.length > 0) return seriesItems;

    const grouped = new Map<
      string,
      JellyfinItem & { __navigationId?: string; __posterSourceId?: string }
    >();

    for (const it of items) {
      const seriesKey = String(
        it.SeriesId ?? it.ParentId ?? it.SeriesName ?? it.Id ?? "",
      );
      if (!grouped.has(seriesKey)) {
        // Create a representative item (shallow copy) and attach metadata
        // for navigation (series id) and poster source (episode id).
        const rep = {
          ...it,
          Name: it.SeriesName ?? it.Name,
          Type: "Series",
          PrimaryImageTag: extractPrimaryImageTag(it),
          __navigationId: it.SeriesId ?? it.ParentId ?? it.Id,
          __posterSourceId: it.Id,
        } as JellyfinItem & {
          __navigationId?: string;
          __posterSourceId?: string;
        };
        grouped.set(seriesKey, rep);
      }
    }

    return Array.from(grouped.values());
  }, [items, activeSegment]);

  // When we have series representatives, fetch their full series-level
  // metadata (including the series' own PrimaryImageTag) in the
  // background so we can replace episode posters with proper series
  // artwork when available.
  const seriesIds = useMemo(() => {
    if (activeSegment !== "tv") return [] as string[];
    const ids = new Set<string>();
    for (const it of displayItems) {
      const maybeNav = getInternalStringField(it, "__navigationId");
      if (maybeNav) ids.add(maybeNav);
      else if (it.Type === "Series" && it.Id) ids.add(it.Id as string);
    }
    return Array.from(ids);
  }, [displayItems, activeSegment]);

  const seriesQueries = useQueries({
    queries: seriesIds.map((seriesId) => ({
      queryKey: queryKeys.jellyfin.item(serviceId ?? "unknown", seriesId),
      enabled: Boolean(serviceId && seriesId),
      staleTime: 1000 * 60 * 60, // 1 hour
      refetchOnWindowFocus: false,
      queryFn: async () => {
        if (!serviceId) return null;
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
          return await connector.getItem(seriesId);
        } catch {
          return null;
        }
      },
    })),
  });

  const seriesMetaMap = useMemo(() => {
    const map = new Map<string, JellyfinItem>();
    for (let i = 0; i < seriesIds.length; i++) {
      const id = seriesIds[i];
      if (!id) continue;
      const q = seriesQueries[i] as { data?: JellyfinItem | null } | undefined;
      if (q && q.data) {
        map.set(id, q.data);
      }
    }
    return map;
  }, [seriesIds, seriesQueries]);

  const displayItemsEnriched = useMemo(() => {
    if (activeSegment !== "tv") return displayItems;
    return displayItems.map((it) => {
      const navId = getInternalStringField(it, "__navigationId") ?? it.Id;
      const meta = navId ? seriesMetaMap.get(navId) : undefined;
      if (!meta) return it;
      return {
        ...it,
        // Use the series item's id for poster requests when possible
        __posterSourceId:
          meta.Id ?? getInternalStringField(it, "__posterSourceId"),
        // Prefer series-level title if available
        Name: meta.Name ?? it.Name,
        PrimaryImageTag:
          extractPrimaryImageTag(meta) ?? extractPrimaryImageTag(it),
        ImageTags:
          (meta as unknown as { ImageTags?: Record<string, string> })
            ?.ImageTags ??
          (it as unknown as { ImageTags?: Record<string, string> })?.ImageTags,
      } as JellyfinItem & { __posterSourceId?: string };
    });
  }, [displayItems, seriesMetaMap, activeSegment]);

  const librariesForActiveSegment = useMemo(
    () => groupedLibraries[activeSegment] ?? [],
    [groupedLibraries, activeSegment],
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

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      librariesQuery.refetch(),
      libraryItemsQuery.refetch(),
      resumeQuery.refetch(),
      nowPlayingQuery.refetch(),
      latestQuery.refetch(),
    ]);
  }, [
    latestQuery,
    librariesQuery,
    libraryItemsQuery,
    resumeQuery,
    nowPlayingQuery,
  ]);

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
      (resumeQuery.data ?? []).filter((it) =>
        it.Id ? !nowPlayingItemIds.has(it.Id) : true,
      ),
    [resumeQuery.data, nowPlayingItemIds],
  );

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
          <MediaPoster uri={posterUri} size={72} borderRadius={10} />
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
            icon="dots-vertical"
            accessibilityLabel="Session actions"
            onPress={() => void handleOpenNowPlaying()}
          />
        </Pressable>
      );
    },
    [connector, handleOpenItem, handleOpenNowPlaying, styles],
  );

  const renderResumeItem = useCallback(
    ({ item, index }: { item: JellyfinResumeItem; index: number }) => {
      const title = item.SeriesName ?? item.Name ?? "Untitled";
      const posterUri = buildPosterUri(connector, item, 420);
      const progress =
        typeof item.UserData?.PlaybackPositionTicks === "number" &&
        typeof item.RunTimeTicks === "number"
          ? Math.min(
              Math.max(
                item.UserData.PlaybackPositionTicks / item.RunTimeTicks,
                0,
              ),
              1,
            )
          : undefined;

      // Responsive poster sizing: prefer two items visible on wide screens
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
                uri={posterUri}
                size={posterSize - 8}
                borderRadius={12}
                accessibilityLabel={`Continue watching ${title}`}
              />
              <View style={styles.playOverlay} pointerEvents="none">
                <Icon source="play" size={28} color={theme.colors.onPrimary} />
              </View>
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
    [connector, handleOpenItem, styles, windowWidth, theme],
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
      const subtitle = deriveSubtitle(item, activeSegment);
      const positionStyle =
        index % 2 === 0 ? styles.gridCardLeft : styles.gridCardRight;

      // Column sizing: compute card/poster size so image is the focus
      const contentHorizontalPadding = spacing.lg * 2; // listContent applies paddingHorizontal: spacing.lg
      const totalGaps = spacing.xl; // space between columns (gridCardLeft/right use spacing.md)
      const effectiveColumnWidth = Math.max(
        0,
        Math.floor(
          (windowWidth - contentHorizontalPadding - totalGaps) / numColumns,
        ),
      );
      const posterSize = Math.max(140, effectiveColumnWidth - spacing.md * 2);
      const innerPosterSize = posterSize;

      return (
        <View>
          <Pressable
            style={({ pressed }) => [
              styles.gridCard,
              positionStyle,
              pressed && styles.cardPressed,
            ]}
            onPress={() =>
              handleOpenItem((item as any).__navigationId ?? item.Id)
            }
          >
            <View style={styles.posterFrame}>
              <MediaPoster
                uri={posterUri}
                size={innerPosterSize}
                borderRadius={12}
              />
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
      );
    },
    [activeSegment, connector, handleOpenItem, styles, windowWidth],
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
                  mode={selectedLibraryId === library.Id ? "flat" : "outlined"}
                  selected={selectedLibraryId === library.Id}
                  onPress={() => setSelectedLibraryId(library.Id ?? null)}
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

            <FlashList
              data={continueWatchingItems}
              keyExtractor={(item) => item.Id ?? item.Name ?? ""}
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

        {/* Searchbar and Tabs placed here per design */}
        <View>
          <Searchbar
            placeholder="Search for movies, shows, or music"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            accessibilityLabel="Search library"
          />
        </View>

        <View style={styles.segmentRow}>
          {collectionSegments.map((segment) => {
            const isActive = activeSegment === segment.key;
            return (
              <Pressable
                key={segment.key}
                onPress={() => setActiveSegment(segment.key)}
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
    activeSegment,
    handleNavigateBack,
    handleOpenNowPlaying,
    handleOpenSettings,

    renderResumeItem,
    continueWatchingItems,
    resumeQuery,
    nowPlayingSessions,
    nowPlayingQuery,
    renderNowPlayingItem,
    searchTerm,
    selectedLibraryId,
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

    if (debouncedSearch.length > 0) {
      return (
        <EmptyState
          title="No results found"
          description="Try a different search query or clear the filter."
        />
      );
    }

    return (
      <EmptyState
        title="Library is empty"
        description="Add media to this Jellyfin library and it will appear here."
      />
    );
  }, [debouncedSearch.length, librariesForActiveSegment.length, serviceId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Content layer: always rendered but faded in when ready */}
      <View
        style={[styles.contentLayer, { opacity: contentInteractive ? 1 : 0 }]}
        pointerEvents={contentInteractive ? "auto" : "none"}
      >
        <FlashList
          data={displayItemsEnriched}
          keyExtractor={(item) => item.Id ?? item.Name ?? ""}
          renderItem={renderLibraryItem}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmptyComponent}
          refreshControl={
            <ListRefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
            />
          }
        />
      </View>

      {/* Skeleton overlay: mounted while visible and cross-fades out */}
      {showSkeletonLayer ? (
        <View
          style={[styles.overlay]}
          pointerEvents={showSkeletonLayer ? "auto" : "none"}
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
