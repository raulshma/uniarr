import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useMemo, type ComponentType } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { queryClient } from '@/config/queryClient';
import { getAppTheme, type AppTheme } from '@/constants/theme';
import { AuthProvider } from '@/services/auth/AuthProvider';

const RootLayout = () => {
  const colorScheme = useColorScheme();

  const theme = useMemo<AppTheme>(() => getAppTheme(colorScheme), [colorScheme]);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
          <QueryDevtools />
        </PaperProvider>
      </QueryClientProvider>
    </AuthProvider>
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
