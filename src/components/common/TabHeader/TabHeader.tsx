import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

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
  style?: any;
};

export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  showTitle = false,
  leftAction,
  rightAction,
  showBackButton = false,
  onBackPress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.elevation.level1,
    },
    leftSection: {
      width: 48,
      alignItems: 'flex-start',
    },
    centerSection: {
      flex: 1,
      alignItems: 'center',
    },
    rightSection: {
      width: 48,
      alignItems: 'flex-end',
    },
    title: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
    },
  });

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        {showBackButton ? (
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onBackground}
            onPress={handleBackPress}
            accessibilityLabel="Go back"
          />
        ) : leftAction ? (
          <IconButton
            icon={leftAction.icon}
            size={24}
            iconColor={leftAction.disabled ? theme.colors.onSurfaceDisabled : theme.colors.onBackground}
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
            size={24}
            iconColor={rightAction.disabled ? theme.colors.onSurfaceDisabled : theme.colors.primary}
            onPress={rightAction.onPress}
            accessibilityLabel={rightAction.accessibilityLabel}
            disabled={rightAction.disabled}
            style={{ marginRight: -spacing.xs }}
          />
        ) : (
          <View />
        )}
      </View>
    </View>
  );
};
