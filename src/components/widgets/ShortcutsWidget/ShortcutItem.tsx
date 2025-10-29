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

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        { backgroundColor: theme.colors.surfaceVariant },
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
      minWidth: touchSizes.xl + 80, // Wider for horizontal pill
      maxWidth: iconSizes.xxxl + 120, // 184 = 64 + 120 - Much wider for pill shape
      backgroundColor: "rgba(255, 255, 255, 0.05)", // Subtle frosted effect
    },
    smallContainer: {
      minHeight: touchSizes.md, // 44 - Short pill
      minWidth: touchSizes.lg + 60, // Wider pill
      maxWidth: touchSizes.xl + 80, // 136 - Wide pill
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    mediumContainer: {
      minHeight: touchSizes.lg, // 48 - Short pill
      minWidth: touchSizes.xl + 100, // Wider pill
      maxWidth: iconSizes.xxxl + 120, // 184 = 64 + 120 - Wide pill
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    largeContainer: {
      minHeight: touchSizes.lg + 8, // 56 - Short pill
      minWidth: touchSizes.xl + 96, // Wider pill
      maxWidth: iconSizes.xxxl + 140, // 204 = 64 + 140 - Wide pill
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    label: {
      marginLeft: spacing.sm,
      textAlign: "left",
      fontWeight: "500",
      flex: 1,
    },
    disabled: {
      opacity: 0.5,
    },
  });

export default ShortcutItem;
