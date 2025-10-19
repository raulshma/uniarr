import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, ViewStyle } from "react-native";
import { IconButton, Text, Menu, Divider, useTheme } from "react-native-paper";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import type { AppTheme } from "@/constants/theme";
import { useContentDownload } from "@/hooks/useContentDownload";
import type { ServiceConfig } from "@/models/service.types";
import type { QualityOption } from "@/connectors/base/IDownloadConnector";
import { spacing } from "@/theme/spacing";
import { iconSizes, buttonSizes, touchSizes } from "@/constants/sizes";
import * as Haptics from "expo-haptics";
import { useCurrentDownloadSpeed } from "@/store/downloadStore";
import { formatSpeed } from "@/utils/torrent.utils";
import EpisodeSelectionDialog from "./EpisodeSelectionDialog";

interface DownloadButtonProps {
  /** Service configuration */
  serviceConfig: ServiceConfig;
  /** Content ID from the service */
  contentId: string;
  /** Button size variant */
  size?: "small" | "medium" | "large";
  /** Button variant */
  variant?: "icon" | "button" | "card" | "navbar-circle";
  /** Whether to show quality selection */
  showQuality?: boolean;
  /** Custom styles */
  style?: ViewStyle;
  /** Callback when download starts */
  onDownloadStart?: (downloadId: string) => void;
  /** Callback when download fails */
  onDownloadError?: (error: string) => void;
}

/**
 * Download button component with quality selection and capability checking
 */
