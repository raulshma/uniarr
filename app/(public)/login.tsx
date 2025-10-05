import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

import { type AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { spacing } from '@/theme/spacing';

const LoginScreen = () => {
  const { signIn, isLoading } = useAuth();
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

  const handleSignIn = useCallback(async () => {
    await signIn();
    router.replace('/(auth)/dashboard');
  }, [router, signIn]);

  return (
    <SafeAreaView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Welcome to UniArr
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Sign in to continue managing your media automation services.
      </Text>
      <Button
        mode="contained"
        onPress={handleSignIn}
        loading={isLoading}
        disabled={isLoading}
        accessibilityRole="button"
      >
        Sign In
      </Button>
    </SafeAreaView>
  );
};

export default LoginScreen;
