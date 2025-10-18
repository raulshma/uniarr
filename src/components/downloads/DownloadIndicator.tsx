import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTheme, IconButton, Badge, Text, Surface } from "react-native-paper";
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

  // Simplified animations - only for floating position
  const slideAnimation = useSharedValue(0);

  // Start animations only for floating position when there are active downloads
  React.useEffect(() => {
    if (position === "floating" && activeCount > 0) {
      slideAnimation.value = withSpring(1, { damping: 15, stiffness: 100 });
    } else {
      slideAnimation.value = withTiming(0);
    }
  }, [activeCount, slideAnimation, position]);

  // Animated styles - minimal for performance
  const slideStyle = useAnimatedStyle(() => {
    if (position !== "floating") return { opacity: 1 };

    const opacity = slideAnimation.value;
    const translateY = interpolate(slideAnimation.value, [0, 1], [10, 0]);
    return {
      opacity,
      transform: [{ translateY }],
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
          containerPadding: spacing.xs,
          fontSize: 10,
        };
      case "large":
        return {
          iconSize: 28,
          containerPadding: spacing.md,
          fontSize: 14,
        };
      default: // medium
        return {
          iconSize: 24,
          containerPadding: spacing.sm,
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
    // Floating indicator for when there are active downloads
    return (
      <Animated.View style={[styles.floatingContainer, slideStyle]}>
        <Pressable onPress={handlePress} style={styles.floatingPressable}>
          <Surface style={styles.floatingSurface}>
            <View style={styles.iconContainer}>
              <IconButton
                icon="download"
                size={sizeConfig.iconSize}
                iconColor={
                  isActive
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
                style={styles.iconButton}
              />
            </View>

            <View style={styles.floatingInfo}>
              <Text
                variant="labelMedium"
                style={[styles.countText, { color: theme.colors.onSurface }]}
              >
                {activeCount} {activeCount === 1 ? "download" : "downloads"}
              </Text>

              {showSpeed && currentSpeed > 0 && (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.speedText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatSpeed(currentSpeed)}
                </Text>
              )}
            </View>

            {activeCount > 0 && (
              <View style={styles.badgeContainer}>
                <Badge
                  style={[
                    styles.floatingBadge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  size={size === "small" ? 20 : 24}
                >
                  {activeCount}
                </Badge>
              </View>
            )}
          </Surface>
        </Pressable>
      </Animated.View>
    );
  }

  // Header indicator - no animations for better performance
  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <Surface style={styles.surface}>
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
        </Surface>
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
    surface: {
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
      right: -4,
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
    // Floating styles
    floatingContainer: {
      position: "absolute",
      bottom: spacing.xl + 60, // Above typical tab bar
      right: spacing.md,
      zIndex: 1000,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    floatingPressable: {
      borderRadius: spacing.lg,
    },
    floatingSurface: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: spacing.lg,
      padding: spacing.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    floatingInfo: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    floatingBadge: {
      position: "absolute",
      top: -4,
      right: -4,
    },
  });

export default DownloadIndicator;
