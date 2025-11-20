import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { iconSizes, borderRadius, touchSizes } from "@/constants/sizes";
import type { ShortcutItemProps } from "./ShortcutsWidget.types";

const ShortcutItem: React.FC<ShortcutItemProps> = ({
  shortcut,
  onPress,
  disabled = false,
  size = "medium",
  compact = false,
  columns = 2,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();
  const styles = useThemeAwareStyles(theme);

  const handlePress = () => {
    if (disabled) return;
    hapticPress();
    onPress(shortcut);
  };

  const getSizeStyles = () => {
    if (compact) {
      switch (size) {
        case "small":
          return {
            container: styles.compactSmallContainer,
            icon: columns === 4 ? iconSizes.md : iconSizes.xl, // 20 or 28
            textVariant: "labelSmall" as const,
          };
        case "large":
          return {
            container: styles.compactLargeContainer,
            icon: columns === 4 ? iconSizes.xl : iconSizes.xxxl, // 28 or 32
            textVariant:
              columns === 4
                ? ("labelSmall" as const)
                : ("labelMedium" as const),
          };
        default: // medium
          return {
            container: styles.compactMediumContainer,
            icon: columns === 4 ? iconSizes.lg : iconSizes.xxl, // 24 or 30
            textVariant: "labelSmall" as const,
          };
      }
    }

    // Regular 2-column layout with labels
    switch (size) {
      case "small":
        return {
          container: styles.smallContainer,
          icon: iconSizes.md, // 20
          textVariant: "labelSmall" as const,
        };
      case "large":
        return {
          container: styles.largeContainer,
          icon: iconSizes.xxxl, // 32
          textVariant: "titleMedium" as const,
        };
      default: // medium
        return {
          container: styles.mediumContainer,
          icon: iconSizes.lg, // 24
          textVariant: "labelMedium" as const,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Calculate width based on columns
  const getCompactWidth = () => {
    if (columns === 4) return "22.5%"; // 4 columns with gaps
    if (columns === 3) return "31%"; // 3 columns with gaps
    return "47%"; // 2 columns
  };

  if (compact) {
    // Compact icon-only layout
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          sizeStyles.container,
          {
            backgroundColor: theme.colors.surfaceVariant,
            width: getCompactWidth(),
          },
          disabled && styles.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={shortcut.icon as any}
          size={sizeStyles.icon}
          color={
            disabled ? theme.colors.onSurfaceDisabled : theme.colors.primary
          }
        />
        <Text
          variant={sizeStyles.textVariant}
          style={[
            styles.compactLabel,
            {
              color: disabled
                ? theme.colors.onSurfaceDisabled
                : theme.colors.onSurfaceVariant,
            },
          ]}
          numberOfLines={1}
        >
          {shortcut.label}
        </Text>
      </TouchableOpacity>
    );
  }

  // Regular horizontal pill layout
  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        { backgroundColor: theme.colors.surfaceVariant, width: "47%" },
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={shortcut.icon as any}
        size={sizeStyles.icon}
        color={disabled ? theme.colors.onSurfaceDisabled : theme.colors.primary}
      />
      <Text
        variant={sizeStyles.textVariant}
        style={[
          styles.label,
          {
            color: disabled
              ? theme.colors.onSurfaceDisabled
              : theme.colors.onSurfaceVariant,
          },
        ]}
        numberOfLines={1}
      >
        {shortcut.label}
      </Text>
    </TouchableOpacity>
  );
};

const useThemeAwareStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      borderRadius: borderRadius.xxl, // 20 - More rounded for cylinder shape
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: touchSizes.lg, // 48 - Shorter for horizontal pill
      backgroundColor: "rgba(255, 255, 255, 0.05)", // Subtle frosted effect
    },
    smallContainer: {
      minHeight: touchSizes.md, // 44 - Short pill
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    mediumContainer: {
      minHeight: touchSizes.lg, // 48 - Short pill
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    largeContainer: {
      minHeight: touchSizes.lg + 8, // 56 - Short pill
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    label: {
      marginLeft: spacing.sm,
      textAlign: "left",
      fontWeight: "500",
      flex: 1,
    },
    // Compact icon-based layout styles (3 or 4 columns)
    compactContainer: {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    compactSmallContainer: {
      minHeight: 64,
      paddingVertical: spacing.sm,
    },
    compactMediumContainer: {
      minHeight: 72,
      paddingVertical: spacing.md,
    },
    compactLargeContainer: {
      minHeight: 80,
      paddingVertical: spacing.md,
    },
    compactLabel: {
      marginTop: spacing.xs,
      textAlign: "center",
      fontWeight: "500",
      width: "100%",
    },
    disabled: {
      opacity: 0.5,
    },
  });

export default ShortcutItem;
