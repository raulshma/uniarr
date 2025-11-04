import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Banner,
  Button,
  Chip,
  Dialog,
  Portal,
  RadioButton,
  Checkbox,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

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
import {
  useSettingsStore,
  selectPreferredJellyseerrServiceId,
} from "@/store/settingsStore";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import type { DiscoverMediaItem } from "@/models/discover.types";
import {
  type AddDestination,
  buildDestinationOptions,
  mapServiceSummaries,
} from "@/utils/discover/destination.utils";
import {
  buildBackdropUrl,
  buildPosterUrl,
  buildProfileUrl,
} from "@/utils/tmdb.utils";
import { spacing } from "@/theme/spacing";
import { alert } from "@/services/dialogService";
import { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
import type { RootFolder } from "@/models/media.types";
import { secureStorage } from "@/services/storage/SecureStorage";
// Note: we intentionally do not import useJellyseerrRequests here because
// calling that hook dynamically for each connector would violate the
// Rules of Hooks (can't call hooks inside callbacks/loops). The file
// interacts with Jellyseerr connectors directly when necessary.
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
    watchProviders.results.US ??
    watchProviders.results.GB ??
    Object.values(watchProviders.results)[0];
  if (!region) {
    return undefined;
  }

  const collect = (entries?: { provider_name?: string }[]) =>
    entries?.map((entry) => entry.provider_name).filter(Boolean) as string[];

  const names: string[] = [];

  if ("flatrate" in region && Array.isArray(region.flatrate)) {
    names.push(...collect(region.flatrate));
  }
  if ("rent" in region && Array.isArray(region.rent)) {
    names.push(...collect(region.rent));
  }
  if ("buy" in region && Array.isArray(region.buy)) {
    names.push(...collect(region.buy));
  }

  if (!names.length) {
    return undefined;
  }

  return Array.from(new Set(names)).join(", ");
};

type MovieListItem = NonNullable<DiscoverMovieResponse["results"]>[number];
type TvListItem = NonNullable<DiscoverTvResponse["results"]>[number];

const buildMovieDiscoverItem = (
  movie: MovieDetailsWithExtrasResponse | MovieListItem,
): DiscoverMediaItem => {
  const tmdbId =
    typeof movie.id === "number" ? movie.id : Number(movie.id ?? 0);
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
    rating:
      typeof movie.vote_average === "number" ? movie.vote_average : undefined,
    releaseDate:
      typeof movie.release_date === "string" ? movie.release_date : undefined,
    tmdbId: tmdbId || undefined,
    sourceId: tmdbId || undefined,
    voteCount:
      typeof movie.vote_count === "number" ? movie.vote_count : undefined,
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
    releaseDate:
      typeof tv.first_air_date === "string" ? tv.first_air_date : undefined,
    tmdbId: tmdbId || undefined,
    sourceId: tmdbId || undefined,
    voteCount: typeof tv.vote_count === "number" ? tv.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};

const CAST_LIMIT = 12;

