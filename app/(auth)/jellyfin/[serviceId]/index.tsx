import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import {
  Chip,
  HelperText,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Text,
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
import { useJellyfinResume } from "@/hooks/useJellyfinResume";
import type {
  JellyfinItem,
  JellyfinLatestItem,
  JellyfinLibraryView,
  JellyfinResumeItem,
} from "@/models/jellyfin.types";
import { spacing } from "@/theme/spacing";

type CollectionSegmentKey = "movies" | "tv" | "music";

const collectionSegments: ReadonlyArray<{
  readonly key: CollectionSegmentKey;
  readonly label: string;
  readonly types: readonly string[];
  readonly includeItemTypes: readonly string[];
  readonly mediaTypes: readonly string[];
}> = [
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

const formatEpisodeLabel = (item: JellyfinItem): string | undefined => {
  if (item.Type !== "Episode") {
    return undefined;
  }

  const season =
    typeof item.ParentIndexNumber === "number"
      ? `S${String(item.ParentIndexNumber).padStart(2, "0")}`
      : "";
  const episode =
    typeof item.IndexNumber === "number"
      ? `E${String(item.IndexNumber).padStart(2, "0")}`
      : "";

  if (!season && !episode) {
    return undefined;
  }

  return `${season}${episode}`.trim();
};

const formatRuntimeMinutes = (ticks?: number): number | undefined => {
  if (!ticks || ticks <= 0) {
    return undefined;
  }

  const minutes = Math.round(ticks / 600_000_000);
  return minutes > 0 ? minutes : undefined;
};

const deriveSubtitle = (
  item: JellyfinItem,
  segment: CollectionSegmentKey
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
  fallbackWidth: number
): string | undefined => {
  if (!connector) {
    return undefined;
  }

  const tag = item.PrimaryImageTag ?? item.ImageTags?.Primary;
  if (!tag) {
    return undefined;
  }

  return connector.getImageUrl(item.Id, "Primary", {
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
    null
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
      const type = (library.CollectionType ?? "").toLowerCase();
      const segment = collectionSegments.find((candidate) =>
        candidate.types.includes(type)
      );
      if (segment) {
        groups[segment.key].push(library);
      }
    });

    return groups;
  }, [librariesQuery.data]);

  useEffect(() => {
    const firstAvailable = collectionSegments.find(
      (segment) => groupedLibraries[segment.key].length > 0
    );

    if (firstAvailable && groupedLibraries[activeSegment].length === 0) {
      setActiveSegment(firstAvailable.key);
      setSelectedLibraryId(groupedLibraries[firstAvailable.key][0]?.Id ?? null);
      return;
    }

    if (groupedLibraries[activeSegment].length > 0) {
      const libraryIds = groupedLibraries[activeSegment].map(
        (library) => library.Id
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
    [activeSegment]
  );

  const resumeQuery = useJellyfinResume({ serviceId, limit: 12 });
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

  const serviceName = connector?.config.name ?? "Jellyfin";

  const isInitialLoad =
    isBootstrapping ||
    librariesQuery.isLoading ||
    libraryItemsQuery.isLoading ||
    resumeQuery.isLoading ||
    latestQuery.isLoading;
  const isRefreshing =
    (libraryItemsQuery.isFetching ||
      resumeQuery.isFetching ||
      latestQuery.isFetching ||
      librariesQuery.isFetching) &&
    !isInitialLoad;

  // Animation: cross-fade skeleton -> content
  const [showSkeletonLayer, setShowSkeletonLayer] = useState(isInitialLoad);
  const [contentInteractive, setContentInteractive] = useState(!isInitialLoad);

  const skeletonOpacity = useRef(
    new Animated.Value(isInitialLoad ? 1 : 0)
  ).current;
  const contentOpacity = useRef(
    new Animated.Value(isInitialLoad ? 0 : 1)
  ).current;

  useEffect(() => {
    if (isInitialLoad) {
      // Ensure skeleton is present while animating in
      setShowSkeletonLayer(true);
      setContentInteractive(false);

      Animated.parallel([
        Animated.timing(skeletonOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    // Fade skeleton out and fade content in, then remove skeleton layer from tree.
    Animated.parallel([
      Animated.timing(skeletonOpacity, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSkeletonLayer(false);
      setContentInteractive(true);
    });
  }, [isInitialLoad, skeletonOpacity, contentOpacity]);

  const aggregatedError =
    librariesQuery.error ??
    libraryItemsQuery.error ??
    resumeQuery.error ??
    latestQuery.error;
  const errorMessage =
    aggregatedError instanceof Error
      ? aggregatedError.message
      : aggregatedError
      ? "Unable to load Jellyfin data."
      : null;

  const items = libraryItemsQuery.data ?? [];
  const librariesForActiveSegment = groupedLibraries[activeSegment] ?? [];

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
    (itemId: string) => {
      if (!serviceId) {
        return;
      }

      router.push({
        pathname: "/(auth)/jellyfin/[serviceId]/details/[itemId]",
        params: { serviceId, itemId },
      });
    },
    [router, serviceId]
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      librariesQuery.refetch(),
      libraryItemsQuery.refetch(),
      resumeQuery.refetch(),
      latestQuery.refetch(),
    ]);
  }, [latestQuery, librariesQuery, libraryItemsQuery, resumeQuery]);

  const renderResumeItem = useCallback(
    ({ item, index }: { item: JellyfinResumeItem; index: number }) => {
      const title = item.SeriesName ?? item.Name ?? "Untitled";
      const subtitle =
        item.Type === "Episode"
          ? item.Name ?? undefined
          : deriveSubtitle(item, "movies");
      const posterUri = buildPosterUri(connector, item, 360);
      const progress =
        typeof item.UserData?.PlaybackPositionTicks === "number" &&
        typeof item.RunTimeTicks === "number"
          ? Math.min(
              Math.max(
                item.UserData.PlaybackPositionTicks / item.RunTimeTicks,
                0
              ),
              1
            )
          : undefined;

      return (
        <View>
          <Pressable
            style={({ pressed }) => [
              styles.resumeCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleOpenItem(item.Id)}
          >
            <MediaPoster
              uri={posterUri}
              size={116}
              accessibilityLabel={`Continue watching ${title}`}
            />
            <View style={styles.resumeMeta}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={styles.resumeTitle}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  variant="bodySmall"
                  numberOfLines={2}
                  style={styles.resumeSubtitle}
                >
                  {subtitle}
                </Text>
              ) : null}
              {typeof progress === "number" ? (
                <View style={styles.progressRail}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      );
    },
    [connector, handleOpenItem, styles]
  );

  const renderLatestItem = useCallback(
    ({ item, index }: { item: JellyfinLatestItem; index: number }) => {
      const posterUri = buildPosterUri(connector, item, 420);
      const subtitle =
        item.Type === "Episode"
          ? item.SeriesName
          : deriveSubtitle(item, activeSegment);
      const status = formatEpisodeLabel(item);

      return (
        <View>
          <Pressable
            style={({ pressed }) => [
              styles.latestCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleOpenItem(item.Id)}
          >
            <MediaPoster
              uri={posterUri}
              size={96}
              onPress={() => handleOpenItem(item.Id)}
            />
            <View style={styles.latestMeta}>
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={styles.latestTitle}
              >
                {item.Name ?? "Untitled"}
              </Text>
              {subtitle ? (
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={styles.latestSubtitle}
                >
                  {subtitle}
                </Text>
              ) : null}
              {status ? (
                <Chip compact mode="outlined" style={styles.episodeChip}>
                  {status}
                </Chip>
              ) : null}
            </View>
          </Pressable>
        </View>
      );
    },
    [activeSegment, connector, handleOpenItem, styles]
  );

  const renderLibraryItem = useCallback(
    ({ item, index }: { item: JellyfinItem; index: number }) => {
      const posterUri = buildPosterUri(connector, item, 480);
      const subtitle = deriveSubtitle(item, activeSegment);
      const positionStyle =
        index % 2 === 0 ? styles.gridCardLeft : styles.gridCardRight;

      // Column sizing: account for FlashList padding and inter-column gaps so poster fits inside card.
      const contentHorizontalPadding = spacing.lg * 2; // listContent applies paddingHorizontal: spacing.lg
      const totalGaps = spacing.xl; // space between columns (gridCardLeft/right use spacing.md)
      const effectiveColumnWidth = Math.max(
        0,
        Math.floor(
          (windowWidth - contentHorizontalPadding - totalGaps) / numColumns
        )
      );
      const posterSize = Math.max(80, effectiveColumnWidth - spacing.md * 2); // leave room for internal card padding

      return (
        <View>
          <Pressable
            style={({ pressed }) => [
              styles.gridCard,
              positionStyle,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleOpenItem(item.Id)}
          >
            <MediaPoster uri={posterUri} size={posterSize} />
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
    [activeSegment, connector, handleOpenItem, styles, windowWidth]
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
        <View>
          <SegmentedButtons
            value={activeSegment}
            onValueChange={(value) =>
              setActiveSegment(value as CollectionSegmentKey)
            }
            buttons={collectionSegments.map((segment) => ({
              value: segment.key,
              label: segment.label,
              disabled: groupedLibraries[segment.key].length === 0,
            }))}
            density="medium"
            style={styles.segmentedControl}
          />
        </View>
        {librariesForActiveSegment.length > 1 ? (
          <View>
            <View style={styles.libraryChipsRow}>
              {librariesForActiveSegment.map((library) => (
                <Chip
                  key={library.Id}
                  mode={selectedLibraryId === library.Id ? "flat" : "outlined"}
                  selected={selectedLibraryId === library.Id}
                  onPress={() => setSelectedLibraryId(library.Id)}
                  style={styles.libraryChip}
                >
                  {library.Name}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

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
        </View>
        {resumeQuery.data && resumeQuery.data.length > 0 ? (
          <FlashList
            data={resumeQuery.data}
            keyExtractor={(item) => item.Id}
            renderItem={renderResumeItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.resumeList}
          />
        ) : (
          <View style={styles.emptyStateInline}>
            <EmptyState
              title="Nothing queued up"
              description="Start playing something in Jellyfin to continue here."
            />
          </View>
        )}

        <View>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Latest Additions
            </Text>
            <IconButton
              icon="refresh"
              size={20}
              accessibilityLabel="Refresh latest additions"
              onPress={() => void latestQuery.refetch()}
            />
          </View>
        </View>
        {latestQuery.data && latestQuery.data.length > 0 ? (
          <FlashList
            data={latestQuery.data}
            keyExtractor={(item) => item.Id}
            renderItem={renderLatestItem}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          />
        ) : (
          <View style={styles.emptyStateInline}>
            <EmptyState
              title="No recent additions"
              description="Freshly added media appears here once Jellyfin indexes it."
            />
          </View>
        )}
      </View>
    );
  }, [
    activeSegment,
    groupedLibraries,
    handleNavigateBack,
    handleOpenNowPlaying,
    handleOpenSettings,
    latestQuery.data,
    renderLatestItem,
    renderResumeItem,
    resumeQuery.data,
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
      <Animated.View
        style={[styles.contentLayer, { opacity: contentOpacity }]}
        pointerEvents={contentInteractive ? "auto" : "none"}
      >
        <FlashList
          data={items}
          keyExtractor={(item) => item.Id}
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
      </Animated.View>

      {/* Skeleton overlay: mounted while visible and cross-fades out */}
      {showSkeletonLayer ? (
        <Animated.View
          style={[styles.overlay, { opacity: skeletonOpacity }]}
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
        </Animated.View>
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
    },
    searchInput: {
      fontSize: 16,
    },
    segmentedControl: {
      marginTop: -spacing.sm,
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
      gap: spacing.md,
    },
    resumeCard: {
      width: 200,
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceVariant,
    },
    resumeMeta: {
      gap: spacing.xs,
    },
    resumeTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    resumeSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    progressRail: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: 3,
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
      gap: spacing.sm,
      marginBottom: spacing.lg,
      padding: spacing.md,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: "hidden",
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
    },
    gridSubtitle: {
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
