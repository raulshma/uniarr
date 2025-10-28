import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { AnimatedView } from "@/components/common/AnimatedComponents";
import { ANIMATION_DURATIONS, FadeIn, FadeOut } from "@/utils/animations.utils";

export type TabHeaderAction = {
  icon: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export type TabHeaderProps = {
  title?: string;
  showTitle?: boolean;
  leftAction?: TabHeaderAction;
  rightAction?: TabHeaderAction;
  showBackButton?: boolean;
  onBackPress?: () => void;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
  animationDelay?: number;
};

export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  showTitle = false,
  leftAction,
  rightAction,
  showBackButton = false,
  onBackPress,
  style,
  animated = true,
  animationDelay = 0,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.sm,
          paddingTop: 0,
          paddingBottom: spacing.xxs,
          backgroundColor: theme.colors.background,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.colors.elevation.level1,
          minHeight: 30,
        },
        leftSection: {
          width: 48,
          alignItems: "flex-start",
        },
        centerSection: {
          flex: 1,
          alignItems: "center",
        },
        rightSection: {
          width: 48,
          alignItems: "flex-end",
        },
        title: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
        },
      }),
    [theme],
  );

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    }
  };

  return (
    <AnimatedView
      style={[styles.container, style]}
      entering={FadeIn.duration(ANIMATION_DURATIONS.NORMAL).delay(
        animationDelay,
      )}
      exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
      animated={animated}
    >
      <View style={styles.leftSection}>
        {showBackButton ? (
          <IconButton
            icon="arrow-left"
            size={18}
            iconColor={theme.colors.onBackground}
            onPress={handleBackPress}
            accessibilityLabel="Go back"
          />
        ) : leftAction ? (
          <IconButton
            icon={leftAction.icon}
            size={18}
            iconColor={
              leftAction.disabled
                ? theme.colors.onSurfaceDisabled
                : theme.colors.onBackground
            }
            onPress={leftAction.onPress}
            accessibilityLabel={leftAction.accessibilityLabel}
            disabled={leftAction.disabled}
          />
        ) : (
          <View />
        )}
      </View>

      <View style={styles.centerSection}>
        {showTitle && title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightSection}>
        {rightAction ? (
          <IconButton
            icon={rightAction.icon}
            size={18}
            iconColor={
              rightAction.disabled
                ? theme.colors.onSurfaceDisabled
                : theme.colors.primary
            }
            onPress={rightAction.onPress}
            accessibilityLabel={rightAction.accessibilityLabel}
            disabled={rightAction.disabled}
            style={{ marginRight: -spacing.xs }}
          />
        ) : (
          <View />
        )}
      </View>
    </AnimatedView>
  );
};
