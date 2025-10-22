import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { getComponentElevation } from "@/constants/elevation";
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
      alignItems: "center",
      justifyContent: "center",
      borderRadius: borderRadius.lg, // 12
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      minHeight: touchSizes.xl + 24, // 80 = 56 + 24
      minWidth: touchSizes.xl + 24,
      maxWidth: iconSizes.xxxl + 56, // 120 = 64 + 56
      ...getComponentElevation("widgetCard", theme),
    },
    smallContainer: {
      minHeight: touchSizes.lg + 12, // 60 = 48 + 12
      minWidth: touchSizes.lg + 12,
      maxWidth: touchSizes.xl + 34, // 90
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    mediumContainer: {
      minHeight: touchSizes.xl + 24, // 80 = 56 + 24
      minWidth: touchSizes.xl + 24,
      maxWidth: iconSizes.xxxl + 56, // 120 = 64 + 56
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    largeContainer: {
      minHeight: touchSizes.xl + 44, // 100 = 56 + 44
      minWidth: touchSizes.xl + 44,
      maxWidth: iconSizes.xxxl + 76, // 140 = 64 + 76
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    label: {
      marginTop: spacing.xs,
      textAlign: "center",
      fontWeight: "500",
    },
    disabled: {
      opacity: 0.5,
    },
  });

export default ShortcutItem;
