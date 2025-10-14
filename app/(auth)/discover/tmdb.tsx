import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Banner,
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TmdbFiltersDrawer } from "@/components/discover/tmdb/TmdbFiltersDrawer";
import { TmdbResultsGrid } from "@/components/discover/tmdb/TmdbResultsGrid";
import {
  type AddDestination,
  buildDestinationOptions,
  mapServiceSummaries,
} from "@/utils/discover/destination.utils";
import type { AppTheme } from "@/constants/theme";
import {
  TmdbConnectorError,
  type DiscoverMovieResponse,
  type DiscoverTvResponse,
} from "@/connectors/implementations/TmdbConnector";
import { useTmdbDiscover, type TmdbDiscoverFilters } from "@/hooks/tmdb/useTmdbDiscover";
import { useTmdbGenres } from "@/hooks/tmdb/useTmdbGenres";
import { useTmdbKey } from "@/hooks/useTmdbKey";
import type { DiscoverMediaItem } from "@/models/discover.types";
import { useConnectorsStore, selectGetConnectorsByType } from "@/store/connectorsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { spacing } from "@/theme/spacing";
import { mapTmdbMovieToDiscover, mapTmdbTvToDiscover } from "@/utils/tmdb.utils";
import { alert } from "@/services/dialogService";

const createInitialFilters = (): TmdbDiscoverFilters => ({
  mediaType: "movie",
  sortBy: "popularity.desc",
  includeAdult: false,
});

const SORT_LABELS: Record<string, string> = {
  "popularity.desc": "Popularity",
  "vote_average.desc": "Rating",
  "primary_release_date.desc": "Release Date",
};

const TmdbDiscoverScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
        },
        toolbar: {
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
        toolbarRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        summaryRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
        },
        summaryChip: {
          marginRight: spacing.xs,
        },
        emptyWrapper: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          justifyContent: "center",
        },
        banner: {
          marginBottom: spacing.md,
        },
      }),
    [theme],
  );

  const { apiKey } = useTmdbKey();
  const tmdbEnabled = useSettingsStore((state) => state.tmdbEnabled);
  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);

  const [filters, setFilters] = useState<TmdbDiscoverFilters>(createInitialFilters);
  const [servicePickerVisible, setServicePickerVisible] = useState(false);
  const [pendingItem, setPendingItem] = useState<DiscoverMediaItem | null>(null);
  const [filtersDrawerVisible, setFiltersDrawerVisible] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState<AddDestination[]>([]);
  const [selectedDestinationKey, setSelectedDestinationKey] = useState<string>("");
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false);

  const genresQuery = useTmdbGenres(filters.mediaType, {
    enabled: tmdbEnabled && Boolean(apiKey),
  });

  const discoverQuery = useTmdbDiscover(filters, {
    enabled: tmdbEnabled && Boolean(apiKey),
  });

  useEffect(() => {
    if (!discoverQuery.isError) {
      setErrorBannerDismissed(false);
    }
  }, [discoverQuery.isError]);

  const items = useMemo(() => {
    const pages = discoverQuery.data?.pages ?? [];

    const mapped = filters.mediaType === "movie"
      ? pages
          .flatMap(
            (page) => (page.results as DiscoverMovieResponse["results"] | undefined) ?? [],
          )
          .map(mapTmdbMovieToDiscover)
      : pages
          .flatMap((page) => (page.results as DiscoverTvResponse["results"] | undefined) ?? [])
          .map(mapTmdbTvToDiscover);

    return mapped.filter((item, index, array) => {
      if (!item.tmdbId) {
        return true;
      }
      const firstIndex = array.findIndex((candidate) => candidate.tmdbId === item.tmdbId);
      return firstIndex === index;
    });
  }, [discoverQuery.data?.pages, filters.mediaType]);

  const errorMessage = useMemo(() => {
    const error = discoverQuery.error;
    if (!error) {
      return null;
    }

    if (error instanceof TmdbConnectorError) {
      if (error.statusCode === 429) {
        const wait = typeof error.retryAfterSeconds === "number" && Number.isFinite(error.retryAfterSeconds)
          ? Math.max(1, Math.ceil(error.retryAfterSeconds))
          : null;
        return wait
          ? `TMDB is rate limiting requests. Please wait about ${wait} second${wait === 1 ? "" : "s"} and try again.`
          : "TMDB is rate limiting requests. Please try again shortly.";
      }

      if (!error.statusCode) {
        return "Unable to reach TMDB. Check your connection and try again.";
      }

      if (error.statusCode >= 500) {
        return "TMDB is currently unavailable. Try again soon.";
      }

      const trimmed = error.message?.trim();
      return trimmed?.length ? trimmed : "TMDB request failed.";
    }

    return error.message ?? "TMDB request failed.";
  }, [discoverQuery.error]);

  const hasCredentials = Boolean(apiKey);

  const sonarrServices = useMemo(
    () => mapServiceSummaries(getConnectorsByType("sonarr")),
    [getConnectorsByType],
  );
  const radarrServices = useMemo(
    () => mapServiceSummaries(getConnectorsByType("radarr")),
    [getConnectorsByType],
  );
  const jellyseerrServices = useMemo(
    () => mapServiceSummaries(getConnectorsByType("jellyseerr")),
    [getConnectorsByType],
  );

  const destinationServices = useMemo(
    () => ({
      sonarr: sonarrServices,
      radarr: radarrServices,
      jellyseerr: jellyseerrServices,
    }),
    [jellyseerrServices, radarrServices, sonarrServices],
  );

  const buildDestinations = useCallback(
    (item: DiscoverMediaItem): AddDestination[] =>
      buildDestinationOptions(item, destinationServices),
    [destinationServices],
  );

  const openServicePicker = useCallback(
    (item: DiscoverMediaItem) => {
      const options = buildDestinations(item);
      if (!options.length) {
        alert(
          "No services available",
          `Add a ${item.mediaType === "series" ? "Sonarr" : "Radarr"} or Jellyseerr service first to work with this title.`
        );
        return;
      }

      setPendingItem(item);
      setDestinationOptions(options);
      setSelectedDestinationKey((current) => {
        if (current && options.some((option) => option.key === current)) {
          return current;
        }
        return options[0]?.key ?? "";
      });
      setServicePickerVisible(true);
    },
    [buildDestinations],
  );

  const closeServicePicker = useCallback(() => {
    setServicePickerVisible(false);
    setPendingItem(null);
    setDestinationOptions([]);
  }, []);

  const confirmAdd = useCallback(() => {
    if (!pendingItem || !selectedDestinationKey) {
      closeServicePicker();
      return;
    }

    const destination = destinationOptions.find((option) => option.key === selectedDestinationKey);
    if (!destination) {
      closeServicePicker();
      return;
    }

    if (destination.kind === "jellyseerr") {
      const tmdbId = pendingItem.tmdbId ?? (typeof pendingItem.sourceId === "number" ? pendingItem.sourceId : undefined);
      if (!tmdbId) {
        alert("Missing TMDB identifier", "Cannot request via Jellyseerr because this item does not have a TMDB id.");
        closeServicePicker();
        return;
      }

      const mediaType = pendingItem.mediaType === "series" ? "tv" : "movie";
      router.push({
        pathname: "/(auth)/jellyseerr/[serviceId]/[mediaType]/[mediaId]",
        params: {
          serviceId: destination.serviceId,
          mediaType,
          mediaId: String(tmdbId),
        },
      });
      closeServicePicker();
      return;
    }

    const params: Record<string, string> = {
      serviceId: destination.serviceId,
      query: pendingItem.title,
    };

    if (pendingItem.tmdbId) {
      params.tmdbId = String(pendingItem.tmdbId);
    }

    if (destination.kind === "sonarr") {
      router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
    } else if (destination.kind === "radarr") {
      router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
    }

    closeServicePicker();
  }, [closeServicePicker, destinationOptions, pendingItem, router, selectedDestinationKey]);

  const handleCardPress = useCallback(
    (item: DiscoverMediaItem) => {
      const tmdbId = item.tmdbId ?? (typeof item.sourceId === "number" ? item.sourceId : undefined);
      if (!tmdbId) {
        alert("Details unavailable", "TMDB did not return an identifier for this title yet. Try again later.");
        return;
      }

      const mediaType = item.mediaType === "series" ? "tv" : "movie";

      router.push({
        pathname: "/(auth)/discover/tmdb/[mediaType]/[tmdbId]",
        params: {
          mediaType,
          tmdbId: String(tmdbId),
        },
      });
    },
    [router],
  );

  const handleAdd = useCallback((item: DiscoverMediaItem) => {
    openServicePicker(item);
  }, [openServicePicker]);

  const handleFiltersChange = useCallback(
    (partial: Partial<TmdbDiscoverFilters>) => {
      setFilters((current) => ({
        ...current,
        ...partial,
      }));
    },
    [],
  );

  const fetchNextPage = useCallback(() => {
    if (!discoverQuery.hasNextPage || discoverQuery.isFetchingNextPage) {
      return;
    }
    void discoverQuery.fetchNextPage();
  }, [discoverQuery]);

  const handleResetFilters = useCallback(() => {
    setFilters(createInitialFilters());
  }, []);

  const filterSummaryChips = useMemo(() => {
    const chips: string[] = [];

    chips.push(filters.mediaType === "movie" ? "Movies" : "TV Series");

    const defaultSort = createInitialFilters().sortBy ?? "popularity.desc";
    const sortLabel = SORT_LABELS[filters.sortBy ?? defaultSort];
    if (sortLabel) {
      chips.push(`Sort · ${sortLabel}`);
    }

    if (filters.genreId) {
      const genreName = (genresQuery.data ?? []).find((genre) => genre.id === filters.genreId)?.name;
      chips.push(`Genre · ${genreName ?? filters.genreId}`);
    }

    if (filters.year) {
      chips.push(`Year · ${filters.year}`);
    }

    if (filters.includeAdult) {
      chips.push("Adult titles");
    }

    return chips;
  }, [filters, genresQuery.data]);
  const isInitialLoading = discoverQuery.isLoading && !discoverQuery.isFetched;
  const showErrorEmptyState = Boolean(!items.length && discoverQuery.isError && errorMessage);
  const showErrorBanner = Boolean(items.length && discoverQuery.isError && errorMessage && !errorBannerDismissed);

  const renderContent = () => {
    let body: React.ReactNode;

    if (isInitialLoading) {
      body = (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="Loading TMDB picks"
            description="Fetching discover results from TMDB."
            icon="progress-clock"
          />
        </View>
      );
    } else if (showErrorEmptyState && errorMessage) {
      body = (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="Unable to load TMDB"
            description={errorMessage}
            icon="alert-circle-outline"
            actionLabel="Try again"
            onActionPress={() => void discoverQuery.refetch()}
          />
        </View>
      );
    } else {
      body = (
        <TmdbResultsGrid
          items={items}
          onAdd={handleAdd}
          onCardPress={handleCardPress}
          onEndReached={fetchNextPage}
          refreshing={discoverQuery.isRefetching}
          onRefresh={() => void discoverQuery.refetch()}
          isFetchingMore={discoverQuery.isFetchingNextPage}
        />
      );
    }

    return (
      <View style={styles.content}>
        <View style={styles.toolbar}>
          <View style={styles.toolbarRow}>
            <Button
              icon="tune"
              mode="outlined"
              onPress={() => setFiltersDrawerVisible(true)}
            >
              Filters
            </Button>
            <IconButton
              icon="refresh"
              onPress={() => void discoverQuery.refetch()}
              disabled={discoverQuery.isFetching}
              accessibilityLabel="Refresh TMDB results"
            />
          </View>
          {filterSummaryChips.length ? (
            <View style={styles.summaryRow}>
              {filterSummaryChips.map((chip) => (
                <Chip key={chip} mode="outlined" style={styles.summaryChip}>
                  {chip}
                </Chip>
              ))}
            </View>
          ) : null}
        </View>

        {showErrorBanner && errorMessage ? (
          <Banner
            visible
            icon="alert-circle"
            style={styles.banner}
            actions={[
              { label: "Try again", onPress: () => void discoverQuery.refetch() },
              { label: "Dismiss", onPress: () => setErrorBannerDismissed(true) },
            ]}
          >
            {errorMessage}
          </Banner>
        ) : null}

        {body}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader
        title="TMDB Discover"
        showTitle
        showBackButton
        onBackPress={() => router.back()}
      />

      {!tmdbEnabled ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="TMDB Discover is disabled"
            description="Enable TMDB integration in Settings to start browsing TMDB recommendations."
            actionLabel="Open settings"
            onActionPress={() => router.push("/(auth)/settings/tmdb")}
          />
        </View>
      ) : !hasCredentials ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="Add your TMDB credential"
            description="Store a TMDB API key or V4 token to fetch discover results."
            actionLabel="Add TMDB key"
            onActionPress={() => router.push("/(auth)/settings/tmdb")}
          />
        </View>
      ) : (
        renderContent()
      )}

      <TmdbFiltersDrawer
        visible={filtersDrawerVisible}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        onClose={() => setFiltersDrawerVisible(false)}
        genres={genresQuery.data ?? []}
        genresLoading={genresQuery.isLoading}
      />

      <Portal>
        <Dialog visible={servicePickerVisible} onDismiss={closeServicePicker}>
          <Dialog.Title>Select destination</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              Choose how you want to handle {pendingItem?.title}
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setSelectedDestinationKey(value)}
              value={selectedDestinationKey}
            >
              {destinationOptions.map((option) => (
                <RadioButton.Item
                  key={option.key}
                  value={option.key}
                  label={option.label}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeServicePicker}>Cancel</Button>
            <Button onPress={confirmAdd} disabled={!selectedDestinationKey}>
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default TmdbDiscoverScreen;
