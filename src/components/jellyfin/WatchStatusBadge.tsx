import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import type { JellyfinUserData } from "@/models/jellyfin.types";

export type WatchStatus = "watching" | "watched" | "unwatched";

interface WatchStatusBadgeProps {
  userData?: JellyfinUserData;
  /**
   * Position of the badge on the poster
   * @default "top-right"
   */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /**
   * Show progress bar at bottom for in-progress items
   * @default true
   */
  showProgressBar?: boolean;
}

const getWatchStatus = (userData?: JellyfinUserData): WatchStatus => {
  if (!userData) return "unwatched";

  if (userData.Played) return "watched";

  // Check both PlayedPercentage and PlaybackPositionTicks for in-progress status
  const progress = userData.PlayedPercentage ?? 0;
  const hasPosition = (userData.PlaybackPositionTicks ?? 0) > 0;

  if (progress > 0 && progress < 100) return "watching";
  if (hasPosition && !userData.Played) return "watching";

  return "unwatched";
};

export const WatchStatusBadge: React.FC<WatchStatusBadgeProps> = ({
  userData,
  position = "top-right",
  showProgressBar = true,
}) => {
  const theme = useTheme<AppTheme>();
  const status = getWatchStatus(userData);

  // Calculate progress - Jellyfin may not always return PlayedPercentage
  const progress = userData?.PlayedPercentage ?? 0;

  // Don't render anything for unwatched items
  if (status === "unwatched") return null;

  const positionStyles = {
    "top-left": styles.topLeft,
    "top-right": styles.topRight,
    "bottom-left": styles.bottomLeft,
    "bottom-right": styles.bottomRight,
  };

  return (
    <>
      {/* Badge for watched/watching status */}
      {status === "watched" && (
        <View style={[styles.badge, positionStyles[position]]}>
          <View
            style={[
              styles.watchedBadge,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>
              ✓
            </Text>
          </View>
        </View>
      )}

      {status === "watching" && (
        <View style={[styles.badge, positionStyles[position]]}>
          <View style={styles.watchingBadge}>
            <Text style={styles.watchingText}>{Math.round(progress)}%</Text>
          </View>
        </View>
      )}

      {/* Progress bar at bottom for watching items */}
      {status === "watching" && showProgressBar && progress > 0 && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    zIndex: 10,
  },
  topLeft: {
    top: 6,
    left: 6,
  },
  topRight: {
    top: 6,
    right: 6,
  },
  bottomLeft: {
    bottom: 6,
    left: 6,
  },
  bottomRight: {
    bottom: 6,
    right: 6,
  },
  watchedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "700",
  },
  watchingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  watchingText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  progressBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 5,
  },
  progressBar: {
    height: "100%",
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 0,
  },
});
