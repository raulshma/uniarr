import { Redirect, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { spacing } from '@/theme/spacing';

const PublicLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = useTheme<AppTheme>();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

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

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
        setHasSeenOnboarding(onboardingCompleted === 'true');
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setHasSeenOnboarding(false); // Default to showing onboarding if there's an error
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  if (isLoading || isCheckingOnboarding) {
    return (
      <View style={styles.container}>
        <ActivityIndicator animating color={theme.colors.primary} />
        <Text style={styles.message} variant="bodyMedium">
          Preparing experience…
        </Text>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(auth)/dashboard" />;
  }

  // Show onboarding for new users, login for returning users
  if (hasSeenOnboarding === false) {
    return <Redirect href="/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
};

export default PublicLayout;
