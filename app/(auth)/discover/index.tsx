import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  Animated as RNAnimated,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  IconButton,
  Portal,
  Dialog,
  Button as PaperButton,
  RadioButton,
  Text,
  useTheme,
  Badge,
  Banner,
} from "react-native-paper";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import {
  AnimatedListItem,
  AnimatedSection,
  PageTransition,
} from "@/components/common/AnimatedComponents";
import { TabHeader } from "@/components/common/TabHeader";
import AnimatedSkiaBackground from "@/components/common/AnimatedSkiaBackground";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import { SectionSkeleton } from "@/components/discover";
import type { AppTheme } from "@/constants/theme";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import { useBatchCheckInLibrary } from "@/hooks/useBatchCheckInLibrary";
import { imageCacheService } from "@/services/image/ImageCacheService";
import type { DiscoverMediaItem } from "@/models/discover.types";
import { spacing } from "@/theme/spacing";
import { useTmdbKey } from "@/hooks/useTmdbKey";
import { useSettingsStore } from "@/store/settingsStore";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import { alert } from "@/services/dialogService";
import QuickViewModal from "@/components/anime/QuickViewModal";

const placeholderText = "Search for movies, shows, and more";
type DiscoverSection = ReturnType<
  typeof useUnifiedDiscover
>["sections"][number];

interface DiscoverCardProps {
  item: DiscoverMediaItem;
  isInLibrary: boolean;
  onAdd: (media: DiscoverMediaItem) => void;
  onPress: (media: DiscoverMediaItem) => void;
  onLongPress: (media: DiscoverMediaItem, layout: any) => void;
  theme: AppTheme;
}

const DiscoverCard = React.memo(
  ({
    item,
    isInLibrary,
    onAdd,
    onPress,
    onLongPress,
    theme,
  }: DiscoverCardProps) => {
    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            width: 152,
            marginRight: spacing.md,
          },
          innerWrapper: {
            flex: 1,
          },
          posterWrapper: {
            marginBottom: spacing.xs,
            position: "relative",
          },
          title: {
            color: theme.colors.onBackground,
            fontSize: theme.custom.typography.titleSmall.fontSize,
            fontFamily: theme.custom.typography.titleSmall.fontFamily,
            lineHeight: theme.custom.typography.titleSmall.lineHeight,
            letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
            fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
          },
          addButton: {
            position: "absolute",
            top: spacing.sm,
            right: spacing.sm,
            backgroundColor: theme.colors.primary,
            zIndex: 100,
            elevation: 100,
          },
          badge: {
            position: "absolute",
            top: spacing.xs,
            left: spacing.xs,
            backgroundColor: theme.colors.primary,
          },
        }),
      [theme],
    );

    const posterRef = React.useRef<View>(null);

    const handlePress = useCallback(() => {
      onPress(item);
    }, [item, onPress]);

    const handleLongPress = useCallback(() => {
      posterRef.current?.measureInWindow((x, y, width, height) => {
        onLongPress(item, { x, y, width, height, pageX: x, pageY: y });
      });
    }, [item, onLongPress]);

    return (
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.innerWrapper} pointerEvents="box-none">
          <Pressable
            ref={posterRef}
            style={styles.posterWrapper}
            onPress={handlePress}
            onLongPress={handleLongPress}
          >
            {isInLibrary && (
              <Badge style={styles.badge} size={20}>
                ✓
              </Badge>
            )}
            <MediaPoster
              uri={item.posterUrl}
              size={152}
              overlay={
                <IconButton
                  icon="plus"
                  size={20}
                  mode="contained"
                  style={styles.addButton}
                  iconColor={theme.colors.onPrimary}
                  onPress={() => onAdd(item)}
                  disabled={isInLibrary}
                  accessibilityLabel={`Add ${item.title}`}
                />
              }
            />
          </Pressable>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
        </View>
      </View>
    );
  },
  (prev, next) => {
    // Custom comparison: only re-render if item id, isInLibrary, or theme changes
    return (
      prev.item.id === next.item.id &&
      prev.isInLibrary === next.isInLibrary &&
      prev.theme === next.theme
    );
  },
);