const DownloadButton: React.FC<DownloadButtonProps> = ({
  serviceConfig,
  contentId,
  size = "medium",
  variant = "icon",
  showQuality = false,
  style,
  onDownloadStart,
  onDownloadError,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(
    () => createStyles(theme, size, variant),
    [theme, size, variant],
  );
  const currentDownloadSpeed = useCurrentDownloadSpeed();

  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const [episodeDialogVisible, setEpisodeDialogVisible] = useState(false);

  // Animation
  const scaleAnimation = useSharedValue(1);
  const rotateAnimation = useSharedValue(0);

  // Download hook
  const {
    isLoading,
    canDownload,
    downloadCapability,
    qualityOptions,
    selectQuality,
    startDownload,
    episodes,
    setSelectedEpisodes,
  } = useContentDownload({
    serviceConfig,
    contentId,
    checkDownloadCapabilityOnMount: variant !== "icon", // Auto-check for non-icon variants
  });

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(scaleAnimation.value, [0, 1], [0.8, 1]);
    const rotate = interpolate(rotateAnimation.value, [0, 1], [0, 180]);
    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  // Handle button press
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!canDownload) {
      return;
    }

    // If this is a series, show episode selection dialog
    if (downloadCapability?.isSeries && episodes && episodes.length > 0) {
      setEpisodeDialogVisible(true);
      return;
    }

    if (showQuality && qualityOptions.length > 1) {
      setMenuVisible(true);
    } else {
      handleDownloadAction();
    }
  };

  // Handle episode selection
  const handleEpisodeSelection = (selectedEpisodeIds: string[]) => {
    setSelectedEpisodes(selectedEpisodeIds);
    setEpisodeDialogVisible(false);
    handleDownloadAction(selectedEpisodeIds);
  };

  // Handle download action
  const handleDownloadAction = async (overrideEpisodes?: readonly string[]) => {
    try {
      scaleAnimation.value = withSpring(0.9, { damping: 15, stiffness: 100 });
      rotateAnimation.value = withSpring(1, { damping: 15, stiffness: 100 });

      const downloadId = await startDownload(overrideEpisodes);

      scaleAnimation.value = withSpring(1, { damping: 15, stiffness: 100 });
      rotateAnimation.value = withSpring(0, { damping: 15, stiffness: 100 });

      onDownloadStart?.(downloadId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onDownloadError?.(message);
    }
  };

  // Handle quality selection
  const handleQualitySelect = (quality: QualityOption) => {
    selectQuality(quality.value);
    setMenuVisible(false);
    handleDownloadAction();
  };

  // Size configurations using centralized tokens
  const sizeConfig = useMemo(() => {
    switch (size) {
      case "small":
        return {
          iconSize: iconSizes.sm + 2, // 18
          buttonHeight: buttonSizes.height.sm,
          fontSize: theme.custom.typography.labelSmall.fontSize,
          padding: spacing.xs,
        };
      case "large":
        return {
          iconSize: iconSizes.xl - 4, // 28
          buttonHeight: buttonSizes.height.lg,
          fontSize: theme.custom.typography.labelMedium.fontSize,
          padding: spacing.md,
        };
      default: // medium
        return {
          iconSize: iconSizes.md, // 24
          buttonHeight: buttonSizes.height.md,
          fontSize: theme.custom.typography.labelMedium.fontSize,
          padding: spacing.sm,
        };
    }
  }, [size, theme.custom.typography]);

  // Don't render if download capability is not available and not loading
  if (!isLoading && canDownload === false && variant === "icon") {
    return null;
  }

  if (variant === "icon") {
    return (
      <>
        <Animated.View style={[animatedStyle, styles.iconContainer, style]}>
          <IconButton
            icon={isLoading ? "download" : "download"}
            size={sizeConfig.iconSize}
            onPress={handlePress}
            disabled={isLoading || !canDownload}
            mode={canDownload ? "contained" : "outlined"}
            iconColor={
              canDownload
                ? theme.colors.onPrimary
                : theme.colors.onSurfaceDisabled
            }
            style={[
              styles.iconButton,
              {
                backgroundColor: canDownload
                  ? theme.colors.primary
                  : "transparent",
              },
            ]}
          />
        </Animated.View>

        {showQuality && qualityOptions.length > 1 && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <View style={styles.menuAnchor}>
                <IconButton
                  icon="chevron-down"
                  size={16}
                  onPress={() => setMenuVisible(true)}
                  disabled={!canDownload}
                  iconColor={
                    canDownload
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceDisabled
                  }
                />
              </View>
            }
          >
            {qualityOptions.map((quality) => (
              <View key={quality.value}>
                <Pressable
                  style={styles.qualityItem}
                  onPress={() => handleQualitySelect(quality)}
                >
                  <Text variant="bodyMedium" style={styles.qualityLabel}>
                    {quality.label}
                  </Text>
                  {quality.estimatedSize && (
                    <Text variant="bodySmall" style={styles.qualitySize}>
                      {`${(quality.estimatedSize / 1024 / 1024).toFixed(1)} MB`}
                    </Text>
                  )}
                </Pressable>
                {qualityOptions.indexOf(quality) <
                  qualityOptions.length - 1 && <Divider />}
              </View>
            ))}
          </Menu>
        )}

        {episodes && episodes.length > 0 && (
          <EpisodeSelectionDialog
            visible={episodeDialogVisible}
            episodes={episodes}
            title={downloadCapability?.restrictions?.[0] || "Select Episodes"}
            onConfirm={handleEpisodeSelection}
            onDismiss={() => setEpisodeDialogVisible(false)}
          />
        )}
      </>
    );
  }

  if (variant === "button") {
    return (
      <>
        <Animated.View style={[animatedStyle, style]}>
          <Pressable
            style={[
              styles.button,
              {
                height: sizeConfig.buttonHeight,
                backgroundColor: canDownload
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
                paddingHorizontal: sizeConfig.padding,
              },
            ]}
            onPress={handlePress}
            disabled={isLoading || !canDownload}
          >
            <View style={styles.buttonContent}>
              <IconButton
                icon={isLoading ? "loading" : "download"}
                size={sizeConfig.iconSize}
                iconColor={
                  canDownload
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceVariant
                }
                style={styles.buttonIcon}
              />
              <Text
                variant="labelMedium"
                style={[
                  styles.buttonText,
                  {
                    color: canDownload
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceVariant,
                    fontSize: sizeConfig.fontSize,
                  },
                ]}
              >
                {isLoading ? "Preparing..." : "Download"}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {showQuality && qualityOptions.length > 1 && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <View style={styles.menuAnchor}>
                <IconButton
                  icon="chevron-down"
                  size={sizeConfig.iconSize}
                  onPress={() => setMenuVisible(true)}
                  disabled={!canDownload}
                  iconColor={
                    canDownload
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceVariant
                  }
                />
              </View>
            }
          >
            {qualityOptions.map((quality) => (
              <View key={quality.value}>
                <Pressable
                  style={styles.qualityItem}
                  onPress={() => handleQualitySelect(quality)}
                >
                  <Text variant="bodyMedium" style={styles.qualityLabel}>
                    {quality.label}
                  </Text>
                  {quality.estimatedSize && (
                    <Text variant="bodySmall" style={styles.qualitySize}>
                      {`${(quality.estimatedSize / 1024 / 1024).toFixed(1)} MB`}
                    </Text>
                  )}
                </Pressable>
                {qualityOptions.indexOf(quality) <
                  qualityOptions.length - 1 && <Divider />}
              </View>
            ))}
          </Menu>
        )}

        {episodes && episodes.length > 0 && (
          <EpisodeSelectionDialog
            visible={episodeDialogVisible}
            episodes={episodes}
            title={downloadCapability?.restrictions?.[0] || "Select Episodes"}
            onConfirm={handleEpisodeSelection}
            onDismiss={() => setEpisodeDialogVisible(false)}
          />
        )}
      </>
    );
  }

  // Card variant
  if (variant === "card") {
    return (
      <>
        <Animated.View style={[animatedStyle, styles.card, style]}>
          <Pressable
            style={[
              styles.cardContent,
              {
                backgroundColor: canDownload
                  ? theme.colors.surface
                  : theme.colors.surfaceDisabled,
                opacity: isLoading ? 0.7 : 1,
              },
            ]}
            onPress={handlePress}
            disabled={isLoading || !canDownload}
          >
            <View style={styles.cardInfo}>
              <Text
                variant="titleSmall"
                style={[
                  styles.cardTitle,
                  {
                    color: canDownload
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceDisabled,
                  },
                ]}
              >
                Download Content
              </Text>
              {downloadCapability?.format && (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.cardFormat,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {downloadCapability.format}
                </Text>
              )}
              {downloadCapability?.estimatedSize && (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.cardSize,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {`${(downloadCapability.estimatedSize / 1024 / 1024).toFixed(1)} MB`}
                </Text>
              )}
            </View>
            <IconButton
              icon={isLoading ? "loading" : "download"}
              size={sizeConfig.iconSize}
              iconColor={
                canDownload
                  ? theme.colors.primary
                  : theme.colors.onSurfaceDisabled
              }
            />
          </Pressable>
        </Animated.View>

        {showQuality && qualityOptions.length > 1 && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <View style={styles.menuAnchor}>
                <IconButton
                  icon="chevron-down"
                  size={sizeConfig.iconSize}
                  onPress={() => setMenuVisible(true)}
                  disabled={!canDownload}
                  iconColor={theme.colors.onSurfaceVariant}
                />
              </View>
            }
          >
            {qualityOptions.map((quality) => (
              <View key={quality.value}>
                <Pressable
                  style={styles.qualityItem}
                  onPress={() => handleQualitySelect(quality)}
                >
                  <Text variant="bodyMedium" style={styles.qualityLabel}>
                    {quality.label}
                  </Text>
                  {quality.estimatedSize && (
                    <Text variant="bodySmall" style={styles.qualitySize}>
                      {`${(quality.estimatedSize / 1024 / 1024).toFixed(1)} MB`}
                    </Text>
                  )}
                </Pressable>
                {qualityOptions.indexOf(quality) <
                  qualityOptions.length - 1 && <Divider />}
              </View>
            ))}
          </Menu>
        )}

        {episodes && episodes.length > 0 && (
          <EpisodeSelectionDialog
            visible={episodeDialogVisible}
            episodes={episodes}
            title={downloadCapability?.restrictions?.[0] || "Select Episodes"}
            onConfirm={handleEpisodeSelection}
            onDismiss={() => setEpisodeDialogVisible(false)}
          />
        )}
      </>
    );
  }

  // Navbar circle variant - circle button with speed in center
  if (variant === "navbar-circle") {
    const buttonSize = touchSizes.lg; // Standard touch target size
    return (
      <>
        <Animated.View style={[animatedStyle, style]}>
          <Pressable
            style={[
              styles.navbarCircle,
              {
                width: buttonSize,
                height: buttonSize,
                backgroundColor: canDownload
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
              },
            ]}
            onPress={handlePress}
            disabled={isLoading || !canDownload}
          >
            <View style={styles.navbarCircleContent}>
              {currentDownloadSpeed > 0 ? (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.navbarCircleSpeed,
                    {
                      color: theme.colors.onPrimary,
                    },
                  ]}
                >
                  {formatSpeed(currentDownloadSpeed)}
                </Text>
              ) : (
                <IconButton
                  icon={isLoading ? "loading" : "download"}
                  size={20}
                  iconColor={
                    canDownload
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceDisabled
                  }
                  style={styles.navbarCircleIcon}
                />
              )}
            </View>
          </Pressable>
        </Animated.View>

        {episodes && episodes.length > 0 && (
          <EpisodeSelectionDialog
            visible={episodeDialogVisible}
            episodes={episodes}
            title={downloadCapability?.restrictions?.[0] || "Select Episodes"}
            onConfirm={handleEpisodeSelection}
            onDismiss={() => setEpisodeDialogVisible(false)}
          />
        )}
      </>
    );
  }

  // Default return - should not reach here but prevents TypeScript errors
  return null;
};

