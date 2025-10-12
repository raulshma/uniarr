import React, { useMemo, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  View,
  StyleSheet as RNStyleSheet,
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
  Extrapolation,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton, Text, useTheme } from "react-native-paper";

import { MediaPoster } from "@/components/media/MediaPoster";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";

export type DetailHeroProps = {
  posterUri?: string;
  backdropUri?: string;
  posterSize?: number;
  heroHeight?: number;
  actionBarHeight?: number;
  onBack?: () => void;
  onShare?: () => void;
  onMal?: () => void;
  isFetching?: boolean;
  children?: React.ReactNode;
};

const AnimatedScrollView = Animated.createAnimatedComponent(
  Animated.ScrollView
);

const DetailHero: React.FC<DetailHeroProps> = ({
  posterUri,
  backdropUri,
  posterSize = 160,
  heroHeight = 320,
  actionBarHeight = 48,
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
  // Start with 75% of the poster inside the hero area (25% projecting into content)
  const initialTop = heroHeight - posterSize * 0.75;
  // Pin directly under the action bar
  const finalTop = insets.top + actionBarHeight;
  const deltaY = finalTop - initialTop;
  const finalTopWithoutHeader = insets.top;
  const deltaYHidden = finalTopWithoutHeader - initialTop;
  const threshold = Math.max(1, heroHeight - finalTop);

  const posterAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolation.CLAMP
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
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      progress,
      [0, 0.6, 1],
      [1, 0, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      progress,
      [0, 1],
      [0, -actionBarHeight],
      Extrapolation.CLAMP
    );
    const height = interpolate(
      progress,
      [0, 1],
      [actionBarHeight, 0],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ translateY }], height } as any;
  });

  useAnimatedReaction(
    () => (scrollY.value >= threshold ? 1 : 0),
    (state, prev) => {
      if (state !== prev) {
        runOnJS(setIsHeaderCollapsed)(state === 1);
      }
    }
  );

  const blurAnimatedStyle = useAnimatedStyle(() => {
    const blurOpacity = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity: blurOpacity } as any;
  });

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    const finalHeroHeight = finalTopWithoutHeader + posterSize * 1.25;
    const height = interpolate(
      progress,
      [0, 1],
      [heroHeight, finalHeroHeight],
      Extrapolation.CLAMP
    );
    return { height } as any;
  });

  const handleBack = () => onBack?.();
  const handleShare = () => onShare?.();
  const handleMal = () => onMal?.();

  const heroUri = backdropUri;

  return (
    <View style={styles.scaffold}>
      <Animated.View style={[styles.heroArea, heroAnimatedStyle]}>
        {heroUri ? (
          <View style={styles.heroImage}>
            <Image
              source={{ uri: heroUri }}
              style={RNStyleSheet.absoluteFill}
              cachePolicy="memory-disk"
            />
            <Animated.View
              style={[RNStyleSheet.absoluteFill, blurAnimatedStyle]}
            >
              <BlurView
                intensity={80}
                tint={theme.dark ? "dark" : "light"}
                style={RNStyleSheet.absoluteFill}
              />
            </Animated.View>
            <LinearGradient
              colors={["transparent", theme.colors.background]}
              start={[0, 0.5]}
              end={[0, 1]}
              style={[RNStyleSheet.absoluteFill, styles.heroGradient]}
            />
          </View>
        ) : (
          // Fallback when no backdrop: gentle gradient so UI doesn't feel empty.
          <LinearGradient
            colors={[theme.colors.surfaceVariant, theme.colors.background]}
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
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

      {/* Pinned poster overlay */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.heroPoster, posterAnimatedStyle]}
      >
        <MediaPoster uri={posterUri} size={posterSize} />
      </Animated.View>

      <AnimatedScrollView
        contentContainerStyle={{
          paddingBottom: 32,
          paddingTop: heroHeight * 0.5,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {children}
      </AnimatedScrollView>
    </View>
  );
};

export default DetailHero;

const styles = StyleSheet.create({
  scaffold: {
    flex: 1,
    backgroundColor: "transparent",
  },
  heroArea: {
    height: 320,
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
    height: 48,
    zIndex: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroPoster: {
    position: "absolute",
    top: 320 - 160 * 0.75,
    left: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    zIndex: 20,
  },
});
