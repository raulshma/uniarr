import React, { useMemo } from "react";
import { View, StyleSheet, Linking } from "react-native";
import { Button } from "react-native-paper";
import { spacing } from "@/theme/spacing";

export interface YouTubePlayerProps {
  /**
   * YouTube video key (id) or full URL.
   * Accepts: "dQw4w9WgXcQ" or "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   */
  videoKey?: string;
  /**
   * Width of the player. Default: 100% (fill parent)
   */
  width?: number | string;
  /**
   * Height of the player. Default: 48px (button height)
   */
  height?: number;
  /**
   * Fallback action when embedded playback is not available.
   * If not provided, falls back to opening YouTube link externally.
   */
  onFallback?: () => void;
}

/**
 * Extracts YouTube video ID from various URL formats and raw keys.
 */
const extractVideoId = (input?: string): string | null => {
  if (!input) return null;

  // Already a video ID (11 characters, alphanumeric + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // Try to extract from YouTube URL
  const urlPatterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * YouTube trailer player component with external link fallback.
 * Provides a button to open trailers on YouTube since embedded WebView is not available.
 * This is a minimal, lightweight alternative that respects app size constraints.
 */
export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoKey,
  width = "100%",
  onFallback,
}) => {
  const videoId = useMemo(() => extractVideoId(videoKey), [videoKey]);
  const youtubeUrl = useMemo(
    () =>
      videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : "https://www.youtube.com",
    [videoId],
  );

  const handlePlayTrailer = async () => {
    if (onFallback) {
      onFallback();
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(youtubeUrl);
      if (canOpen) {
        await Linking.openURL(youtubeUrl);
      }
    } catch (error) {
      console.warn("[YouTubePlayer] Failed to open YouTube link:", error);
    }
  };

  if (!videoId) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      width: "100%",
      marginVertical: spacing.sm,
    },
  });

  return (
    <View style={styles.container}>
      <Button mode="contained" icon="play" onPress={handlePlayTrailer}>
        Watch Trailer
      </Button>
    </View>
  );
};

export default YouTubePlayer;
