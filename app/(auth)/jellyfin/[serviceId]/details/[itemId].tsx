import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Share,
  ScrollView,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  runOnJS,
  interpolate,
  Extrapolate,
  Extrapolation,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { EmptyState } from "@/components/common/EmptyState";
import { MediaPoster } from "@/components/media/MediaPoster";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { useJellyfinItemDetails } from "@/hooks/useJellyfinItemDetails";
import { spacing } from "@/theme/spacing";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
// Size used for the hero poster so layout calculations remain consistent
const POSTER_SIZE = 160;
// Height of the hero area (kept in sync with styles.heroArea)
const HERO_HEIGHT = 320;
// Height for the action/header row. Used so the poster pins directly below it
// with no extra gap when scrolled.
const ACTION_BAR_HEIGHT = 48;

const formatRuntimeMinutes = (ticks?: number): number | undefined => {
  if (!ticks || ticks <= 0) {
    return undefined;
  }

  const minutes = Math.round(ticks / 600_000_000);
  return minutes > 0 ? minutes : undefined;
};

const deriveYear = (
  itemPremiere?: string,
  productionYear?: number,
): number | undefined => {
  if (productionYear) {
    return productionYear;
  }

  if (itemPremiere) {
    const parsed = new Date(itemPremiere);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear();
    }
  }

  return undefined;
};

