import React, { useEffect, useState, useRef } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import YoutubeIframe from "react-native-youtube-iframe";
import { useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { ANIMATION_DURATIONS } from "@/utils/animations.utils";
import { UniArrLoader } from "@/components/common/UniArrLoader";

export type TrailerFadeOverlayProps = {
  /** URL to the backdrop image to display initially */
  backdropUri?: string;
  /** YouTube video ID for the trailer */
  videoKey?: string;
  /** Height of the component (defaults to 320) */
  height?: number;
  /** Optional callback when video is ready */
  onVideoReady?: () => void;
  /** Optional callback when video fails to load */
  onVideoError?: () => void;
  viewStyle?: StyleProp<ViewStyle>;
};

/**
 * TrailerFadeOverlay
 *
 * A reusable component that displays a backdrop image initially, then fades it into
 * an embedded YouTube trailer after 2 seconds. If no trailer is available or fails to load,
 * the backdrop remains visible indefinitely.
 *
 * Features:
 * - Muted auto-play with user unmute control
 * - Backdrop visible during video load (graceful fallback)
 * - Fade in/out animations using react-native-reanimated
 * - Responsive sizing and dimensions
 *
 * @example
 * <TrailerFadeOverlay
 *   backdropUri="https://image.tmdb.org/t/p/w1280/..."
 *   videoKey="9qhL2_UxXM0"
 *   height={320}
 * />
 */
const TrailerFadeOverlay: React.FC<TrailerFadeOverlayProps> = ({
  backdropUri,
  videoKey,
  height = 320,
  onVideoReady,
  onVideoError,
  viewStyle,
}) => {
  const theme = useTheme<AppTheme>();
  const [showTrailer, setShowTrailer] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Shared value for backdrop opacity animation
  const backdropOpacity = useSharedValue(1);

  // Backdrop animated style (fades out when trailer is ready)
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  useEffect(() => {
    // Only proceed if we have a video key
    if (!videoKey) {
      return;
    }

    // Set timer for 2-second delay before showing trailer
    timerRef.current = setTimeout(() => {
      setShowTrailer(true);
    }, 2000);

    // Cleanup timer on unmount or if props change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [videoKey]);

  const handleVideoReady = () => {
    setVideoLoaded(true);
    onVideoReady?.();

    // Fade out backdrop once video is ready
    backdropOpacity.value = withTiming(0, {
      duration: ANIMATION_DURATIONS.NORMAL,
    });
  };

  const handleVideoError = () => {
    setVideoError(true);
    onVideoError?.();
    // Backdrop remains visible if video fails
  };

  const styles = StyleSheet.create({
    container: {
      width: "100%",
      height,
      backgroundColor: theme.colors.background,
      overflow: "hidden",
      position: "relative",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    backdropImage: {
      width: "100%",
      height: "100%",
    },
    trailerContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
      backgroundColor: theme.colors.background,
    },
    youtubePlayer: {
      width: "100%",
      height: "100%",
    },
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 3,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "transparent",
    },
  });

  // If no video key or backdrop, don't render anything
  if (!videoKey && !backdropUri) {
    return null;
  }

  // If no video key, just show the backdrop
  if (!videoKey) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[styles.backdrop, backdropAnimatedStyle, viewStyle]}
          entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        >
          {backdropUri && (
            <Image
              source={{ uri: backdropUri }}
              style={styles.backdropImage}
              contentFit="cover"
            />
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, viewStyle]}>
      {/* Backdrop - fades out once video is ready */}
      {backdropUri && (
        <Animated.View
          style={[styles.backdrop, backdropAnimatedStyle]}
          entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        >
          <Image
            source={{ uri: backdropUri }}
            style={styles.backdropImage}
            contentFit="cover"
          />
        </Animated.View>
      )}

      {/* Trailer - fades in after 2 seconds */}
      {showTrailer && (
        <Animated.View
          style={styles.trailerContainer}
          entering={FadeIn.duration(ANIMATION_DURATIONS.NORMAL)}
          exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
        >
          <YoutubeIframe
            height={height}
            width="100%"
            videoId={videoKey}
            play={true}
            muted={true}
            onReady={handleVideoReady}
            onError={handleVideoError}
          />

          {/* Loading spinner while video is being loaded */}
          {!videoLoaded && !videoError && (
            <View style={styles.loadingContainer}>
              <UniArrLoader size={60} />
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
};

export default TrailerFadeOverlay;
