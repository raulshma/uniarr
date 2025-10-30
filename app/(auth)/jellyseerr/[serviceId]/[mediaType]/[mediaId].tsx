import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, View, StyleSheet, Linking } from "react-native";
import { Button, Card, Chip, Text, useTheme } from "react-native-paper";
import { SkiaLoader } from "@/components/common/SkiaLoader";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { MediaPoster } from "@/components/media/MediaPoster";
import { EmptyState } from "@/components/common/EmptyState";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useJellyseerrMediaDetails } from "@/hooks/useJellyseerrMediaDetails";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
type MovieDetails = components["schemas"]["MovieDetails"];
type TvDetails = components["schemas"]["TvDetails"];
type JellyDetails = MovieDetails | TvDetails;

const isMovieDetails = (d?: JellyDetails): d is MovieDetails =>
  Boolean(d && "title" in d);
const isTvDetails = (d?: JellyDetails): d is TvDetails =>
  Boolean(d && "name" in d);

const JellyseerrMediaDetailScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    serviceId: rawServiceId,
    mediaType: rawMediaType,
    mediaId: rawMediaId,
  } = useLocalSearchParams<{
    serviceId?: string;
    mediaType?: string;
    mediaId?: string;
  }>();

  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const mediaType =
    rawMediaType === "movie" || rawMediaType === "tv"
      ? rawMediaType
      : undefined;
  const mediaId = Number.parseInt(
    typeof rawMediaId === "string" ? rawMediaId : "",
    10,
  );

  const { data, isLoading, isError, refetch } = useJellyseerrMediaDetails(
    serviceId,
    mediaType ?? "movie",
    mediaId,
  );
  // Typed accessors for the generated MovieDetails | TvDetails union
  const getTitle = (d?: JellyDetails) => {
    if (!d) return "Unknown Title";
    if ("title" in d && d.title) return d.title;
    if ("name" in d && d.name) return d.name;
    return "Unknown Title";
  };

  const toRecord = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : null;

  const getOriginalTitle = (d?: JellyDetails) => {
    const r = toRecord(d);
    const val = r?.originalTitle ?? undefined;
    return typeof val === "string" ? val : undefined;
  };

  const getPosterPath = (d?: JellyDetails) => {
    const r = toRecord(d);
    const p =
      r?.posterPath ??
      (r?.mediaInfo && (r.mediaInfo as any)?.posterPath) ??
      undefined;
    return typeof p === "string" ? p : undefined;
  };

  const getExternalUrl = (d?: JellyDetails) => {
    const r = toRecord(d);
    const v =
      r?.externalUrl ??
      (r?.mediaInfo && (r.mediaInfo as any)?.externalUrl) ??
      undefined;
    return typeof v === "string" ? v : undefined;
  };

  const getTagline = (d?: JellyDetails) => {
    const r = toRecord(d);
    const v = r?.tagline ?? undefined;
    return typeof v === "string" ? v : undefined;
  };
  const getReleaseDate = (d?: JellyDetails) => {
    if (!d) return undefined;
    if (isMovieDetails(d) && d.releaseDate) return d.releaseDate;
    if (isTvDetails(d) && d.firstAirDate) return d.firstAirDate;
    return undefined;
  };

  // Local convenience values used in render
  const posterPath = getPosterPath(data);
  const title = getTitle(data);
  const originalTitle = getOriginalTitle(data);
  const tagline = getTagline(data);
  const releaseDate = getReleaseDate(data);
  const isMovie = isMovieDetails(data);
  const isTv = isTvDetails(data);
  const runtime = isMovie
    ? data?.runtime
    : isTv
      ? (data.episodeRunTime?.[0] ?? undefined)
      : undefined;
  const rating = data?.voteAverage;
  const voteCount = data?.voteCount;
  const popularity = data?.popularity;
  const networkName = isTv
    ? (data.networks?.[0]?.name ?? data.productionCompanies?.[0]?.name)
    : isMovie
      ? data.productionCompanies?.[0]?.name
      : undefined;
  const certification = undefined; // not reliably present in generated schema
  const studios =
    (isMovie
      ? data.productionCompanies?.map((s) => s.name).filter(Boolean)
      : isTv
        ? data.networks?.map((n) => n.name).filter(Boolean)
        : []) ?? [];
  const getGenres = (d?: JellyDetails) => {
    const r = toRecord(d);
    const g =
      r?.genres ?? (r?.mediaInfo && (r.mediaInfo as any)?.genres) ?? undefined;
    return Array.isArray(g)
      ? (g as (string | { id?: number; name?: string })[])
      : [];
  };

  const getAlternateTitles = (d?: JellyDetails) => {
    const r = toRecord(d);
    const a = r?.alternateTitles ?? undefined;
    return Array.isArray(a) ? (a as string[]) : [];
  };

  const getSeasons = (d?: JellyDetails) => {
    const r = toRecord(d);
    const s = r?.seasons ?? undefined;
    return Array.isArray(s) ? (s as any[]) : [];
  };

  const genres = getGenres(data);
  const alternateTitles = getAlternateTitles(data);
  const seasons = isTv ? getSeasons(data) : [];

  const connector = useMemo(() => {
    const c = ConnectorManager.getInstance().getConnector(serviceId) as
      | JellyseerrConnector
      | undefined;
    return c && c.config.type === "jellyseerr" ? c : undefined;
  }, [serviceId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: spacing.lg,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        posterContainer: {
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        titleContainer: {
          alignItems: "center",
          marginBottom: spacing.md,
        },
        card: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 12,
          marginBottom: spacing.lg,
        },
        cardContent: {
          padding: spacing.md,
        },
        detailRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        label: {
          color: theme.colors.onSurfaceVariant,
        },
        value: {
          color: theme.colors.onSurface,
          fontWeight: "600",
        },
        genresContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
        buttonsContainer: {
          flexDirection: "row",
          gap: spacing.sm,
          marginTop: spacing.lg,
        },
      }),
    [theme, insets],
  );

  const openInJellyseerr = async () => {
    if (!connector || !mediaType || !mediaId) return;
    const path = connector.getMediaDetailUrl(mediaId, mediaType);
    const base = connector.config.url.replace(/\/$/, "");
    await Linking.openURL(`${base}${path}`);
  };

  const openExternalUrl = async () => {
    const url = getExternalUrl(data);
    if (url) {
      await Linking.openURL(url);
    }
  };

  if (!serviceId || !mediaType || !Number.isFinite(mediaId)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <EmptyState
            title="Invalid media reference"
            description="Missing or invalid service, media type, or media id."
            actionLabel="Go back"
            onActionPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: "center" }]}>
          <SkiaLoader size={60} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <EmptyState
            title="Failed to load media"
            description="We couldn't load details from Jellyseerr."
            actionLabel="Retry"
            onActionPress={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.View
          style={styles.header}
          entering={FadeInDown.delay(200).springify()}
        >
          <Button mode="text" onPress={() => router.back()}>
            Back
          </Button>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          {/* Poster */}
          <Animated.View
            style={styles.posterContainer}
            entering={FadeIn.delay(400)}
          >
            <MediaPoster
              uri={
                posterPath
                  ? `https://image.tmdb.org/t/p/original${posterPath}`
                  : undefined
              }
              size="large"
              borderRadius={12}
            />
          </Animated.View>

          {/* Title and Basic Info */}
          <Animated.View
            style={styles.titleContainer}
            entering={FadeIn.delay(500)}
          >
            <Text
              variant="headlineLarge"
              style={{
                color: theme.colors.onSurface,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {title}
            </Text>
            {originalTitle && originalTitle !== title ? (
              <Text
                variant="titleMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                {originalTitle}
              </Text>
            ) : null}
            {tagline ? (
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                  fontStyle: "italic",
                  marginTop: spacing.xs,
                }}
              >
                "{tagline}"
              </Text>
            ) : null}
          </Animated.View>

          {/* Overview */}
          {data?.overview ? (
            <Animated.View entering={FadeIn.delay(600)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      lineHeight: 24,
                    }}
                  >
                    {data.overview}
                  </Text>
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Media Details */}
          <Animated.View entering={FadeIn.delay(700)}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.detailRow}>
                  <Text variant="labelMedium" style={styles.label}>
                    Type
                  </Text>
                  <Text variant="bodyLarge" style={styles.value}>
                    {mediaType === "movie" ? "Movie" : "TV Series"}
                  </Text>
                </View>
                {releaseDate ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      {mediaType === "movie"
                        ? "Release Date"
                        : "First Air Date"}
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {new Date(releaseDate).getFullYear()}
                    </Text>
                  </View>
                ) : null}
                {runtime ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Runtime
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {runtime} min
                    </Text>
                  </View>
                ) : null}
                {rating ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Rating
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {rating?.toFixed?.(1) ?? ""}/10
                    </Text>
                  </View>
                ) : null}
                {voteCount ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Votes
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {voteCount?.toLocaleString?.() ?? ""}
                    </Text>
                  </View>
                ) : null}
                {popularity ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Popularity
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {popularity?.toFixed?.(1) ?? ""}
                    </Text>
                  </View>
                ) : null}
                {networkName ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Network
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {networkName}
                    </Text>
                  </View>
                ) : null}
                {certification ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Certification
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {certification}
                    </Text>
                  </View>
                ) : null}
                {data?.status ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Status
                    </Text>
                    <Chip
                      mode="flat"
                      style={{ backgroundColor: theme.colors.primaryContainer }}
                    >
                      {data.status}
                    </Chip>
                  </View>
                ) : null}
                {studios.length ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Studios
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {studios.join(", ")}
                    </Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          </Animated.View>

          {/* Genres */}
          {genres.length ? (
            <Animated.View entering={FadeIn.delay(800)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Genres
                  </Text>
                  <View style={styles.genresContainer}>
                    {genres.map((genreOrObj) => {
                      const name =
                        typeof genreOrObj === "string"
                          ? genreOrObj
                          : (genreOrObj?.name ?? String(genreOrObj?.id ?? ""));
                      return (
                        <Chip
                          key={name}
                          mode="outlined"
                          style={{ borderColor: theme.colors.outline }}
                        >
                          {name}
                        </Chip>
                      );
                    })}
                  </View>
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Alternate Titles */}
          {(alternateTitles ?? []).length ? (
            <Animated.View entering={FadeIn.delay(900)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Also Known As
                  </Text>
                  {(alternateTitles ?? []).map(
                    (title: string, index: number) => (
                      <Text
                        key={index}
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {title}
                      </Text>
                    ),
                  )}
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Seasons for TV */}
          {mediaType === "tv" && (seasons ?? []).length ? (
            <Animated.View entering={FadeIn.delay(1000)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Seasons
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {(seasons ?? []).length} season
                    {(seasons ?? []).length !== 1 ? "s" : ""}
                  </Text>
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Action Buttons */}
          <Animated.View
            style={styles.buttonsContainer}
            entering={FadeIn.delay(1100)}
          >
            <Button
              mode="contained"
              onPress={openInJellyseerr}
              style={{ flex: 1 }}
            >
              Open in Jellyseerr
            </Button>
            {getExternalUrl(data) ? (
              <Button
                mode="outlined"
                onPress={openExternalUrl}
                style={{ flex: 1 }}
              >
                External Link
              </Button>
            ) : null}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default JellyseerrMediaDetailScreen;