const DiscoverScreen = () => {
  const theme = useTheme<AppTheme>();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const router = useRouter();
  const tmdbEnabled = useSettingsStore((state) => state.tmdbEnabled);
  const { apiKey: tmdbKey } = useTmdbKey();

  // Backdrop with blur settings
  const enableBackdropWithBlur = useSettingsStore(
    (state) => state.enableBackdropWithBlur,
  );
  const discoverBannerDismissed = useSettingsStore(
    (state) => state.discoverBannerDismissed,
  );
  const setDiscoverBannerDismissed = useSettingsStore(
    (state) => state.setDiscoverBannerDismissed,
  );

  // State for banner visibility with delay
  const [showBanner, setShowBanner] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false); // For animation

  const { sections, services, isLoading, isFetching, isError, error, refetch } =
    useUnifiedDiscover();

  // Batch check all items in all sections at once
  const allItems = useMemo(() => {
    return sections.flatMap((section) => section.items);
  }, [sections]);

  const { itemsInLibrary } = useBatchCheckInLibrary(allItems);

  const inLibraryIds = useMemo(() => {
    if (itemsInLibrary instanceof Map) {
      const ids = new Set<string>();
      itemsInLibrary.forEach((entry, id) => {
        if (entry?.services?.length) {
          ids.add(id);
        }
      });
      return ids;
    }
    return new Set<string>();
  }, [itemsInLibrary]);

  // Get a backdrop image from the discover data for the background
  const backgroundImageUri = useMemo(() => {
    // Find the first item with a backdrop URL
    for (const section of sections) {
      for (const item of section.items) {
        if (item.backdropUrl) {
          return item.backdropUrl;
        }
      }
    }
    return undefined; // Will use default image
  }, [sections]);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogItem, setDialogItem] = useState<DiscoverMediaItem | undefined>(
    undefined,
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // QuickViewModal state
  const [quickViewData, setQuickViewData] = useState<{
    item: {
      id: number | string;
      title: string;
      posterUrl?: string;
      rating?: number;
      overview?: string;
    };
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageX: number;
      pageY: number;
    };
  } | null>(null);

  // Banner delay effect
  useEffect(() => {
    // Only show banner if backdrop is disabled and not previously dismissed
    if (!enableBackdropWithBlur && !discoverBannerDismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
        // Start animation after a small delay
        setTimeout(() => setBannerVisible(true), 50);
      }, 2000); // 2-second delay

      return () => clearTimeout(timer);
    }

    // Auto-hide banner if feature gets enabled
    if (enableBackdropWithBlur && showBanner) {
      setBannerVisible(false);
      setTimeout(() => setShowBanner(false), 600); // Match fade animation duration
    }
  }, [enableBackdropWithBlur, discoverBannerDismissed, showBanner]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        page: {
          flex: 1,
        },
        content: {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.lg,
        },
        searchBar: {
          height: 48,
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: theme.dark
            ? "rgba(30, 41, 59, 0.3)"
            : "rgba(248, 250, 252, 0.5)",
        },
        searchBarContent: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        searchPlaceholder: {
          flex: 1,
          marginLeft: spacing.sm,
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          fontFamily: theme.custom.typography.bodyLarge.fontFamily,
        },
        sectionsContainer: {
          gap: spacing.lg,
        },
        sectionContainer: {
          gap: spacing.sm,
        },
        searchBarWrapper: {
          marginBottom: spacing.lg,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          lineHeight: theme.custom.typography.titleLarge.lineHeight,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
          fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
        },
        sectionSubtitle: {
          color: theme.colors.onSurfaceVariant,
        },
        listContent: {
          paddingRight: spacing.md,
        },
        dialogContent: {
          paddingVertical: spacing.sm,
        },
        dialogRadio: {
          paddingVertical: spacing.xs,
        },
        emptyWrapper: {
          marginTop: spacing.xl,
        },
        banner: {
          marginHorizontal: spacing.md,
          marginBottom: spacing.md,
        },
        bannerAnimated: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: 80,
        },
      }),
    [theme],
  );

  const isRefreshing = isFetching && !isLoading;
  const allowAnimations = shouldAnimateLayout(isLoading, isFetching);
  const allowHeaderAnimations = shouldAnimateLayout(false, isFetching); // Header should animate even during initial load

  const openUnifiedSearch = useCallback(() => {
    router.push("/(auth)/search");
  }, [router]);

  const openSettings = useCallback(() => {
    router.push("/(auth)/(tabs)/settings");
  }, [router]);

  const openExperimentalSettings = useCallback(() => {
    router.push("/(auth)/settings/experimental-features");
  }, [router]);

  const handleBannerDismiss = useCallback(() => {
    setBannerVisible(false);
    setTimeout(() => setShowBanner(false), 600); // Match fade animation duration
    setDiscoverBannerDismissed(true);
  }, [setDiscoverBannerDismissed]);

  const handleBannerSettingsPress = useCallback(() => {
    setBannerVisible(false);
    setTimeout(() => setShowBanner(false), 600); // Match fade animation duration
    setDiscoverBannerDismissed(true);
    openExperimentalSettings();
  }, [setDiscoverBannerDismissed, openExperimentalSettings]);

  const openTmdbDiscover = useCallback(() => {
    router.push("/(auth)/discover/tmdb");
  }, [router]);

  const openSectionPage = useCallback(
    (sectionId: string) => {
      router.push(`/(auth)/discover/section/${sectionId}`);
    },
    [router],
  );

  const openServicePicker = useCallback(
    (item: DiscoverMediaItem) => {
      const options =
        item.mediaType === "series" ? services.sonarr : services.radarr;
      if (!options.length) {
        alert(
          "No services available",
          `Add a ${
            item.mediaType === "series" ? "Sonarr" : "Radarr"
          } service first to request this title.`,
        );
        return;
      }

      setDialogItem(item);
      setSelectedServiceId((current) => {
        if (current && options.some((service) => service.id === current)) {
          return current;
        }
        return options[0]?.id ?? "";
      });
      setDialogVisible(true);
    },
    [services],
  );

  const handleCardPress = useCallback(
    (item: DiscoverMediaItem) => {
      // Prefetch images when card is pressed to speed up detail screen load
      if (item.posterUrl) {
        void imageCacheService.prefetch(item.posterUrl);
      }
      if (item.backdropUrl) {
        void imageCacheService.prefetch(item.backdropUrl);
      }

      router.push({ pathname: `/(auth)/discover/${item.id}` });
    },
    [router],
  );

  const handleCardLongPress = useCallback(
    (item: DiscoverMediaItem, layout: any) => {
      setQuickViewData({
        item: {
          id: item.id,
          title: item.title,
          posterUrl: item.posterUrl,
          rating: item.rating,
          overview: item.overview,
        },
        layout,
      });
    },
    [],
  );

  const handleDialogDismiss = useCallback(() => {
    setDialogVisible(false);
    setDialogItem(undefined);
  }, []);

  const handleConfirmAdd = useCallback(() => {
    if (!dialogItem || !selectedServiceId) {
      handleDialogDismiss();
      return;
    }

    const params: Record<string, string> = {
      serviceId: selectedServiceId,
      query: dialogItem.title,
    };

    if (dialogItem.tmdbId) {
      params.tmdbId = String(dialogItem.tmdbId);
    }

    if (dialogItem.tvdbId) {
      params.tvdbId = String(dialogItem.tvdbId);
    }

    if (dialogItem.mediaType === "series") {
      router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
    } else {
      router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
    }

    handleDialogDismiss();
  }, [dialogItem, handleDialogDismiss, router, selectedServiceId]);

  const renderSection = useCallback(
    (section: DiscoverSection, order: number): React.ReactElement => {
      const { id: sectionId, title, subtitle, items } = section;

      const shouldShowSkeleton =
        sectionId.startsWith("placeholder-") ||
        (items.length === 0 && isFetching);

      if (shouldShowSkeleton) {
        return <SectionSkeleton />;
      }

      const entranceDelay = Math.min(order * 80, 320);

      const handleViewAllPress = () => openSectionPage(sectionId);

      const getItemLayout = (
        _: unknown,
        index: number,
      ): { length: number; offset: number; index: number } => {
        const ITEM_WIDTH = 152 + spacing.md; // card width + marginRight
        return {
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        };
      };

      return (
        <AnimatedSection
          delay={entranceDelay}
          animated={allowAnimations}
          style={styles.sectionContainer}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.sectionSubtitle}>{subtitle}</Text>
              ) : null}
            </View>
            <PaperButton
              mode="text"
              compact
              onPress={handleViewAllPress}
              textColor={theme.colors.primary}
            >
              View all
            </PaperButton>
          </View>
          <FlatList
            data={items}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            getItemLayout={getItemLayout}
            initialNumToRender={6}
            windowSize={5}
            renderItem={({ item, index }) => {
              const isInLibrary = inLibraryIds.has(item.id);

              return (
                <AnimatedListItem
                  index={index}
                  totalItems={items.length}
                  staggerDelay={50}
                  animated={allowAnimations}
                >
                  <DiscoverCard
                    item={item}
                    isInLibrary={isInLibrary}
                    onPress={handleCardPress}
                    onLongPress={handleCardLongPress}
                    onAdd={openServicePicker}
                    theme={theme}
                  />
                </AnimatedListItem>
              );
            }}
          />
        </AnimatedSection>
      );
    },
    [
      allowAnimations,
      handleCardPress,
      inLibraryIds,
      isFetching,
      openSectionPage,
      openServicePicker,
      styles.listContent,
      styles.sectionContainer,
      styles.sectionHeader,
      styles.sectionSubtitle,
      styles.sectionTitle,
      theme,
    ],
  );

  return (
    <SafeAreaView style={styles.container}>
      {enableBackdropWithBlur ? (
        <RNAnimated.View style={{ opacity: 1 }}>
          <AnimatedSkiaBackground
            theme={theme}
            imageUri={backgroundImageUri}
            scrollY={scrollY}
          />
        </RNAnimated.View>
      ) : null}

      {/* Banner with delay and animation */}
      {showBanner && (
        <RNAnimated.View
          style={[
            styles.bannerAnimated,
            {
              opacity: bannerVisible ? 1 : 0,
              top: spacing.sm,
            },
          ]}
        >
          <Banner
            visible={true}
            actions={[
              {
                label: "Settings",
                onPress: handleBannerSettingsPress,
              },
              {
                label: "Dismiss",
                onPress: handleBannerDismiss,
              },
            ]}
            icon="information"
          >
            Enable backdrop effects in Experimental Settings
          </Banner>
        </RNAnimated.View>
      )}

      <PageTransition style={styles.page} transitionType="fade">
        <AnimatedSection animated={allowHeaderAnimations} delay={0}>
          <TabHeader
            style={{ backgroundColor: "transparent" }}
            title="Discover"
            showTitle
            leftAction={
              tmdbEnabled && tmdbKey
                ? {
                    icon: "movie-open",
                    onPress: openTmdbDiscover,
                    accessibilityLabel: "Open TMDB discover",
                  }
                : undefined
            }
            rightAction={{
              icon: "cog",
              onPress: openSettings,
              accessibilityLabel: "Open settings",
            }}
          />
        </AnimatedSection>

        <Animated.FlatList
          data={sections}
          keyExtractor={(section) => section.id}
          renderItem={({ item, index }) => renderSection(item, index)}
          contentContainerStyle={[styles.content, styles.sectionsContainer]}
          onScroll={scrollHandler}
          initialNumToRender={3}
          windowSize={5}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <AnimatedSection
              style={styles.searchBarWrapper}
              delay={50}
              animated={allowAnimations}
            >
              <View style={styles.searchBar}>
                <BlurView
                  style={StyleSheet.absoluteFill}
                  intensity={10}
                  tint={theme.dark ? "dark" : "light"}
                />
                <Pressable
                  style={styles.searchBarContent}
                  onPress={openUnifiedSearch}
                  accessibilityRole="button"
                >
                  <IconButton
                    icon="magnify"
                    size={24}
                    onPress={openUnifiedSearch}
                    accessibilityLabel="Open search"
                  />
                  <Text style={styles.searchPlaceholder}>
                    {placeholderText}
                  </Text>
                </Pressable>
              </View>
            </AnimatedSection>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              {isError ? (
                <EmptyState
                  title="Unable to load recommendations"
                  description={
                    error instanceof Error
                      ? error.message
                      : "Try refreshing to retry the request."
                  }
                  actionLabel="Retry"
                  onActionPress={() => void refetch()}
                />
              ) : (
                <EmptyState
                  title="No recommendations yet"
                  description="Configure Jellyseerr to see trending picks or refresh to try again."
                  actionLabel="Refresh"
                  onActionPress={() => void refetch()}
                />
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={handleDialogDismiss}>
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
                    style={styles.dialogRadio}
                  />
                ))}
              </RadioButton.Group>
            </Dialog.Content>
            <Dialog.Actions>
              <PaperButton onPress={handleDialogDismiss}>Cancel</PaperButton>
              <PaperButton
                onPress={handleConfirmAdd}
                disabled={!selectedServiceId}
              >
                Add
              </PaperButton>
            </Dialog.Actions>
          </Dialog>

          <QuickViewModal
            visible={!!quickViewData}
            item={quickViewData?.item ?? null}
            initialLayout={quickViewData?.layout ?? null}
            onClose={() => setQuickViewData(null)}
          />
        </Portal>
      </PageTransition>
    </SafeAreaView>
  );
};

export default DiscoverScreen;
