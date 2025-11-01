import React, { useState } from "react";
import {
  Dimensions,
  StyleSheet,
  View,
  StyleSheet as RNStyleSheet,
  PixelRatio,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Image } from "expo-image";

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, Text, useTheme } from "react-native-paper";

import { MediaPoster } from "@/components/media/MediaPoster";
import { imageCacheService } from "@/services/image/ImageCacheService";
import { useThumbhash } from "@/hooks/useThumbhash";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import { posterSizes, controlSizes } from "@/constants/sizes";
import { getComponentElevation } from "@/constants/elevation";
import { createFlexLayout } from "@/utils/style.utils";

export type DetailHeroProps = {
  posterUri?: string;
  backdropUri?: string;
  posterSize?: number;
  heroHeight?: number;
  actionBarHeight?: number;
  /** Optional override for the gradient end color (falls back to theme.colors.background) */
  overlayEndColor?: string;
  onBack?: () => void;
  onShare?: () => void;
  onMal?: () => void;
  isFetching?: boolean;
  children?: React.ReactNode;
};

const AnimatedScrollView = Animated.createAnimatedComponent(
  Animated.ScrollView,
);

const DetailHero: React.FC<DetailHeroProps> = ({
  posterUri,
  backdropUri,
  posterSize = posterSizes.xl, // 160 -> centralized
  heroHeight = spacing.xxxxl * 4, // 320 -> centralized (80 * 4)
  actionBarHeight = controlSizes.switch.height, // 48 -> centralized
  overlayEndColor,
  onBack,
  onShare,
  onMal,
  isFetching,
  children,
}) => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const windowWidth = Dimensions.get("window").width;

  // Shared scroll position used to animate hero elements
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
  });

  // Layout deltas used to move the poster from left-floating into a centered pinned spot
  const initialLeft = spacing.lg;
  const finalLeft = (windowWidth - posterSize) / 2;
  const deltaX = finalLeft - initialLeft;
  // Start with 70% of the poster inside the hero area (30% projecting into content)
  const initialTop = heroHeight - posterSize * 0.7;
  // Pin directly under the action bar
  const finalTop = insets.top + actionBarHeight;
  const finalTopWithoutHeader = insets.top;
  const deltaYHidden = finalTopWithoutHeader - initialTop;
  const threshold = Math.max(1, heroHeight - finalTop);

  const posterAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolate.CLAMP,
    );
    // scale down a bit
    const finalScale = 0.75;
    const scale = interpolate(progress, [0, 1], [1, finalScale]);
    const translateX = interpolate(progress, [0, 1], [0, deltaX]);
    // Move up into the pinned position; compensate for scaling to keep top aligned
    const translateYBase = interpolate(progress, [0, 1], [0, deltaYHidden]);
    const translateY = translateYBase + (posterSize * (scale - 1)) / 2;
    return {
      transform: [{ translateX }, { translateY }, { scale }],
    } as any;
  });

  // Header collapse state & animation (fades out / slides up)
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
      [0, -actionBarHeight],
      Extrapolate.CLAMP,
    );
    const height = interpolate(
      progress,
      [0, 1],
      [actionBarHeight, 0],
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

  const blurAnimatedStyle = useAnimatedStyle(() => {
    const blurOpacity = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolate.CLAMP,
    );
    return { opacity: blurOpacity } as any;
  });

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolate.CLAMP,
    );
    const finalHeroHeight = finalTopWithoutHeader + posterSize * 1.25;
    const height = interpolate(
      progress,
      [0, 1],
      [heroHeight, finalHeroHeight],
      Extrapolate.CLAMP,
    );
    return { height } as any;
  });

  const handleBack = () => onBack?.();
  const handleShare = () => onShare?.();
  const handleMal = () => onMal?.();

  const heroUri = backdropUri;
  const [resolvedHeroUri, setResolvedHeroUri] = useState<string | undefined>(
    heroUri,
  );

  // Use thumbhash hook for the backdrop image
  const { thumbhash: heroThumbhash } = useThumbhash(heroUri, {
    autoGenerate: true,
    generateDelay: 200, // Slightly longer delay for backdrop images
  });

  React.useEffect(() => {
    let mounted = true;
    const resolveHero = async () => {
      if (!heroUri) {
        if (mounted) setResolvedHeroUri(undefined);
        return;
      }
      try {
        const dpr = PixelRatio.get();
        const targetW = Math.round(Dimensions.get("window").width * dpr);
        const targetH = Math.round(heroHeight * dpr);
        const r = await imageCacheService.resolveForSize(
          heroUri,
          targetW,
          targetH,
        );
        if (mounted) setResolvedHeroUri(r);
      } catch {
        if (mounted) setResolvedHeroUri(heroUri);
      }
    };
    void resolveHero();
    return () => {
      mounted = false;
    };
  }, [heroUri, heroHeight]);

  // Create styles with theme access
  const styles = createStyles(theme, heroHeight, posterSize, actionBarHeight);

  return (
    <View style={styles.scaffold}>
      <Animated.View style={[styles.heroArea, heroAnimatedStyle]}>
        {resolvedHeroUri ? (
          <View style={styles.heroImage}>
            <Image
              source={{ uri: resolvedHeroUri }}
              style={RNStyleSheet.absoluteFill}
              placeholder={{ thumbhash: heroThumbhash }}
              cachePolicy="memory-disk"
              priority="high"
              transition={{ effect: "cross-dissolve", duration: 500 }}
            />
            {/* Blur opacity wrapped in inner animated view to prevent layout conflicts */}
            <View style={RNStyleSheet.absoluteFill}>
              <Animated.View
                style={[RNStyleSheet.absoluteFill, blurAnimatedStyle]}
              >
                <BlurView
                  intensity={80}
                  tint={theme.dark ? "dark" : "light"}
                  style={RNStyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <LinearGradient
              colors={[
                "transparent",
                overlayEndColor ?? theme.colors.background,
              ]}
              start={[0, 0.5]}
              end={[0, 1]}
              style={[RNStyleSheet.absoluteFill, styles.heroGradient]}
            />
          </View>
        ) : (
          // Fallback when no backdrop: gentle gradient so UI doesn't feel empty.
          <LinearGradient
            colors={[
              theme.colors.surfaceVariant,
              overlayEndColor ?? theme.colors.background,
            ]}
            start={[0, 0]}
            end={[0, 1]}
            style={RNStyleSheet.absoluteFill}
          />
        )}

        <Animated.View
          pointerEvents={isHeaderCollapsed ? "none" : "auto"}
          style={[styles.heroActions, { top: insets.top }, headerAnimatedStyle]}
        >
          <IconButton
            icon="arrow-left"
            accessibilityLabel="Go back"
            onPress={handleBack}
          />
          <View style={createFlexLayout("row", "sm", { align: "center" })}>
            {isFetching ? (
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Refreshing…
              </Text>
            ) : null}
            <IconButton
              icon="share-variant"
              accessibilityLabel="Share"
              onPress={handleShare}
            />
            {onMal ? (
              <IconButton
                icon="web"
                accessibilityLabel="View on MyAnimeList"
                onPress={handleMal}
              />
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>

      <AnimatedScrollView
        contentContainerStyle={{
          paddingBottom: spacing.xl, // 32 -> xl
          paddingTop: heroHeight * 0.4,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {children}
      </AnimatedScrollView>

      {/* Pinned poster overlay (render after scroll so it visually overlays content) */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.heroPoster, posterAnimatedStyle]}
      >
        <MediaPoster uri={posterUri} size={posterSize} />
      </Animated.View>
    </View>
  );
};

export default DetailHero;

// Create styles inside component to access theme
const createStyles = (
  theme: AppTheme,
  heroHeight: number,
  posterSize: number,
  actionBarHeight: number,
) =>
  StyleSheet.create({
    scaffold: {
      flex: 1,
      backgroundColor: "transparent",
    },
    heroArea: {
      height: heroHeight,
      position: "relative",
      overflow: "hidden",
    },
    heroImage: {
      ...RNStyleSheet.absoluteFillObject,
      width: "100%",
      height: "100%",
    },
    heroGradient: {
      ...RNStyleSheet.absoluteFillObject,
    },
    heroActions: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      height: actionBarHeight,
      zIndex: 30,
      ...createFlexLayout("row", "md", {
        justify: "space-between",
        align: "center",
      }),
    },
    heroPoster: {
      position: "absolute",
      top: heroHeight - posterSize * 0.7,
      left: spacing.lg,
      zIndex: 60,
      ...getComponentElevation("poster", theme),
    },
  });
