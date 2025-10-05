import { Redirect, Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { type AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { spacing } from '@/theme/spacing';

const PublicLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          padding: spacing.lg,
        },
        message: {
          marginTop: spacing.sm,
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator animating color={theme.colors.primary} />
        <Text style={styles.message} variant="bodyMedium">
          Preparing login experience…
        </Text>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(auth)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
};

export default PublicLayout;
