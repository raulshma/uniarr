import { ClerkLoaded, ClerkProvider } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useMemo, type ComponentType } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/config/queryClient';
import { clerkTokenCache, getClerkPublishableKey } from '@/services/auth/AuthService';
import { AuthProvider } from '@/services/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const clerkPublishableKey = useMemo(getClerkPublishableKey, []);

  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
        <ClerkLoaded>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <PaperProvider theme={theme}>
                <StatusBar style={theme.dark ? 'light' : 'dark'} />
                <Stack screenOptions={{ headerShown: false }} />
                <QueryDevtools />
              </PaperProvider>
            </QueryClientProvider>
          </AuthProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </SafeAreaProvider>
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
