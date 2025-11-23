import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  RefreshControl,
  Pressable,
  ImageBackground,
} from "react-native";
import { HelperText, useTheme, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { SeriesListItemSkeleton } from "@/components/media/skeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { ResumePlaybackDialog } from "@/components/jellyfin/ResumePlaybackDialog";
import { WatchStatusBadge } from "@/components/jellyfin/WatchStatusBadge";
import LatestMediaSection from "@/components/jellyfin/LatestMediaSection";
import { JellyfinQuickViewModal } from "@/components/jellyfin/JellyfinQuickViewModal";

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

  // Quick view modal state
  const [quickViewState, setQuickViewState] = React.useState<{
    visible: boolean;
    item: JellyfinItem | null;
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageX: number;
      pageY: number;
    } | null;
  }>({
    visible: false,
    item: null,
    layout: null,
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

  const handleQuickView = useCallback(
    (
      item: JellyfinItem,
      layout: {
        x: number;
        y: number;
        width: number;
        height: number;
        pageX: number;
        pageY: number;
      },
    ) => {
      setQuickViewState({
        visible: true,
        item,
        layout,
      });
    },
    [],
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

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const paddingToBottom = 20;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;

      if (
        isCloseToBottom &&
        libraryItemsInfiniteQuery.hasNextPage &&
        !libraryItemsInfiniteQuery.isFetchingNextPage
      ) {
        void libraryItemsInfiniteQuery.fetchNextPage();
      }
    },
    [libraryItemsInfiniteQuery],
  );

  // Split items into two columns for masonry layout
  const { leftColumn, rightColumn } = useMemo(() => {
    const left: { item: EnrichedJellyfinItem; height: number }[] = [];
    const right: { item: EnrichedJellyfinItem; height: number }[] = [];

    displayItemsEnriched.forEach((item, index) => {
      const heights = [200, 250, 300, 220, 280, 320, 240, 260];
      const height = heights[index % heights.length] ?? 250;

      if (index % 2 === 0) {
        left.push({ item, height });
      } else {
        right.push({ item, height });
      }
    });

    return { leftColumn: left, rightColumn: right };
  }, [displayItemsEnriched]);

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
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={400}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={theme.colors.primary}
            />
          }
        >
          {/* Header Section */}
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

          {/* Masonry Grid */}
          {displayItemsEnriched.length > 0 ? (
            <View style={styles.masonryContainer}>
              {/* First column - normal scroll */}
              <View style={styles.column}>
                {leftColumn.map(({ item, height }, index) => (
                  <MasonryItem
                    key={`left-${item.Id || index}`}
                    item={item}
                    height={height}
                    connector={connector}
                    onOpenItem={handleOpenItem}
                    onPlayItem={handlePlayItem}
                    onQuickView={handleQuickView}
                    theme={theme}
                  />
                ))}
              </View>

              {/* Second column */}
              <View style={styles.column}>
                {rightColumn.map(({ item, height }, index) => (
                  <MasonryItem
                    key={`right-${item.Id || index}`}
                    item={item}
                    height={height}
                    connector={connector}
                    onOpenItem={handleOpenItem}
                    onPlayItem={handlePlayItem}
                    onQuickView={handleQuickView}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          ) : (
            listEmptyComponent
          )}
        </ScrollView>
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

      <JellyfinQuickViewModal
        visible={quickViewState.visible}
        item={quickViewState.item}
        initialLayout={quickViewState.layout}
        connector={connector}
        onDismiss={() =>
          setQuickViewState({
            visible: false,
            item: null,
            layout: null,
          })
        }
        onOpenDetails={handleOpenItem}
        onPlay={handlePlayItem}
      />
    </SafeAreaView>
  );
};

// Masonry Item Component
interface MasonryItemProps {
  item: EnrichedJellyfinItem;
  height: number;
  connector: JellyfinConnector | undefined;
  onOpenItem: (itemId?: string) => void;
  onPlayItem: (item: JellyfinItem, resumeTicks?: number | null) => void;
  onQuickView: (
    item: JellyfinItem,
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageX: number;
      pageY: number;
    },
  ) => void;
  theme: AppTheme;
}

const MasonryItem: React.FC<MasonryItemProps> = ({
  item,
  height,
  connector,
  onOpenItem,
  onPlayItem,
  onQuickView,
  theme,
}) => {
  const styles = useMemo(() => createMasonryItemStyles(theme), [theme]);
  const itemRef = React.useRef<View>(null);
  const posterUri = useMemo(
    () =>
      `${connector?.config.url}/Items/${item.Id}/Images/Primary?maxHeight=600&quality=90`,
    [connector, item.Id],
  );

  const isPlayable =
    item.Type === "Movie" ||
    item.Type === "Episode" ||
    item.Type === "Video" ||
    item.MediaType === "Video";

  const navigationId = (item as any).__navigationId ?? item.Id;

  const handleLongPress = () => {
    itemRef.current?.measure((x, y, width, height, pageX, pageY) => {
      onQuickView(item, { x, y, width, height, pageX, pageY });
    });
  };

  return (
    <Pressable
      ref={itemRef}
      onPress={() => onOpenItem(navigationId)}
      onLongPress={handleLongPress}
      style={styles.itemContainer}
    >
      <ImageBackground
        source={{ uri: posterUri }}
        style={[styles.imageBackground, { height }]}
        imageStyle={styles.imageStyle}
      >
        <WatchStatusBadge
          userData={item.UserData}
          position="top-right"
          showProgressBar={true}
        />

        {isPlayable && (
          <Pressable
            style={styles.playOverlay}
            onPress={(event) => {
              event.stopPropagation?.();
              onPlayItem(item, item.UserData?.PlaybackPositionTicks ?? null);
            }}
          >
            <View style={styles.playButton}>
              <MaterialCommunityIcons
                name="play"
                size={24}
                color={theme.colors.onPrimary}
              />
            </View>
          </Pressable>
        )}

        <LinearGradient
          style={styles.gradient}
          colors={["transparent", "rgba(0, 0, 0, 0.7)"]}
        >
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.Name ?? "Untitled"}
          </Text>
          {item.ProductionYear && (
            <Text style={styles.itemYear}>{item.ProductionYear}</Text>
          )}
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
};

const createMasonryItemStyles = (theme: AppTheme) =>
  StyleSheet.create({
    itemContainer: {
      marginBottom: spacing.sm,
    },
    imageBackground: {
      width: "100%",
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    imageStyle: {
      borderRadius: 16,
    },
    gradient: {
      padding: spacing.md,
      alignItems: "flex-start",
      justifyContent: "flex-end",
    },
    itemTitle: {
      color: "#FFFFFF",
      fontWeight: "bold",
      fontSize: 16,
    },
    itemYear: {
      color: "rgba(255, 255, 255, 0.8)",
      fontSize: 12,
      marginTop: spacing.xs,
    },
    playOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -22 }, { translateY: -22 }],
      zIndex: 2,
    },
    playButton: {
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 22,
      padding: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      width: 44,
      height: 44,
    },
  });

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      gap: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    masonryContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    column: {
      flex: 1,
      paddingHorizontal: spacing.xs,
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
