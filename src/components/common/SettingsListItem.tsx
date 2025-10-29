import React, { useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ViewStyle,
  AccessibilityRole,
} from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

export type GroupPosition = "single" | "top" | "middle" | "bottom";

export interface SettingsListItemProps {
  /** Primary label */
  title: string;
  /** Secondary, muted text */
  subtitle?: string;
  /** Left icon configuration */
  left?: {
    iconName?: string;
    node?: React.ReactNode;
    accessibilityLabel?: string;
  };
  /** Trailing node (Switch, Button, chevron, text, etc.) */
  trailing?: React.ReactNode;
  /** Press handler; when present, item is focusable with ripple */
  onPress?: () => void;
  /** Optional convenience for built-in Switch behavior */
  onToggle?: (value: boolean) => void;
  /** Selection visual (left accent + subtle tint) */
  selected?: boolean;
  /** Disables interaction */
  disabled?: boolean;
  /** Controls corner radii and divider rendering */
  groupPosition?: GroupPosition;
  /** Override default accessible label */
  accessibilityLabel?: string;
  /** Test ID */
  testID?: string;
  /** Optional style override */
  style?: ViewStyle;
  /** Frosted glass background */
  frosted?: boolean;
}

const SettingsListItem = React.forwardRef<View, SettingsListItemProps>(
  (
    {
      title,
      subtitle,
      left,
      trailing,
      onPress,
      onToggle,
      selected = false,
      disabled = false,
      groupPosition = "single",
      accessibilityLabel: customAccessibilityLabel,
      testID,
      style,
      frosted = false,
    },
    ref,
  ) => {
    const theme = useTheme<AppTheme>();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: frosted
              ? "rgba(255, 255, 255, 0.05)"
              : selected
                ? theme.colors.primaryContainer
                : theme.colors.surface,
            flexDirection: "column",
          },
          cornerRadius: getCornerRadius(groupPosition),
          innerContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            minHeight: 48,
          },
          leftIconContainer: {
            width: 40,
            height: 40,
            borderRadius: 20, // Circle
            backgroundColor: frosted
              ? "rgba(255, 255, 255, 0.08)"
              : selected
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          },
          contentContainer: {
            flex: 1,
            justifyContent: "center",
          },
          title: {
            color: theme.colors.onSurface,
            fontSize: theme.custom.typography.bodyMedium.fontSize,
            fontFamily: theme.custom.typography.bodyMedium.fontFamily,
            lineHeight: theme.custom.typography.bodyMedium.lineHeight,
            letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
            fontWeight: "600" as const,
            marginBottom: subtitle ? 2 : 0,
          },
          subtitle: {
            color: theme.colors.onSurfaceVariant,
            fontSize: theme.custom.typography.bodySmall.fontSize,
            fontFamily: theme.custom.typography.bodySmall.fontFamily,
            lineHeight: theme.custom.typography.bodySmall.lineHeight,
            letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
            fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
          },
          trailingContainer: {
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
          },
          // Divider rendered as a separate view so it can be inset to align with text
          divider: {
            height: StyleSheet.hairlineWidth || 1,
            backgroundColor: theme.colors.outline,
            // inset the divider so it aligns with the content (icon width + gap + padding)
            marginLeft: spacing.md + 40 + spacing.md,
            marginRight: spacing.md,
          },
          pressedStyle: {
            opacity: 0.8,
          },
          disabledStyle: {
            opacity: 0.5,
          },
        }),
      [theme, selected, groupPosition, subtitle, frosted],
    );

    // Compute accessible label: custom override or "Title, Subtitle"
    const computedAccessibilityLabel =
      customAccessibilityLabel || (subtitle ? `${title}, ${subtitle}` : title);

    // Determine accessibility role
    const accessibilityRole: AccessibilityRole = onPress ? "button" : "text";

    return (
      <>
        <Pressable
          ref={ref}
          onPress={onPress}
          disabled={disabled || !onPress}
          style={({ pressed }) => [
            styles.container,
            styles.cornerRadius,
            pressed && !disabled && styles.pressedStyle,
            disabled && styles.disabledStyle,
            style,
          ]}
          testID={testID}
          accessible
          accessibilityRole={accessibilityRole}
          accessibilityLabel={computedAccessibilityLabel}
          accessibilityState={{ disabled }}
        >
          <View style={styles.innerContainer}>
            {/* Left Icon or Custom Node */}
            {left ? (
              <View style={styles.leftIconContainer}>
                {left.node ? (
                  left.node
                ) : left.iconName ? (
                  <IconButton
                    icon={left.iconName}
                    size={20}
                    iconColor={
                      selected ? theme.colors.onPrimary : theme.colors.primary
                    }
                    style={{ margin: 0 }}
                  />
                ) : null}
              </View>
            ) : (
              <View style={styles.leftIconContainer} />
            )}

            {/* Content: Title & Subtitle */}
            <View style={styles.contentContainer}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
              {subtitle && (
                <Text
                  style={styles.subtitle}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {subtitle}
                </Text>
              )}
            </View>

            {/* Trailing Control */}
            {trailing && (
              <View style={styles.trailingContainer} pointerEvents="box-none">
                {trailing}
              </View>
            )}
          </View>
        </Pressable>
        {/* Divider (inset) — render for top/middle items only */}
        {groupPosition !== "bottom" && groupPosition !== "single" && (
          <View style={styles.divider} />
        )}
      </>
    );
  },
);

SettingsListItem.displayName = "SettingsListItem";

export default SettingsListItem;

/**
 * Helper to get corner radius based on group position
 */
function getCornerRadius(groupPosition: GroupPosition): ViewStyle {
  const cornerRadius = 16;

  switch (groupPosition) {
    case "single":
      return {
        borderTopLeftRadius: cornerRadius,
        borderTopRightRadius: cornerRadius,
        borderBottomLeftRadius: cornerRadius,
        borderBottomRightRadius: cornerRadius,
      };
    case "top":
      return {
        borderTopLeftRadius: cornerRadius,
        borderTopRightRadius: cornerRadius,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      };
    case "middle":
      return {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      };
    case "bottom":
      return {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: cornerRadius,
        borderBottomRightRadius: cornerRadius,
      };
    default:
      return {};
  }
}

/**
 * Helper to compute group positions for an array of items
 * @param count - Total number of items
 * @returns Array of GroupPositions indexed by item position
 */
export const getGroupPositions = (count: number): GroupPosition[] => {
  if (count === 1) return ["single"];
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) return "top";
    if (i === count - 1) return "bottom";
    return "middle";
  });
};
