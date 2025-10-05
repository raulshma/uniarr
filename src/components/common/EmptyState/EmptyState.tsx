import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import { Button } from '@/components/common/Button';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof Icon>['source'];
  actionLabel?: string;
  onActionPress?: () => void;
  children?: React.ReactNode;
  testID?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = 'inbox-outline',
  actionLabel,
  onActionPress,
  children,
  testID = 'empty-state',
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <View
      style={[styles.container, { paddingHorizontal: theme.custom.spacing.xl }]}
      accessibilityRole="summary"
      testID={testID}
    >
      <Icon
        source={icon}
        size={48}
        color={theme.colors.onSurfaceVariant}
      />
      <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onActionPress ? (
        <Button mode="contained" onPress={onActionPress} fullWidth={false}>
          {actionLabel}
        </Button>
      ) : null}
      {children}
    </View>
  );
};

export default EmptyState;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  title: {
    marginTop: 16,
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    textAlign: 'center',
  },
});
