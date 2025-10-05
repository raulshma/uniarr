import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { spacing } from '@/theme/spacing';

const DashboardScreen = () => {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        },
        title: {
          marginBottom: spacing.sm,
          color: theme.colors.onBackground,
          textAlign: 'center',
        },
        subtitle: {
          marginBottom: spacing.lg,
          color: theme.colors.onSurfaceVariant,
          textAlign: 'center',
        },
      }),
    [theme],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace('/(public)/login');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.';

      Alert.alert('Sign out failed', message);
    }
  }, [router, signOut]);

  return (
    <SafeAreaView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Dashboard
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {user ? `Signed in as ${user.email ?? user.id}` : 'Connecting to your account…'}
      </Text>
      <Button
        mode="contained"
        onPress={handleSignOut}
        loading={isLoading}
        disabled={isLoading}
        accessibilityRole="button"
      >
        Sign Out
      </Button>
    </SafeAreaView>
  );
};

export default DashboardScreen;
