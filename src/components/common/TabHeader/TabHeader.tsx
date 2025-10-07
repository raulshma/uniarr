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
      paddingHorizontal: spacing.md,
      paddingTop: 0,
      paddingBottom: spacing.sm,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.elevation.level1,
      minHeight: 48,
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
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
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
            size={20}
            iconColor={theme.colors.onBackground}
            onPress={handleBackPress}
            accessibilityLabel="Go back"
          />
        ) : leftAction ? (
          <IconButton
            icon={leftAction.icon}
            size={20}
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
            size={20}
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
