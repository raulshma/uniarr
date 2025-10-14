import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Button, Chip, Dialog, Portal, RadioButton, Surface, Text, useTheme } from "react-native-paper";

import DetailHero from "@/components/media/DetailHero/DetailHero";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import { EmptyState } from "@/components/common/EmptyState";
import type { AppTheme } from "@/constants/theme";
import {
  TmdbConnectorError,
  type DiscoverMovieResponse,
  type DiscoverTvResponse,
  type MovieCreditsResponse,
  type MovieDetailsWithExtrasResponse,
  type MovieVideosResponse,
  type MovieWatchProvidersResponse,
  type TvCreditsResponse,
  type TvDetailsWithExtrasResponse,
  type TvVideosResponse,
  type TvWatchProvidersResponse,
} from "@/connectors/implementations/TmdbConnector";
import { useTmdbDetails } from "@/hooks/tmdb/useTmdbDetails";
import { useTmdbKey } from "@/hooks/useTmdbKey";
import { useSettingsStore } from "@/store/settingsStore";
import { useConnectorsStore, selectGetConnectorsByType } from "@/store/connectorsStore";
import type { DiscoverMediaItem } from "@/models/discover.types";
import {
  type AddDestination,
  buildDestinationOptions,
  mapServiceSummaries,
} from "@/utils/discover/destination.utils";
import { buildBackdropUrl, buildPosterUrl } from "@/utils/tmdb.utils";
import { spacing } from "@/theme/spacing";
import { alert } from "@/services/dialogService";

