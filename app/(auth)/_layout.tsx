import { Redirect, Stack } from 'expo-router';
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { type AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { spacing } from '@/theme/spacing';

const AuthenticatedLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F0F0F',
          padding: spacing.lg,
        },
        message: {
          marginTop: spacing.sm,
          color: '#FFFFFF',
        },
      }),
    [theme],
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator animating color="#FFD700" />
        <Text style={styles.message} variant="bodyMedium">
          Checking your session…
        </Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-service" />
    </Stack>
  );
};

export default AuthenticatedLayout;
