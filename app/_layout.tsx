import { ClerkLoaded, ClerkProvider } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useMemo, type ComponentType, useEffect } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/config/queryClient';
import { clerkTokenCache, getClerkPublishableKey } from '@/services/auth/AuthService';
import { AuthProvider, useAuth } from '@/services/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { OfflineIndicator } from '@/components/common/OfflineIndicator';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useNotificationRegistration } from '@/hooks/useNotificationRegistration';
import { useNotificationResponseHandler } from '@/hooks/useNotificationResponseHandler';
import { useQuietHoursManager } from '@/hooks/useQuietHoursManager';

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const clerkPublishableKey = useMemo(getClerkPublishableKey, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
          <ClerkLoaded>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <PaperProvider theme={theme}>
                  <StatusBar style={theme.dark ? 'light' : 'dark'} />
                  <ErrorBoundary context={{ location: 'RootLayout' }}>
                    <AppContent />
                  </ErrorBoundary>
                  <QueryDevtools />
                </PaperProvider>
              </QueryClientProvider>
            </AuthProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inPublicGroup = segments[0] === '(public)';

    if (isAuthenticated && !inAuthGroup) {
      // User is authenticated but not in auth group, redirect to dashboard
      router.replace('/(auth)/dashboard');
    } else if (!isAuthenticated && !inPublicGroup) {
      // User is not authenticated and not in public group, redirect to login
      router.replace('/(public)/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <Slot />;
};

const AppContent = () => {
  const { isOnline } = useOfflineSync();
  useNotificationRegistration();
  useNotificationResponseHandler();
  useQuietHoursManager();

  return (
    <View style={{ flex: 1 }}>
      <OfflineIndicator isVisible={!isOnline} />
      <RootNavigator />
    </View>
  );
};

export default RootLayout;

type DevtoolsComponentProps = {
  initialIsOpen?: boolean;
};

const WebDevtools: ComponentType<DevtoolsComponentProps> | null =
  __DEV__ && Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    (require('@tanstack/react-query-devtools').ReactQueryDevtools as ComponentType<DevtoolsComponentProps>)
    : null;

const QueryDevtools = () => {
  if (!__DEV__ || !WebDevtools) {
    return null;
  }

  return <WebDevtools initialIsOpen={false} />;
};
