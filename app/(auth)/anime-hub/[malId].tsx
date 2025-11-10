import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Linking,
  Image as RNImage,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Chip,
  Text,
  useTheme,
  IconButton,
  Portal,
  Dialog,
  Checkbox,
  Button,
} from "react-native-paper";

import DetailHero from "@/components/media/DetailHero/DetailHero";
import TrailerFadeOverlay from "@/components/media/TrailerFadeOverlay/TrailerFadeOverlay";
import { EmptyState } from "@/components/common/EmptyState";
import {
  AnimatedSection,
  SettingsGroup,
  UniArrLoader,
} from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useJikanAnimeDetails } from "@/hooks/useJikanAnimeDetails";
import { useSkeletonLoading } from "@/hooks/useSkeletonLoading";
import { skeletonTiming } from "@/constants/skeletonTiming";
import type { JikanTrailer } from "@/models/jikan.types";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import { useConnectorsStore, selectConnectors } from "@/store/connectorsStore";
import type { components as JellyseerrComponents } from "@/connectors/client-schemas/jellyseerr-openapi";
import { alert } from "@/services/dialogService";
import { secureStorage } from "@/services/storage/SecureStorage";
import type { RootFolder } from "@/models/media.types";
import {
  useSettingsStore,
  selectPreferredJellyseerrServiceId,
} from "@/store/settingsStore";

// removed unused isApiError import
import DetailPageSkeleton from "@/components/discover/DetailPageSkeleton";
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Jellyseerr search result type not needed in this file

const AnimeHubDetailScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const params = useLocalSearchParams<{ malId?: string }>();
  const malId = Number.parseInt(params.malId ?? "", 10);
  const validMalId = Number.isFinite(malId) && malId > 0 ? malId : undefined;

  const { anime, isLoading, isError, refetch } =
    useJikanAnimeDetails(validMalId);

  // Initialize skeleton loading hook with high complexity timing (900ms) for external API data
  const skeleton = useSkeletonLoading(skeletonTiming.highComplexity); // Lines 587-593 omitted

  // Effect to manage skeleton visibility based on loading state
  useEffect(() => {
    // Lines 587-593 omitted
    if (isLoading && !anime) {
      skeleton.startLoading();
    } else {
      skeleton.stopLoading();
    }
  }, [isLoading, anime, skeleton]);

  const connectors = useConnectorsStore(selectConnectors);
  const jellyseerrConnectors = useMemo(() => {
    return Array.from(connectors.values()).filter(
      (connector): connector is JellyseerrConnector =>
        connector.config.type === "jellyseerr" && connector.config.enabled,
    );
  }, [connectors]);

  const { searchableServices } = useUnifiedSearch("", { enabled: false });

  const [isRequesting, setIsRequesting] = useState(false);
  // --- Jellyseerr request modal state ---
  const preferredJellyseerrServiceId = useSettingsStore(
    selectPreferredJellyseerrServiceId,
  );
  const trailerFeatureEnabled = useSettingsStore(
    (s) => s.trailerFeatureEnabled,
  );

  const [jellyseerrServiceDialogVisible, setJellyseerrServiceDialogVisible] =
    useState(false);

  const [jellyseerrDialogVisible, setJellyseerrDialogVisible] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>("");

  type JellyServer =
    | JellyseerrComponents["schemas"]["RadarrSettings"]
    | JellyseerrComponents["schemas"]["SonarrSettings"];
  type ServiceProfile = JellyseerrComponents["schemas"]["ServiceProfile"];

  const [servers, setServers] = useState<JellyServer[]>([]);
  const [profiles, setProfiles] = useState<ServiceProfile[]>([]);
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([]);
  const [currentConnector, setCurrentConnector] =
    useState<JellyseerrConnector | null>(null);

  const [matchedJellyseerrRequests, setMatchedJellyseerrRequests] = useState<
    {
      connector: JellyseerrConnector;
      request: any;
      serviceId: string | number | undefined;
      serviceName: string | undefined;
    }[]
  >([]);
  // scanning state intentionally omitted from UI for now
  const [removeDialogVisible, setRemoveDialogVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<any[]>([]);
  const [selectAllSeasons, setSelectAllSeasons] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollContainer: {
          paddingHorizontal: spacing.xs,
          paddingBottom: spacing.xxxxl,
        },
        section: {
          marginTop: spacing.md,
          marginHorizontal: spacing.xs,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: 16,
          fontWeight: "500",
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.xs,
        },
        metaRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        chip: {
          backgroundColor: theme.colors.secondaryContainer,
        },
        chipText: {
          color: theme.colors.onSecondaryContainer,
        },
        headline: {
          color: theme.colors.onSurface,
          fontWeight: "700",
        },
        body: {
          color: theme.colors.onSurfaceVariant,
          lineHeight: 22,
        },
        metaText: {
          color: theme.colors.onSurface,
        },
        primaryActions: {
          marginTop: spacing.md,
          gap: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
        },
        helperText: {
          color: theme.colors.onSurfaceVariant,
          marginTop: spacing.sm,
        },
        statLabel: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        statValue: {
          color: theme.colors.onSurface,
          fontWeight: "600",
        },
        statNumber: {
          color: theme.colors.onSurface,
          fontWeight: "600",
        },
        relationType: {
          color: theme.colors.primary,
          marginBottom: spacing.xs,
          textTransform: "capitalize",
        },
        relationGroup: {
          marginBottom: spacing.md,
        },
        reviewItem: {
          marginBottom: spacing.md,
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        reviewContent: {
          color: theme.colors.onSurface,
          lineHeight: 20,
          marginBottom: spacing.xs,
        },
        reviewAuthor: {
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
        picturesContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        pictureItem: {
          width: "30%",
          aspectRatio: 16 / 9,
          borderRadius: 8,
          overflow: "hidden",
        },
        pictureImage: {
          width: "100%",
          height: "100%",
        },
        episodeItem: {
          marginBottom: spacing.sm,
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        episodeTitle: {
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        episodeMeta: {
          color: theme.colors.onSurfaceVariant,
        },
        showMore: {
          color: theme.colors.primary,
          textAlign: "center",
          marginTop: spacing.sm,
        },
        statsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        statCard: {
          flex: 1,
          minWidth: 80,
          alignItems: "center",
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        detailedStats: {
          gap: spacing.md,
        },
        statRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          gap: spacing.md,
        },
        statItem: {
          flex: 1,
          minWidth: 120,
          alignItems: "center",
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        episodesList: {
          gap: spacing.sm,
        },
        episodeHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.md,
        },
        modalImage: {
          width: "100%",
          height: "100%",
        },
      }),
    [theme],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  );

  const windowDimensions = useWindowDimensions();
  const dialogMaxHeight = Math.max(240, windowDimensions.height * 0.6);

  const animationsEnabled = shouldAnimateLayout(false, false);
  const [selectedBackdropUri, setSelectedBackdropUri] = useState<
    string | undefined
  >(undefined);
  const posterUri =
    anime?.images?.jpg?.large_image_url ??
    anime?.images?.jpg?.image_url ??
    undefined;
  const trailerBackdropUri = (() => {
    const trailer = anime?.trailer as JikanTrailer | undefined;
    if (!trailer) return undefined;
    const images = trailer.images;
    if (images && typeof images === "object") {
      return images.maximum_image_url ?? images.large_image_url ?? undefined;
    }
    return undefined;
  })();
  const trailerVideoKey = (() => {
    const trailer = anime?.trailer as JikanTrailer | undefined;
    if (!trailer) return undefined;
    return trailer.youtube_id ?? undefined;
  })();
  useEffect(() => {
    let mounted = true;

    const chooseBackdrop = async () => {
      try {
        // 1) If trailer provides a backdrop, use it immediately.
        if (trailerBackdropUri) {
          if (mounted) setSelectedBackdropUri(trailerBackdropUri);
          return;
        }

        // 2) Otherwise, try to pick a persisted gallery image index for this anime.
        const pics = Array.isArray(anime?.pictures) ? anime!.pictures : [];
        const animeId = anime?.mal_id ?? undefined;

        if (animeId && pics.length > 0) {
          const key = `animeBackdropChoice:${animeId}`;
          const stored = await AsyncStorage.getItem(key);
          let index: number | undefined = undefined;
          if (stored !== null) {
            const parsed = Number.parseInt(stored, 10);
            if (
              Number.isFinite(parsed) &&
              parsed >= 0 &&
              parsed < pics.length
            ) {
              index = parsed;
            }
          }

          if (index === undefined) {
            index = Math.floor(Math.random() * pics.length);
            try {
              await AsyncStorage.setItem(key, String(index));
            } catch {
              // ignore storage errors — fallback still works
            }
          }

          const picture = pics[index];
          const uri =
            picture?.jpg?.large_image_url ??
            picture?.jpg?.image_url ??
            undefined;
          if (mounted) setSelectedBackdropUri(uri ?? posterUri);
          return;
        }

        // 3) Fallback to posterUri (may be undefined)
        if (mounted) setSelectedBackdropUri(posterUri);
      } catch {
        if (mounted) setSelectedBackdropUri(posterUri);
      }
    };

    void chooseBackdrop();
    return () => {
      mounted = false;
    };
  }, [anime, posterUri, trailerBackdropUri]);

  const openOnMal = async () => {
    if (validMalId) {
      const url = `https://myanimelist.net/anime/${validMalId}`;
      await Linking.openURL(url);
    }
  };

  // --- Jellyseerr: load servers/profiles and populate dialog ---
  const loadJellyseerrOptions = useCallback(
    async (connector: JellyseerrConnector) => {
      if (!anime) return;

      setCurrentConnector(connector);
      setSubmitError("");

      const mediaType = "tv"; // anime hub items are tv-style

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

        if (defaultServerId != null) {
          const { profiles: profs, rootFolders: rf } =
            await connector.getProfiles(defaultServerId, mediaType);
          setProfiles(profs ?? []);
          setRootFolders(rf ?? []);

          const defaultProfile = Array.isArray(profs) ? profs[0] : undefined;
          const defaultRootFolder = rf?.[0]?.path || "";

          // load per-service config defaults if present
          const serviceId = (connector as any).config?.id;
          let serviceConfig: any = null;
          if (serviceId) {
            try {
              const configs = await secureStorage.getServiceConfigs();
              serviceConfig = Array.isArray(configs)
                ? (configs.find((c) => String(c.id) === String(serviceId)) ??
                  null)
                : null;
            } catch {
              serviceConfig = null;
            }
          }

          const targetKey =
            defaultServerId != null ? String(defaultServerId) : undefined;
          const targetDefaults = serviceConfig?.jellyseerrTargetDefaults ?? {};
          const targetDefault = targetKey
            ? targetDefaults?.[targetKey]
            : undefined;

          // Anime context: treat as anime
          const serverAnimeProfileId =
            (defaultServer as any)?.activeAnimeProfileId ?? null;
          const serverAnimeDirectory =
            (defaultServer as any)?.activeAnimeDirectory ?? null;

          let selectedProfileId: number | undefined = undefined;
          let selectedRootFolderStr: string | undefined = undefined;

          // prefer per-target default, then service-level, then server-provided anime defaults
          if (targetDefault?.profileId) {
            selectedProfileId = Number(targetDefault.profileId);
          } else if (serviceConfig?.defaultProfileId) {
            selectedProfileId = Number(serviceConfig.defaultProfileId);
          } else if (serverAnimeProfileId != null) {
            selectedProfileId = Number(serverAnimeProfileId);
          } else if (defaultProfile && (defaultProfile as any).id != null) {
            selectedProfileId = Number((defaultProfile as any).id);
          }

          if (targetDefault?.rootFolderPath) {
            selectedRootFolderStr = targetDefault.rootFolderPath;
          } else if (serviceConfig?.defaultRootFolderPath) {
            selectedRootFolderStr = serviceConfig.defaultRootFolderPath;
          } else if (serverAnimeDirectory) {
            selectedRootFolderStr = String(serverAnimeDirectory);
          } else {
            selectedRootFolderStr = defaultRootFolder;
          }

          setSelectedProfile(
            selectedProfileId != null ? Number(selectedProfileId) : null,
          );
          setSelectedRootFolder(selectedRootFolderStr || "");

          // load available seasons for confirmation if connector supports getMediaDetails
          try {
            const mediaId = anime?.mal_id ?? undefined;
            if (
              typeof (connector as any).getMediaDetails === "function" &&
              mediaId
            ) {
              const details = await (connector as any).getMediaDetails(
                mediaId,
                mediaType,
              );
              const seasons = details?.seasons ?? [];
              setAvailableSeasons(Array.isArray(seasons) ? seasons : []);
            } else {
              setAvailableSeasons([]);
            }
          } catch {
            setAvailableSeasons([]);
          }
        }

        setJellyseerrDialogVisible(true);
      } catch (error) {
        void alert(
          "Error",
          `Failed to load options: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.warn("loadJellyseerrOptions failed", error);
      }
    },
    [anime],
  );

  const handleServerChange = useCallback(
    async (serverId: number) => {
      if (!currentConnector) return;
      if (serverId < 0) return;

      const mediaType = "tv";
      try {
        const { profiles: profs, rootFolders: rf } =
          await currentConnector.getProfiles(serverId, mediaType);
        setProfiles(profs ?? []);
        setRootFolders(rf ?? []);

        const serviceId: string | undefined = (currentConnector as any).config
          ?.id;
        let serviceConfig: any = null;
        if (serviceId) {
          try {
            const configs = await secureStorage.getServiceConfigs();
            serviceConfig = Array.isArray(configs)
              ? (configs.find((c) => String(c.id) === String(serviceId)) ??
                null)
              : null;
          } catch {
            serviceConfig = null;
          }
        }

        const defaultProfile = Array.isArray(profs) ? profs[0] : undefined;
        const defaultRootFolder = rf?.[0]?.path || "";

        const targetKey = String(serverId);
        const targetDefaults = serviceConfig?.jellyseerrTargetDefaults ?? {};
        const targetDefault = targetDefaults?.[targetKey];

        const serverObj = servers.find(
          (s) => String((s as any)?.id) === String(serverId),
        );
        const serverAnimeProfileId =
          (serverObj as any)?.activeAnimeProfileId ?? null;
        const serverAnimeDirectory =
          (serverObj as any)?.activeAnimeDirectory ?? null;

        let selectedProfileId: number | undefined = undefined;
        let selectedRootFolderStr: string | undefined = undefined;

        if (targetDefault?.profileId) {
          selectedProfileId = Number(targetDefault.profileId);
        } else if (serviceConfig?.defaultProfileId) {
          selectedProfileId = Number(serviceConfig.defaultProfileId);
        } else if (serverAnimeProfileId != null) {
          selectedProfileId = Number(serverAnimeProfileId);
        } else if (defaultProfile && (defaultProfile as any).id != null) {
          selectedProfileId = Number((defaultProfile as any).id);
        }

        if (targetDefault?.rootFolderPath) {
          selectedRootFolderStr = targetDefault.rootFolderPath;
        } else if (serviceConfig?.defaultRootFolderPath) {
          selectedRootFolderStr = serviceConfig.defaultRootFolderPath;
        } else if (serverAnimeDirectory) {
          selectedRootFolderStr = String(serverAnimeDirectory);
        } else {
          selectedRootFolderStr = defaultRootFolder;
        }

        setSelectedProfile(
          selectedProfileId != null ? Number(selectedProfileId) : null,
        );
        setSelectedRootFolder(selectedRootFolderStr || "");
      } catch (error) {
        void alert(
          "Error",
          `Failed to load profiles: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.warn("handleServerChange failed", error);
      }
    },
    [currentConnector, servers],
  );

  const refreshJellyseerrMatches = useCallback(async () => {
    // scanning starts
    try {
      if (!anime || jellyseerrConnectors.length === 0) {
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
            const requests = await connector.getRequests();
            if (!Array.isArray(requests)) return;

            for (const req of requests) {
              const media = req?.media as any;
              const mediaTmdb = media?.tmdbId ?? media?.tmdb_id ?? undefined;
              const mediaId = mediaTmdb ?? media?.id ?? undefined;
              // match by mal_id if connector stores it, otherwise tmdb
              if (
                mediaId &&
                (mediaId === anime.mal_id || mediaId === anime?.mal_id)
              ) {
                matches.push({
                  connector,
                  request: req,
                  serviceId: (connector as any).config?.id,
                  serviceName: (connector as any).config?.name,
                });
              }
            }
          } catch {
            // ignore per-connector failures
          }
        }),
      );

      setMatchedJellyseerrRequests(matches);
    } finally {
      // scanning finished
    }
  }, [anime, jellyseerrConnectors]);

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
          `Failed to remove request: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsRemoving(false);
      }
    },
    [refreshJellyseerrMatches],
  );

  const handleSubmitRequest = useCallback(async () => {
    if (!currentConnector || !anime) {
      setSubmitError("Please select a server and profile.");
      return;
    }

    if (selectedServer == null || selectedProfile == null) {
      setSubmitError("Please select a server and profile.");
      return;
    }

    setSubmitError("");
    setIsRequesting(true);

    try {
      // Check existing requests
      let existing;
      try {
        const requests = await currentConnector.getRequests();
        existing =
          Array.isArray(requests) &&
          requests.find((r) => {
            const media = r?.media as any;
            const mediaTmdb = media?.tmdbId ?? media?.tmdb_id ?? undefined;
            return mediaTmdb === anime.mal_id || media?.id === anime.mal_id;
          });
      } catch {
        existing = undefined;
      }

      if (existing) {
        setSubmitError("This title already has a request in Jellyseerr.");
        return;
      }

      const payload: Parameters<JellyseerrConnector["createRequest"]>[0] = {
        mediaType: "tv",
        mediaId: anime.mal_id as number,
        serverId: selectedServer,
        profileId: selectedProfile,
        rootFolder: selectedRootFolder || undefined,
        is4k: false,
        ...(selectedSeasons && selectedSeasons.length
          ? { seasons: selectedSeasons }
          : { seasons: "all" }),
      } as any;

      await currentConnector.createRequest(payload);
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
    anime,
    refreshJellyseerrMatches,
    selectedProfile,
    selectedRootFolder,
    selectedSeasons,
    selectedServer,
  ]);

  const handleJellyseerrRequest = useCallback(async () => {
    if (!anime || jellyseerrConnectors.length === 0) return;

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
      setJellyseerrServiceDialogVisible(true);
    } else {
      await loadJellyseerrOptions(
        jellyseerrConnectors[0] as JellyseerrConnector,
      );
    }
  }, [
    anime,
    jellyseerrConnectors,
    loadJellyseerrOptions,
    preferredJellyseerrServiceId,
  ]);

  React.useEffect(() => {
    void refreshJellyseerrMatches();
  }, [anime?.mal_id, jellyseerrConnectors, refreshJellyseerrMatches]);

  if (skeleton.showSkeleton && isLoading && !anime) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <DetailHero
          posterUri={posterUri}
          backdropUri={selectedBackdropUri}
          heroHeight={spacing.xxxxl * 3}
          overlayEndColor={theme.colors.background}
          onBack={() => router.back()}
          onMal={openOnMal}
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

  if (!validMalId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Invalid anime ID"
          description="The requested anime could not be found."
          actionLabel="Go Back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if ((isError || !anime) && !isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Failed to load"
          description="We couldn't load this title from MyAnimeList."
          actionLabel="Retry"
          onActionPress={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const genres = (anime?.genres ?? [])
    .map((genre) => genre.name)
    .filter(Boolean);
  const themes = (anime?.themes ?? [])
    .map((themeItem) => themeItem.name)
    .filter(Boolean);
  const demographics = (anime?.demographics ?? [])
    .map((item) => item.name)
    .filter(Boolean);
  const tags = [...genres, ...themes, ...demographics];

  const metaItems = [
    anime?.type,
    anime?.episodes ? `${anime.episodes} episodes` : undefined,
    anime?.duration ?? undefined,
    anime?.status ?? undefined,
    anime?.score ? `${anime.score.toFixed(1)} rating` : undefined,
    anime?.rank ? `Rank #${anime.rank}` : undefined,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <DetailHero
        posterUri={posterUri}
        backdropUri={selectedBackdropUri}
        heroHeight={spacing.xxxxl * 3}
        overlayEndColor={theme.colors.background}
        onBack={() => router.back()}
        onMal={openOnMal}
      >
        {/* Primary Information Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <SettingsGroup>
            <View style={{ padding: spacing.md, gap: spacing.md }}>
              <View>
                <Text variant="headlineLarge" style={styles.headline}>
                  {anime?.title ?? "Untitled"}
                </Text>
                {anime?.title_english && anime.title_english !== anime.title ? (
                  <Text variant="titleMedium" style={styles.body}>
                    {anime.title_english}
                  </Text>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                {metaItems.map((item) => (
                  <Chip key={item} compact mode="outlined">
                    <Text style={styles.metaText}>{item}</Text>
                  </Chip>
                ))}
              </View>

              <View style={styles.primaryActions}>
                {isRequesting ? (
                  <UniArrLoader size={20} centered />
                ) : (
                  <IconButton
                    icon="playlist-plus"
                    size={28}
                    iconColor={theme.colors.primary}
                    onPress={() => void handleJellyseerrRequest()}
                    accessibilityLabel="Request via Jellyseerr"
                  />
                )}

                <IconButton
                  icon="movie-search"
                  size={28}
                  onPress={() =>
                    router.push({
                      pathname: "/(auth)/search",
                      params: { query: anime?.title, mediaType: "series" },
                    })
                  }
                  disabled={!searchableServices.length}
                  iconColor={
                    searchableServices.length
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                  accessibilityLabel="Unified Search"
                />
              </View>
              {jellyseerrConnectors.length === 0 ? (
                <Text variant="bodySmall" style={styles.helperText}>
                  Connect a Jellyseerr service to forward anime requests to
                  Radarr/Sonarr automatically.
                </Text>
              ) : null}
            </View>
          </SettingsGroup>
        </AnimatedSection>

        {/* Synopsis Section */}
        {anime?.synopsis ? (
          <AnimatedSection
            style={styles.section}
            delay={100}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Synopsis</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <Text variant="bodyLarge" style={styles.body}>
                  {anime.synopsis}
                </Text>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Trailer */}
        {trailerFeatureEnabled && trailerVideoKey && trailerBackdropUri ? (
          <TrailerFadeOverlay
            videoKey={trailerVideoKey}
            backdropUri={trailerBackdropUri}
            height={200}
          />
        ) : null}

        {/* Quick Stats Overview */}
        {anime?.statistics ? (
          <AnimatedSection
            style={styles.section}
            delay={150}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Quick Stats</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {anime && typeof anime.score === "number"
                        ? anime.score.toFixed(1)
                        : "N/A"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Score
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {anime && typeof anime.rank === "number"
                        ? `#${anime.rank}`
                        : "N/A"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Rank
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {anime && typeof anime.popularity === "number"
                        ? `#${anime.popularity}`
                        : "N/A"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Popularity
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text variant="headlineSmall" style={styles.statNumber}>
                      {anime && typeof anime.members === "number"
                        ? anime.members.toLocaleString()
                        : "N/A"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Members
                    </Text>
                  </View>
                </View>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Tags and Categories */}
        {tags.length || (anime?.studios?.length ?? 0) > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={200}
            animated={animationsEnabled}
          >
            {tags.length ? (
              <>
                <Text style={styles.sectionTitle}>Tags</Text>
                <SettingsGroup>
                  <View style={{ padding: spacing.md }}>
                    <View style={styles.metaRow}>
                      {tags.map((tag) => (
                        <Chip
                          key={tag}
                          style={styles.chip}
                          textStyle={styles.chipText}
                        >
                          {tag}
                        </Chip>
                      ))}
                    </View>
                  </View>
                </SettingsGroup>
              </>
            ) : null}

            {anime?.studios?.length ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
                  Studios
                </Text>
                <SettingsGroup>
                  <View style={{ padding: spacing.md }}>
                    <View style={styles.metaRow}>
                      {anime.studios
                        .map((studio) => studio.name)
                        .filter(Boolean)
                        .map((name) => (
                          <Chip key={name} mode="outlined">
                            <Text style={styles.metaText}>{name}</Text>
                          </Chip>
                        ))}
                    </View>
                  </View>
                </SettingsGroup>
              </>
            ) : null}
          </AnimatedSection>
        ) : null}

        {/* Detailed Statistics */}
        {anime?.statistics ? (
          <AnimatedSection
            style={styles.section}
            delay={250}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Community Stats</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <View style={styles.detailedStats}>
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <Text variant="headlineSmall" style={styles.statValue}>
                        {anime &&
                        anime.statistics &&
                        typeof anime.statistics.watching === "number"
                          ? anime.statistics.watching.toLocaleString()
                          : "0"}
                      </Text>
                      <Text variant="labelMedium" style={styles.statLabel}>
                        Currently Watching
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text variant="headlineSmall" style={styles.statValue}>
                        {anime &&
                        anime.statistics &&
                        typeof anime.statistics.completed === "number"
                          ? anime.statistics.completed.toLocaleString()
                          : "0"}
                      </Text>
                      <Text variant="labelMedium" style={styles.statLabel}>
                        Completed
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <Text variant="headlineSmall" style={styles.statValue}>
                        {anime &&
                        anime.statistics &&
                        typeof anime.statistics.on_hold === "number"
                          ? anime.statistics.on_hold.toLocaleString()
                          : "0"}
                      </Text>
                      <Text variant="labelMedium" style={styles.statLabel}>
                        On Hold
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text variant="headlineSmall" style={styles.statValue}>
                        {anime &&
                        anime.statistics &&
                        typeof anime.statistics.dropped === "number"
                          ? anime.statistics.dropped.toLocaleString()
                          : "0"}
                      </Text>
                      <Text variant="labelMedium" style={styles.statLabel}>
                        Dropped
                      </Text>
                    </View>
                  </View>
                  {anime &&
                    anime.statistics &&
                    typeof (anime.statistics as Record<string, unknown>)[
                      "favorites"
                    ] === "number" && (
                      <View style={styles.statRow}>
                        <View style={styles.statItem}>
                          <Text
                            variant="headlineSmall"
                            style={styles.statValue}
                          >
                            {typeof (
                              anime.statistics as Record<string, unknown>
                            )["favorites"] === "number"
                              ? (
                                  (anime.statistics as Record<string, unknown>)[
                                    "favorites"
                                  ] as number
                                ).toLocaleString()
                              : "0"}
                          </Text>
                          <Text variant="labelMedium" style={styles.statLabel}>
                            Favorited
                          </Text>
                        </View>
                      </View>
                    )}
                </View>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Episodes Section */}
        {anime?.episodes && anime.episodes.length > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={300}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>
              Episodes ({anime && anime.episodes ? anime.episodes.length : 0})
            </Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <View style={styles.episodesList}>
                  {anime.episodes.slice(0, 8).map((episode) => (
                    <View key={episode.mal_id} style={styles.episodeItem}>
                      <View style={styles.episodeHeader}>
                        <Text variant="bodyMedium" style={styles.episodeTitle}>
                          {episode.title}
                        </Text>
                        <Text variant="labelSmall" style={styles.episodeMeta}>
                          #{episode.episode_id}
                        </Text>
                      </View>
                      {episode.duration && (
                        <Text variant="labelSmall" style={styles.episodeMeta}>
                          {episode.duration}
                        </Text>
                      )}
                    </View>
                  ))}
                  {anime && anime.episodes && anime.episodes.length > 8 && (
                    <Text variant="labelMedium" style={styles.showMore}>
                      +{" "}
                      {anime && anime.episodes ? anime.episodes.length - 8 : 0}{" "}
                      more episodes
                    </Text>
                  )}
                </View>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Pictures Gallery */}
        {anime && anime.pictures && anime.pictures.length > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={350}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Gallery</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <View style={styles.picturesContainer}>
                  {anime && anime.pictures
                    ? anime.pictures.slice(0, 6).map((picture, index) => {
                        const uri =
                          picture.jpg?.large_image_url ??
                          picture.jpg?.image_url ??
                          undefined;
                        return (
                          <Pressable
                            key={index}
                            style={styles.pictureItem}
                            onPress={() => {
                              if (uri) {
                                setSelectedImage(uri);
                                setModalVisible(true);
                              }
                            }}
                          >
                            <RNImage
                              source={{ uri }}
                              style={styles.pictureImage}
                              resizeMode="cover"
                            />
                          </Pressable>
                        );
                      })
                    : null}
                </View>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Related Content */}
        {anime && anime.relations && anime.relations.length > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={400}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Related Content</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md, gap: spacing.md }}>
                {anime.relations.map((relation) => (
                  <View key={relation.relation} style={styles.relationGroup}>
                    <Text variant="labelMedium" style={styles.relationType}>
                      {relation.relation}
                    </Text>
                    <View style={styles.metaRow}>
                      {relation.entry?.map((entry) => (
                        <Chip
                          key={`${entry.mal_id}-${entry.name}`}
                          mode="outlined"
                          onPress={() => {
                            if (entry.mal_id && entry.type === "anime") {
                              router.push(`/anime-hub/${entry.mal_id}`);
                            }
                          }}
                        >
                          <Text style={styles.metaText}>{entry.name}</Text>
                        </Chip>
                      )) || []}
                    </View>
                  </View>
                ))}
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Recommendations */}
        {anime?.recommendations && anime.recommendations.length > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={450}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Recommended For You</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <View style={styles.metaRow}>
                  {anime.recommendations.slice(0, 8).map((rec, idx) => {
                    const entry = Array.isArray(rec.entry)
                      ? (rec.entry[1] ?? rec.entry[0])
                      : rec.entry;
                    const malId = entry?.mal_id ?? entry?.malId ?? undefined;
                    const name =
                      entry?.name ??
                      entry?.title ??
                      entry?.title_english ??
                      "Untitled";
                    return (
                      <Chip
                        key={`${malId ?? idx}-${name}`}
                        mode="outlined"
                        onPress={() => {
                          if (malId && entry?.type === "anime") {
                            router.push(`/anime-hub/${malId}`);
                          }
                        }}
                      >
                        <Text style={styles.metaText}>{name}</Text>
                      </Chip>
                    );
                  })}
                </View>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Streaming Platforms */}
        {anime?.streaming && anime.streaming.length > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={500}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Available On</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md }}>
                <View style={styles.metaRow}>
                  {anime.streaming.map((stream) => (
                    <Chip
                      key={`${stream.name}-${stream.url}`}
                      mode="outlined"
                      onPress={() => {
                        if (stream.url) {
                          Linking.openURL(stream.url);
                        }
                      }}
                    >
                      <Text style={styles.metaText}>{stream.name}</Text>
                    </Chip>
                  ))}
                </View>
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Additional Information */}
        {(anime?.background ||
          (anime?.external && anime.external.length > 0)) && (
          <AnimatedSection
            style={styles.section}
            delay={550}
            animated={animationsEnabled}
          >
            {anime?.background ? (
              <>
                <Text style={styles.sectionTitle}>Background</Text>
                <SettingsGroup>
                  <View style={{ padding: spacing.md }}>
                    <Text variant="bodyLarge" style={styles.body}>
                      {anime.background}
                    </Text>
                  </View>
                </SettingsGroup>
              </>
            ) : null}

            {anime?.external && anime.external.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
                  External Links
                </Text>
                <SettingsGroup>
                  <View style={{ padding: spacing.md }}>
                    <View style={styles.metaRow}>
                      {anime.external.map((link) => (
                        <Chip
                          key={`${link.name}-${link.url}`}
                          mode="outlined"
                          onPress={() => {
                            if (link.url) {
                              Linking.openURL(link.url);
                            }
                          }}
                        >
                          <Text style={styles.metaText}>{link.name}</Text>
                        </Chip>
                      ))}
                    </View>
                  </View>
                </SettingsGroup>
              </>
            ) : null}
          </AnimatedSection>
        )}

        {/* Reviews Section */}
        {anime?.reviews && anime.reviews.length > 0 ? (
          <AnimatedSection
            style={styles.section}
            delay={600}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Community Reviews</Text>
            <SettingsGroup>
              <View style={{ padding: spacing.md, gap: spacing.md }}>
                {anime.reviews.slice(0, 3).map((review) => (
                  <View key={review.mal_id} style={styles.reviewItem}>
                    <Text variant="bodyMedium" style={styles.reviewContent}>
                      {review.content
                        ? `${review.content.substring(0, 200)}...`
                        : (review as any)?.review
                          ? `${(review as any).review.substring(0, 200)}...`
                          : ""}
                    </Text>
                    <Text variant="labelSmall" style={styles.reviewAuthor}>
                      - {review.user?.username || "Anonymous"}
                    </Text>
                  </View>
                ))}
              </View>
            </SettingsGroup>
          </AnimatedSection>
        ) : null}

        {/* Jellyseerr dialogs */}
        <Portal>
          {/* Service selector */}
          <Dialog
            visible={jellyseerrServiceDialogVisible}
            onDismiss={() => setJellyseerrServiceDialogVisible(false)}
          >
            <Dialog.Title>Select Jellyseerr Service</Dialog.Title>
            <Dialog.Content>
              {jellyseerrConnectors.map((connector) => (
                <Button
                  key={connector.config.id}
                  onPress={async () => {
                    setJellyseerrServiceDialogVisible(false);
                    // persist preferred selection if desired
                    try {
                      useSettingsStore
                        .getState()
                        .setPreferredJellyseerrServiceId?.(
                          String(connector.config.id),
                        );
                    } catch {
                      // ignore
                    }
                    await loadJellyseerrOptions(connector);
                  }}
                >
                  {connector.config.name}
                </Button>
              ))}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setJellyseerrServiceDialogVisible(false)}>
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* Request options dialog */}
          <Dialog
            visible={jellyseerrDialogVisible}
            onDismiss={() => setJellyseerrDialogVisible(false)}
          >
            <Dialog.Title>Request Options</Dialog.Title>
            <Dialog.Content>
              <ScrollView
                style={{ maxHeight: dialogMaxHeight }}
                contentContainerStyle={{ paddingVertical: spacing.sm }}
              >
                <Text variant="labelMedium" style={{ marginBottom: 8 }}>
                  Server
                </Text>
                {servers.map((srv) => (
                  <Button
                    key={String((srv as any).id)}
                    mode={
                      selectedServer === Number((srv as any).id)
                        ? "contained"
                        : "text"
                    }
                    onPress={() => {
                      const id = Number((srv as any).id);
                      setSelectedServer(id);
                      void handleServerChange(id);
                    }}
                  >
                    {(srv as any).name ?? String((srv as any).id)}
                  </Button>
                ))}

                <Text
                  variant="labelMedium"
                  style={{ marginTop: 12, marginBottom: 8 }}
                >
                  Profile
                </Text>
                {profiles.map((p) => (
                  <Button
                    key={String((p as any).id)}
                    mode={
                      selectedProfile === Number((p as any).id)
                        ? "contained"
                        : "text"
                    }
                    onPress={() => setSelectedProfile(Number((p as any).id))}
                  >
                    {(p as any).name ?? String((p as any).id)}
                  </Button>
                ))}

                <Text
                  variant="labelMedium"
                  style={{ marginTop: 12, marginBottom: 8 }}
                >
                  Root folder
                </Text>
                {rootFolders.map((r) => {
                  const free = (r as any).freeSpace;
                  return (
                    <View
                      key={String((r as any).path)}
                      style={{ marginBottom: spacing.xs }}
                    >
                      <Button
                        mode={
                          selectedRootFolder === (r as any).path
                            ? "contained"
                            : "text"
                        }
                        onPress={() => setSelectedRootFolder((r as any).path)}
                      >
                        {(r as any).path}
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

                {availableSeasons && availableSeasons.length > 0 ? (
                  <>
                    <Text
                      variant="labelMedium"
                      style={{ marginTop: 12, marginBottom: 8 }}
                    >
                      Seasons
                    </Text>
                    <View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Checkbox
                          status={selectAllSeasons ? "checked" : "unchecked"}
                          onPress={() => {
                            const next = !selectAllSeasons;
                            setSelectAllSeasons(next);
                            setSelectedSeasons(
                              next
                                ? availableSeasons.map(
                                    (s) => s.seasonNumber ?? s.number ?? s,
                                  )
                                : [],
                            );
                          }}
                        />
                        <Text>All seasons</Text>
                      </View>
                      {availableSeasons.map((s, idx) => {
                        const seasonNum = s.seasonNumber ?? s.number ?? idx + 1;
                        const checked = selectedSeasons.includes(seasonNum);
                        return (
                          <View
                            key={String(seasonNum)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Checkbox
                              status={checked ? "checked" : "unchecked"}
                              onPress={() => {
                                const next = checked
                                  ? selectedSeasons.filter(
                                      (x) => x !== seasonNum,
                                    )
                                  : [...selectedSeasons, seasonNum];
                                setSelectedSeasons(next);
                                if (next.length !== availableSeasons.length)
                                  setSelectAllSeasons(false);
                              }}
                            />
                            <Text>Season {seasonNum}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {submitError ? (
                  <Text
                    variant="labelSmall"
                    style={{ color: "red", marginTop: 8 }}
                  >
                    {submitError}
                  </Text>
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
              >
                Submit
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* Remove existing requests dialog */}
          <Dialog
            visible={removeDialogVisible}
            onDismiss={() => setRemoveDialogVisible(false)}
          >
            <Dialog.Title>Existing Requests</Dialog.Title>
            <Dialog.Content>
              {matchedJellyseerrRequests.length === 0 ? (
                <Text>No matching requests found.</Text>
              ) : (
                matchedJellyseerrRequests.map((m, idx) => (
                  <View
                    key={`${String(m.serviceId)}-${idx}`}
                    style={{ marginBottom: 8 }}
                  >
                    <Text>{m.serviceName ?? String(m.serviceId)}</Text>
                    <Button
                      onPress={() =>
                        void handleRemoveJellyseerrRequest(
                          m.connector,
                          Number(m.request?.id),
                        )
                      }
                      loading={isRemoving}
                    >
                      Remove
                    </Button>
                  </View>
                ))
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setRemoveDialogVisible(false)}>
                Close
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Fullscreen image modal */}
        <Modal
          visible={modalVisible}
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}
          >
            {selectedImage ? (
              <RNImage
                source={{ uri: selectedImage }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </Modal>
      </DetailHero>
    </SafeAreaView>
  );
};

export default AnimeHubDetailScreen;
