import React, { useCallback, useMemo, useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  useTheme,
  Portal,
  Dialog,
  RadioButton,
  Button as PaperButton,
  IconButton,
} from "react-native-paper";
import PagerView from "react-native-pager-view";

import DiscoverQueueItem from "@/components/discover/DiscoverQueueItem";
import { alert } from "@/services/dialogService";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import type { DiscoverMediaItem } from "@/models/discover.types";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import { getTmdbConnector } from "@/services/tmdb/TmdbConnectorProvider";
import {
  mapTmdbMovieToDiscover,
  mapTmdbTvToDiscover,
} from "@/utils/tmdb.utils";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
type JellyseerrSearchResultType =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

const mapTrendingResult = (
  result: JellyseerrSearchResultType,
  mediaType: DiscoverMediaItem["mediaType"],
  sourceServiceId?: string,
): DiscoverMediaItem => {
  const tmdbCandidate = result.mediaInfo?.tmdbId ?? result.id;
  const tmdbId = typeof tmdbCandidate === "number" ? tmdbCandidate : undefined;
  const tvdbCandidate = result.mediaInfo?.tvdbId;
  const tvdbId = typeof tvdbCandidate === "number" ? tvdbCandidate : undefined;

  const title = (() => {
    if ("title" in result && typeof result.title === "string")
      return result.title;
    if ("name" in result && typeof result.name === "string") return result.name;
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    if (typeof mi.title === "string") return mi.title as string;
    if (typeof mi.name === "string") return mi.name as string;
    return undefined;
  })();
  const { poster, backdrop } = (() => {
    const poster =
      typeof result.posterPath === "string" ? result.posterPath : undefined;
    const backdrop =
      typeof result.backdropPath === "string" ? result.backdropPath : undefined;
    if (poster && backdrop) return { poster, backdrop };
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return {
      poster:
        poster ??
        (typeof mi.posterPath === "string"
          ? (mi.posterPath as string)
          : undefined),
      backdrop:
        backdrop ??
        (typeof mi.backdropPath === "string"
          ? (mi.backdropPath as string)
          : undefined),
    };
  })();
  const voteAverage =
    typeof result.voteAverage === "number" ? result.voteAverage : undefined;
  const popularity =
    typeof result.popularity === "number" ? result.popularity : undefined;
  const releaseDate = (() => {
    if (
      "firstAirDate" in result &&
      typeof (result as any).firstAirDate === "string"
    )
      return (result as any).firstAirDate as string;
    if (
      "releaseDate" in result &&
      typeof (result as any).releaseDate === "string"
    )
      return (result as any).releaseDate as string;
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return typeof mi.releaseDate === "string"
      ? (mi.releaseDate as string)
      : undefined;
  })();
  const overview = (() => {
    if (typeof result.overview === "string") return result.overview;
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return typeof mi.overview === "string"
      ? (mi.overview as string)
      : undefined;
  })();
  const imdbId = (() => {
    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const mi = toRecord(result.mediaInfo) ?? {};
    return typeof mi.imdbId === "string" ? (mi.imdbId as string) : undefined;
  })();
  const voteCount =
    typeof result.voteCount === "number" ? result.voteCount : undefined;

  return {
    id: `${mediaType}-${String(tmdbId ?? result.id ?? "")}`,
    title: title ?? "Untitled",
    mediaType,
    overview,
    posterUrl: poster
      ? `https://image.tmdb.org/t/p/original${poster}`
      : undefined,
    backdropUrl: backdrop
      ? `https://image.tmdb.org/t/p/original${backdrop}`
      : undefined,
    rating: voteAverage,
    popularity,
    releaseDate,
    year: (() => {
      const dateString = releaseDate as string | undefined;
      if (!dateString) return undefined;
      const parsed = Number.parseInt(dateString.slice(0, 4), 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    })(),
    sourceId: result.id,
    tmdbId,
    tvdbId,
    imdbId,
    voteCount,
    sourceServiceId: sourceServiceId,
    source: "jellyseerr",
  };
};

const SectionPage: React.FC = () => {
  const params = useLocalSearchParams<{ sectionId?: string }>();
  const sectionId = params.sectionId ?? "";
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const { sections, services } = useUnifiedDiscover();

  const section = useMemo(
    () => sections.find((s) => s.id === sectionId),
    [sections, sectionId],
  );

  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["discover-section", sectionId],
    queryFn: async ({ pageParam = 1 }) => {
      if (!section) throw new Error("Section not found");

      if (section.source === "jellyseerr") {
        const sourceServiceId = section.items[0]?.sourceServiceId;
        const connector = getConnectorsByType("jellyseerr").find(
          (c) => c.config.id === sourceServiceId,
        ) as JellyseerrConnector;
        if (!connector) throw new Error("Jellyseerr connector not found");
        const response = await connector.getTrending({ page: pageParam });
        const items = response.items.map((item) =>
          mapTrendingResult(
            item,
            section.mediaType === "movie" ? "movie" : "series",
            sourceServiceId,
          ),
        );
        return {
          items,
          hasNextPage:
            (response.pageInfo?.page ?? 1) < (response.pageInfo?.pages ?? 1),
        };
      } else if (section.source === "tmdb") {
        const tmdbConnector = await getTmdbConnector();
        if (!tmdbConnector) throw new Error("TMDB connector not available");
        const response =
          section.mediaType === "movie"
            ? await tmdbConnector.discoverMovies({
                sort_by: "popularity.desc",
                page: pageParam,
              })
            : await tmdbConnector.discoverTv({
                sort_by: "popularity.desc",
                page: pageParam,
              });
        const items = (response.results || []).map((item) =>
          section.mediaType === "movie"
            ? mapTmdbMovieToDiscover(item as any)
            : mapTmdbTvToDiscover(item as any),
        );
        return { items, hasNextPage: pageParam < (response.total_pages ?? 1) };
      }
      throw new Error("Unsupported section source");
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasNextPage ? pages.length + 1 : undefined;
    },
    enabled: !!section,
    initialPageParam: 1,
  });

  const items = useMemo(() => {
    const allItems = infiniteQuery.data?.pages.flatMap((p) => p.items) || [];
    // Deduplicate by tmdbId or id
    const seen = new Set<string>();
    return allItems.filter((item) => {
      const key = item.tmdbId ? `tmdb-${item.tmdbId}` : item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [infiniteQuery.data]);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogItem, setDialogItem] = useState<DiscoverMediaItem | undefined>(
    undefined,
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (
      currentPage === items.length - 1 &&
      infiniteQuery.hasNextPage &&
      !infiniteQuery.isFetchingNextPage
    ) {
      void infiniteQuery.fetchNextPage();
    }
  }, [currentPage, items.length, infiniteQuery]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: "transparent" },
        content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
        floatingBackButton: {
          position: "absolute",
          top: 45, // Position below status bar
          left: spacing.lg,
          zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.7)",
          borderRadius: 25,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
        },
      }),
    [],
  );

  const openServicePicker = useCallback(
    (item: DiscoverMediaItem) => {
      const options =
        item.mediaType === "series" ? services.sonarr : services.radarr;
      if (!options.length) {
        void alert(
          "No services available",
          `Add a ${item.mediaType === "series" ? "Sonarr" : "Radarr"} service first to request this title.`,
        );
        return;
      }

      // Store current page before opening dialog to prevent navigation issues
      const currentPageBeforeDialog = currentPage;

      setDialogItem(item);
      setSelectedServiceId((current) => {
        if (current && options.some((service) => service.id === current)) {
          return current;
        }
        return options[0]?.id ?? "";
      });
      setDialogVisible(true);

      // Restore page position after dialog state updates
      setTimeout(() => {
        setCurrentPage(currentPageBeforeDialog);
      }, 0);
    },
    [services, currentPage],
  );

  const handleConfirmAdd = useCallback(() => {
    if (!dialogItem || !selectedServiceId) {
      setDialogVisible(false);
      setDialogItem(undefined);
      setSelectedServiceId("");
      return;
    }

    const params: Record<string, string> = {
      serviceId: selectedServiceId,
      query: dialogItem.title,
    };

    if (dialogItem.tmdbId) params.tmdbId = String(dialogItem.tmdbId);
    if (dialogItem.tvdbId) params.tvdbId = String(dialogItem.tvdbId);

    if (dialogItem.mediaType === "series") {
      router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
    } else {
      router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
    }

    setDialogVisible(false);
    setDialogItem(undefined);
    setSelectedServiceId("");
  }, [dialogItem, router, selectedServiceId]);

  const handleCardPress = useCallback(
    (item: DiscoverMediaItem) => {
      router.push(`/(auth)/discover/${item.id}`);
    },
    [router],
  );

  if (!section) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
          style={styles.floatingBackButton}
          iconColor="#FFFFFF"
        />
        <View style={{ padding: spacing.lg, paddingTop: 100 }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Section not found
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            The requested discover section could not be located.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* Floating Back Button */}
      <IconButton
        icon="arrow-left"
        size={24}
        onPress={() => router.back()}
        style={styles.floatingBackButton}
        iconColor="#FFFFFF"
      />

      <PagerView
        style={{ flex: 1, backgroundColor: "transparent" }}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        initialPage={0}
      >
        {items.map((item) => (
          <View
            key={item.id}
            style={{ flex: 1, backgroundColor: "transparent" }}
          >
            <DiscoverQueueItem
              item={item}
              onAdd={openServicePicker}
              onDetails={handleCardPress}
            />
          </View>
        ))}
      </PagerView>

      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => {
            setDialogVisible(false);
            setDialogItem(undefined);
            setSelectedServiceId("");
          }}
        >
          <Dialog.Title>Add to service</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              Choose where to add{" "}
              <Text style={{ fontWeight: "600" }}>{dialogItem?.title}</Text>
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setSelectedServiceId(value)}
              value={selectedServiceId}
            >
              {(dialogItem?.mediaType === "series"
                ? services.sonarr
                : services.radarr
              ).map((service) => (
                <RadioButton.Item
                  key={service.id}
                  value={service.id}
                  label={service.name}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton
              onPress={() => {
                setDialogVisible(false);
                setDialogItem(undefined);
                setSelectedServiceId("");
              }}
            >
              Cancel
            </PaperButton>
            <PaperButton
              onPress={handleConfirmAdd}
              disabled={!selectedServiceId}
            >
              Add
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default SectionPage;
