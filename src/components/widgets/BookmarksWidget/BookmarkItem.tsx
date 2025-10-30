import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  ColorValue,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import type { BookmarkItemProps } from "./BookmarksWidget.types";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { getComponentElevation } from "@/constants/elevation";
import { borderRadius } from "@/constants/sizes";

const BookmarkItem: React.FC<BookmarkItemProps> = ({
  bookmark,
  health,
  onPress,
  onLongPress,
  disabled = false,
  size = "medium",
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();
  const cardElevationStyle = getComponentElevation("card", theme);

  const handlePress = () => {
    hapticPress();
    onPress(bookmark);

    // Open the URL
    try {
      Linking.openURL(bookmark.url);
    } catch (error) {
      console.error(`Failed to open URL: ${bookmark.url}`, error);
    }
  };

  const handleLongPress = () => {
    hapticPress();
    onLongPress?.(bookmark);
  };

  const renderIcon = () => {
    const iconSize = size === "small" ? 24 : size === "medium" ? 32 : 40;

    switch (bookmark.icon.type) {
      case "material-icon":
        return (
          <MaterialCommunityIcons
            name={bookmark.icon.value as any}
            size={iconSize}
            color={bookmark.icon.textColor || theme.colors.primary}
          />
        );

      case "cdn-icon":
        return (
          <CdnIconImage
            name={bookmark.icon.value}
            size={iconSize}
            tintColor={bookmark.icon.textColor}
          />
        );

      case "image-url":
        return (
          <Image
            source={{ uri: bookmark.icon.value }}
            style={{
              width: iconSize,
              height: iconSize,
            }}
            resizeMode="contain"
          />
        );

      default:
        return (
          <MaterialCommunityIcons
            name="link"
            size={iconSize}
            color={theme.colors.primary}
          />
        );
    }
  };

  const containerBgColor = bookmark.icon.backgroundColor
    ? bookmark.icon.backgroundColor
    : `${theme.colors.primary}15`;

  const getStatusColor = (): string => {
    if (health?.status === "loading") return theme.colors.outline;
    if (health?.status === "healthy") return "#4CAF50";
    if (health?.status === "unhealthy") return "#FF5252";
    return theme.colors.outlineVariant;
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        size === "small" && styles.smallContainer,
        size === "medium" && styles.mediumContainer,
        size === "large" && styles.largeContainer,
        disabled && styles.disabled,
        { backgroundColor: theme.colors.surfaceVariant },
        cardElevationStyle,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* Icon Container */}
      <View
        style={[styles.iconContainer, { backgroundColor: containerBgColor }]}
      >
        {renderIcon()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          variant={size === "small" ? "labelSmall" : "labelMedium"}
          style={styles.label}
          numberOfLines={2}
        >
          {bookmark.label}
        </Text>

        {/* Health Status Badge */}
        {health && health.status !== "unknown" && (
          <View style={[styles.healthBadge, { borderColor: getStatusColor() }]}>
            <View
              style={[styles.healthDot, { backgroundColor: getStatusColor() }]}
            />
            <Text
              variant="labelSmall"
              style={[styles.healthText, { color: getStatusColor() }]}
              numberOfLines={1}
            >
              {health.status === "loading"
                ? "Checking..."
                : health.status === "healthy"
                  ? "Online"
                  : "Offline"}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
    overflow: "hidden",
    width: "100%",
  },
  smallContainer: {
    minHeight: 80,
  },
  mediumContainer: {
    minHeight: 100,
  },
  largeContainer: {
    minHeight: 120,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  content: {
    width: "100%",
    alignItems: "center",
    // spacing between label and health badge is provided by margins
  },
  label: {
    fontWeight: "600",
    textAlign: "center",
  },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  healthDot: {
    width: 4,
    height: 4,
    borderRadius: borderRadius.xs,
  },
  healthText: {
    fontSize: 10,
  },
});

export default BookmarkItem;

// CDN Icon Image component with fallback and color support
const CdnIconImage: React.FC<{
  name: string;
  size: number;
  tintColor?: string;
}> = ({ name, size, tintColor }) => {
  const [urlIndex, setUrlIndex] = React.useState(0);

  const getUrlPriority = (): string[] => {
    return [
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${name}.svg`,
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${name}.png`,
      `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/${name}.svg`,
      `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png/${name}.png`,
    ];
  };

  const urls = getUrlPriority();
  const currentUrl = urls[urlIndex];

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex(urlIndex + 1);
    }
  };

  return (
    <Image
      source={{ uri: currentUrl }}
      style={{
        width: size,
        height: size,
        ...(tintColor && { tintColor: tintColor as ColorValue }),
      }}
      resizeMode="contain"
      onError={handleError}
    />
  );
};
