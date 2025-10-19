import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import type { BookmarkItemProps } from "./BookmarksWidget.types";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";

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
    const iconProps = {
      size: size === "small" ? 24 : size === "medium" ? 32 : 40,
    };

    switch (bookmark.icon.type) {
      case "material-icon":
        return (
          <MaterialCommunityIcons
            name={bookmark.icon.value as any}
            color={bookmark.icon.textColor || theme.colors.primary}
            {...iconProps}
          />
        );

      case "cdn-icon":
        return (
          <Image
            source={{
              uri: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${bookmark.icon.value}.svg`,
            }}
            style={{
              width: iconProps.size,
              height: iconProps.size,
              tintColor: bookmark.icon.textColor || theme.colors.primary,
            }}
            resizeMode="contain"
          />
        );

      case "image-url":
        return (
          <Image
            source={{ uri: bookmark.icon.value }}
            style={{
              width: iconProps.size,
              height: iconProps.size,
            }}
            resizeMode="contain"
          />
        );

      default:
        return (
          <MaterialCommunityIcons
            name="link"
            color={theme.colors.primary}
            {...iconProps}
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
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 100,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  smallContainer: {
    flex: 1,
    minHeight: 80,
    maxWidth: "48%",
  },
  mediumContainer: {
    flex: 1,
    minHeight: 100,
    maxWidth: "48%",
  },
  largeContainer: {
    flex: 1,
    minHeight: 120,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    fontWeight: "600",
    textAlign: "center",
  },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  healthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  healthText: {
    fontSize: 10,
  },
});

export default BookmarkItem;