const formatRuntime = (minutes?: number | null): string | undefined => {
  if (!minutes || minutes <= 0) {
    return undefined;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
};

const getTrailerUrl = (
  videos?: MovieVideosResponse | TvVideosResponse,
): string | undefined => {
  const results = videos?.results;
  if (!Array.isArray(results)) {
    return undefined;
  }

  const match = results.find((video) => {
    const site = typeof video.site === "string" ? video.site : undefined;
    const type = typeof video.type === "string" ? video.type : undefined;
    return site === "YouTube" && (type === "Trailer" || type === "Teaser");
  });

  if (!match) {
    return undefined;
  }

  const key = typeof match.key === "string" ? match.key : undefined;
  if (!key) {
    return undefined;
  }

  return `https://www.youtube.com/watch?v=${key}`;
};

const getProviderNames = (
  watchProviders?: MovieWatchProvidersResponse | TvWatchProvidersResponse,
): string | undefined => {
  if (!watchProviders?.results) {
    return undefined;
  }

  const region =
    watchProviders.results.US ?? watchProviders.results.GB ?? Object.values(watchProviders.results)[0];
  if (!region) {
    return undefined;
  }

  const collect = (entries?: Array<{ provider_name?: string }>) =>
    entries?.map((entry) => entry.provider_name).filter(Boolean) as string[];

  const names: string[] = [];

  if ('flatrate' in region && Array.isArray(region.flatrate)) {
    names.push(...collect(region.flatrate));
  }
  if ('rent' in region && Array.isArray(region.rent)) {
    names.push(...collect(region.rent));
  }
  if ('buy' in region && Array.isArray(region.buy)) {
    names.push(...collect(region.buy));
  }

  if (!names.length) {
    return undefined;
  }

  return Array.from(new Set(names)).join(", ");
};

type MovieListItem = NonNullable<DiscoverMovieResponse['results']>[number];
type TvListItem = NonNullable<DiscoverTvResponse['results']>[number];

const buildMovieDiscoverItem = (
  movie: MovieDetailsWithExtrasResponse | MovieListItem,
): DiscoverMediaItem => {
  const tmdbId = typeof movie.id === "number" ? movie.id : Number(movie.id ?? 0);
  const title =
    typeof movie.title === "string"
      ? movie.title
      : typeof movie.original_title === "string"
      ? movie.original_title
      : "Untitled Movie";

  return {
    id: `movie-${tmdbId}`,
    title,
    mediaType: "movie",
    overview: typeof movie.overview === "string" ? movie.overview : undefined,
    posterUrl: buildPosterUrl(movie.poster_path),
    backdropUrl: buildBackdropUrl(movie.backdrop_path),
    rating: typeof movie.vote_average === "number" ? movie.vote_average : undefined,
    releaseDate: typeof movie.release_date === "string" ? movie.release_date : undefined,
    tmdbId: tmdbId || undefined,
    sourceId: tmdbId || undefined,
    voteCount: typeof movie.vote_count === "number" ? movie.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};

const buildTvDiscoverItem = (
  tv: TvDetailsWithExtrasResponse | TvListItem,
): DiscoverMediaItem => {
  const tmdbId = typeof tv.id === "number" ? tv.id : Number(tv.id ?? 0);
  const title =
    typeof tv.name === "string"
      ? tv.name
      : typeof tv.original_name === "string"
      ? tv.original_name
      : "Untitled Series";

  return {
    id: `series-${tmdbId}`,
    title,
    mediaType: "series",
    overview: typeof tv.overview === "string" ? tv.overview : undefined,
    posterUrl: buildPosterUrl(tv.poster_path),
    backdropUrl: buildBackdropUrl(tv.backdrop_path),
    rating: typeof tv.vote_average === "number" ? tv.vote_average : undefined,
    releaseDate: typeof tv.first_air_date === "string" ? tv.first_air_date : undefined,
    tmdbId: tmdbId || undefined,
    sourceId: tmdbId || undefined,
    voteCount: typeof tv.vote_count === "number" ? tv.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};

const CAST_LIMIT = 12;

const TmdbDetailPage = () => {
  const params = useLocalSearchParams<{ mediaType?: string; tmdbId?: string }>();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const mediaTypeParam = params.mediaType === "movie" || params.mediaType === "tv" ? params.mediaType : null;
  const tmdbIdParam = Number(params.tmdbId);
  const tmdbId = Number.isFinite(tmdbIdParam) ? tmdbIdParam : null;

  const tmdbEnabled = useSettingsStore((state) => state.tmdbEnabled);
  const { apiKey } = useTmdbKey();
  const hasCredentials = Boolean(apiKey);

  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);

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

  const detailsQuery = useTmdbDetails(mediaTypeParam ?? "movie", tmdbId, {
    enabled: Boolean(mediaTypeParam && tmdbId && tmdbEnabled && hasCredentials),
  });

  const [servicePickerVisible, setServicePickerVisible] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState<AddDestination[]>([]);
  const [selectedDestinationKey, setSelectedDestinationKey] = useState<string>("");
  const [pendingItem, setPendingItem] = useState<DiscoverMediaItem | null>(null);
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false);

  useEffect(() => {
    if (!detailsQuery.isError) {
      setErrorBannerDismissed(false);
    }
  }, [detailsQuery.isError]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        },
        section: {
          gap: spacing.sm,
        },
        infoRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        castRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.md,
        },
        castCard: {
          width: 120,
          padding: spacing.sm,
          borderRadius: 12,
          backgroundColor: theme.colors.elevation.level1,
        },
        recommendationRow: {
          flexDirection: "row",
          gap: spacing.md,
        },
        recommendationCard: {
          width: 140,
          gap: spacing.sm,
        },
        dialogText: {
          marginBottom: spacing.sm,
        },
        banner: {
          marginBottom: spacing.md,
        },
      }),
    [theme],
  );

  const errorMessage = useMemo(() => {
    const error = detailsQuery.error;
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

      if (error.statusCode === 404) {
        return "TMDB could not find this title. It may have been removed or is not yet available.";
      }

      if (error.statusCode >= 500) {
        return "TMDB is currently unavailable. Try again soon.";
      }

      const trimmed = error.message?.trim();
      return trimmed?.length ? trimmed : "TMDB request failed.";
    }

    return error.message ?? "TMDB request failed.";
  }, [detailsQuery.error]);

  const showErrorBanner = Boolean(detailsQuery.data && detailsQuery.isError && errorMessage && !errorBannerDismissed);
  const showErrorEmptyState = Boolean(!detailsQuery.data && detailsQuery.isError && errorMessage);

  const destinationForItem = useCallback(
    (item: DiscoverMediaItem): AddDestination[] => buildDestinationOptions(item, destinationServices),
    [destinationServices],
  );

  const handleAdd = useCallback(
    (item: DiscoverMediaItem) => {
      const options = destinationForItem(item);
      if (!options.length) {
        const label = item.mediaType === "series" ? "Sonarr or Jellyseerr" : "Radarr or Jellyseerr";
        alert("No services available", `Add a ${label} service first to work with this title.`);
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
    [destinationForItem],
  );

  const closeServicePicker = useCallback(() => {
    setServicePickerVisible(false);
    setDestinationOptions([]);
    setPendingItem(null);
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
      const tmdbIdentifier = pendingItem.tmdbId ?? (typeof pendingItem.sourceId === "number" ? pendingItem.sourceId : undefined);
      if (!tmdbIdentifier) {
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
          mediaId: String(tmdbIdentifier),
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

  const movieDetails = mediaTypeParam === "movie"
    ? (detailsQuery.data?.details as MovieDetailsWithExtrasResponse | undefined)
    : undefined;
  const tvDetails = mediaTypeParam === "tv"
    ? (detailsQuery.data?.details as TvDetailsWithExtrasResponse | undefined)
    : undefined;

  const primaryItem = useMemo(() => {
    if (!mediaTypeParam) {
      return undefined;
    }

    if (mediaTypeParam === "movie") {
      return movieDetails ? buildMovieDiscoverItem(movieDetails) : undefined;
    }

    return tvDetails ? buildTvDiscoverItem(tvDetails) : undefined;
  }, [mediaTypeParam, movieDetails, tvDetails]);

  const trailerUrl = useMemo(() => (detailsQuery.data ? getTrailerUrl(detailsQuery.data.videos) : undefined), [
    detailsQuery.data,
  ]);

  const providers = useMemo(
    () => (detailsQuery.data ? getProviderNames(detailsQuery.data.watchProviders) : undefined),
    [detailsQuery.data],
  );

  const cast = useMemo(() => {
    const credits = detailsQuery.data?.credits as MovieCreditsResponse | TvCreditsResponse | undefined;
    const rawCast = credits?.cast;
    if (!Array.isArray(rawCast)) {
      return [];
    }

    return rawCast.slice(0, CAST_LIMIT).map((person) => ({
      id: String(person.id ?? Math.random()),
      name: typeof person.name === "string" ? person.name : person.original_name ?? "Unknown",
      role: typeof person.character === "string" ? person.character : undefined,
      profilePath: typeof person.profile_path === "string" ? person.profile_path : undefined,
    }));
  }, [detailsQuery.data]);

  const recommendations = useMemo(() => {
    if (!detailsQuery.data || !mediaTypeParam) {
      return [];
    }

    if (mediaTypeParam === "movie") {
      const results = (detailsQuery.data.recommendations?.results ?? []) as MovieListItem[];
      return results
        .map((entry) => buildMovieDiscoverItem(entry))
        .filter((item) => typeof item.tmdbId === "number" && item.tmdbId > 0);
    }

    const results = (detailsQuery.data.recommendations?.results ?? []) as TvListItem[];
    return results
      .map((entry) => buildTvDiscoverItem(entry))
      .filter((item) => typeof item.tmdbId === "number" && item.tmdbId > 0);
  }, [detailsQuery.data, mediaTypeParam]);

  const similar = useMemo(() => {
    if (!detailsQuery.data || !mediaTypeParam) {
      return [];
    }

    if (mediaTypeParam === "movie") {
      const results = (detailsQuery.data.similar?.results ?? []) as MovieListItem[];
      return results
        .map((entry) => buildMovieDiscoverItem(entry))
        .filter((item) => typeof item.tmdbId === "number" && item.tmdbId > 0);
    }

    const results = (detailsQuery.data.similar?.results ?? []) as TvListItem[];
    return results
      .map((entry) => buildTvDiscoverItem(entry))
      .filter((item) => typeof item.tmdbId === "number" && item.tmdbId > 0);
  }, [detailsQuery.data, mediaTypeParam]);

  const title =
    movieDetails?.title ??
    tvDetails?.name ??
    movieDetails?.original_title ??
    tvDetails?.original_name ??
    "TMDB title";
  const tagline = movieDetails?.tagline ?? tvDetails?.tagline;
  const overview = movieDetails?.overview ?? tvDetails?.overview;
  const releaseLabel = movieDetails?.release_date ?? tvDetails?.first_air_date ?? "Unknown";
  const runtimeLabel = mediaTypeParam === "movie"
    ? formatRuntime(movieDetails?.runtime)
    : formatRuntime(Array.isArray(tvDetails?.episode_run_time) ? tvDetails?.episode_run_time[0] : undefined);
  const ratingValue = movieDetails?.vote_average ?? tvDetails?.vote_average;
  const statusLabel = movieDetails?.status ?? tvDetails?.status;
  const genresList = ((mediaTypeParam === "movie" ? movieDetails?.genres : tvDetails?.genres) ?? []) as Array<{
    id: number;
    name?: string;
  }>;
  const homepageUrl = typeof movieDetails?.homepage === "string"
    ? movieDetails.homepage
    : typeof tvDetails?.homepage === "string"
    ? tvDetails.homepage
    : undefined;

  const navigateToItem = useCallback(
    (item: DiscoverMediaItem) => {
      const targetId = item.tmdbId ?? item.sourceId;
      if (!targetId) {
        alert("Details unavailable", "TMDB did not return an identifier for this title yet. Try again later.");
        return;
      }

      const targetMediaType = item.mediaType === "series" ? "tv" : "movie";
      router.push({
        pathname: "/(auth)/discover/tmdb/[mediaType]/[tmdbId]",
        params: {
          mediaType: targetMediaType,
          tmdbId: String(targetId),
        },
      });
    },
    [router],
  );

  if (!tmdbEnabled) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="TMDB Discover is disabled"
          description="Enable TMDB integration in Settings to view details."
          actionLabel="Open settings"
          onActionPress={() => router.push("/(auth)/settings/tmdb")}
        />
      </SafeAreaView>
    );
  }

  if (!hasCredentials) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Add your TMDB credential"
          description="Store a TMDB API key or V4 token to load details."
          actionLabel="Add TMDB key"
          onActionPress={() => router.push("/(auth)/settings/tmdb")}
        />
      </SafeAreaView>
    );
  }

  if (!mediaTypeParam || !tmdbId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Unknown TMDB title"
          description="We could not determine which item to load."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (showErrorEmptyState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Unable to load TMDB"
          description={errorMessage ?? "TMDB request failed."}
          icon="alert-circle-outline"
          actionLabel="Try again"
          onActionPress={() => void detailsQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <DetailHero
        posterUri={buildPosterUrl(detailsQuery.data?.details?.poster_path)}
        backdropUri={buildBackdropUrl(detailsQuery.data?.details?.backdrop_path)}
        onBack={() => router.back()}
        isFetching={detailsQuery.isLoading}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {showErrorBanner && errorMessage ? (
            <Banner
              visible
              icon="alert-circle"
              style={styles.banner}
              actions={[
                { label: "Retry", onPress: () => void detailsQuery.refetch() },
                { label: "Dismiss", onPress: () => setErrorBannerDismissed(true) },
              ]}
            >
              {errorMessage}
            </Banner>
          ) : null}

          <View style={styles.section}>
            <Text variant="headlineLarge" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
              {title}
            </Text>
            {tagline ? (
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}>
                {tagline}
              </Text>
            ) : null}

            {overview ? (
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
                {overview}
              </Text>
            ) : null}
          </View>

          <View style={styles.infoRow}>
            {genresList.map((genre) => (
              <Chip key={genre.id} icon="ticket" compact>
                {genre.name ?? `Genre ${genre.id}`}
              </Chip>
            ))}
            <Chip icon="calendar">{releaseLabel}</Chip>
            {typeof ratingValue === "number" ? <Chip icon="star">{ratingValue.toFixed(1)}</Chip> : null}
            {runtimeLabel ? <Chip icon="clock-outline">{runtimeLabel}</Chip> : null}
            {statusLabel ? <Chip>{statusLabel}</Chip> : null}
          </View>

          <View style={styles.infoRow}>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => primaryItem && handleAdd(primaryItem)}
              disabled={!primaryItem}
            >
              Add to library
            </Button>
            {trailerUrl ? (
              <Button
                mode="outlined"
                icon="youtube"
                onPress={() => {
                  void Linking.openURL(trailerUrl);
                }}
              >
                Watch trailer
              </Button>
            ) : null}
            {homepageUrl ? (
              <Button
                mode="text"
                icon="open-in-new"
                onPress={() => {
                  void Linking.openURL(homepageUrl);
                }}
              >
                Official site
              </Button>
            ) : null}
          </View>

          {providers ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Watch providers
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {providers}
              </Text>
            </View>
          ) : null}

          {cast.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Top cast
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.castRow}>
                  {cast.map((person) => (
                    <Surface key={person.id} style={styles.castCard} elevation={1}>
                      <MediaPoster
                        uri={buildPosterUrl(person.profilePath)}
                        size={80}
                        borderRadius={12}
                        accessibilityLabel={`${person.name} profile`}
                      />
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface, fontWeight: "600" }}
                        numberOfLines={1}
                      >
                        {person.name}
                      </Text>
                      {person.role ? (
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                          numberOfLines={1}
                        >
                          as {person.role}
                        </Text>
                      ) : null}
                    </Surface>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {recommendations.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Recommendations
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.recommendationRow}>
                  {recommendations.map((item) => (
                    <View key={item.id} style={styles.recommendationCard}>
                      <MediaPoster
                        uri={item.posterUrl}
                        size={140}
                        borderRadius={16}
                        onPress={() => navigateToItem(item)}
                      />
                      <Button
                        mode="text"
                        icon="information-outline"
                        onPress={() => navigateToItem(item)}
                      >
                        {item.title}
                      </Button>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {similar.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Similar titles
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.recommendationRow}>
                  {similar.map((item) => (
                    <View key={item.id} style={styles.recommendationCard}>
                      <MediaPoster
                        uri={item.posterUrl}
                        size={140}
                        borderRadius={16}
                        onPress={() => navigateToItem(item)}
                      />
                      <Button
                        mode="text"
                        icon="information-outline"
                        onPress={() => navigateToItem(item)}
                      >
                        {item.title}
                      </Button>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      </DetailHero>

      <Portal>
        <Dialog visible={servicePickerVisible} onDismiss={closeServicePicker}>
          <Dialog.Title>Select destination</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
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

export default TmdbDetailPage;
