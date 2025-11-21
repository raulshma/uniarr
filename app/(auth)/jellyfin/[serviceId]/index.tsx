import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { HelperText, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { SeriesListItemSkeleton } from "@/components/media/skeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { ResumePlaybackDialog } from "@/components/jellyfin/ResumePlaybackDialog";
import LatestMediaSection from "@/components/jellyfin/LatestMediaSection";

import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type {
  JellyfinItem,
  JellyfinLibraryView,
} from "@/models/jellyfin.types";
import { spacing } from "@/theme/spacing";

import { useJellyfinLibraryState } from "./hooks/useJellyfinLibraryState";
import {
  useJellyfinLibraryData,
  collectionSegments,
} from "./hooks/useJellyfinLibraryData";
import { useJellyfinSeriesMetadata } from "./hooks/useJellyfinSeriesMetadata";
import {
  useJellyfinDisplayItems,
  type EnrichedJellyfinItem,
} from "./hooks/useJellyfinDisplayItems";
import { JellyfinLibraryHeader } from "./components/JellyfinLibraryHeader";
import { NowPlayingSection } from "./components/NowPlayingSection";
import { ContinueWatchingSection } from "./components/ContinueWatchingSection";
import { LibraryGridItem } from "./components/LibraryGridItem";

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

  // State management
  const { state: libraryState, dispatch } = useJellyfinLibraryState();

  // Resume playback dialog state
  const [resumeDialogState, setResumeDialogState] = React.useState<{
    visible: boolean;
    item: JellyfinItem | null;
    resumeTicks: number | null;
  }>({
    visible: false,
    item: null,
    resumeTicks: null,
  });

  const connector = useMemo(() => {
    if (!serviceId) return undefined;
    return manager.getConnector(serviceId) as JellyfinConnector | undefined;
  }, [manager, serviceId]);

  // Bootstrap connector
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
  }, [manager, serviceId, dispatch]);

  // Fetch library data
  const {
    librariesQuery,
    libraryItemsInfiniteQuery,
    resumeQuery,
    nowPlayingQuery,
  } = useJellyfinLibraryData({
    serviceId,
    selectedLibraryId: libraryState.selectedLibraryId,
    activeSegment: libraryState.activeSegment,
    debouncedSearch: libraryState.debouncedSearch,
  });

  // Group libraries by segment
  const groupedLibraries = useMemo(() => {
    const groups: {
      movies: JellyfinLibraryView[];
      tv: JellyfinLibraryView[];
      music: JellyfinLibraryView[];
    } = {
      movies: [],
      tv: [],
      music: [],
    };

    if (!librariesQuery.data) return groups;

    for (const library of librariesQuery.data) {
      const libraryWithType = library as JellyfinLibraryView & {
        CollectionType?: string;
      };
      const type = (libraryWithType.CollectionType ?? "").toLowerCase();
      const segment = collectionSegments.find((candidate) =>
        (candidate.types as readonly string[]).includes(type),
      );
      if (segment) {
        if (segment.key === "movies") groups.movies.push(library);
        else if (segment.key === "tv") groups.tv.push(library);
        else if (segment.key === "music") groups.music.push(library);
      }
    }

    return groups;
  }, [librariesQuery.data]);

  // Auto-select first available library
  useEffect(() => {
    const firstAvailable = collectionSegments.find(
      (segment) => (groupedLibraries[segment.key] ?? []).length > 0,
    );

    if (
      firstAvailable &&
      (groupedLibraries[libraryState.activeSegment] ?? []).length === 0
    ) {
      dispatch({ type: "SET_SEGMENT", payload: firstAvailable.key });
      dispatch({
        type: "SET_LIBRARY_ID",
        payload: (groupedLibraries[firstAvailable.key] ?? [])[0]?.Id ?? null,
      });
      return;
    }

    if ((groupedLibraries[libraryState.activeSegment] ?? []).length > 0) {
      const libraryIds = (
        groupedLibraries[libraryState.activeSegment] ?? []
      ).map((library) => library?.Id ?? "");
      if (
        !libraryState.selectedLibraryId ||
        !libraryIds.includes(libraryState.selectedLibraryId)
      ) {
        dispatch({
          type: "SET_LIBRARY_ID",
          payload:
            (groupedLibraries[libraryState.activeSegment] ?? [])[0]?.Id ?? null,
        });
      }
    }
  }, [
    libraryState.activeSegment,
    groupedLibraries,
    libraryState.selectedLibraryId,
    dispatch,
  ]);

  const items = useMemo(
    () => libraryItemsInfiniteQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [libraryItemsInfiniteQuery.data],
  );

  // Process display items
  const { displayItemsEnriched } = useJellyfinDisplayItems({
    items,
    activeSegment: libraryState.activeSegment,
    debouncedSearch: libraryState.debouncedSearch,
    seriesMetaMap: useJellyfinSeriesMetadata({
      serviceId,
      displayItems: items,
      activeSegment: libraryState.activeSegment,
    }),
  });

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

  // Manage skeleton state
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
  }, [isInitialLoad, dispatch]);

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

  const librariesForActiveSegment = useMemo(
    () => groupedLibraries[libraryState.activeSegment] ?? [],
    [groupedLibraries, libraryState.activeSegment],
  );

  // Event handlers
  const handleNavigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenSettings = useCallback(() => {
    if (!serviceId) return;
    router.push({ pathname: "/(auth)/edit-service", params: { serviceId } });
  }, [router, serviceId]);

  const handleOpenNowPlaying = useCallback(() => {
    if (!serviceId) return;
    router.push({
      pathname: "/(auth)/jellyfin/[serviceId]/now-playing",
      params: { serviceId },
    });
  }, [router, serviceId]);

  const handleOpenItem = useCallback(
    (itemId?: string) => {
      if (!serviceId || !itemId) return;
      router.push({
        pathname: "/(auth)/jellyfin/[serviceId]/details/[itemId]",
        params: { serviceId, itemId },
      });
    },
    [router, serviceId],
  );

  const openPlayer = useCallback(
    (itemId: string, resumeTicks?: number | null) => {
      if (!serviceId || !itemId) return;

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
      if (!item?.Id) return;

      const ticksCandidate =
        resumeTicks ?? item.UserData?.PlaybackPositionTicks ?? null;

      const hasProgress = ticksCandidate && ticksCandidate > 600_000_000;

      if (hasProgress) {
        setResumeDialogState({
          visible: true,
          item,
          resumeTicks: ticksCandidate,
        });
      } else {
        openPlayer(item.Id, null);
      }
    },
    [openPlayer],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      librariesQuery.refetch(),
      libraryItemsInfiniteQuery.refetch(),
      resumeQuery.refetch(),
      nowPlayingQuery.refetch(),
    ]);
  }, [librariesQuery, libraryItemsInfiniteQuery, resumeQuery, nowPlayingQuery]);

  // Filter now playing sessions
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
      (resumeQuery.data ?? []).filter((it: any) =>
        it.Id ? !nowPlayingItemIds.has(it.Id) : true,
      ),
    [resumeQuery.data, nowPlayingItemIds],
  );

  // Render library item
  const renderLibraryItem = useCallback(
    ({ item, index }: { item: EnrichedJellyfinItem; index: number }) => (
      <LibraryGridItem
        item={item}
        index={index}
        connector={connector}
        serviceId={serviceId}
        activeSegment={libraryState.activeSegment}
        windowWidth={windowWidth}
        numColumns={numColumns}
        onOpenItem={handleOpenItem}
        onPlayItem={handlePlayItem}
      />
    ),
    [
      connector,
      serviceId,
      libraryState.activeSegment,
      windowWidth,
      handleOpenItem,
      handlePlayItem,
    ],
  );

  // List header
  const listHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        <JellyfinLibraryHeader
          serviceName={serviceName}
          activeSegment={libraryState.activeSegment}
          selectedLibraryId={libraryState.selectedLibraryId}
          searchTerm={libraryState.searchTerm}
          librariesForActiveSegment={librariesForActiveSegment}
          onNavigateBack={handleNavigateBack}
          onOpenSettings={handleOpenSettings}
          onOpenNowPlaying={handleOpenNowPlaying}
          onSegmentChange={(segment) =>
            dispatch({ type: "SET_SEGMENT", payload: segment })
          }
          onLibraryChange={(libraryId) =>
            dispatch({ type: "SET_LIBRARY_ID", payload: libraryId })
          }
          onSearchChange={(text) =>
            dispatch({ type: "SET_SEARCH_TERM", payload: text })
          }
        />

        <ContinueWatchingSection
          items={continueWatchingItems}
          connector={connector}
          serviceId={serviceId}
          windowWidth={windowWidth}
          onOpenItem={handleOpenItem}
          onPlayItem={handlePlayItem}
          onRefresh={() => void resumeQuery.refetch()}
        />

        <NowPlayingSection
          sessions={nowPlayingSessions}
          connector={connector}
          onOpenItem={handleOpenItem}
          onPlayItem={handlePlayItem}
          onOpenNowPlaying={handleOpenNowPlaying}
          onRefresh={() => void nowPlayingQuery.refetch()}
        />

        {serviceId && (
          <LatestMediaSection
            serviceId={serviceId}
            libraries={librariesQuery.data ?? []}
            onOpenItem={handleOpenItem}
          />
        )}
      </View>
    );
  }, [
    libraryState.activeSegment,
    libraryState.selectedLibraryId,
    libraryState.searchTerm,
    handleNavigateBack,
    handleOpenItem,
    handleOpenSettings,
    handleOpenNowPlaying,
    librariesQuery.data,
    serviceId,
    continueWatchingItems,
    resumeQuery,
    nowPlayingSessions,
    nowPlayingQuery,
    serviceName,
    styles,
    librariesForActiveSegment,
    connector,
    windowWidth,
    handlePlayItem,
    dispatch,
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
          estimatedItemSize={200}
        />
      </View>

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

      <ResumePlaybackDialog
        visible={resumeDialogState.visible}
        onDismiss={() =>
          setResumeDialogState({
            visible: false,
            item: null,
            resumeTicks: null,
          })
        }
        onResume={() => {
          if (resumeDialogState.item?.Id) {
            openPlayer(
              resumeDialogState.item.Id,
              resumeDialogState.resumeTicks,
            );
          }
          setResumeDialogState({
            visible: false,
            item: null,
            resumeTicks: null,
          });
        }}
        onStartFromBeginning={() => {
          if (resumeDialogState.item?.Id) {
            openPlayer(resumeDialogState.item.Id, null);
          }
          setResumeDialogState({
            visible: false,
            item: null,
            resumeTicks: null,
          });
        }}
        itemTitle={resumeDialogState.item?.Name}
        playedPercentage={resumeDialogState.item?.UserData?.PlayedPercentage}
        positionTicks={resumeDialogState.resumeTicks ?? undefined}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
