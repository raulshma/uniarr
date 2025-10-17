import { ClerkLoaded, ClerkProvider } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Slot, useRouter, useSegments } from "expo-router";
import { useMemo, type ComponentType, useEffect } from "react";
import { Platform, View } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@/config/queryClient";
import {
  clerkTokenCache,
  getClerkPublishableKey,
} from "@/services/auth/AuthService";
import { AuthProvider, useAuth } from "@/services/auth/AuthProvider";
import { useTheme } from "@/hooks/useTheme";
import { defaultTheme } from "@/constants/theme";
import { ErrorBoundary, DialogProvider } from "@/components/common";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineAwareActions } from "@/hooks/useOfflineAwareActions";
import { useNotificationRegistration } from "@/hooks/useNotificationRegistration";
import { useNotificationResponseHandler } from "@/hooks/useNotificationResponseHandler";
import { useQuietHoursManager } from "@/hooks/useQuietHoursManager";
import { useVoiceCommandHandler } from "@/hooks/useVoiceCommandHandler";

const RootLayout = () => {
  const theme = useTheme();
  const clerkPublishableKey = useMemo(() => getClerkPublishableKey(), []);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <SafeAreaProvider>
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          tokenCache={clerkTokenCache}
        >
          <ClerkLoaded>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <PaperProvider theme={theme || defaultTheme}>
                  <DialogProvider>
                    <StatusBar style={theme.dark ? "light" : "dark"} />
                    <ErrorBoundary context={{ location: "RootLayout" }}>
                      <AppContent />
                    </ErrorBoundary>
                    <QueryDevtools />
                  </DialogProvider>
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

    const inAuthGroup = segments[0] === "(auth)";
    const inPublicGroup = segments[0] === "(public)";

    // Prevent infinite redirects by checking if we're already on the correct route
    const currentRoute = segments.join("/");
    const isOnDashboard = currentRoute.includes("(auth)/dashboard");
    const isOnLogin = currentRoute.includes("(public)/login");

    if (isAuthenticated && !inAuthGroup && !isOnDashboard) {
      // User is authenticated but not in auth group, redirect to dashboard
      router.replace("/(auth)/dashboard");
    } else if (!isAuthenticated && !inPublicGroup && !isOnLogin) {
      // User is not authenticated and not in public group, redirect to login
      router.replace("/(public)/login");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <Slot />;
};

const AppContent = () => {
  const { isOnline } = useOfflineSync();
  const { type: networkType } = useNetworkStatus();
  const { queuedCount, isSyncing, forceSync } = useOfflineAwareActions();
  const theme = useTheme();
  useNotificationRegistration();
  useNotificationResponseHandler();
  useQuietHoursManager();
  useVoiceCommandHandler();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/*
        Only show the offline banner when the app has determined the device is
        explicitly offline. Network status hooks may return `null` while they
        are initializing; treating `null` as "unknown" prevents flicker of the
        offline banner when the status is not yet resolved.
      */}
      <OfflineIndicator
        isVisible={isOnline === false}
        networkType={networkType || undefined}
        showRetry={true}
        isSyncing={isSyncing}
        queuedCount={queuedCount}
        onRetry={forceSync}
      />
      <RootNavigator />
    </View>
  );
};

export default RootLayout;

type DevtoolsComponentProps = {
  initialIsOpen?: boolean;
};

const WebDevtools: ComponentType<DevtoolsComponentProps> | null =
  __DEV__ && Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@tanstack/react-query-devtools")
        .ReactQueryDevtools as ComponentType<DevtoolsComponentProps>)
    : null;

const QueryDevtools = () => {
  if (!__DEV__ || !WebDevtools) {
    return null;
  }

  return <WebDevtools initialIsOpen={false} />;
};
