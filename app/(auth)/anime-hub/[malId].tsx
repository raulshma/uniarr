import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  StyleSheet,
  View,
  Linking,
  Image as RNImage,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions,
  Animated,
  LayoutAnimation,
  Platform,
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
  SkeletonPlaceholder,
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

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Dialog animation values
  const dialogScaleAnim = useRef(new Animated.Value(0)).current;
  const dialogOpacityAnim = useRef(new Animated.Value(0)).current;

  // Modal animation values
  const modalScaleAnim = useRef(new Animated.Value(0.8)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  // Removed unused parallax effect variables

  // Picture animation values
  const [pictureAnimations] = useState(() =>
    Array.from({ length: 6 }, () => ({
      scale: new Animated.Value(1),
      opacity: new Animated.Value(1),
    })),
  );

  // Shimmer animation for images
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Create skeleton components for each section
  const HeroSkeleton = () => (
    <Animated.View style={{ opacity: shimmerAnim }}>
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <SkeletonPlaceholder width="80%" height={32} borderRadius={4} />
        <SkeletonPlaceholder width="50%" height={16} borderRadius={4} />
        <View style={styles.metaRow}>
          <SkeletonPlaceholder width={100} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={100} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
        </View>
        <View style={styles.primaryActions}>
          <SkeletonPlaceholder width={48} height={48} borderRadius={24} />
          <SkeletonPlaceholder width={48} height={48} borderRadius={24} />
        </View>
      </View>
    </Animated.View>
  );

  const SynopsisSkeleton = () => (
    <Animated.View style={{ opacity: shimmerAnim }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <SkeletonPlaceholder width="100%" height={16} borderRadius={4} />
        <SkeletonPlaceholder width="100%" height={16} borderRadius={4} />
        <SkeletonPlaceholder width="60%" height={16} borderRadius={4} />
      </View>
    </Animated.View>
  );

  const StatsSkeleton = () => (
    <Animated.View style={{ opacity: shimmerAnim }}>
      <View style={{ padding: spacing.md }}>
        <View style={styles.statsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.statCard}>
              <SkeletonPlaceholder width={40} height={24} borderRadius={4} />
              <SkeletonPlaceholder width={50} height={16} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );

  const TagsSkeleton = () => (
    <Animated.View style={{ opacity: shimmerAnim }}>
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <SkeletonPlaceholder width="30%" height={20} borderRadius={4} />
        <View style={styles.metaRow}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonPlaceholder
              key={i}
              width={80}
              height={32}
              borderRadius={16}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );

  const GallerySkeleton = () => (
    <Animated.View style={{ opacity: shimmerAnim }}>
      <View style={{ padding: spacing.md }}>
        <SkeletonPlaceholder width="30%" height={20} borderRadius={4} />
        <View style={styles.picturesContainer}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonPlaceholder
              key={i}
              width="30%"
              height={80}
              borderRadius={8}
              style={{ margin: 0 }}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );

  // Animate dialogs when they appear
  const animateDialogIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(dialogScaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(dialogOpacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [dialogScaleAnim, dialogOpacityAnim]);

  const resetDialogAnimations = useCallback(() => {
    dialogScaleAnim.setValue(0);
    dialogOpacityAnim.setValue(0);
  }, [dialogScaleAnim, dialogOpacityAnim]);

  const { anime, isLoading, isError, refetch } =
    useJikanAnimeDetails(validMalId);

  // Configure layout animation
  useEffect(() => {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      LayoutAnimation.configureNext({
        duration: 300,
        create: { type: "easeInEaseOut", property: "opacity" },
        update: { type: "easeInEaseOut", property: "opacity" },
        delete: { type: "easeInEaseOut", property: "opacity" },
      });
    }
  }, []);

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

  // Track anime mal_id to avoid unnecessary refresh calls
  const prevMalIdRef = useRef<number | undefined>(undefined);

  // Progressive loading states moved to individual section visibility states

  // Create animated values for each section
  const [sectionAnimations] = useState(() => ({
    hero: new Animated.Value(0),
    synopsis: new Animated.Value(0),
    stats: new Animated.Value(0),
    tags: new Animated.Value(0),
    studios: new Animated.Value(0),
    detailedStats: new Animated.Value(0),
    episodes: new Animated.Value(0),
    gallery: new Animated.Value(0),
    relations: new Animated.Value(0),
    recommendations: new Animated.Value(0),
    streaming: new Animated.Value(0),
    background: new Animated.Value(0),
    reviews: new Animated.Value(0),
  }));

  // Progressive loading animation
  useEffect(() => {
    if (!isLoading && anime) {
      const sections: (keyof typeof sectionAnimations)[] = [
        "hero",
        "synopsis",
        "stats",
        "tags",
        "studios",
        "detailedStats",
        "episodes",
        "gallery",
        "relations",
        "recommendations",
        "streaming",
        "background",
        "reviews",
      ];

      // Animate sections one by one with staggered timing
      sections.forEach((section, index) => {
        setTimeout(() => {
          // Animate section appearance
          Animated.timing(sectionAnimations[section], {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, index * 150); // 150ms delay between each section
      });
    }
  }, [isLoading, anime, sectionAnimations]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        animatedContainer: {
          flex: 1,
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

    // Try to get youtube_id first
    if (trailer.youtube_id) {
      return trailer.youtube_id;
    }

    // If embed_url is available, extract the video ID from it
    if ((trailer as any).embed_url) {
      const embedUrl = (trailer as any).embed_url as string;
      // Extract video ID from URLs like: https://www.youtube-nocookie.com/embed/MUJFsL_rE6E?...
      const match = embedUrl.match(/\/embed\/([^/?]+)/);
      if (match?.[1]) {
        return match[1];
      }
    }

    return undefined;
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
          try {
            const stored = await AsyncStorage.getItem(key);
            if (!mounted) return; // Check after async operation

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

            if (mounted) {
              const picture = pics[index];
              const uri =
                picture?.jpg?.large_image_url ??
                picture?.jpg?.image_url ??
                undefined;
              setSelectedBackdropUri(uri ?? posterUri);
            }
            return;
          } catch {
            if (mounted) setSelectedBackdropUri(posterUri);
          }
        } else {
          // 3) Fallback to posterUri (may be undefined)
          if (mounted) setSelectedBackdropUri(posterUri);
        }
      } catch {
        if (mounted) setSelectedBackdropUri(posterUri);
      }
    };

    void chooseBackdrop();
    return () => {
      mounted = false;
      // Ensure async operations don't continue after unmount
    };
  }, [anime, posterUri, trailerBackdropUri]);

  // Initial animation on mount
  useEffect(() => {
    const animateIn = () => {
      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
      ]).start();
    };

    if (!isLoading && anime) {
      animateIn();
    }
  }, [isLoading, anime, fadeAnim, slideAnim, scaleAnim]);

  // Shimmer animation for images
  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    if (isLoading || !anime) {
      shimmerAnimation.start();
    } else {
      shimmerAnimation.stop();
      shimmerAnim.setValue(0);
    }

    return () => shimmerAnimation.stop();
  }, [isLoading, anime, shimmerAnim]);

  // Trigger dialog animations when they open
  useEffect(() => {
    if (
      jellyseerrServiceDialogVisible ||
      jellyseerrDialogVisible ||
      removeDialogVisible
    ) {
      animateDialogIn();
    } else {
      resetDialogAnimations();
    }
  }, [
    jellyseerrServiceDialogVisible,
    jellyseerrDialogVisible,
    removeDialogVisible,
    animateDialogIn,
    resetDialogAnimations,
  ]);

  // Animate modal when it appears and disappears
  useEffect(() => {
    if (modalVisible) {
      Animated.parallel([
        Animated.spring(modalScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out when closing
      Animated.parallel([
        Animated.spring(modalScaleAnim, {
          toValue: 0.9,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset values after animation completes
        modalScaleAnim.setValue(0.8);
      });
    }
  }, [modalVisible, modalScaleAnim, modalOpacityAnim]);

  const openOnMal = async () => {
    if (validMalId) {
      const url = `https://myanimelist.net/anime/${validMalId}`;
      await Linking.openURL(url);
    }
  };

  // --- Jellyseerr: load servers/profiles and populate dialog ---
  const loadJellyseerrOptions = useCallback(
    async (connector: JellyseerrConnector) => {
      let isMounted = true;

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
          if (isMounted) {
            void alert(
              "Error",
              `Failed to initialize Jellyseerr connector: ${
                initError instanceof Error
                  ? initError.message
                  : String(initError)
              }`,
            );
          }
          console.warn("Jellyseerr initialize failed", initError);
          return;
        }

        const srv = await connector.getServers(mediaType);
        if (!isMounted) return;

        const validServers = Array.isArray(srv)
          ? srv.filter(
              (s) =>
                s &&
                s.id != null &&
                ((typeof s.id === "number" && s.id >= 0) ||
                  (typeof s.id === "string" && (s.id as string).trim() !== "")),
            )
          : [];

        if (isMounted) {
          setServers(validServers);
        }

        const defaultServer =
          validServers.find((s) => (s as any).isDefault) || validServers[0];
        const defaultServerId =
          defaultServer?.id !== undefined && defaultServer?.id !== null
            ? Number(defaultServer.id)
            : null;

        if (isMounted) {
          setSelectedServer(defaultServerId);
        }

        if (validServers.length === 0) {
          if (isMounted) {
            void alert(
              "No servers available",
              "No valid servers are configured in Jellyseerr for this media type.",
            );
          }
          return;
        }

        if (defaultServerId != null) {
          const { profiles: profs, rootFolders: rf } =
            await connector.getProfiles(defaultServerId, mediaType);
          if (!isMounted) return;

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
              if (!isMounted) return;
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

          if (isMounted) {
            setSelectedProfile(
              selectedProfileId != null ? Number(selectedProfileId) : null,
            );
            setSelectedRootFolder(selectedRootFolderStr || "");
          }

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
              if (!isMounted) return;
              const seasons = details?.seasons ?? [];
              setAvailableSeasons(Array.isArray(seasons) ? seasons : []);
            } else if (isMounted) {
              setAvailableSeasons([]);
            }
          } catch {
            if (isMounted) {
              setAvailableSeasons([]);
            }
          }
        }

        if (isMounted) {
          setJellyseerrDialogVisible(true);
        }
      } catch (error) {
        if (isMounted) {
          void alert(
            "Error",
            `Failed to load options: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        console.warn("loadJellyseerrOptions failed", error);
      } finally {
        isMounted = false; // Prevent further state updates after component unmounts
      }
    },
    [anime],
  );

  const handleServerChange = useCallback(
    async (serverId: number) => {
      if (!currentConnector) return;
      if (serverId < 0) return;

      let isMounted = true;
      const mediaType = "tv";
      try {
        const { profiles: profs, rootFolders: rf } =
          await currentConnector.getProfiles(serverId, mediaType);
        if (!isMounted) return;

        setProfiles(profs ?? []);
        setRootFolders(rf ?? []);

        const serviceId: string | undefined = (currentConnector as any).config
          ?.id;
        let serviceConfig: any = null;
        if (serviceId) {
          try {
            const configs = await secureStorage.getServiceConfigs();
            if (!isMounted) return;
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

        if (isMounted) {
          setSelectedProfile(
            selectedProfileId != null ? Number(selectedProfileId) : null,
          );
          setSelectedRootFolder(selectedRootFolderStr || "");
        }
      } catch (error) {
        if (isMounted) {
          void alert(
            "Error",
            `Failed to load profiles: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        console.warn("handleServerChange failed", error);
      } finally {
        isMounted = false; // Prevent further state updates
      }
    },
    [currentConnector, servers],
  );

  const refreshJellyseerrMatches = useCallback(async () => {
    let isMounted = true;
    // scanning starts
    try {
      if (!anime || jellyseerrConnectors.length === 0) {
        if (isMounted) setMatchedJellyseerrRequests([]);
        return;
      }

      const malId = anime.mal_id;
      const connectorList = Array.from(jellyseerrConnectors);
      const matches: {
        connector: JellyseerrConnector;
        request: any;
        serviceId: string | number | undefined;
        serviceName: string | undefined;
      }[] = [];

      await Promise.all(
        connectorList.map(async (connector) => {
          try {
            const requests = await connector.getRequests();
            if (!isMounted || !Array.isArray(requests)) return;

            for (const req of requests) {
              const media = req?.media as any;
              const mediaTmdb = media?.tmdbId ?? media?.tmdb_id ?? undefined;
              const mediaId = mediaTmdb ?? media?.id ?? undefined;
              // match by mal_id if connector stores it, otherwise tmdb
              if (mediaId && (mediaId === malId || mediaId === malId)) {
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

      if (isMounted) setMatchedJellyseerrRequests(matches);
    } finally {
      // scanning finished
      isMounted = false;
    }
  }, [anime, jellyseerrConnectors]);

  const handleRemoveJellyseerrRequest = useCallback(
    async (connector: JellyseerrConnector, requestId: number) => {
      let isMounted = true;
      setIsRemoving(true);
      try {
        await connector.deleteRequest(requestId);
        if (isMounted) {
          void alert("Success", "Request removed from Jellyseerr");
          await refreshJellyseerrMatches();
        }
      } catch (error) {
        console.error("Failed to delete Jellyseerr request", error);
        if (isMounted) {
          void alert(
            "Error",
            `Failed to remove request: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } finally {
        if (isMounted) setIsRemoving(false);
        isMounted = false;
      }
    },
    [refreshJellyseerrMatches],
  );

  const handleSubmitRequest = useCallback(async () => {
    let isMounted = true;

    if (!currentConnector || !anime) {
      if (isMounted) setSubmitError("Please select a server and profile.");
      return;
    }

    if (selectedServer == null || selectedProfile == null) {
      if (isMounted) setSubmitError("Please select a server and profile.");
      return;
    }

    if (isMounted) {
      setSubmitError("");
      setIsRequesting(true);
    }

    try {
      // Check existing requests
      let existing;
      try {
        const requests = await currentConnector.getRequests();
        if (!isMounted) return;
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
        if (isMounted)
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
      if (isMounted) {
        void alert("Success", "Request submitted successfully!");
        setJellyseerrDialogVisible(false);
        await refreshJellyseerrMatches();
      }
    } catch (error) {
      console.error(error);
      if (isMounted) {
        setSubmitError(
          error instanceof Error ? error.message : "Failed to submit request",
        );
      }
    } finally {
      if (isMounted) setIsRequesting(false);
      isMounted = false;
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
    const malId = anime?.mal_id;

    if (!malId || jellyseerrConnectors.length === 0) {
      setMatchedJellyseerrRequests([]);
      prevMalIdRef.current = malId;
      return;
    }

    // Only refresh if the mal_id actually changed
    if (prevMalIdRef.current === malId) {
      return;
    }

    prevMalIdRef.current = malId;
    void refreshJellyseerrMatches();
  }, [anime, jellyseerrConnectors, refreshJellyseerrMatches]);

  // Progressive skeleton loading display
  if (isLoading || !anime) {
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
            <View style={{ gap: spacing.md }}>
              <HeroSkeleton />
              <SynopsisSkeleton />
              <StatsSkeleton />
              <TagsSkeleton />
              <GallerySkeleton />
            </View>
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
    anime?.episodes ? `${anime.episodes.length} episodes` : undefined,
    anime?.duration ?? undefined,
    anime?.status ?? undefined,
    anime?.score ? `${anime.score.toFixed(1)} rating` : undefined,
    anime?.rank ? `Rank #${anime.rank}` : undefined,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <DetailHero
          posterUri={posterUri}
          backdropUri={selectedBackdropUri}
          heroHeight={spacing.xxxxl * 3}
          overlayEndColor={theme.colors.background}
          onBack={() => router.back()}
          onMal={openOnMal}
        >
          {/* Primary Information Section */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: sectionAnimations.hero,
                transform: [
                  {
                    translateY: Animated.multiply(
                      Animated.subtract(1, sectionAnimations.hero),
                      20,
                    ),
                  },
                ],
              },
            ]}
          >
            <SettingsGroup>
              <View style={{ padding: spacing.md, gap: spacing.md }}>
                <View>
                  <Text variant="headlineLarge" style={styles.headline}>
                    {anime?.title ?? "Untitled"}
                  </Text>
                  {anime?.title_english &&
                  anime.title_english !== anime.title ? (
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

                <Animated.View
                  style={[
                    styles.primaryActions,
                    {
                      opacity: sectionAnimations.hero,
                      transform: [
                        {
                          translateY: Animated.multiply(
                            Animated.subtract(1, sectionAnimations.hero),
                            8,
                          ),
                        },
                        {
                          scale: Animated.add(
                            sectionAnimations.hero.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.95, 1],
                            }),
                            0,
                          ),
                        },
                      ],
                    },
                  ]}
                >
                  {isRequesting ? (
                    <UniArrLoader size={20} centered />
                  ) : (
                    <Animated.View
                      style={{
                        transform: [{ scale: scaleAnim }],
                      }}
                    >
                      <IconButton
                        icon="playlist-plus"
                        size={28}
                        iconColor={theme.colors.primary}
                        onPress={() => void handleJellyseerrRequest()}
                        accessibilityLabel="Request via Jellyseerr"
                      />
                    </Animated.View>
                  )}

                  <Animated.View
                    style={{
                      transform: [{ scale: scaleAnim }],
                    }}
                  >
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
                  </Animated.View>
                </Animated.View>
                {jellyseerrConnectors.length === 0 ? (
                  <Text variant="bodySmall" style={styles.helperText}>
                    Connect a Jellyseerr service to forward anime requests to
                    Radarr/Sonarr automatically.
                  </Text>
                ) : null}
              </View>
            </SettingsGroup>
          </Animated.View>

          {/* Synopsis Section */}
          {anime?.synopsis ? (
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: sectionAnimations.synopsis,
                  transform: [
                    {
                      translateX: Animated.multiply(
                        Animated.subtract(1, sectionAnimations.synopsis),
                        -10,
                      ),
                    },
                    {
                      scale: Animated.add(
                        sectionAnimations.synopsis.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.98, 1.02, 1],
                        }),
                        0,
                      ),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sectionTitle}>Synopsis</Text>
              <SettingsGroup>
                <View style={{ padding: spacing.md }}>
                  <Text variant="bodyLarge" style={styles.body}>
                    {anime.synopsis}
                  </Text>
                </View>
              </SettingsGroup>
            </Animated.View>
          ) : null}

          {/* Trailer */}
          {trailerFeatureEnabled && trailerVideoKey ? (
            <Animated.View
              style={{
                opacity: sectionAnimations.gallery,
                transform: [
                  {
                    scale: Animated.add(
                      sectionAnimations.hero.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.8, 1.05, 1],
                      }),
                      0,
                    ),
                  },
                  {
                    translateY: Animated.multiply(
                      Animated.subtract(1, sectionAnimations.hero),
                      10,
                    ),
                  },
                ],
              }}
            >
              <TrailerFadeOverlay
                videoKey={trailerVideoKey}
                backdropUri={trailerBackdropUri}
                height={200}
                viewStyle={{ marginTop: spacing.md }}
              />
            </Animated.View>
          ) : null}

          {/* Quick Stats Overview */}
          {anime?.statistics ? (
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: sectionAnimations.stats,
                  transform: [
                    {
                      translateY: Animated.multiply(
                        Animated.subtract(1, sectionAnimations.stats),
                        20,
                      ),
                    },
                  ],
                },
              ]}
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
            </Animated.View>
          ) : null}

          {/* Tags and Categories */}
          {tags.length || (anime?.studios?.length ?? 0) > 0 ? (
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: sectionAnimations.tags,
                  transform: [
                    {
                      translateY: Animated.multiply(
                        Animated.subtract(1, sectionAnimations.tags),
                        20,
                      ),
                    },
                  ],
                },
              ]}
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
                  <Text
                    style={[styles.sectionTitle, { marginTop: spacing.md }]}
                  >
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
            </Animated.View>
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
                                    (
                                      anime.statistics as Record<
                                        string,
                                        unknown
                                      >
                                    )["favorites"] as number
                                  ).toLocaleString()
                                : "0"}
                            </Text>
                            <Text
                              variant="labelMedium"
                              style={styles.statLabel}
                            >
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
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: sectionAnimations.episodes,
                  transform: [
                    {
                      translateY: Animated.multiply(
                        Animated.subtract(1, sectionAnimations.episodes),
                        15,
                      ),
                    },
                    {
                      scale: Animated.add(
                        Animated.multiply(
                          sectionAnimations.episodes,
                          sectionAnimations.episodes.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.02],
                          }),
                        ),
                        1,
                      ),
                    },
                  ],
                },
              ]}
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
                          <Text
                            variant="bodyMedium"
                            style={styles.episodeTitle}
                          >
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
                        {anime && anime.episodes
                          ? anime.episodes.length - 8
                          : 0}{" "}
                        more episodes
                      </Text>
                    )}
                  </View>
                </View>
              </SettingsGroup>
            </Animated.View>
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

                          const animation = pictureAnimations[index] || {
                            scale: new Animated.Value(1),
                            opacity: new Animated.Value(1),
                          };

                          const handlePicturePress = () => {
                            if (uri) {
                              // Add a spring scale animation on press
                              Animated.sequence([
                                Animated.spring(animation.scale, {
                                  toValue: 0.95,
                                  useNativeDriver: true,
                                  friction: 8,
                                  tension: 80,
                                }),
                                Animated.spring(animation.scale, {
                                  toValue: 1,
                                  useNativeDriver: true,
                                  friction: 8,
                                  tension: 80,
                                }),
                              ]).start();

                              setSelectedImage(uri);
                              setModalVisible(true);
                            }
                          };

                          return (
                            <Animated.View
                              key={index}
                              style={[
                                styles.pictureItem,
                                {
                                  transform: [{ scale: animation.scale }],
                                  opacity: animation.opacity,
                                },
                              ]}
                            >
                              <Pressable
                                style={styles.pictureItem}
                                onPress={handlePicturePress}
                              >
                                <RNImage
                                  source={{ uri }}
                                  style={styles.pictureImage}
                                  resizeMode="cover"
                                />
                              </Pressable>
                            </Animated.View>
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
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: sectionAnimations.streaming,
                  transform: [
                    {
                      translateX: Animated.multiply(
                        Animated.subtract(1, sectionAnimations.streaming),
                        -20,
                      ),
                    },
                    {
                      scale: Animated.add(
                        sectionAnimations.hero.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.05, 1],
                        }),
                        0,
                      ),
                    },
                  ],
                },
              ]}
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
            </Animated.View>
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
                  <Text
                    style={[styles.sectionTitle, { marginTop: spacing.md }]}
                  >
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
              style={{
                transform: [{ scale: dialogScaleAnim }],
                opacity: dialogOpacityAnim,
              }}
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
                <Button
                  onPress={() => setJellyseerrServiceDialogVisible(false)}
                >
                  Cancel
                </Button>
              </Dialog.Actions>
            </Dialog>

            {/* Request options dialog */}
            <Dialog
              visible={jellyseerrDialogVisible}
              onDismiss={() => setJellyseerrDialogVisible(false)}
              style={{
                transform: [{ scale: dialogScaleAnim }],
                opacity: dialogOpacityAnim,
              }}
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
                          const seasonNum =
                            s.seasonNumber ?? s.number ?? idx + 1;
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
              style={{
                transform: [{ scale: dialogScaleAnim }],
                opacity: dialogOpacityAnim,
              }}
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
                <Animated.View
                  style={{
                    transform: [{ scale: modalScaleAnim }],
                    opacity: modalOpacityAnim,
                  }}
                >
                  <RNImage
                    source={{ uri: selectedImage }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              ) : null}
            </Pressable>
          </Modal>
        </DetailHero>
      </Animated.View>
    </SafeAreaView>
  );
};

export default AnimeHubDetailScreen;
