import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import type { ShortcutItemProps } from "./ShortcutsWidget.types";

const ShortcutItem: React.FC<ShortcutItemProps> = ({
  shortcut,
  onPress,
  disabled = false,
  size = "medium",
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();

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
          icon: 20,
          textVariant: "labelSmall" as const,
        };
      case "large":
        return {
          container: styles.largeContainer,
          icon: 32,
          textVariant: "titleMedium" as const,
        };
      default: // medium
        return {
          container: styles.mediumContainer,
          icon: 24,
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

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 80,
    minWidth: 80,
    maxWidth: 120,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  smallContainer: {
    minHeight: 60,
    minWidth: 60,
    maxWidth: 90,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  mediumContainer: {
    minHeight: 80,
    minWidth: 80,
    maxWidth: 120,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  largeContainer: {
    minHeight: 100,
    minWidth: 100,
    maxWidth: 140,
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
