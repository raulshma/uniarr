import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';

const sizeMap = {
  small: 24,
  medium: 32,
  large: 40,
} as const;

export type LoadingStateProps = {
  message?: string;
  size?: keyof typeof sizeMap | number;
  testID?: string;
};

const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  size = 'large',
  testID = 'loading-state',
}) => {
  const theme = useTheme<AppTheme>();

  const indicatorSize = typeof size === 'number' ? size : sizeMap[size];

  return (
    <View
      style={[styles.container, { padding: theme.custom.spacing.lg }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
      testID={testID}
    >
      <ActivityIndicator size={indicatorSize} color={theme.colors.primary} animating />
      {message ? (
        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
      ) : null}
    </View>
  );
};

export default LoadingState;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
  },
});
