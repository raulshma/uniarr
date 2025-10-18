import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Circle, Svg } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme, IconButton, Badge, Text } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import {
  useDownloadStore,
  selectActiveDownloadsCount,
  selectCurrentDownloadSpeed,
} from "@/store/downloadStore";
import { formatSpeed } from "@/utils/torrent.utils";
import { spacing } from "@/theme/spacing";
import * as Haptics from "expo-haptics";

interface DownloadIndicatorProps {
  onPress?: () => void;
  showSpeed?: boolean;
  size?: "small" | "medium" | "large";
  position?: "header" | "floating";
}

/**
 * Circular progress ring component for the FAB
 */
const ProgressRing: React.FC<{
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}> = ({ progress, size, strokeWidth, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      {/* Background circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={0.2}
      />
      {/* Progress circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
};

/**
 * Download indicator component that shows active download count and speed
 */
const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  onPress,
  showSpeed = true,
  size = "medium",
  position = "header",
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(
    () => createStyles(theme, size, position),
    [theme, size, position],
  );

  // Get download data from store
  const activeCount = useDownloadStore(selectActiveDownloadsCount);
  const currentSpeed = useDownloadStore(selectCurrentDownloadSpeed);

  // Animated progress for the floating FAB
  const progress = useSharedValue(0);
  const scaleAnimation = useSharedValue(0);

  // Update progress animation
  React.useEffect(() => {
    if (position === "floating" && activeCount > 0) {
      scaleAnimation.value = withSpring(1, { damping: 15, stiffness: 100 });
    } else {
      scaleAnimation.value = withSpring(0, { damping: 15, stiffness: 100 });
    }
  }, [activeCount, position, scaleAnimation]);

  // Animate progress ring (0-1 cycle repeating)
  React.useEffect(() => {
    if (position === "floating" && activeCount > 0) {
      const interval = setInterval(() => {
        progress.value = (progress.value + 0.01) % 1;
      }, 50);
      return () => clearInterval(interval);
    }
  }, [position, activeCount, progress]);

  // Animated styles
  const fabStyle = useAnimatedStyle(() => {
    return {
      opacity: scaleAnimation.value,
      transform: [
        { scale: scaleAnimation.value },
        { translateY: scaleAnimation.value === 0 ? 10 : 0 },
      ],
    };
  });

  // Handle press with haptic feedback
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  // Size configurations
  const sizeConfig = useMemo(() => {
    switch (size) {
      case "small":
        return {
          iconSize: 20,
          fabSize: 56,
          fontSize: 10,
        };
      case "large":
        return {
          iconSize: 28,
          fabSize: 80,
          fontSize: 14,
        };
      default: // medium
        return {
          iconSize: 24,
          fabSize: 68,
          fontSize: 12,
        };
    }
  }, [size]);

  // Don't render if no active downloads and not in floating position
  if (activeCount === 0 && position === "header") {
    return null;
  }

  const isActive = activeCount > 0;

  if (position === "floating") {
    // Floating FAB with circular progress ring
    return (
      <Animated.View style={[styles.floatingContainer, fabStyle]}>
        <Pressable
          onPress={handlePress}
          style={[
            styles.floatingFab,
            {
              width: sizeConfig.fabSize,
              height: sizeConfig.fabSize,
              borderRadius: sizeConfig.fabSize / 2,
            },
          ]}
        >
          {/* Progress ring background */}
          <View
            style={[
              styles.progressRingContainer,
              {
                width: sizeConfig.fabSize,
                height: sizeConfig.fabSize,
              },
            ]}
          >
            <ProgressRing
              progress={progress.value}
              size={sizeConfig.fabSize}
              strokeWidth={3}
              color={theme.colors.primary}
            />
          </View>

          {/* Center content: only speed (no icon) */}
          <View style={styles.fabContent}>
            {showSpeed && currentSpeed > 0 && (
              <Text
                variant="labelSmall"
                style={[
                  styles.fabSpeed,
                  {
                    color: theme.colors.onPrimary,
                    fontSize: sizeConfig.fontSize,
                  },
                ]}
              >
                {formatSpeed(currentSpeed)}
              </Text>
            )}
          </View>

          {/* Badge for count */}
          {activeCount > 0 && (
            <View style={styles.fabBadgeContainer}>
              <Badge
                style={[
                  styles.fabBadge,
                  { backgroundColor: theme.colors.tertiary },
                ]}
                size={24}
              >
                {activeCount}
              </Badge>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  // Header indicator
  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <View style={styles.headerSurface}>
          <View style={styles.iconContainer}>
            <IconButton
              icon={isActive ? "download" : "download-outline"}
              size={sizeConfig.iconSize}
              iconColor={
                isActive ? theme.colors.primary : theme.colors.onSurfaceVariant
              }
              style={styles.iconButton}
            />
          </View>

          {isActive && (
            <>
              <View style={styles.badgeContainer}>
                <Badge
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  size={size === "small" ? 16 : 20}
                >
                  {activeCount}
                </Badge>
              </View>

              {showSpeed && currentSpeed > 0 && (
                <View style={styles.speedContainer}>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.speedText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {formatSpeed(currentSpeed)}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
};

const createStyles = (
  theme: AppTheme,
  size: "small" | "medium" | "large",
  position: "header" | "floating",
) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
    },
    pressable: {
      borderRadius: spacing.md,
    },
    headerSurface: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: spacing.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: theme.colors.surfaceVariant,
    },
    iconContainer: {
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      margin: 0,
    },
    badgeContainer: {
      position: "absolute",
      top: -4,
      left: -4,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 0,
    },
    speedContainer: {
      marginLeft: spacing.xs,
    },
    speedText: {
      fontSize: 10,
      fontWeight: "500",
    },
    countText: {
      fontWeight: "600",
    },
    // Floating FAB styles
    floatingContainer: {
      position: "absolute",
      bottom: spacing.xl + 60, // Above typical tab bar
      left: spacing.md,
      zIndex: 1000,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
    floatingFab: {
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    progressRingContainer: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    progressSvg: {
      position: "absolute",
    },
    fabContent: {
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    fabIcon: {
      margin: 0,
    },
    fabSpeed: {
      fontSize: 9,
      fontWeight: "600",
      marginTop: -4,
    },
    fabBadgeContainer: {
      position: "absolute",
      top: -2,
      right: -2,
      zIndex: 20,
    },
    fabBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 0,
    },
  });

export default DownloadIndicator;
