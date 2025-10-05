import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { type AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { getClerkErrorMessage } from '@/services/auth/AuthService';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';

const LoginScreen = () => {
  const { isAuthenticated } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        formSpacing: {
          marginBottom: spacing.md,
        },
        error: {
          marginBottom: spacing.md,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(auth)/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSignIn = useCallback(async () => {
    if (!isLoaded || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!signIn) {
        setErrorMessage('Authentication service is not ready. Please try again.');
        return;
      }

      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });

      if (result.status !== 'complete' || !result.createdSessionId) {
        setErrorMessage('Additional verification is required to finish signing in.');
        return;
      }

      if (!setActive) {
        setErrorMessage('Unable to finalize the session. Please try again.');
        return;
      }

      await setActive({ session: result.createdSessionId });
      router.replace('/(auth)/dashboard');
    } catch (error) {
      const message = getClerkErrorMessage(
        error,
        'Unable to sign in. Check your credentials and try again.',
      );
      setErrorMessage(message);

      void logger.warn('Sign-in attempt failed.', {
        location: 'LoginScreen.handleSignIn',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [identifier, isLoaded, isSubmitting, password, router, setActive, signIn]);

  return (
    <SafeAreaView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Welcome to UniArr
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Sign in to continue managing your media automation services.
      </Text>
      <TextInput
        label="Email"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        style={styles.formSpacing}
        returnKeyType="next"
        accessibilityLabel="Email address"
        mode="outlined"
        disabled={isSubmitting}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        style={styles.formSpacing}
        returnKeyType="done"
        onSubmitEditing={handleSignIn}
        accessibilityLabel="Password"
        mode="outlined"
        disabled={isSubmitting}
      />
      {Boolean(errorMessage) && (
        <HelperText type="error" visible style={styles.error}>
          {errorMessage}
        </HelperText>
      )}
      <Button
        mode="contained"
        onPress={handleSignIn}
        loading={isSubmitting}
        disabled={
          isSubmitting || !isLoaded || identifier.trim().length === 0 || password.length === 0
        }
        accessibilityRole="button"
      >
        Sign In
      </Button>
    </SafeAreaView>
  );
};

export default LoginScreen;
