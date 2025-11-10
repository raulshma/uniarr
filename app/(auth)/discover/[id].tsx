import React, { useCallback, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  useTheme,
  Portal,
  Dialog,
  RadioButton,
  Checkbox,
  Chip,
} from "react-native-paper";
import { Button } from "@/components/common/Button";
import { alert } from "@/services/dialogService";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import TrailerFadeOverlay from "@/components/media/TrailerFadeOverlay/TrailerFadeOverlay";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import { useJellyseerrMediaCredits } from "@/hooks/useJellyseerrMediaCredits";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import { useCheckInLibrary } from "@/hooks/useCheckInLibrary";
import { useDiscoverReleases } from "@/hooks/useDiscoverReleases";
import type { AppTheme } from "@/constants/theme";
import { buildProfileUrl, createDiscoverId } from "@/utils/tmdb.utils";
import { useTmdbDetails, getDeviceRegion } from "@/hooks/tmdb/useTmdbDetails";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import {
  useSettingsStore,
  selectPreferredJellyseerrServiceId,
  selectTrailerFeatureEnabled,
} from "@/store/settingsStore";
import { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import { useRelatedItems } from "@/hooks/useRelatedItems";
import RatingsOverview from "@/components/media/RatingsOverview";
import { secureStorage } from "@/services/storage/SecureStorage";
import { spacing } from "@/theme/spacing";
import { avatarSizes } from "@/constants/sizes";
import RelatedItems from "@/components/discover/RelatedItems";
import DetailPageSkeleton from "@/components/discover/DetailPageSkeleton";
import { useSkeletonLoading } from "@/hooks/useSkeletonLoading";
import { skeletonTiming } from "@/constants/skeletonTiming";

const DiscoverItemDetails = () => {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? "";
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const { sections, services } = useUnifiedDiscover();

  const jellyseerrConnectors = useConnectorsStore(selectGetConnectorsByType)(
    "jellyseerr",
  );
  const preferredJellyseerrServiceId = useSettingsStore(
    selectPreferredJellyseerrServiceId,
  );
  const trailerFeatureEnabled = useSettingsStore(selectTrailerFeatureEnabled);

  const item = useMemo(() => {
    // First try to find by exact ID match
    for (const section of sections) {
      const found = section.items.find((i) => i.id === id);
      if (found) return found;
    }

    // If not found, try to find by TMDB ID or source ID
    for (const section of sections) {
      const found = section.items.find(
        (i) =>
          (i.tmdbId && `movie-${i.tmdbId}` === id) ||
          (i.tmdbId && `series-${i.tmdbId}` === id) ||
          (i.sourceId && `${i.mediaType}-${i.sourceId}` === id),
      );
      if (found) return found;
    }

    // If still not found, check if it's a TMDB prefixed ID for virtual item
    if (id.startsWith("movie-")) {
      const tmdbId = parseInt(id.slice(6), 10);
      if (!isNaN(tmdbId)) {
        return {
          id,
          mediaType: "movie" as const,
          tmdbId,
          title: "Loading...",
          posterUrl: undefined,
          backdropUrl: undefined,
          rating: undefined,
          voteCount: undefined,
          overview: undefined,
          releaseDate: undefined,
          year: undefined,
          tvdbId: undefined,
          imdbId: undefined,
          sourceId: undefined,
          source: "tmdb" as const,
          sourceServiceId: undefined,
        };
      }
    } else if (id.startsWith("series-")) {
      const tmdbId = parseInt(id.slice(7), 10);
      if (!isNaN(tmdbId)) {
        return {
          id,
          mediaType: "series" as const,
          tmdbId,
          title: "Loading...",
          posterUrl: undefined,
          backdropUrl: undefined,
          rating: undefined,
          voteCount: undefined,
          overview: undefined,
          releaseDate: undefined,
          year: undefined,
          tvdbId: undefined,
          imdbId: undefined,
          sourceId: undefined,
          source: "tmdb" as const,
          sourceServiceId: undefined,
        };
      }
    }

    return undefined;
  }, [sections, id]);

  const tmdbDetailsQuery = useTmdbDetails(
    item?.mediaType === "series" ? "tv" : "movie",
    item?.tmdbId ?? null,
    { enabled: !!item?.tmdbId },
  );

  // Fetch real related items (recommendations and similar) from TMDB
  const relatedItemsQuery = useRelatedItems(
    item?.mediaType,
    item?.tmdbId,
    !!item?.tmdbId,
  );

  // Check if item is already in the user's library (lazy check on detail view mount)
  const inLibraryQuery = useCheckInLibrary({
    tmdbId: item?.tmdbId,
    tvdbId: item?.tvdbId,
    sourceId: item?.sourceId,
    mediaType: item?.mediaType ?? "movie",
    enabled: !!item,
  });

  const [dialogVisible, setDialogVisible] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>("");
  const [showReleases, setShowReleases] = useState(false);

  const [jellyseerrServiceDialogVisible, setJellyseerrServiceDialogVisible] =
    useState(false);
  const [selectedJellyseerrServiceId, setSelectedJellyseerrServiceId] =
    useState<string>("");
  const [isRequesting, setIsRequesting] = useState(false);

  const [jellyseerrDialogVisible, setJellyseerrDialogVisible] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>("");
  const [servers, setServers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rootFolders, setRootFolders] = useState<any[]>([]);
  const [currentConnector, setCurrentConnector] =
    useState<JellyseerrConnector | null>(null);

  // --- New state: detect existing Jellyseerr requests for this media ---
  const [matchedJellyseerrRequests, setMatchedJellyseerrRequests] = useState<
    {
      connector: JellyseerrConnector;
      request: any;
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

  // Track pending async operations for cleanup on unmount
  const abortControllerRef = React.useRef<AbortController>(
    new AbortController(),
  );

  // Fetch releases on-demand when user expands the releases section
  const releasesQuery = useDiscoverReleases(
    item?.mediaType === "series" ? "series" : "movie",
    showReleases && item?.tmdbId ? item.tmdbId : undefined,
    {
      preferQuality: true,
      minSeeders: 0,
      tvdbId: showReleases && item?.tvdbId ? item.tvdbId : undefined,
      imdbId: showReleases && item?.imdbId ? item.imdbId : undefined,
      title: showReleases && item?.title ? item.title : undefined,
      year: showReleases && item?.year ? item.year : undefined,
    },
  );

  // Cleanup pending operations on unmount
  React.useEffect(() => {
    const controller = abortControllerRef.current;
    return () => {
      controller.abort();
    };
  }, []);

  const openServicePicker = useCallback(() => {
    if (!item) return;

    // If item is already in library, offer to open it instead
    if (inLibraryQuery.foundServices.length > 0) {
      const found = inLibraryQuery.foundServices[0];
      if (found) {
        void alert(
          "Already in Library",
          `This ${item.mediaType === "series" ? "series" : "movie"} is already in ${found.name}.`,
        );
      }
      return;
    }

    const options =
      item.mediaType === "series" ? services.sonarr : services.radarr;
    if (!options || options.length === 0) {
      // Show an alert advising user to add a service first
      void alert(
        "No services available",
        `Add a ${
          item.mediaType === "series" ? "Sonarr" : "Radarr"
        } service first to add this title.`,
      );
      return;
    }

    if (options.length === 1) {
      // Only one service configured — navigate directly with prefilled params
      const serviceId = options[0]!.id;
      const params: Record<string, string> = { serviceId, query: item.title };
      if (item.tmdbId) params.tmdbId = String(item.tmdbId);
      if (item.tvdbId) params.tvdbId = String(item.tvdbId);
      if (item.mediaType === "series") {
        router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
      } else {
        router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
      }
      return;
    }

    // Multiple services — open picker dialog and preselect first option
    setSelectedServiceId((current) => {
      // Normalize to strings for RadioButton.Group matching
      if (current && options.some((s) => String(s.id) === current))
        return current;
      return String(options[0]!.id ?? "");
    });
    setDialogVisible(true);
  }, [item, router, services, inLibraryQuery.foundServices]);

  // Initialize skeleton loading hook with medium complexity timing (700ms) for TMDB details
  const skeleton = useSkeletonLoading(skeletonTiming.mediumComplexity);

  // Effect to manage skeleton visibility based on loading state
  React.useEffect(() => {
    if (tmdbDetailsQuery.isLoading && !tmdbDetailsQuery.data) {
      skeleton.startLoading();
    } else {
      skeleton.stopLoading();
    }
  }, [tmdbDetailsQuery.isLoading, tmdbDetailsQuery.data, skeleton]);

  const handleRelatedPress = useCallback(
    (relatedId: string) => {
      if (!item) return;

      // Normalize incoming relatedId: if it already looks like
      // 'movie-<id>' or 'series-<id>' use as-is. Otherwise build a
      // canonical discover id using createDiscoverId.
      const trimmed = String(relatedId).trim();
      const isPrefixed = /^\s*(movie|series)-\d+\s*$/i.test(trimmed);
      const finalId = isPrefixed
        ? trimmed
        : createDiscoverId(item.mediaType, Number(trimmed));

      router.push(`/(auth)/discover/${finalId}`);
    },
    [router, item],
  );

  const loadJellyseerrOptions = useCallback(
    async (connector: JellyseerrConnector) => {
      if (!item || abortControllerRef.current.signal.aborted) return;

      setCurrentConnector(connector);
      setSubmitError("");

      const mediaType = item.mediaType === "series" ? "tv" : "movie";

      try {
        // Ensure connector is initialized (auth + version) before querying
        try {
          if (typeof connector.initialize === "function") {
            await connector.initialize();
          }
        } catch (initError) {
          if (!abortControllerRef.current.signal.aborted) {
            void alert(
              "Error",
              `Failed to initialize Jellyseerr connector: ${
                initError instanceof Error
                  ? initError.message
                  : String(initError)
              }`,
            );
            console.warn("Jellyseerr initialize failed", initError);
          }
          return;
        }

        const servers = await connector.getServers(mediaType);
        // Accept any server entries that include a valid id (number >= 0 or non-empty string).
        const validServers = Array.isArray(servers)
          ? servers.filter(
              (s) =>
                s &&
                s.id != null &&
                ((typeof s.id === "number" && s.id >= 0) ||
                  (typeof s.id === "string" && (s.id as string).trim() !== "")),
            )
          : [];

        // Only update state if component is still mounted
        if (!abortControllerRef.current.signal.aborted) {
          setServers(validServers);
        } else {
          return;
        }

        const defaultServer =
          validServers.find((s) => (s as any).isDefault) || validServers[0];

        // Normalize server id to number for internal state
        const defaultServerId =
          defaultServer?.id !== undefined && defaultServer?.id !== null
            ? Number(defaultServer.id)
            : null;

        if (!abortControllerRef.current.signal.aborted) {
          setSelectedServer(defaultServerId);
        } else {
          return;
        }

        if (validServers.length === 0) {
          if (!abortControllerRef.current.signal.aborted) {
            void alert(
              "No servers available",
              "No valid servers are configured in Jellyseerr for this media type.",
            );
          }
          return;
        }

        if (defaultServerId !== null) {
          const { profiles, rootFolders } = await connector.getProfiles(
            defaultServerId,
            mediaType,
          );

          if (abortControllerRef.current.signal.aborted) {
            return;
          }

          setProfiles(profiles ?? []);
          setRootFolders(rootFolders ?? []);

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

          const defaultProfile = Array.isArray(profiles)
            ? profiles[0]
            : undefined;
          const defaultRootFolder = rootFolders?.[0]?.path || "";

          const targetKey =
            defaultServerId != null ? String(defaultServerId) : undefined;
          const targetDefaults = serviceConfig?.jellyseerrTargetDefaults ?? {};
          const targetDefault = targetKey
            ? targetDefaults?.[targetKey]
            : undefined;

          // Determine whether this item appears to be anime.
          const tmdbDetails = tmdbDetailsQuery.data?.details as any | undefined;
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
              selectedProfileId = profiles?.find(
                (p: any) => p.id === targetDefault.profileId,
              )?.id;
            }

            // Then prefer the connector/server-provided anime profile id
            if (selectedProfileId == null && serverAnimeProfileId != null) {
              selectedProfileId = profiles?.find(
                (p: any) => p.id === serverAnimeProfileId,
              )?.id;
            }

            // Fallback to service-level or first profile
            if (selectedProfileId == null) {
              selectedProfileId = targetDefault?.profileId
                ? profiles?.find((p: any) => p.id === targetDefault.profileId)
                    ?.id
                : serviceConfig?.defaultProfileId
                  ? profiles?.find(
                      (p: any) => p.id === serviceConfig.defaultProfileId,
                    )?.id
                  : defaultProfile?.id;
            }

            // Root folder: prefer per-target, then connector anime directory, then service-level/default
            if (targetDefault?.rootFolderPath) {
              selectedRootFolder = rootFolders?.find(
                (f: any) => f.path === targetDefault.rootFolderPath,
              )?.path;
            }
            if (!selectedRootFolder && serverAnimeDirectory) {
              selectedRootFolder = rootFolders?.find(
                (f: any) => f.path === serverAnimeDirectory,
              )?.path;
            }
            if (!selectedRootFolder) {
              selectedRootFolder = serviceConfig?.defaultRootFolderPath
                ? rootFolders?.find(
                    (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                  )?.path
                : defaultRootFolder;
            }
          } else {
            // Non-anime fallback (existing behavior)
            selectedProfileId = targetDefault?.profileId
              ? profiles?.find((p: any) => p.id === targetDefault.profileId)?.id
              : serviceConfig?.defaultProfileId
                ? profiles?.find(
                    (p: any) => p.id === serviceConfig.defaultProfileId,
                  )?.id
                : defaultProfile?.id;

            selectedRootFolder = targetDefault?.rootFolderPath
              ? rootFolders?.find(
                  (f: any) => f.path === targetDefault.rootFolderPath,
                )?.path
              : serviceConfig?.defaultRootFolderPath
                ? rootFolders?.find(
                    (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                  )?.path
                : defaultRootFolder;
          }

          setSelectedProfile(
            selectedProfileId != null ? Number(selectedProfileId) : null,
          );
          setSelectedRootFolder(selectedRootFolder || "");

          if (mediaType === "tv") {
            const details = await connector.getMediaDetails(
              item.tmdbId || item.sourceId!,
              "tv",
            );

            // Only update state if component is still mounted
            if (!abortControllerRef.current.signal.aborted) {
              setAvailableSeasons((details as any).seasons || []);
              setSelectedSeasons([]);
              setSelectAllSeasons(false);
            } else {
              return;
            }
          }
        }

        // Only show dialog if component is still mounted
        if (!abortControllerRef.current.signal.aborted) {
          setJellyseerrDialogVisible(true);
        }
      } catch (error) {
        // Don't show alert if component was unmounted
        if (!abortControllerRef.current.signal.aborted) {
          void alert(
            "Error",
            `Failed to load options: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        console.warn("loadJellyseerrOptions failed", error);
      }
    },
    [item, tmdbDetailsQuery.data?.details],
  );

  const handleServerChange = useCallback(
    async (serverId: number) => {
      if (
        !currentConnector ||
        !item ||
        abortControllerRef.current.signal.aborted
      )
        return;
      if (serverId < 0) return;

      const mediaType = item.mediaType === "series" ? "tv" : "movie";

      try {
        const { profiles, rootFolders } = await currentConnector.getProfiles(
          serverId,
          mediaType,
        );

        // Only update state if component is still mounted
        if (abortControllerRef.current.signal.aborted) {
          return;
        }

        setProfiles(profiles ?? []);
        setRootFolders(rootFolders ?? []);

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

        const defaultProfile = Array.isArray(profiles)
          ? profiles[0]
          : undefined;
        const defaultRootFolder = rootFolders?.[0]?.path || "";

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

        // Detect anime for the current item using the TMDB details if available.
        const tmdbDetails = tmdbDetailsQuery.data?.details as any | undefined;
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
            selectedProfileId = profiles?.find(
              (p: any) => p.id === targetDefault.profileId,
            )?.id;
          }

          if (selectedProfileId == null && serverAnimeProfileId != null) {
            selectedProfileId = profiles?.find(
              (p: any) => p.id === serverAnimeProfileId,
            )?.id;
          }

          if (selectedProfileId == null) {
            selectedProfileId = targetDefault?.profileId
              ? profiles?.find((p: any) => p.id === targetDefault.profileId)?.id
              : serviceConfig?.defaultProfileId
                ? profiles?.find(
                    (p: any) => p.id === serviceConfig.defaultProfileId,
                  )?.id
                : defaultProfile?.id;
          }

          if (targetDefault?.rootFolderPath) {
            selectedRootFolder = rootFolders?.find(
              (f: any) => f.path === targetDefault.rootFolderPath,
            )?.path;
          }
          if (!selectedRootFolder && serverAnimeDirectory) {
            selectedRootFolder = rootFolders?.find(
              (f: any) => f.path === serverAnimeDirectory,
            )?.path;
          }
          if (!selectedRootFolder) {
            selectedRootFolder = serviceConfig?.defaultRootFolderPath
              ? rootFolders?.find(
                  (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                )?.path
              : defaultRootFolder;
          }
        } else {
          selectedProfileId = targetDefault?.profileId
            ? profiles?.find((p: any) => p.id === targetDefault.profileId)?.id
            : serviceConfig?.defaultProfileId
              ? profiles?.find(
                  (p: any) => p.id === serviceConfig.defaultProfileId,
                )?.id
              : defaultProfile?.id;

          selectedRootFolder = targetDefault?.rootFolderPath
            ? rootFolders?.find(
                (f: any) => f.path === targetDefault.rootFolderPath,
              )?.path
            : serviceConfig?.defaultRootFolderPath
              ? rootFolders?.find(
                  (f: any) => f.path === serviceConfig.defaultRootFolderPath,
                )?.path
              : defaultRootFolder;
        }

        setSelectedProfile(
          selectedProfileId != null ? Number(selectedProfileId) : null,
        );
        setSelectedRootFolder(selectedRootFolder || "");
      } catch (error) {
        // Don't show alert if component was unmounted
        if (!abortControllerRef.current.signal.aborted) {
          void alert(
            "Error",
            `Failed to load profiles: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        console.warn("handleServerChange failed", error);
      }
    },
    [currentConnector, item, servers, tmdbDetailsQuery.data?.details],
  );

  const handleSubmitRequest = useCallback(async () => {
    // Accept numeric id 0 as valid — only guard against null/undefined
    if (
      !currentConnector ||
      !item ||
      selectedServer == null ||
      selectedProfile == null ||
      abortControllerRef.current.signal.aborted
    ) {
      setSubmitError("Please select a server and profile.");
      return;
    }

    setSubmitError("");

    const mediaType = item.mediaType === "series" ? "tv" : "movie";

    // Validation
    if (mediaType === "tv" && selectedSeasons.length === 0) {
      setSubmitError("Please select at least one season.");
      return;
    }

    setIsRequesting(true);

    try {
      // Check for existing request
      const requests = await currentConnector.getRequests({
        mediaType,
      });

      // Only continue if component is still mounted
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      const existingRequest = requests.items.find(
        (req) =>
          req.media?.tmdbId === item.tmdbId || req.media?.id === item.sourceId,
      );

      if (existingRequest) {
        setSubmitError("This item has already been requested.");
        return;
      }

      // Submit the request
      await currentConnector.createRequest({
        mediaType,
        mediaId: item.tmdbId || item.sourceId!,
        tvdbId: item.tvdbId,
        is4k: false,
        ...(mediaType === "tv" && { seasons: selectedSeasons }),
        serverId: selectedServer,
        profileId: selectedProfile,
        rootFolder: selectedRootFolder || undefined,
      });

      // Only show success alert and clear dialog if component is still mounted
      if (!abortControllerRef.current.signal.aborted) {
        void alert("Success", "Request submitted successfully!");
        setJellyseerrDialogVisible(false);
      }
    } catch (error) {
      console.error(error);
      if (!abortControllerRef.current.signal.aborted) {
        setSubmitError(
          error instanceof Error ? error.message : "Failed to submit request",
        );
      }
    } finally {
      setIsRequesting(false);
    }
  }, [
    currentConnector,
    item,
    selectedServer,
    selectedProfile,
    selectedRootFolder,
    selectedSeasons,
  ]);

  const handleJellyseerrRequest = useCallback(async () => {
    if (!item || jellyseerrConnectors.length === 0) return;

    // If user has a preferred Jellyseerr service, try to use it directly
    if (preferredJellyseerrServiceId) {
      const pref = jellyseerrConnectors.find(
        (c) => String(c.config.id) === String(preferredJellyseerrServiceId),
      ) as JellyseerrConnector | undefined;
      if (pref) {
        await loadJellyseerrOptions(pref);
        return;
      }
    }

    if (jellyseerrConnectors.length > 1) {
      // Preselect preferred if available, otherwise first connector — ensure string
      const preselect =
        preferredJellyseerrServiceId ?? jellyseerrConnectors[0]?.config.id;
      setSelectedJellyseerrServiceId(preselect ? String(preselect) : "");
      setJellyseerrServiceDialogVisible(true);
    } else {
      await loadJellyseerrOptions(
        jellyseerrConnectors[0] as JellyseerrConnector,
      );
    }
  }, [
    item,
    jellyseerrConnectors,
    loadJellyseerrOptions,
    preferredJellyseerrServiceId,
  ]);

  const refreshJellyseerrMatches = useCallback(async () => {
    setCheckingJellyseerr(true);
    try {
      if (
        !item ||
        jellyseerrConnectors.length === 0 ||
        abortControllerRef.current.signal.aborted
      ) {
        setMatchedJellyseerrRequests([]);
        return;
      }

      const mediaType = item.mediaType === "series" ? "tv" : "movie";
      const matches: {
        connector: JellyseerrConnector;
        request: any;
        serviceId: string | number | undefined;
        serviceName: string | undefined;
      }[] = [];

      // Query each configured jellyseerr connector for requests and find matches
      await Promise.all(
        jellyseerrConnectors.map(async (connector) => {
          // Check abort status before making request
          if (abortControllerRef.current.signal.aborted) {
            return;
          }

          try {
            const jelly = connector as unknown as JellyseerrConnector;
            // Ensure connector initialized where possible
            if (typeof jelly.initialize === "function") {
              // Do not fail hard if initialize throws for a single connector
              try {
                await jelly.initialize();
              } catch (initErr) {
                console.warn("Jellyseerr connector initialize failed", initErr);
              }
            }

            // Early exit if aborted before API call
            if (abortControllerRef.current.signal.aborted) {
              return;
            }

            const requests = await jelly.getRequests({ mediaType });

            // Only update state if component is still mounted
            if (abortControllerRef.current.signal.aborted) {
              return;
            }

            if (requests && Array.isArray(requests.items)) {
              const found = requests.items.filter(
                (req: any) =>
                  req &&
                  ((req.media &&
                    req.media.tmdbId &&
                    item.tmdbId &&
                    req.media.tmdbId === item.tmdbId) ||
                    (req.media &&
                      req.media.id &&
                      item.sourceId &&
                      String(req.media.id) === String(item.sourceId))),
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
            // Log and continue — we don't want a single connector failure to block the UI
            console.warn(
              "Error checking Jellyseerr requests for connector",
              (connector as any)?.config?.name,
              err,
            );
          }
        }),
      );

      // Only update state if component is still mounted
      if (!abortControllerRef.current.signal.aborted) {
        setMatchedJellyseerrRequests(matches);
      }
    } finally {
      setCheckingJellyseerr(false);
    }
  }, [item, jellyseerrConnectors]);

  // Run initial detection when item or connectors change
  React.useEffect(() => {
    void refreshJellyseerrMatches();
  }, [refreshJellyseerrMatches]);

  const handleRemoveJellyseerrRequest = useCallback(
    async (connector: JellyseerrConnector, requestId: number) => {
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      setIsRemoving(true);
      try {
        await connector.deleteRequest(requestId);

        // Only show alert and refresh if component is still mounted
        if (!abortControllerRef.current.signal.aborted) {
          void alert("Success", "Request removed from Jellyseerr");
          // Refresh matches so UI updates
          await refreshJellyseerrMatches();
        }
      } catch (error) {
        console.error("Failed to delete Jellyseerr request", error);

        // Only show alert if component is still mounted
        if (!abortControllerRef.current.signal.aborted) {
          void alert(
            "Error",
            `Failed to remove request: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } finally {
        setIsRemoving(false);
      }
    },
    [refreshJellyseerrMatches],
  );

  // Extract YouTube trailer video key from TMDB details
  const trailerVideoKey = useMemo(() => {
    const videos = (tmdbDetailsQuery.data?.details as any)?.videos;
    if (!Array.isArray(videos?.results)) return undefined;
    const match = videos.results.find((video: any) => {
      const site = typeof video.site === "string" ? video.site : undefined;
      const type = typeof video.type === "string" ? video.type : undefined;
      return site === "YouTube" && (type === "Trailer" || type === "Teaser");
    });
    return match?.key ?? undefined;
  }, [tmdbDetailsQuery.data]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: theme.colors.background },
        content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
        synopsis: { marginBottom: spacing.lg },
        castRow: {
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        addButton: { marginVertical: spacing.lg },
      }),
    [theme.colors.background],
  );

  if (!item) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View style={{ padding: spacing.lg }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Item not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <DetailHero
        posterUri={
          tmdbDetailsQuery.data?.details?.poster_path
            ? `https://image.tmdb.org/t/p/w500${tmdbDetailsQuery.data.details.poster_path}`
            : item.posterUrl
        }
        backdropUri={
          tmdbDetailsQuery.data?.details?.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${tmdbDetailsQuery.data.details.backdrop_path}`
            : item.backdropUrl
        }
        onBack={() => router.back()}
      >
        {skeleton.showSkeleton &&
        tmdbDetailsQuery.isLoading &&
        !tmdbDetailsQuery.data ? (
          <ScrollView contentContainerStyle={styles.content}>
            <DetailPageSkeleton />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.sm,
                justifyContent: "space-between",
              }}
            >
              <Text
                variant="headlineLarge"
                style={{
                  color: theme.colors.onSurface,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {tmdbDetailsQuery.data?.details &&
                "title" in tmdbDetailsQuery.data.details
                  ? tmdbDetailsQuery.data.details.title
                  : tmdbDetailsQuery.data?.details &&
                      "name" in tmdbDetailsQuery.data.details
                    ? tmdbDetailsQuery.data.details.name
                    : item.title}
              </Text>
              {inLibraryQuery.foundServices.length > 0 && (
                <Chip
                  icon="check-circle"
                  mode="outlined"
                  style={{ borderColor: theme.colors.primary }}
                  textStyle={{ color: theme.colors.primary }}
                >
                  In Library
                </Chip>
              )}
            </View>

            {tmdbDetailsQuery.data?.details?.overview || item.overview ? (
              <View style={styles.synopsis}>
                <Text
                  variant="bodyLarge"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    lineHeight: 22,
                  }}
                >
                  {tmdbDetailsQuery.data?.details?.overview || item.overview}
                </Text>
              </View>
            ) : null}

            {tmdbDetailsQuery.data?.details?.genres &&
            tmdbDetailsQuery.data.details.genres.length > 0 ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.onSurface,
                    fontWeight: "700",
                    marginBottom: spacing.xs,
                  }}
                >
                  Genres
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {tmdbDetailsQuery.data.details.genres
                    .map((g) => g.name)
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            ) : null}

            {/* Cast */}
            <CastRow item={item} tmdbDetailsData={tmdbDetailsQuery.data} />

            {/* Ratings */}
            <RatingsOverview
              rating={
                tmdbDetailsQuery.data?.details?.vote_average || item.rating
              }
              votes={
                tmdbDetailsQuery.data?.details?.vote_count || item.voteCount
              }
            />

            {/* Release Date & Runtime */}
            <ReleaseMetadata item={item} tmdbDetails={tmdbDetailsQuery.data} />

            {/* Trailer */}
            {trailerFeatureEnabled &&
            tmdbDetailsQuery.data?.videos?.results &&
            tmdbDetailsQuery.data.videos.results.length > 0 ? (
              <TrailerFadeOverlay
                videoKey={trailerVideoKey}
                backdropUri={
                  tmdbDetailsQuery.data?.details?.backdrop_path
                    ? `https://image.tmdb.org/t/p/w1280${tmdbDetailsQuery.data.details.backdrop_path}`
                    : item.backdropUrl
                }
                height={200}
              />
            ) : null}

            {/* Watch Providers */}
            <WatchProvidersSection
              watchProvidersData={
                tmdbDetailsQuery.data?.watchProviders?.results as any
              }
            />

            {/* Sources / Releases */}
            <ReleasesList
              isLoading={releasesQuery.isLoading}
              isOpen={showReleases}
              onToggle={() => setShowReleases(!showReleases)}
              releases={releasesQuery.data ?? []}
            />

            <Button
              mode="contained"
              onPress={openServicePicker}
              disabled={inLibraryQuery.isLoading}
              style={styles.addButton}
            >
              {inLibraryQuery.isLoading
                ? "Checking..."
                : inLibraryQuery.foundServices.length > 0
                  ? "Already in Library"
                  : "Add to Library"}
            </Button>

            {jellyseerrConnectors.length > 0 &&
              (matchedJellyseerrRequests.length === 0 ? (
                <Button
                  mode="outlined"
                  onPress={handleJellyseerrRequest}
                  disabled={isRequesting}
                  style={styles.addButton}
                >
                  {isRequesting ? "Requesting..." : "Request with Jellyseerr"}
                </Button>
              ) : (
                <Button
                  mode="outlined"
                  onPress={() => setRemoveDialogVisible(true)}
                  disabled={checkingJellyseerr || isRemoving}
                  style={styles.addButton}
                >
                  {isRemoving
                    ? "Removing..."
                    : `Remove Jellyseerr Request${matchedJellyseerrRequests.length > 1 ? ` (${matchedJellyseerrRequests.length})` : ""}`}
                </Button>
              ))}

            {/* Related Items */}
            <RelatedItems
              currentId={item.id}
              onPress={(id: string) => handleRelatedPress(id)}
              relatedItems={
                relatedItemsQuery.recommendations.length > 0
                  ? relatedItemsQuery.recommendations
                  : relatedItemsQuery.similar.length > 0
                    ? relatedItemsQuery.similar
                    : undefined
              }
              isLoadingRelated={relatedItemsQuery.isLoading}
            />
          </ScrollView>
        )}
      </DetailHero>
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
        >
          <Dialog.Title>Add to service</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              Choose where to add{" "}
              <Text style={{ fontWeight: "600" }}>{item.title}</Text>
            </Text>
            <RadioButton.Group
              onValueChange={(v) => setSelectedServiceId(v)}
              value={selectedServiceId}
            >
              {(item.mediaType === "series"
                ? services.sonarr
                : services.radarr
              ).map((service) => (
                <RadioButton.Item
                  key={service.id}
                  value={String(service.id)}
                  label={service.name}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (!selectedServiceId) return;
                const params: Record<string, string> = {
                  serviceId: selectedServiceId,
                  query: item.title,
                };
                if (item.tmdbId) params.tmdbId = String(item.tmdbId);
                if (item.tvdbId) params.tvdbId = String(item.tvdbId);
                if (item.mediaType === "series") {
                  router.push({
                    pathname: "/(auth)/sonarr/[serviceId]/add",
                    params,
                  });
                } else {
                  router.push({
                    pathname: "/(auth)/radarr/[serviceId]/add",
                    params,
                  });
                }
                setDialogVisible(false);
              }}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
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
                  key={service.config.id}
                  value={String(service.config.id)}
                  label={service.config.name}
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
                // Compare as strings to avoid number/string mismatches
                const connector = jellyseerrConnectors.find(
                  (c) => String(c.config.id) === selectedJellyseerrServiceId,
                ) as JellyseerrConnector | undefined;
                if (connector) {
                  // await load to ensure servers/profiles are available when dialog closes
                  await loadJellyseerrOptions(connector);
                }
                setJellyseerrServiceDialogVisible(false);
              }}
            >
              Select
            </Button>
          </Dialog.Actions>
        </Dialog>
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
                <Text style={{ fontWeight: "600" }}>{item.title}</Text>
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
                {servers.map((server) => (
                  <RadioButton.Item
                    key={server.id}
                    value={server.id.toString()}
                    label={server.name}
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
                {profiles.map((profile) => (
                  <RadioButton.Item
                    key={profile.id}
                    value={profile.id.toString()}
                    label={profile.name}
                  />
                ))}
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
                {rootFolders.map((folder) => (
                  <RadioButton.Item
                    key={folder.path}
                    value={folder.path}
                    label={`${folder.path} (${(folder.freeSpace / (1024 * 1024 * 1024)).toFixed(2)} GB free)`}
                  />
                ))}
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

export default DiscoverItemDetails;

const CastRow: React.FC<{
  item: import("@/models/discover.types").DiscoverMediaItem;
  tmdbDetailsData: ReturnType<typeof useTmdbDetails>["data"];
}> = ({ item, tmdbDetailsData }) => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  // Use centralized size tokens for consistent avatar sizing
  const AVATAR_SIZE = avatarSizes.lg;
  const MAX_VISIBLE = 5; // show up to 5 avatars, then a +N badge
  const OVERLAP = Math.round(AVATAR_SIZE * 0.35);

  // Fetch credits from Jellyseerr for Jellyseerr items
  const jellyseerrCreditsQuery = useJellyseerrMediaCredits(
    item.sourceServiceId!,
    item.mediaType === "series" ? "tv" : "movie",
    item.sourceId!,
  );

  // Use TMDB details data passed from parent
  const tmdbCast = useMemo(() => {
    const rawCast = tmdbDetailsData?.credits?.cast;
    if (!Array.isArray(rawCast)) {
      return [];
    }

    return rawCast.slice(0, MAX_VISIBLE).map((person) => ({
      id: person.id,
      name:
        typeof person.name === "string"
          ? person.name
          : (person.original_name ?? "Unknown"),
      profilePath:
        typeof person.profile_path === "string"
          ? person.profile_path
          : undefined,
    }));
  }, [tmdbDetailsData?.credits?.cast]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        avatars: { flexDirection: "row", alignItems: "center" },
        avatar: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          overflow: "hidden",
        },
        moreBadge: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [AVATAR_SIZE],
  );

  // Use either Jellyseerr or TMDB cast data
  const shouldFetchJellyseerrCredits =
    item.source === "jellyseerr" && item.sourceServiceId && item.sourceId;
  const cast = shouldFetchJellyseerrCredits
    ? (jellyseerrCreditsQuery?.data ?? [])
    : (tmdbCast ?? []);

  const openPersonDetails = (personId?: number, name?: string) => {
    if (personId) {
      router.push({
        pathname: "/(auth)/person/[personId]",
        params: { personId: String(personId) },
      });
    } else if (name) {
      // Fallback to search if no person ID is available
      router.push({ pathname: "/(auth)/search", params: { query: name } });
    }
  };

  if (!cast.length) {
    return (
      <View style={styles.row}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface, fontWeight: "700" }}
        >
          Cast
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          No cast information
        </Text>
      </View>
    );
  }

  const visibleCast = cast.slice(0, MAX_VISIBLE);
  const extras = Math.max(0, cast.length - MAX_VISIBLE);

  // Helper to get the profile image URL based on the source
  const getProfileImageUrl = (person: any): string | undefined => {
    // For Jellyseerr cast: profileUrl is already a full URL
    if ("profileUrl" in person && person.profileUrl) {
      return person.profileUrl;
    }
    // For TMDB cast: profilePath needs to be converted to full URL
    if ("profilePath" in person && person.profilePath) {
      return buildProfileUrl(person.profilePath);
    }
    return undefined;
  };

  return (
    <View style={styles.row}>
      <Text
        variant="titleMedium"
        style={{ color: theme.colors.onSurface, fontWeight: "700" }}
      >
        Cast
      </Text>
      <View style={{ flex: 1 }} />

      <View style={styles.avatars} accessibilityRole="list">
        {visibleCast.map((person, idx) => (
          <Pressable
            key={String(person.id ?? person.name ?? idx)}
            accessibilityRole="button"
            accessibilityLabel={
              person.name
                ? `View details for ${person.name}`
                : "View cast member details"
            }
            onPress={() => openPersonDetails(person.id, person.name)}
            style={{ marginLeft: idx === 0 ? 0 : -OVERLAP, zIndex: idx + 1 }}
          >
            <MediaPoster
              uri={getProfileImageUrl(person)}
              size={AVATAR_SIZE}
              aspectRatio={1}
              borderRadius={AVATAR_SIZE / 2}
              style={[
                styles.avatar,
                {
                  borderWidth: 2,
                  borderColor: theme.colors.onPrimaryContainer,
                  backgroundColor: theme.colors.onPrimaryContainer,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 6,
                },
              ]}
            />
          </Pressable>
        ))}

        {extras > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${extras} more cast members`}
            onPress={() =>
              router.push(
                `/(auth)/search?query=${encodeURIComponent(item.title)}`,
              )
            }
            style={{ marginLeft: -OVERLAP, zIndex: visibleCast.length + 1 }}
          >
            <View
              style={[
                styles.moreBadge,
                {
                  backgroundColor: theme.colors.onPrimaryContainer,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 6,
                },
              ]}
            >
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.primary, fontWeight: "700" }}
              >
                {`+${extras}`}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const ReleaseMetadata: React.FC<{
  item: import("@/models/discover.types").DiscoverMediaItem;
  tmdbDetails: ReturnType<typeof useTmdbDetails>["data"];
}> = ({ item, tmdbDetails }) => {
  const theme = useTheme<AppTheme>();

  const runtime = useMemo(() => {
    if (item.mediaType === "series") {
      const tvRuntime = (tmdbDetails?.details as any)?.episode_run_time?.[0];
      return tvRuntime ? `${tvRuntime}m/ep` : undefined;
    }
    const movieRuntime = (tmdbDetails?.details as any)?.runtime;
    return movieRuntime ? `${movieRuntime}m` : undefined;
  }, [tmdbDetails, item.mediaType]);

  const releaseYear = useMemo(() => {
    const fromItem = item.releaseDate
      ? new Date(item.releaseDate).getFullYear()
      : item.year;
    const releaseDateKey =
      item.mediaType === "movie" ? "release_date" : "first_air_date";
    const fromTmdb = (tmdbDetails?.details as any)?.[releaseDateKey]
      ? new Date((tmdbDetails?.details as any)[releaseDateKey]).getFullYear()
      : undefined;
    return fromTmdb ?? fromItem;
  }, [tmdbDetails, item.releaseDate, item.year, item.mediaType]);

  if (!runtime && !releaseYear) return null;

  return (
    <View
      style={{
        marginBottom: spacing.sm,
        flexDirection: "row",
        gap: spacing.md,
      }}
    >
      {releaseYear && (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {releaseYear}
        </Text>
      )}
      {runtime && (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {runtime}
        </Text>
      )}
    </View>
  );
};

const WatchProvidersSection: React.FC<{
  watchProvidersData?: any;
}> = ({ watchProvidersData }) => {
  const theme = useTheme<AppTheme>();

  if (!watchProvidersData || typeof watchProvidersData !== "object") {
    return null;
  }

  // Get device region and try fallback chain: device region -> US -> any available
  const region = getDeviceRegion();
  let regionData = watchProvidersData[region];

  if (!regionData) {
    // Fallback to US if device region not available
    regionData = watchProvidersData["US"];
  }

  if (!regionData) {
    // Try to find any available region
    const availableRegion = Object.keys(watchProvidersData).find(
      (k) => watchProvidersData[k]?.flatrate?.length > 0,
    );
    if (availableRegion) {
      regionData = watchProvidersData[availableRegion];
    }
  }

  if (!regionData || !Array.isArray(regionData?.flatrate)) {
    return null;
  }

  const providers = regionData.flatrate.slice(0, 5);

  if (providers.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text
        variant="titleMedium"
        style={{
          color: theme.colors.onSurface,
          fontWeight: "700",
          marginBottom: spacing.xs,
        }}
      >
        Available On
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
        {providers.map((provider: any) => (
          <Chip key={provider.provider_id} icon="play-circle-outline">
            {provider.provider_name}
          </Chip>
        ))}
      </View>
    </View>
  );
};

const ReleasesList: React.FC<{
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  releases: import("@/models/discover.types").NormalizedRelease[];
}> = ({ isLoading, isOpen, onToggle, releases }) => {
  const theme = useTheme<AppTheme>();

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Pressable
        onPress={onToggle}
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
          marginBottom: isOpen ? spacing.md : 0,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "700",
            }}
          >
            Release Sources
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {isLoading ? "Loading..." : isOpen ? "▼" : "▶"}
          </Text>
        </View>
      </Pressable>

      {isOpen && (
        <View style={{ marginTop: spacing.md }}>
          {isLoading ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                paddingVertical: spacing.lg,
              }}
            >
              Searching available sources...
            </Text>
          ) : releases.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                paddingVertical: spacing.lg,
              }}
            >
              No releases found
            </Text>
          ) : (
            releases
              .slice(0, 10)
              .map((release, idx) => (
                <ReleaseCard
                  key={`${release.sourceConnector}-${idx}`}
                  release={release}
                />
              ))
          )}
        </View>
      )}
    </View>
  );
};

const ReleaseCard: React.FC<{
  release: import("@/models/discover.types").NormalizedRelease;
}> = ({ release }) => {
  const theme = useTheme<AppTheme>();

  const sizeInGB = useMemo(
    () =>
      release.size
        ? (release.size / (1024 * 1024 * 1024)).toFixed(2)
        : undefined,
    [release.size],
  );

  const handleOpenMagnet = async () => {
    if (release.magnetUrl) {
      try {
        const canOpen = await Linking.canOpenURL(release.magnetUrl);
        if (canOpen) {
          await Linking.openURL(release.magnetUrl);
        }
      } catch (error) {
        console.warn("Failed to open magnet link:", error);
      }
    } else if (release.downloadUrl) {
      try {
        const canOpen = await Linking.canOpenURL(release.downloadUrl);
        if (canOpen) {
          await Linking.openURL(release.downloadUrl);
        }
      } catch (error) {
        console.warn("Failed to open download link:", error);
      }
    }
  };

  return (
    <View
      style={{
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: 8,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ marginBottom: spacing.xs }}>
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurface, fontWeight: "600" }}
          numberOfLines={2}
        >
          {release.title}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: spacing.xs,
          flexWrap: "wrap",
          marginBottom: spacing.xs,
        }}
      >
        {release.quality?.name && (
          <Chip mode="outlined" compact>
            {release.quality.name}
          </Chip>
        )}
        {release.indexer && (
          <Chip mode="outlined" compact>
            {release.indexer}
          </Chip>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: spacing.xs,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {release.seeders !== null && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              📤 {release.seeders}
            </Text>
          )}
          {release.size && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {sizeInGB}GB
            </Text>
          )}
        </View>
        {(release.magnetUrl || release.downloadUrl) && (
          <Button mode="outlined" compact onPress={handleOpenMagnet}>
            Open
          </Button>
        )}
      </View>
    </View>
  );
};
