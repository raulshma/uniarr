import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useCallback, useState, useEffect } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from "react-native";
import {
  Button,
  Card,
  Chip,
  Text,
  useTheme,
  Portal,
  Dialog,
  Checkbox,
  IconButton,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSkeletonLoading } from "@/hooks/useSkeletonLoading";
import { skeletonTiming } from "@/constants/skeletonTiming";
import DetailPageSkeleton from "@/components/discover/DetailPageSkeleton";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import TrailerFadeOverlay from "@/components/media/TrailerFadeOverlay/TrailerFadeOverlay";
import { spacing } from "@/theme/spacing";

import { MediaPoster } from "@/components/media/MediaPoster";
import { EmptyState } from "@/components/common/EmptyState";
import { alert } from "@/services/dialogService";
import type { AppTheme } from "@/constants/theme";
import { useJellyseerrMediaDetails } from "@/hooks/useJellyseerrMediaDetails";
import { useSettingsStore } from "@/store/settingsStore";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
import { secureStorage } from "@/services/storage/SecureStorage";
import type { RootFolder } from "@/models/media.types";
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

  // Initialize skeleton loading hook with high complexity timing (900ms) for external API data
  const skeleton = useSkeletonLoading(skeletonTiming.highComplexity);

  // Effect to manage skeleton visibility based on loading state
  React.useEffect(() => {
    if (isLoading && !data) {
      skeleton.startLoading();
    } else {
      skeleton.stopLoading();
    }
  }, [isLoading, data, skeleton]);
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

  const getBackdropPath = (d?: JellyDetails) => {
    const r = toRecord(d);
    const b =
      r?.backdropPath ??
      (r?.mediaInfo && (r.mediaInfo as any)?.backdropPath) ??
      undefined;
    return typeof b === "string" ? b : undefined;
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
  const backdropPath = getBackdropPath(data);
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

  const getTrailerVideoKey = (d?: JellyDetails) => {
    const r = toRecord(d);
    const videos = r?.relatedVideos ?? undefined;
    if (!Array.isArray(videos)) return undefined;
    const trailer = (videos as any[]).find(
      (v: any) => v?.site === "YouTube" && v?.type === "Trailer",
    );
    return trailer?.key ?? undefined;
  };

  const genres = getGenres(data);
  const alternateTitles = getAlternateTitles(data);
  const seasons = isTv ? getSeasons(data) : [];
  const trailerVideoKey = getTrailerVideoKey(data);
  const trailerFeatureEnabled = useSettingsStore(
    (s) => s.trailerFeatureEnabled,
  );

  const connector = useMemo(() => {
    const c = ConnectorManager.getInstance().getConnector(serviceId) as
      | JellyseerrConnector
      | undefined;
    return c && c.config.type === "jellyseerr" ? c : undefined;
  }, [serviceId]);

  // --- Jellyseerr request modal state ---
  const [jellyseerrDialogVisible, setJellyseerrDialogVisible] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>("");

  type JellyServer =
    | components["schemas"]["RadarrSettings"]
    | components["schemas"]["SonarrSettings"];

  type ServiceProfile = components["schemas"]["ServiceProfile"];

  const [servers, setServers] = useState<JellyServer[]>([]);
  const [profiles, setProfiles] = useState<ServiceProfile[]>([]);
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<any[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<number[] | null>(null);
  const [matchedRequests, setMatchedRequests] = useState<any[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const mediaTypeNormalized =
    mediaType ?? (isMovieDetails(data) ? "movie" : "tv");
  const { height } = useWindowDimensions();

  const loadJellyseerrOptions = useCallback(
    async (c: JellyseerrConnector) => {
      if (!c) return;
      setSubmitError("");
      try {
        if (typeof c.initialize === "function") {
          await c.initialize();
        }

        const srv = await c.getServers(mediaTypeNormalized);
        const validServers = Array.isArray(srv)
          ? srv.filter((s) => s && s.id != null)
          : [];
        setServers(validServers);
        const defaultServer =
          validServers.find((s: any) => s.isDefault) || validServers[0];
        const defaultServerId =
          defaultServer?.id != null ? Number(defaultServer.id) : null;
        setSelectedServer(defaultServerId);

        if (defaultServerId != null) {
          const { profiles: profs, rootFolders: rf } = await c.getProfiles(
            defaultServerId,
            mediaTypeNormalized,
          );
          setProfiles(profs ?? []);
          setRootFolders(rf ?? []);

          // load per-service config defaults if present
          const serviceIdVal = (c as any).config?.id;
          let serviceConfig: any = null;
          if (serviceIdVal) {
            try {
              const configs = await secureStorage.getServiceConfigs();
              serviceConfig = Array.isArray(configs)
                ? (configs.find((x) => String(x.id) === String(serviceIdVal)) ??
                  null)
                : null;
            } catch {
              serviceConfig = null;
            }
          }

          const defaultProfile = Array.isArray(profs) ? profs[0] : undefined;
          const defaultRootFolder = rf?.[0]?.path || "";

          const targetKey =
            defaultServerId != null ? String(defaultServerId) : undefined;
          const targetDefaults = serviceConfig?.jellyseerrTargetDefaults ?? {};
          const targetDefault = targetKey
            ? targetDefaults?.[targetKey]
            : undefined;

          // Determine whether this Jellyseerr item appears to be anime.
          const jellyDetails = data as any | undefined;
          let isAnimeLocal = false;
          try {
            const originalLang =
              jellyDetails?.originalLanguage ?? jellyDetails?.original_language;
            if (typeof originalLang === "string" && originalLang === "ja") {
              isAnimeLocal = true;
            }
            const detGenres =
              jellyDetails?.genres ?? jellyDetails?.mediaInfo?.genres ?? [];
            const names = (detGenres ?? []).map((g: any) =>
              (g?.name || "").toLowerCase(),
            );
            if (names.includes("anime") || names.includes("animation")) {
              isAnimeLocal = true;
            }
          } catch {
            /* ignore */
          }

          // Connector-provided anime-specific fields (if present on the server)
          const serverAnimeProfileId =
            (defaultServer as any)?.activeAnimeProfileId ?? null;
          const serverAnimeDirectory =
            (defaultServer as any)?.activeAnimeDirectory ?? null;

          let selectedProfileId: number | undefined = undefined;
          let selectedRootFolderStr: string | undefined = undefined;

          if (isAnimeLocal) {
            // Prefer per-target configured default
            if (targetDefault?.profileId) {
              selectedProfileId = profs?.find(
                (p: any) => p.id === targetDefault.profileId,
              )?.id;
            }

            // Then prefer the connector/server-provided anime profile id
            if (selectedProfileId == null && serverAnimeProfileId != null) {
              selectedProfileId = profs?.find(
                (p: any) => p.id === serverAnimeProfileId,
              )?.id;
            }

            // Fallback to service-level or first profile
            if (selectedProfileId == null) {
              selectedProfileId = targetDefault?.profileId
                ? profs?.find((p: any) => p.id === targetDefault.profileId)?.id
                : serviceConfig?.defaultProfileId
                  ? profs?.find(
                      (p: any) => p.id === serviceConfig.defaultProfileId,
                    )?.id
                  : defaultProfile?.id;
            }

            // Root folder: prefer per-target, then connector anime directory, then service-level/default
            if (targetDefault?.rootFolderPath) {
              selectedRootFolderStr = rf?.find(
                (f: any) => f.path === targetDefault.rootFolderPath,
              )?.path;
            }
            if (!selectedRootFolderStr && serverAnimeDirectory) {
              selectedRootFolderStr = rf?.find(
                (f: any) => f.path === serverAnimeDirectory,
              )?.path;
            }
            if (!selectedRootFolderStr) {
              selectedRootFolderStr = serviceConfig?.defaultRootFolderPath
                ? rf?.find(
                    (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                  )?.path
                : defaultRootFolder;
            }
          } else {
            // Non-anime fallback
            selectedProfileId = targetDefault?.profileId
              ? profs?.find((p: any) => p.id === targetDefault.profileId)?.id
              : serviceConfig?.defaultProfileId
                ? profs?.find(
                    (p: any) => p.id === serviceConfig.defaultProfileId,
                  )?.id
                : defaultProfile?.id;

            selectedRootFolderStr = targetDefault?.rootFolderPath
              ? rf?.find((f: any) => f.path === targetDefault.rootFolderPath)
                  ?.path
              : serviceConfig?.defaultRootFolderPath
                ? rf?.find(
                    (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                  )?.path
                : defaultRootFolder;
          }

          setSelectedProfile(
            selectedProfileId != null ? Number(selectedProfileId) : null,
          );
          setSelectedRootFolder(selectedRootFolderStr || "");

          if (mediaTypeNormalized === "tv") {
            try {
              const details = await c.getMediaDetails(mediaId as any, "tv");
              setAvailableSeasons((details as any)?.seasons ?? []);
              setSelectedSeasons([]);
            } catch {
              setAvailableSeasons([]);
              setSelectedSeasons([]);
            }
          }
        }

        setJellyseerrDialogVisible(true);
      } catch (error) {
        console.warn("loadJellyseerrOptions failed", error);
      }
    },
    [data, mediaTypeNormalized, mediaId],
  );

  const handleServerChange = useCallback(
    async (serverId: number) => {
      if (!connector) return;
      if (serverId == null) return;
      try {
        const { profiles: profs, rootFolders: rf } =
          await connector.getProfiles(serverId, mediaTypeNormalized);
        setProfiles(profs ?? []);
        setRootFolders(rf ?? []);
        const defaultProfile = Array.isArray(profs) ? profs[0] : undefined;
        setSelectedProfile(
          defaultProfile && (defaultProfile as any).id != null
            ? Number((defaultProfile as any).id)
            : null,
        );
        setSelectedRootFolder(rf?.[0]?.path || "");
      } catch (error) {
        console.warn("handleServerChange failed", error);
      }
    },
    [connector, mediaTypeNormalized],
  );

  const refreshJellyseerrMatches = useCallback(async () => {
    if (!connector || !mediaId) {
      setMatchedRequests([]);
      return;
    }
    try {
      const requests = await connector.getRequests();
      const matches = Array.isArray(requests)
        ? requests.filter((r: any) => {
            const media = r?.media as any;
            const mediaTmdb = media?.tmdbId ?? media?.tmdb_id ?? undefined;
            const mediaIdVal = mediaTmdb ?? media?.id ?? undefined;
            return mediaIdVal === mediaId;
          })
        : [];
      setMatchedRequests(matches);
    } catch {
      setMatchedRequests([]);
    }
  }, [connector, mediaId]);

  const handleRemoveJellyseerrRequest = useCallback(
    async (requestId: number) => {
      if (!connector) return;
      setIsRemoving(true);
      try {
        await connector.deleteRequest(requestId);
        await refreshJellyseerrMatches();
      } catch (error) {
        console.warn("Failed to delete request", error);
      } finally {
        setIsRemoving(false);
      }
    },
    [connector, refreshJellyseerrMatches],
  );

  const handleSubmitRequest = useCallback(async () => {
    if (!connector) {
      setSubmitError("Connector unavailable");
      return;
    }

    if (selectedServer == null || selectedProfile == null) {
      setSubmitError("Please select a server and profile.");
      return;
    }

    setSubmitError("");
    setIsRequesting(true);
    try {
      const payload: Parameters<JellyseerrConnector["createRequest"]>[0] = {
        mediaType: mediaTypeNormalized as any,
        mediaId: mediaId as any,
        serverId: selectedServer,
        profileId: selectedProfile,
        rootFolder: selectedRootFolder || undefined,
        is4k: false,
        ...(selectedSeasons && selectedSeasons.length
          ? { seasons: selectedSeasons }
          : { seasons: "all" }),
      } as any;

      await connector.createRequest(payload);
      setJellyseerrDialogVisible(false);
      await refreshJellyseerrMatches();
    } catch (error) {
      console.error(error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit request",
      );
    } finally {
      setIsRequesting(false);
    }
  }, [
    connector,
    mediaId,
    mediaTypeNormalized,
    refreshJellyseerrMatches,
    selectedProfile,
    selectedRootFolder,
    selectedSeasons,
    selectedServer,
  ]);

  useEffect(() => {
    void refreshJellyseerrMatches();
  }, [connector, refreshJellyseerrMatches]);

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
        trailerContainer: {
          marginBottom: spacing.lg,
          borderRadius: 12,
          overflow: "hidden",
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

  if (skeleton.showSkeleton && isLoading && !data) {
    const posterPath = getPosterPath(data);
    return (
      <SafeAreaView style={styles.safeArea}>
        <DetailHero
          posterUri={
            posterPath
              ? `https://image.tmdb.org/t/p/w342${posterPath}`
              : undefined
          }
          onBack={() => router.back()}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xxxxl,
            }}
          >
            <DetailPageSkeleton />
          </ScrollView>
        </DetailHero>
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
          {/* Trailer Fade Overlay - shows trailer if enabled and available */}
          {trailerFeatureEnabled && trailerVideoKey && backdropPath ? (
            <Animated.View
              style={styles.trailerContainer}
              entering={FadeIn.delay(350)}
            >
              <TrailerFadeOverlay
                backdropUri={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
                videoKey={trailerVideoKey}
                height={200}
              />
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
            <Button
              mode="outlined"
              onPress={() => {
                if (!connector) {
                  void alert(
                    "Connector unavailable",
                    "This Jellyseerr service is not available.",
                  );
                  return;
                }
                void loadJellyseerrOptions(connector);
              }}
              style={{ flex: 1 }}
            >
              Request
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

          <Portal>
            <Dialog
              visible={jellyseerrDialogVisible}
              onDismiss={() => setJellyseerrDialogVisible(false)}
            >
              <Dialog.Title>Send request</Dialog.Title>
              <Dialog.Content>
                <ScrollView
                  style={{ maxHeight: Math.max(240, height * 0.6) }}
                  contentContainerStyle={{ paddingVertical: spacing.md }}
                >
                  <Text variant="bodyMedium">Server</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.sm,
                      marginTop: spacing.xs,
                    }}
                  >
                    {servers.map((s: any) => (
                      <Button
                        key={String((s as any).id)}
                        mode={
                          Number(selectedServer) === Number((s as any).id)
                            ? "contained"
                            : "outlined"
                        }
                        onPress={() => {
                          const id = (s as any).id;
                          setSelectedServer(id != null ? Number(id) : null);
                          void handleServerChange(Number(id));
                        }}
                        style={{ marginRight: spacing.xs }}
                      >
                        {(s as any).name || String((s as any).id)}
                      </Button>
                    ))}
                  </View>

                  <Text variant="bodyMedium" style={{ marginTop: spacing.md }}>
                    Profile
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.sm,
                      marginTop: spacing.xs,
                    }}
                  >
                    {profiles.map((p: any) => (
                      <Button
                        key={String((p as any).id)}
                        mode={
                          Number(selectedProfile) === Number((p as any).id)
                            ? "contained"
                            : "outlined"
                        }
                        onPress={() =>
                          setSelectedProfile(Number((p as any).id))
                        }
                        style={{ marginRight: spacing.xs }}
                      >
                        {(p as any).name || String((p as any).id)}
                      </Button>
                    ))}
                  </View>

                  <Text variant="bodyMedium" style={{ marginTop: spacing.md }}>
                    Root folder
                  </Text>
                  <View style={{ marginTop: spacing.xs }}>
                    {rootFolders.map((r) => {
                      const free = (r as any).freeSpace;
                      return (
                        <View key={r.path} style={{ marginTop: spacing.xs }}>
                          <Button
                            mode={
                              selectedRootFolder === r.path
                                ? "contained"
                                : "outlined"
                            }
                            onPress={() => setSelectedRootFolder(r.path)}
                          >
                            {r.path}
                          </Button>
                          {free != null ? (
                            <Text
                              variant="labelSmall"
                              style={{
                                color: theme.colors.onSurfaceVariant,
                                marginTop: 4,
                              }}
                            >
                              {(free / (1024 * 1024 * 1024)).toFixed(2)} GB free
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>

                  {availableSeasons && availableSeasons.length ? (
                    <>
                      <Text
                        variant="bodyMedium"
                        style={{ marginTop: spacing.md }}
                      >
                        Seasons
                      </Text>
                      <View style={{ marginTop: spacing.xs }}>
                        {availableSeasons.map((s: any, idx: number) => {
                          const val = s.seasonNumber ?? s.number ?? idx + 1;
                          const checked = Array.isArray(selectedSeasons)
                            ? selectedSeasons.includes(Number(val))
                            : false;
                          return (
                            <View
                              key={String(val)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: spacing.sm,
                              }}
                            >
                              <Checkbox.Android
                                status={checked ? "checked" : "unchecked"}
                                onPress={() => {
                                  if (!Array.isArray(selectedSeasons))
                                    setSelectedSeasons([Number(val)]);
                                  else if (checked)
                                    setSelectedSeasons(
                                      selectedSeasons.filter(
                                        (x) => x !== Number(val),
                                      ),
                                    );
                                  else
                                    setSelectedSeasons([
                                      ...selectedSeasons,
                                      Number(val),
                                    ]);
                                }}
                              />
                              <Text>{s.name ?? `Season ${val}`}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : null}

                  {submitError ? (
                    <Text
                      style={{
                        color: theme.colors.error,
                        marginTop: spacing.sm,
                      }}
                    >
                      {submitError}
                    </Text>
                  ) : null}

                  {matchedRequests.length ? (
                    <>
                      <Text
                        variant="titleMedium"
                        style={{ marginTop: spacing.md }}
                      >
                        Existing requests
                      </Text>
                      {matchedRequests.map((r: any) => (
                        <View
                          key={String(r.id)}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: spacing.xs,
                          }}
                        >
                          <Text>
                            {r.media?.title ||
                              r.media?.name ||
                              `Request #${r.id}`}
                          </Text>
                          <IconButton
                            icon="delete"
                            size={20}
                            onPress={() =>
                              void handleRemoveJellyseerrRequest(r.id)
                            }
                            disabled={isRemoving}
                          />
                        </View>
                      ))}
                    </>
                  ) : null}
                </ScrollView>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setJellyseerrDialogVisible(false)}>
                  Cancel
                </Button>
                <Button
                  onPress={() => void handleSubmitRequest()}
                  loading={isRequesting}
                  disabled={isRequesting}
                >
                  Request
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default JellyseerrMediaDetailScreen;