const createStyles = (
  theme: AppTheme,
  size: "small" | "medium" | "large",
  variant: "icon" | "button" | "card" | "navbar-circle",
) =>
  StyleSheet.create({
    iconContainer: {
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      margin: 0,
    },
    button: {
      borderRadius: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    buttonIcon: {
      margin: 0,
    },
    buttonText: {
      fontWeight: "600",
    },
    card: {
      borderRadius: spacing.md,
      overflow: "hidden",
    },
    cardContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
    },
    cardInfo: {
      flex: 1,
    },
    cardTitle: {
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    cardFormat: {
      marginBottom: spacing.xs / 2,
    },
    cardSize: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
    },
    menuAnchor: {
      marginLeft: -spacing.xs,
    },
    qualityItem: {
      padding: spacing.md,
    },
    qualityLabel: {
      fontWeight: "500",
    },
    qualitySize: {
      color: theme.colors.onSurfaceVariant,
      marginTop: spacing.xs / 2,
    },
    navbarCircle: {
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    navbarCircleContent: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    navbarCircleSpeed: {
      fontWeight: "700",
      fontSize: theme.custom.typography.labelSmall.fontSize * 0.8, // Small text for speed indicator
      textAlign: "center",
    },
    navbarCircleIcon: {
      margin: 0,
    },
  });

export default DownloadButton;