const TmdbDetailPage = () => {
  const params = useLocalSearchParams<{
    mediaType?: string;
    tmdbId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const mediaTypeParam =
    params.mediaType === "movie" || params.mediaType === "tv"
      ? params.mediaType
      : null;
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
  const [destinationOptions, setDestinationOptions] = useState<
    AddDestination[]
  >([]);
  const [selectedDestinationKey, setSelectedDestinationKey] =
    useState<string>("");
  const [pendingItem, setPendingItem] = useState<DiscoverMediaItem | null>(
    null,
  );
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false);

  // --- Jellyseerr in-place request state and hooks ---
  const jellyseerrConnectors = getConnectorsByType("jellyseerr");
  // NOTE: we do NOT call useJellyseerrRequests dynamically for each
  // configured connector because Hooks must not be invoked inside
  // callbacks/loops. Instead, when we need per-service data we call the
  // connector methods (getRequests / createRequest) directly.

  const preferredJellyseerrServiceId = useSettingsStore(
    selectPreferredJellyseerrServiceId,
  );

  const [jellyseerrServiceDialogVisible, setJellyseerrServiceDialogVisible] =
    useState(false);
  const [selectedJellyseerrServiceId, setSelectedJellyseerrServiceId] =
    useState<string>("");
  const [isRequesting, setIsRequesting] = useState(false);

  const [jellyseerrDialogVisible, setJellyseerrDialogVisible] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>("");
  type JellyServer =
    | components["schemas"]["RadarrSettings"]
    | components["schemas"]["SonarrSettings"];
  type ServiceProfile = components["schemas"]["ServiceProfile"];
  type JellyRequest = components["schemas"]["MediaRequest"];

  const [servers, setServers] = useState<JellyServer[]>([]);
  const [profiles, setProfiles] = useState<ServiceProfile[]>([]);
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([]);
  const [currentConnector, setCurrentConnector] =
    useState<JellyseerrConnector | null>(null);

  const [matchedJellyseerrRequests, setMatchedJellyseerrRequests] = useState<
    {
      connector: JellyseerrConnector;
      request: JellyRequest;
      serviceId: string | number | undefined;
      serviceName: string | undefined;
    }[]
  >([]);
  const [checkingJellyseerr, setCheckingJellyseerr] = useState(false);
  const [removeDialogVisible, setRemoveDialogVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<any[]>([]);
  const [selectAllSeasons, setSelectAllSeasons] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

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
        const wait =
          typeof error.retryAfterSeconds === "number" &&
          Number.isFinite(error.retryAfterSeconds)
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

  const showErrorBanner = Boolean(
    detailsQuery.data &&
      detailsQuery.isError &&
      errorMessage &&
      !errorBannerDismissed,
  );
  const showErrorEmptyState = Boolean(
    !detailsQuery.data && detailsQuery.isError && errorMessage,
  );

  const destinationForItem = useCallback(
    (item: DiscoverMediaItem): AddDestination[] =>
      buildDestinationOptions(item, destinationServices),
    [destinationServices],
  );

  const handleAdd = useCallback(
    (item: DiscoverMediaItem) => {
      const options = destinationForItem(item);
      if (!options.length) {
        const label =
          item.mediaType === "series"
            ? "Sonarr or Jellyseerr"
            : "Radarr or Jellyseerr";
        alert(
          "No services available",
          `Add a ${label} service first to work with this title.`,
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

    const destination = destinationOptions.find(
      (option) => option.key === selectedDestinationKey,
    );
    if (!destination) {
      closeServicePicker();
      return;
    }

    if (destination.kind === "jellyseerr") {
      const tmdbIdentifier =
        pendingItem.tmdbId ??
        (typeof pendingItem.sourceId === "number"
          ? pendingItem.sourceId
          : undefined);
      if (!tmdbIdentifier) {
        alert(
          "Missing TMDB identifier",
          "Cannot request via Jellyseerr because this item does not have a TMDB id.",
        );
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
  }, [
    closeServicePicker,
    destinationOptions,
    pendingItem,
    router,
    selectedDestinationKey,
  ]);

  // --- Jellyseerr handlers (mirror discover/[id].tsx behavior) ---
  const loadJellyseerrOptions = useCallback(
    async (connector: JellyseerrConnector) => {
      if (!tmdbId || !mediaTypeParam) return;

      setCurrentConnector(connector);
      setSubmitError("");

      const mediaType = mediaTypeParam === "tv" ? "tv" : "movie";

      try {
        try {
          if (typeof connector.initialize === "function") {
            await connector.initialize();
          }
        } catch (initError) {
          void alert(
            "Error",
            `Failed to initialize Jellyseerr connector: ${
              initError instanceof Error ? initError.message : String(initError)
            }`,
          );
          console.warn("Jellyseerr initialize failed", initError);
          return;
        }

        const srv = await connector.getServers(mediaType);
        const validServers = Array.isArray(srv)
          ? srv.filter(
              (s) =>
                s &&
                s.id != null &&
                ((typeof s.id === "number" && s.id >= 0) ||
                  (typeof s.id === "string" && (s.id as string).trim() !== "")),
            )
          : [];
        setServers(validServers);
        const defaultServer =
          validServers.find((s) => (s as any).isDefault) || validServers[0];

        const defaultServerId =
          defaultServer?.id !== undefined && defaultServer?.id !== null
            ? Number(defaultServer.id)
            : null;
        setSelectedServer(defaultServerId);

        if (validServers.length === 0) {
          void alert(
            "No servers available",
            "No valid servers are configured in Jellyseerr for this media type.",
          );
          return;
        }

        if (defaultServerId !== null) {
          const { profiles: profs, rootFolders: rf } =
            await connector.getProfiles(defaultServerId, mediaType);
          setProfiles(profs ?? []);
          setRootFolders(rf ?? []);

          // Get service config for defaults (prefer per-target Jellyseerr defaults)
          const serviceId = (connector as any).config?.id;
          let serviceConfig = null as any | null;
          if (serviceId) {
            try {
              const configs = await secureStorage.getServiceConfigs();
              serviceConfig = configs.find((c) => c.id === serviceId);
            } catch (error) {
              console.warn("Failed to load service config for defaults", error);
            }
          }

          // Use per-target jellyseerr defaults if present, then fall back to service-level
          const defaultProfile = Array.isArray(profs) ? profs[0] : undefined;
          const defaultRootFolder = rf?.[0]?.path || "";

          const targetKey =
            defaultServerId != null ? String(defaultServerId) : undefined;
          const targetDefaults = serviceConfig?.jellyseerrTargetDefaults ?? {};
          const targetDefault = targetKey
            ? targetDefaults?.[targetKey]
            : undefined;

          // Determine whether this TMDB item appears to be anime.
          const tmdbDetails = detailsQuery.data?.details as any | undefined;
          let isAnimeLocal = false;
          try {
            const originalLang = tmdbDetails?.original_language;
            if (typeof originalLang === "string" && originalLang === "ja") {
              isAnimeLocal = true;
            }
            const detGenres = tmdbDetails?.genres ?? [];
            const names = (detGenres ?? []).map((g: any) => {
              return (g.name || "").toLowerCase();
            });
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
          let selectedRootFolder: string | undefined = undefined;

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
              selectedRootFolder = rf?.find(
                (f: any) => f.path === targetDefault.rootFolderPath,
              )?.path;
            }
            if (!selectedRootFolder && serverAnimeDirectory) {
              selectedRootFolder = rf?.find(
                (f: any) => f.path === serverAnimeDirectory,
              )?.path;
            }
            if (!selectedRootFolder) {
              selectedRootFolder = serviceConfig?.defaultRootFolderPath
                ? rf?.find(
                    (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                  )?.path
                : defaultRootFolder;
            }
          } else {
            // Non-anime fallback (existing behavior)
            selectedProfileId = targetDefault?.profileId
              ? profs?.find((p: any) => p.id === targetDefault.profileId)?.id
              : serviceConfig?.defaultProfileId
                ? profs?.find(
                    (p: any) => p.id === serviceConfig.defaultProfileId,
                  )?.id
                : defaultProfile?.id;

            selectedRootFolder = targetDefault?.rootFolderPath
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
          setSelectedRootFolder(selectedRootFolder || "");

          if (mediaType === "tv") {
            const details = await connector.getMediaDetails(tmdbId, "tv");
            setAvailableSeasons((details as any).seasons || []);
            setSelectedSeasons([]);
            setSelectAllSeasons(false);
          }
        }

        setJellyseerrDialogVisible(true);
      } catch (error) {
        void alert(
          "Error",
          `Failed to load options: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        console.warn("loadJellyseerrOptions failed", error);
      }
    },
    [mediaTypeParam, tmdbId, detailsQuery.data],
  );

  const handleServerChange = useCallback(
    async (serverId: number) => {
      if (!currentConnector) return;
      if (serverId < 0) return;

      const mediaType = mediaTypeParam === "tv" ? "tv" : "movie";

      try {
        const { profiles: profs, rootFolders: rf } =
          await currentConnector.getProfiles(serverId, mediaType);
        setProfiles(profs ?? []);
        setRootFolders(rf ?? []);

        // Get service config for defaults (prefer per-target Jellyseerr defaults)
        const serviceId: string | undefined = (currentConnector as any).config
          ?.id;
        let serviceConfig = null as any | null;
        if (serviceId) {
          try {
            const configs = await secureStorage.getServiceConfigs();
            serviceConfig = configs.find((c) => c.id === serviceId);
          } catch (error) {
            console.warn("Failed to load service config for defaults", error);
          }
        }

        const defaultProfile = Array.isArray(profs) ? profs[0] : undefined;
        const defaultRootFolder = rf?.[0]?.path || "";

        const targetKey = String(serverId);
        const targetDefaults = serviceConfig?.jellyseerrTargetDefaults ?? {};
        const targetDefault = targetDefaults?.[targetKey];

        // Try to find the server object in the previously loaded servers list so
        // we can use any connector-provided anime defaults (activeAnimeProfileId / activeAnimeDirectory).
        const serverObj = servers.find(
          (s) => String((s as any)?.id) === String(serverId),
        );
        const serverAnimeProfileId =
          (serverObj as any)?.activeAnimeProfileId ?? null;
        const serverAnimeDirectory =
          (serverObj as any)?.activeAnimeDirectory ?? null;

        // Detect anime for the current TMDB item using the details we already
        // have from the TMDB details hook, if available.
        const tmdbDetails = detailsQuery.data?.details as any | undefined;
        let isAnimeLocal = false;
        try {
          const originalLang = tmdbDetails?.original_language;
          if (typeof originalLang === "string" && originalLang === "ja") {
            isAnimeLocal = true;
          }
          const detGenres = tmdbDetails?.genres ?? [];
          const names = (detGenres ?? []).map((g: any) => {
            return (g.name || "").toLowerCase();
          });
          if (names.includes("anime") || names.includes("animation")) {
            isAnimeLocal = true;
          }
        } catch {
          /* ignore */
        }

        let selectedProfileId: number | undefined = undefined;
        let selectedRootFolder: string | undefined = undefined;

        if (isAnimeLocal) {
          if (targetDefault?.profileId) {
            selectedProfileId = profs?.find(
              (p: any) => p.id === targetDefault.profileId,
            )?.id;
          }

          if (selectedProfileId == null && serverAnimeProfileId != null) {
            selectedProfileId = profs?.find(
              (p: any) => p.id === serverAnimeProfileId,
            )?.id;
          }

          if (selectedProfileId == null) {
            selectedProfileId = targetDefault?.profileId
              ? profs?.find((p: any) => p.id === targetDefault.profileId)?.id
              : serviceConfig?.defaultProfileId
                ? profs?.find(
                    (p: any) => p.id === serviceConfig.defaultProfileId,
                  )?.id
                : defaultProfile?.id;
          }

          if (targetDefault?.rootFolderPath) {
            selectedRootFolder = rf?.find(
              (f: any) => f.path === targetDefault.rootFolderPath,
            )?.path;
          }
          if (!selectedRootFolder && serverAnimeDirectory) {
            selectedRootFolder = rf?.find(
              (f: any) => f.path === serverAnimeDirectory,
            )?.path;
          }
          if (!selectedRootFolder) {
            selectedRootFolder = serviceConfig?.defaultRootFolderPath
              ? rf?.find(
                  (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                )?.path
              : defaultRootFolder;
          }
        } else {
          selectedProfileId = targetDefault?.profileId
            ? profs?.find((p: any) => p.id === targetDefault.profileId)?.id
            : serviceConfig?.defaultProfileId
              ? profs?.find((p: any) => p.id === serviceConfig.defaultProfileId)
                  ?.id
              : defaultProfile?.id;

          selectedRootFolder = targetDefault?.rootFolderPath
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
        setSelectedRootFolder(selectedRootFolder || "");
      } catch (error) {
        void alert(
          "Error",
          `Failed to load profiles: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        console.warn("handleServerChange failed", error);
      }
    },
    [currentConnector, mediaTypeParam, servers, detailsQuery.data],
  );
  const refreshJellyseerrMatches = useCallback(async () => {
    setCheckingJellyseerr(true);
    try {
      if (!tmdbId || jellyseerrConnectors.length === 0) {
        setMatchedJellyseerrRequests([]);
        return;
      }

      const matches: {
        connector: JellyseerrConnector;
        request: any;
        serviceId: string | number | undefined;
        serviceName: string | undefined;
      }[] = [];

      await Promise.all(
        jellyseerrConnectors.map(async (connector) => {
          try {
            const jelly = connector as unknown as JellyseerrConnector;
            if (typeof jelly.initialize === "function") {
              try {
                await jelly.initialize();
              } catch (initErr) {
                console.warn("Jellyseerr connector initialize failed", initErr);
              }
            }

            const list = await jelly.getRequests();
            const requests = list?.items ?? [];
            if (Array.isArray(requests)) {
              const found = requests.filter(
                (req: any) =>
                  req &&
                  ((req.media &&
                    req.media.tmdbId &&
                    tmdbId &&
                    req.media.tmdbId === tmdbId) ||
                    (req.media &&
                      req.media.id &&
                      tmdbId &&
                      String(req.media.id) === String(tmdbId))),
              );

              found.forEach((r: any) =>
                matches.push({
                  connector: jelly,
                  request: r,
                  serviceId: (connector as any).config?.id,
                  serviceName: (connector as any).config?.name,
                }),
              );
            }
          } catch (err) {
            console.warn(
              "Error checking Jellyseerr requests for connector",
              (connector as any)?.config?.name,
              err,
            );
          }
        }),
      );

      setMatchedJellyseerrRequests(matches);
    } finally {
      setCheckingJellyseerr(false);
    }
  }, [jellyseerrConnectors, tmdbId]);

  const handleSubmitRequest = useCallback(async () => {
    if (!currentConnector || !tmdbId || !mediaTypeParam) {
      setSubmitError("Please select a server and profile.");
      return;
    }

    if (selectedServer == null || selectedProfile == null) {
      setSubmitError("Please select a server and profile.");
      return;
    }

    setSubmitError("");

    const mediaType = mediaTypeParam === "tv" ? "tv" : "movie";

    if (mediaType === "tv" && selectedSeasons.length === 0) {
      setSubmitError("Please select at least one season.");
      return;
    }

    setIsRequesting(true);

    try {
      // Check existing requests using the current connector directly.
      let existing;
      try {
        const list = await currentConnector.getRequests();
        const requests = list?.items ?? [];
        existing = requests.find(
          (req: any) =>
            (req.media && req.media.tmdbId && req.media.tmdbId === tmdbId) ||
            (req.media &&
              req.media.id &&
              String(req.media.id) === String(tmdbId)),
        );
      } catch (innerErr) {
        // Non-fatal; continue to attempt create if connector fails to list.
        console.warn("Failed to fetch existing Jellyseerr requests", innerErr);
      }

      if (existing) {
        setSubmitError("This item has already been requested.");
        return;
      }

      await currentConnector.createRequest({
        mediaType,
        mediaId: tmdbId,
        tvdbId: undefined,
        is4k: false,
        ...(mediaType === "tv" && { seasons: selectedSeasons }),
        serverId: selectedServer,
        profileId: selectedProfile,
        rootFolder: selectedRootFolder || undefined,
      });

      void alert("Success", "Request submitted successfully!");
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
    currentConnector,
    mediaTypeParam,
    refreshJellyseerrMatches,
    selectedProfile,
    selectedRootFolder,
    selectedSeasons,
    selectedServer,
    tmdbId,
  ]);

  const handleJellyseerrRequest = useCallback(async () => {
    if (!mediaTypeParam || jellyseerrConnectors.length === 0) return;

    if (preferredJellyseerrServiceId) {
      const pref = jellyseerrConnectors.find(
        (c) =>
          String((c as any).config?.id) ===
          String(preferredJellyseerrServiceId),
      ) as JellyseerrConnector | undefined;
      if (pref) {
        await loadJellyseerrOptions(pref);
        return;
      }
    }

    if (jellyseerrConnectors.length > 1) {
      const preselect =
        preferredJellyseerrServiceId ??
        (jellyseerrConnectors[0] as any)?.config?.id;
      setSelectedJellyseerrServiceId(preselect ? String(preselect) : "");
      setJellyseerrServiceDialogVisible(true);
    } else {
      await loadJellyseerrOptions(
        jellyseerrConnectors[0] as JellyseerrConnector,
      );
    }
  }, [
    jellyseerrConnectors,
    loadJellyseerrOptions,
    mediaTypeParam,
    preferredJellyseerrServiceId,
  ]);

  React.useEffect(() => {
    void refreshJellyseerrMatches();
  }, [tmdbId, jellyseerrConnectors, refreshJellyseerrMatches]);

  const handleRemoveJellyseerrRequest = useCallback(
    async (connector: JellyseerrConnector, requestId: number) => {
      setIsRemoving(true);
      try {
        await connector.deleteRequest(requestId);
        void alert("Success", "Request removed from Jellyseerr");
        await refreshJellyseerrMatches();
      } catch (error) {
        console.error("Failed to delete Jellyseerr request", error);
        void alert(
          "Error",
          `Failed to remove request: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        setIsRemoving(false);
      }
    },
    [refreshJellyseerrMatches],
  );

  const movieDetails =
    mediaTypeParam === "movie"
      ? (detailsQuery.data?.details as
          | MovieDetailsWithExtrasResponse
          | undefined)
      : undefined;
  const tvDetails =
    mediaTypeParam === "tv"
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

  const trailerUrl = useMemo(
    () =>
      detailsQuery.data ? getTrailerUrl(detailsQuery.data.videos) : undefined,
    [detailsQuery.data],
  );

  const providers = useMemo(
    () =>
      detailsQuery.data
        ? getProviderNames(detailsQuery.data.watchProviders)
        : undefined,
    [detailsQuery.data],
  );

  const cast = useMemo(() => {
    const credits = detailsQuery.data?.credits as
      | MovieCreditsResponse
      | TvCreditsResponse
      | undefined;
    const rawCast = credits?.cast;
    if (!Array.isArray(rawCast)) {
      return [];
    }

    return rawCast.slice(0, CAST_LIMIT).map((person) => ({
      id: String(person.id ?? Math.random()),
      personId: typeof person.id === "number" ? person.id : undefined,
      name:
        typeof person.name === "string"
          ? person.name
          : (person.original_name ?? "Unknown"),
      role: typeof person.character === "string" ? person.character : undefined,
      profilePath:
        typeof person.profile_path === "string"
          ? person.profile_path
          : undefined,
    }));
  }, [detailsQuery.data]);

  const recommendations = useMemo(() => {
    if (!detailsQuery.data || !mediaTypeParam) {
      return [];
    }

    if (mediaTypeParam === "movie") {
      const results = (detailsQuery.data.recommendations?.results ??
        []) as MovieListItem[];
      return results
        .map((entry) => buildMovieDiscoverItem(entry))
        .filter((item) => typeof item.tmdbId === "number" && item.tmdbId > 0);
    }

    const results = (detailsQuery.data.recommendations?.results ??
      []) as TvListItem[];
    return results
      .map((entry) => buildTvDiscoverItem(entry))
      .filter((item) => typeof item.tmdbId === "number" && item.tmdbId > 0);
  }, [detailsQuery.data, mediaTypeParam]);

  const similar = useMemo(() => {
    if (!detailsQuery.data || !mediaTypeParam) {
      return [];
    }

    if (mediaTypeParam === "movie") {
      const results = (detailsQuery.data.similar?.results ??
        []) as MovieListItem[];
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
  const releaseLabel =
    movieDetails?.release_date ?? tvDetails?.first_air_date ?? "Unknown";
  const runtimeLabel =
    mediaTypeParam === "movie"
      ? formatRuntime(movieDetails?.runtime)
      : formatRuntime(
          Array.isArray(tvDetails?.episode_run_time)
            ? tvDetails?.episode_run_time[0]
            : undefined,
        );
  const ratingValue = movieDetails?.vote_average ?? tvDetails?.vote_average;
  const statusLabel = movieDetails?.status ?? tvDetails?.status;
  const genresList = useMemo(
    () =>
      ((mediaTypeParam === "movie"
        ? movieDetails?.genres
        : tvDetails?.genres) ?? []) as {
        id: number;
        name?: string;
      }[],
    [mediaTypeParam, movieDetails, tvDetails],
  );

  // (anime detection is performed in the Jellyseerr flows where needed so we
  // avoid ordering issues with hooks/closures)
  const homepageUrl =
    typeof movieDetails?.homepage === "string"
      ? movieDetails.homepage
      : typeof tvDetails?.homepage === "string"
        ? tvDetails.homepage
        : undefined;

  const navigateToItem = useCallback(
    (item: DiscoverMediaItem) => {
      const targetId = item.tmdbId ?? item.sourceId;
      if (!targetId) {
        alert(
          "Details unavailable",
          "TMDB did not return an identifier for this title yet. Try again later.",
        );
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

  const navigateToPerson = useCallback(
    (personId: number) => {
      router.push({
        pathname: "/(auth)/person/[personId]",
        params: { personId: String(personId) },
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
        backdropUri={buildBackdropUrl(
          detailsQuery.data?.details?.backdrop_path,
        )}
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
                {
                  label: "Dismiss",
                  onPress: () => setErrorBannerDismissed(true),
                },
              ]}
            >
              {errorMessage}
            </Banner>
          ) : null}

          <View style={styles.section}>
            <Text
              variant="headlineLarge"
              style={{ color: theme.colors.onSurface, fontWeight: "700" }}
            >
              {title}
            </Text>
            {tagline ? (
              <Text
                variant="titleMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontStyle: "italic",
                }}
              >
                {tagline}
              </Text>
            ) : null}

            {overview ? (
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}
              >
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
            {typeof ratingValue === "number" ? (
              <Chip icon="star">{ratingValue.toFixed(1)}</Chip>
            ) : null}
            {runtimeLabel ? (
              <Chip icon="clock-outline">{runtimeLabel}</Chip>
            ) : null}
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
            {jellyseerrConnectors.length > 0 &&
              (matchedJellyseerrRequests.length === 0 ? (
                <Button
                  mode="outlined"
                  onPress={handleJellyseerrRequest}
                  disabled={isRequesting}
                >
                  {isRequesting ? "Requesting..." : "Request with Jellyseerr"}
                </Button>
              ) : (
                <Button
                  mode="outlined"
                  onPress={() => setRemoveDialogVisible(true)}
                  disabled={checkingJellyseerr || isRemoving}
                >
                  {isRemoving
                    ? "Removing..."
                    : `Remove Jellyseerr Request${matchedJellyseerrRequests.length > 1 ? ` (${matchedJellyseerrRequests.length})` : ""}`}
                </Button>
              ))}
          </View>

          {providers ? (
            <View style={styles.section}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
                Watch providers
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {providers}
              </Text>
            </View>
          ) : null}

          {cast.length ? (
            <View style={styles.section}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
                Top cast
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.castRow}>
                  {cast.map((person) => (
                    <Pressable
                      key={person.id}
                      onPress={() =>
                        person.personId && navigateToPerson(person.personId)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`View details for ${person.name}`}
                    >
                      <Surface style={styles.castCard} elevation={1}>
                        <MediaPoster
                          uri={buildProfileUrl(person.profilePath)}
                          size={80}
                          borderRadius={12}
                          accessibilityLabel={`${person.name} profile`}
                        />
                        <Text
                          variant="bodyMedium"
                          style={{
                            color: theme.colors.onSurface,
                            fontWeight: "600",
                          }}
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
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {recommendations.length ? (
            <View style={styles.section}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
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
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
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
        {/* Jellyseerr service selector dialog */}
        <Dialog
          visible={jellyseerrServiceDialogVisible}
          onDismiss={() => setJellyseerrServiceDialogVisible(false)}
        >
          <Dialog.Title>Select Jellyseerr Service</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={setSelectedJellyseerrServiceId}
              value={selectedJellyseerrServiceId}
            >
              {jellyseerrConnectors.map((service) => (
                <RadioButton.Item
                  key={(service as any).config.id}
                  value={String((service as any).config.id)}
                  label={(service as any).config.name}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setJellyseerrServiceDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={async () => {
                const connector = jellyseerrConnectors.find(
                  (c) =>
                    String((c as any).config?.id) ===
                    selectedJellyseerrServiceId,
                ) as JellyseerrConnector | undefined;
                if (connector) {
                  // Persist preferred service
                  useSettingsStore
                    .getState()
                    .setPreferredJellyseerrServiceId(
                      selectedJellyseerrServiceId,
                    );
                  await loadJellyseerrOptions(connector);
                }
                setJellyseerrServiceDialogVisible(false);
              }}
            >
              Select
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Jellyseerr Request Options dialog */}
        <Dialog
          visible={jellyseerrDialogVisible}
          onDismiss={() => {
            setJellyseerrDialogVisible(false);
            setSubmitError("");
          }}
        >
          <Dialog.Title>Request Options</Dialog.Title>
          <Dialog.Content style={{ maxHeight: 400 }}>
            <ScrollView>
              <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
                Configure request for{" "}
                <Text style={{ fontWeight: "600" }}>{title}</Text>
              </Text>

              <Text variant="titleSmall" style={{ marginBottom: spacing.xs }}>
                Server
              </Text>
              <RadioButton.Group
                onValueChange={(value) => {
                  const serverId = parseInt(value);
                  setSelectedServer(serverId);
                  handleServerChange(serverId);
                }}
                value={selectedServer?.toString() || ""}
              >
                {servers.map((server, idx) => (
                  <RadioButton.Item
                    key={String(server.id ?? idx)}
                    value={server.id != null ? String(server.id) : ""}
                    label={server.name ?? String(server.id ?? idx)}
                  />
                ))}
              </RadioButton.Group>

              <Text
                variant="titleSmall"
                style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}
              >
                Profile
              </Text>
              <RadioButton.Group
                onValueChange={(value) => setSelectedProfile(parseInt(value))}
                value={selectedProfile?.toString() || ""}
              >
                {profiles.map((profile, idx) => {
                  const profileLabel =
                    profile.name ?? `Profile ${String(profile.id ?? idx)}`;
                  return (
                    <RadioButton.Item
                      key={String(profile.id ?? idx)}
                      value={profile.id != null ? String(profile.id) : ""}
                      label={profileLabel}
                    />
                  );
                })}
              </RadioButton.Group>

              <Text
                variant="titleSmall"
                style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}
              >
                Root Folder
              </Text>
              <RadioButton.Group
                onValueChange={setSelectedRootFolder}
                value={selectedRootFolder}
              >
                {rootFolders.map((folder, idx) => {
                  const rootLabel =
                    folder.freeSpace != null
                      ? `${folder.path} (${(folder.freeSpace / (1024 * 1024 * 1024)).toFixed(2)} GB free)`
                      : (folder.path ?? `Root ${idx}`);
                  return (
                    <RadioButton.Item
                      key={folder.path ?? String(idx)}
                      value={folder.path ?? ""}
                      label={rootLabel}
                    />
                  );
                })}
              </RadioButton.Group>

              {availableSeasons.length > 0 && (
                <>
                  <Text
                    variant="titleSmall"
                    style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}
                  >
                    Seasons
                  </Text>
                  <Checkbox.Item
                    label="All Seasons"
                    status={selectAllSeasons ? "checked" : "unchecked"}
                    onPress={() => {
                      const newSelectAll = !selectAllSeasons;
                      setSelectAllSeasons(newSelectAll);
                      setSelectedSeasons(
                        newSelectAll
                          ? availableSeasons.map((s) => s.seasonNumber)
                          : [],
                      );
                    }}
                  />
                  {availableSeasons.map((season) => (
                    <Checkbox.Item
                      key={season.seasonNumber}
                      label={`Season ${season.seasonNumber}`}
                      status={
                        selectedSeasons.includes(season.seasonNumber)
                          ? "checked"
                          : "unchecked"
                      }
                      disabled={selectAllSeasons}
                      onPress={() => {
                        setSelectedSeasons((prev) =>
                          prev.includes(season.seasonNumber)
                            ? prev.filter((s) => s !== season.seasonNumber)
                            : [...prev, season.seasonNumber],
                        );
                      }}
                    />
                  ))}
                </>
              )}
            </ScrollView>
            {submitError && (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.error, marginTop: spacing.sm }}
              >
                {submitError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setJellyseerrDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={handleSubmitRequest}
              disabled={
                isRequesting ||
                selectedServer === null ||
                selectedProfile === null
              }
            >
              {isRequesting ? "Requesting..." : "Submit Request"}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog to show and remove existing Jellyseerr requests for this media */}
        <Dialog
          visible={removeDialogVisible}
          onDismiss={() => setRemoveDialogVisible(false)}
        >
          <Dialog.Title>Jellyseerr Requests</Dialog.Title>
          <Dialog.Content style={{ maxHeight: 400 }}>
            {checkingJellyseerr ? (
              <Text variant="bodyMedium">Checking existing requests...</Text>
            ) : matchedJellyseerrRequests.length === 0 ? (
              <Text variant="bodyMedium">
                No Jellyseerr requests found for this item.
              </Text>
            ) : (
              <ScrollView>
                {matchedJellyseerrRequests.map((m, idx) => (
                  <View
                    key={`${String(m.serviceId)}-${String(m.request?.id ?? idx)}`}
                    style={{ marginBottom: spacing.sm }}
                  >
                    <Text
                      variant="titleSmall"
                      style={{ marginBottom: spacing.xs }}
                    >
                      {m.serviceName ?? String(m.serviceId)}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ marginBottom: spacing.xs }}
                    >
                      Request ID: {String(m.request?.id ?? "unknown")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing.xs }}>
                      <Button
                        mode="outlined"
                        compact
                        onPress={async () => {
                          const reqId = m.request?.id;
                          if (!reqId) return;
                          await handleRemoveJellyseerrRequest(
                            m.connector,
                            reqId,
                          );
                        }}
                        disabled={isRemoving}
                      >
                        Remove
                      </Button>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default TmdbDetailPage;