const JellyfinItemDetailsScreen = () => {
  const { serviceId: rawServiceId, itemId: rawItemId } = useLocalSearchParams<{
    serviceId?: string;
    itemId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : undefined;
  const itemId = typeof rawItemId === "string" ? rawItemId : undefined;
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const windowWidth = Dimensions.get("window").width;

  // Shared scroll position used to animate hero elements
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
  });

  // Calculate translation deltas so poster moves from left-floating position
  // into a centered, top-aligned position as the user scrolls.
  const initialLeft = spacing.lg;
  const finalLeft = (windowWidth - POSTER_SIZE) / 2;
  const deltaX = finalLeft - initialLeft;
  // Start with 75% of the poster inside the hero area (25% projecting
  // into the content card) for the desired visual overlap.
  const initialTop = HERO_HEIGHT - POSTER_SIZE * 0.75;
  // Pin directly under the header/action row so there is no extra gap.
  const finalTop = insets.top + ACTION_BAR_HEIGHT;
  // Also compute target translateY when the header is hidden so the poster
  // can pin directly under the status bar. We'll animate the poster to this
  // value in the same progress curve so the header can hide while the poster
  // moves into the center/aligned position.
  const finalTopWithoutHeader = insets.top;
  const deltaYHidden = finalTopWithoutHeader - initialTop;
  const threshold = Math.max(1, HERO_HEIGHT - finalTop);

  const posterAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolate.CLAMP,
    );
    // Animated scale value (1 -> finalScale)
    const finalScale = 0.75;
    const scale = interpolate(progress, [0, 1], [1, finalScale]);
    const translateX = interpolate(progress, [0, 1], [0, deltaX]);
    // Compute base translateY and compensate for the change in height due to scaling
    // so the poster's top aligns exactly with the target finalTop when pinned.
    // Target the hidden-header delta so the poster will end up flush under
    // the status bar once the header has been removed.
    const translateYBase = interpolate(progress, [0, 1], [0, deltaYHidden]);
    const translateY = translateYBase + (POSTER_SIZE * (scale - 1)) / 2;
    return {
      transform: [{ translateX }, { translateY }, { scale }],
    } as any;
  });

  // Animate the header to fade out and slide away as the poster moves. When
  // the scroll progress passes the threshold we also toggle a React state so
  // the header stops intercepting pointer events (clearing its interactive
  // space).
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolate.CLAMP,
    );
    const opacity = interpolate(
      progress,
      [0, 0.6, 1],
      [1, 0, 0],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      progress,
      [0, 1],
      [0, -ACTION_BAR_HEIGHT],
      Extrapolate.CLAMP,
    );
    const height = interpolate(
      progress,
      [0, 1],
      [ACTION_BAR_HEIGHT, 0],
      Extrapolate.CLAMP,
    );
    return { opacity, transform: [{ translateY }], height } as any;
  });

  useAnimatedReaction(
    () => (scrollY.value >= threshold ? 1 : 0),
    (state, prev) => {
      if (state !== prev) {
        runOnJS(setIsHeaderCollapsed)(state === 1);
      }
    },
  );

  // Animate a blur overlay on the hero image instead of fully hiding it.
  const blurAnimatedStyle = useAnimatedStyle(() => {
    const blurOpacity = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolate.CLAMP,
    );
    return { opacity: blurOpacity } as any;
  });

  // Animate the hero area's height so the background image shrinks while the
  // poster moves into its final (pinned) position. The final hero height is
  // chosen so the poster will be nicely contained when pinned under the
  // status bar.
  const heroAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const finalHeroHeight = finalTopWithoutHeader + POSTER_SIZE * 1.25;
    const height = interpolate(
      progress,
      [0, 1],
      [HERO_HEIGHT, finalHeroHeight],
      Extrapolation.CLAMP,
    );
    return { height } as any;
  });
  const router = useRouter();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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

  const detailsQuery = useJellyfinItemDetails({ serviceId, itemId });

  const item = detailsQuery.data;
  const isLoading = isBootstrapping || detailsQuery.isLoading;
  const errorMessage =
    detailsQuery.error instanceof Error
      ? detailsQuery.error.message
      : detailsQuery.error
        ? "Unable to load item details."
        : null;

  const runtimeMinutes = useMemo(
    () => formatRuntimeMinutes(item?.RunTimeTicks ?? undefined),
    [item?.RunTimeTicks],
  );
  const releaseYear = useMemo(
    () =>
      deriveYear(
        item?.PremiereDate ?? undefined,
        item?.ProductionYear ?? undefined,
      ),
    [item?.PremiereDate, item?.ProductionYear],
  );
  const ratingLabel =
    item?.OfficialRating ??
    (item?.CommunityRating ? `${item.CommunityRating.toFixed(1)}★` : undefined);
  const heroTag = item?.BackdropImageTags?.[0] ?? item?.ImageTags?.Backdrop;
  const heroUri =
    heroTag && connector && item?.Id
      ? connector.getImageUrl(item.Id, "Backdrop", {
          tag: heroTag,
          width: 1280,
        })
      : undefined;
  const posterUri =
    item?.Id && connector
      ? connector.getImageUrl(item.Id, "Primary", {
          tag: (typeof item === "object" && item !== null
            ? ((item as any).PrimaryImageTag ?? item.ImageTags?.Primary)
            : undefined) as string | undefined,
          width: 720,
        })
      : undefined;
  const cast = useMemo(
    () =>
      (item?.People ?? [])
        .filter((person) => person?.Type === "Actor")
        .slice(0, 12),
    [item?.People],
  );
  const genres = item?.Genres ?? [];

  const providerSummary = useMemo(() => {
    const providers = item?.ProviderIds ?? {};
    const mapped = Object.entries(providers)
      .map(([key, value]) => ({ key, value }))
      .filter((entry) => Boolean(entry.value));

    if (mapped.length === 0) {
      return "No external identifiers linked.";
    }

    return `Linked providers: ${mapped
      .map((entry) => entry.key.toUpperCase())
      .join(", ")}`;
  }, [item?.ProviderIds]);

  const handleNavigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleShare = useCallback(async () => {
    if (!item) {
      return;
    }

    const message = [item.Name ?? "Untitled", item.Overview]
      .filter(Boolean)
      .join("\n\n");

    try {
      await Share.share({ message });
    } catch {
      // Swallow share errors silently.
    }
  }, [item]);

  const handlePlay = useCallback(async () => {
    if (!connector || !item) {
      return;
    }

    const baseUrl = connector.config.url.replace(/\/$/, "");
    const deepLink = `${baseUrl}/web/index.html#!/details?id=${item.Id}`;

    try {
      await Linking.openURL(deepLink);
    } catch {
      setSyncStatus("Unable to open Jellyfin web player.");
    }
  }, [connector, item]);

  const handleSyncMetadata = useCallback(async () => {
    if (!connector || !item) {
      return;
    }

    try {
      setIsSyncing(true);
      if (!item.Id) {
        setSyncStatus("Unable to refresh metadata: missing item id.");
      } else {
        await connector.refreshItemMetadata(item.Id, false);
      }
      setSyncStatus(
        "Metadata refresh requested. Jellyfin will update this item shortly.",
      );
      await detailsQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to refresh metadata.";
      setSyncStatus(message);
    } finally {
      setIsSyncing(false);
    }
  }, [connector, detailsQuery, item]);

  const renderCastMember = useCallback(
    ({ item: person }: { item: (typeof cast)[number] }) => {
      // Use person name (preferred by Jellyfin OpenAPI) so paths like
      // /Persons/{name}/Images/Primary are correctly resolved. Fall back
      // to Id if name is not available.
      const personIdentifier = person?.Name || person?.Id;
      const personPrimaryTag =
        person && typeof person === "object"
          ? ((person as any).PrimaryImageTag ??
            (person as any).ImageTags?.Primary)
          : undefined;
      const avatarUri =
        personIdentifier &&
        connector?.getPersonImageUrl(personIdentifier, personPrimaryTag, {
          width: 320,
        });

      return (
        <View style={styles.castCard}>
          <View style={styles.castAvatarShell}>
            {avatarUri ? (
              <>
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.castAvatar}
                  cachePolicy="memory-disk"
                />
                <BlurView
                  intensity={50}
                  tint={theme.dark ? "dark" : "light"}
                  style={styles.castAvatarBlur}
                />
              </>
            ) : (
              <View style={[styles.castAvatar, styles.castAvatarPlaceholder]}>
                <Text variant="titleMedium" style={styles.castAvatarInitial}>
                  {person?.Name?.charAt(0) ?? "?"}
                </Text>
              </View>
            )}
          </View>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.castName}>
            {person?.Name ?? "Unknown"}
          </Text>
          {person?.Role ? (
            <Text variant="bodySmall" numberOfLines={1} style={styles.castRole}>
              {person.Role}
            </Text>
          ) : null}
        </View>
      );
    },
    [connector, styles, theme],
  );

  if (!serviceId || !itemId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Missing item context"
          description="We could not determine which Jellyfin item to display."
          actionLabel="Go back"
          onActionPress={handleNavigateBack}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator animating size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Unable to load details"
          description={errorMessage}
          actionLabel="Retry"
          onActionPress={() => void detailsQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Item not found"
          description="This media could not be located on the Jellyfin server."
          actionLabel="Close"
          onActionPress={handleNavigateBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <>
      <View style={styles.scaffold}>
        <Animated.View style={[styles.heroArea, heroAnimatedStyle]}>
          {heroUri ? (
            <View style={styles.heroImage}>
              <Image
                source={{ uri: heroUri }}
                style={StyleSheet.absoluteFill}
                cachePolicy="memory-disk"
              />
              {/* Animated blur overlays the image. Gradient sits on top so the
                  blur only affects the backdrop, not the gradient that helps
                  blend into the background color. */}
              <Animated.View
                style={[StyleSheet.absoluteFill, blurAnimatedStyle]}
              >
                <BlurView
                  intensity={80}
                  tint={theme.dark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <LinearGradient
                colors={["transparent", theme.colors.background]}
                start={[0, 0.5]}
                end={[0, 1]}
                style={[StyleSheet.absoluteFill, styles.heroGradient]}
              />
            </View>
          ) : null}
          <Animated.View
            pointerEvents={isHeaderCollapsed ? "none" : "auto"}
            style={[
              styles.heroActions,
              { top: insets.top },
              headerAnimatedStyle,
            ]}
          >
            <IconButton
              icon="arrow-left"
              accessibilityLabel="Go back"
              onPress={handleNavigateBack}
            />
            <IconButton
              icon="share-variant"
              accessibilityLabel="Share item"
              onPress={handleShare}
            />
          </Animated.View>
          {/* heroPoster has been moved out so it can be pinned independent of the scrollable content */}
        </Animated.View>
        {/* Overlay poster so it can be translated to the top of the screen and remain visible
            while the scroll content moves beneath it. */}
        <Animated.View
          pointerEvents="box-none"
          style={[styles.heroPoster, posterAnimatedStyle]}
        >
          <MediaPoster uri={posterUri} size={POSTER_SIZE} />
        </Animated.View>
        <AnimatedScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.detailsContent}>
            <Text variant="headlineSmall" style={styles.title}>
              {item.Name ?? "Untitled"}
            </Text>
            <View style={styles.metaRow}>
              {releaseYear ? (
                <Chip icon="calendar" compact>
                  {releaseYear}
                </Chip>
              ) : null}
              {runtimeMinutes ? (
                <Chip
                  icon="clock-outline"
                  compact
                >{`${runtimeMinutes} min`}</Chip>
              ) : null}
              {ratingLabel ? (
                <Chip icon="star" compact>
                  {ratingLabel}
                </Chip>
              ) : null}
            </View>

            {item.Overview ? (
              <Text variant="bodyMedium" style={styles.overview}>
                {item.Overview}
              </Text>
            ) : null}

            {/* Cast section */}

            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Cast
              </Text>
            </View>
            {cast.length > 0 ? (
              <FlashList
                data={cast}
                keyExtractor={(person) => person.Id ?? person.Name ?? ""}
                renderItem={renderCastMember}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castList}
              />
            ) : (
              <Text variant="bodySmall" style={styles.sectionEmptyText}>
                Cast information is not available.
              </Text>
            )}

            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Genres
              </Text>
            </View>
            {genres.length > 0 ? (
              <View style={styles.genreRow}>
                {genres.map((genre) => (
                  <Chip
                    key={genre}
                    mode="flat"
                    style={styles.genreChip}
                    textStyle={styles.genreChipText}
                  >
                    {genre}
                  </Chip>
                ))}
              </View>
            ) : (
              <Text variant="bodySmall" style={styles.sectionEmptyText}>
                No genres available for this item.
              </Text>
            )}

            {/* Prominent full-width play button per design */}
            <Button
              mode="contained"
              icon="play"
              onPress={handlePlay}
              style={styles.playButton}
              contentStyle={styles.playButtonContent}
              labelStyle={styles.playButtonLabel}
            >
              Play on Jellyfin
            </Button>

            {/* Sync card with inline Update button on the right */}
            <Surface style={styles.syncCard} elevation={1}>
              <LinearGradient
                colors={[theme.colors.surfaceVariant, theme.colors.surface]}
                start={[0, 0.5]}
                end={[1, 1]}
                style={styles.syncGradient}
              />
              <View style={styles.syncCardContentRow}>
                <View style={styles.syncCardText}>
                  <Text variant="titleMedium" style={styles.syncTitle}>
                    Sync Status
                  </Text>
                  <Text variant="bodySmall" style={styles.syncDescription}>
                    {syncStatus ?? providerSummary}
                  </Text>
                </View>
                <Button
                  mode="contained"
                  onPress={handleSyncMetadata}
                  loading={isSyncing}
                  compact
                  style={styles.syncUpdateButton}
                  labelStyle={styles.syncUpdateLabel}
                >
                  Update
                </Button>
              </View>
            </Surface>
          </View>
          <View style={{ height: spacing.xxl }} />
        </AnimatedScrollView>
      </View>
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scaffold: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    heroArea: {
      height: HERO_HEIGHT,
      position: "relative",
      overflow: "hidden",
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
      width: "100%",
      height: "100%",
    },
    heroOverlay: {
      backgroundColor: theme.colors.backdrop,
      opacity: 0.4,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    heroActions: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      height: ACTION_BAR_HEIGHT,
      zIndex: 30,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroPoster: {
      position: "absolute",
      // start visually overlapping the bottom of the hero area
      top: HERO_HEIGHT - POSTER_SIZE * 0.75,
      left: spacing.lg,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
      zIndex: 20,
    },
    scrollContent: {
      paddingBottom: spacing.xxl,
    },
    detailsContent: {
      // Add extra top padding so content does not overlap the floating poster
      // only 25% of the poster projects into the content card
      paddingTop: spacing.xxxl + POSTER_SIZE * 0.5,
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    title: {
      color: theme.colors.onSurface,
      fontWeight: "700",
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    overview: {
      color: theme.colors.onSurfaceVariant,
    },
    actionRow: {
      flexDirection: "row",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    syncCard: {
      padding: 0,
      borderRadius: 20,
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    syncGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
    },
    syncCardContent: {
      padding: spacing.md,
      borderRadius: 20,
      backgroundColor: "transparent",
      zIndex: 1,
    },
    syncTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    syncDescription: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    sectionEmptyText: {
      color: theme.colors.onSurfaceVariant,
    },
    castList: {
      marginTop: spacing.sm,
      gap: spacing.md,
    },
    castCard: {
      width: 120,
      alignItems: "center",
      gap: spacing.xs,
    },
    castAvatarShell: {
      width: 96,
      height: 96,
      borderRadius: 48,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
    },
    castAvatarBlur: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 48,
    },
    castAvatar: {
      width: "100%",
      height: "100%",
      borderRadius: 48,
    },
    castAvatarPlaceholder: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    castAvatarInitial: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "600",
    },
    castName: {
      color: theme.colors.onSurface,
      fontWeight: "600",
      textAlign: "center",
    },
    castRole: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    genreRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    genreChip: {
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    genreChipText: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    playButton: {
      width: "100%",
      borderRadius: 28,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: theme.colors.primary,
    },
    playButtonContent: {
      height: 56,
      justifyContent: "center",
    },
    playButtonLabel: {
      color: theme.colors.onPrimary,
      fontWeight: "700",
    },
    syncCardContentRow: {
      padding: spacing.md,
      borderRadius: 20,
      backgroundColor: "transparent",
      zIndex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    syncCardText: {
      flex: 1,
      paddingRight: spacing.md,
    },
    syncUpdateButton: {
      borderRadius: 16,
      minWidth: 96,
      height: 40,
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    syncUpdateLabel: {
      color: theme.colors.onPrimary,
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });

export default JellyfinItemDetailsScreen;
