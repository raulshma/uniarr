import "./../pollyfills";
import { ClerkLoaded, ClerkProvider } from "@clerk/clerk-expo";
import { QueryClientProvider, hydrate } from "@tanstack/react-query";
import type { Persister } from "@tanstack/react-query-persist-client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StatusBar } from "expo-status-bar";
import { Slot, useRouter, useSegments } from "expo-router";
import { useMemo, type ComponentType, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { PaperProvider, Portal } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

import { queryClient } from "@/config/queryClient";
import {
  clerkTokenCache,
  getClerkPublishableKey,
} from "@/services/auth/AuthService";
import { AuthProvider, useAuth } from "@/services/auth/AuthProvider";
import { useTheme } from "@/hooks/useTheme";
import { defaultTheme } from "@/constants/theme";
import {
  ErrorBoundary,
  DialogProvider,
  GlobalSnackbar,
} from "@/components/common";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { DownloadManagerProvider } from "@/providers/DownloadManagerProvider";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineAwareActions } from "@/hooks/useOfflineAwareActions";
import { useNotificationRegistration } from "@/hooks/useNotificationRegistration";
import { useNotificationResponseHandler } from "@/hooks/useNotificationResponseHandler";
import { useQuietHoursManager } from "@/hooks/useQuietHoursManager";
import { useApiLoggerLifecycle } from "@/hooks/useApiLoggerLifecycle";
import { useVoiceCommandHandler } from "@/hooks/useVoiceCommandHandler";
import { useServiceLifecycleCoordination } from "@/hooks/useServiceLifecycleCoordination";
import { useJellyfinSettingsSync } from "@/hooks/useJellyfinSettingsSync";
import { WidgetDrawerProvider } from "@/services/widgetDrawerService";
import { GlobalWidgetDrawer } from "@/components/widgets/GlobalWidgetDrawer";
import { storageInitPromise } from "@/services/storage/MMKVStorage";
import { getPersister } from "@/services/storage/queryClientPersister";
import {
  performStorageMigration,
  cleanupAsyncStorage,
} from "@/utils/storage.migration";
import { registerAllTools } from "@/services/ai/tools";

// Disable Reanimated strict mode warnings for mixed Animated API usage
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const RootLayout = () => {
  const theme = useTheme();
  const clerkPublishableKey = useMemo(() => getClerkPublishableKey(), []);
  const [storageReady, setStorageReady] = useState(false);
  const [persisterReady, setPersisterReady] = useState(false);
  const [persister, setPersister] = useState<Persister | null>(null);

  // Initialize storage at startup (eager detection)
  useEffect(() => {
    // Use the module-level storage init promise so initialization begins on import.
    let mounted = true;
    const initializeStorage = async () => {
      try {
        await storageInitPromise;

        // Perform silent migration if needed
        const migrationResult = await performStorageMigration();
        if (migrationResult.itemsFailed > 0) {
          console.warn(
            `[RootLayout] Storage migration had ${migrationResult.itemsFailed} failures`,
            migrationResult.errors,
          );
        }

        // Clean up old AsyncStorage data after successful migration
        await cleanupAsyncStorage();

        // Initialize AI tools after storage is ready
        try {
          registerAllTools();
          console.log("[RootLayout] AI tools registered successfully");
        } catch (error) {
          console.error("[RootLayout] Failed to register AI tools", error);
          // Don't block app startup if tool registration fails
        }

        if (mounted) setStorageReady(true);
      } catch (error) {
        console.error("[RootLayout] Storage initialization failed", error);
        // Mark as ready anyway to allow app to continue
        if (mounted) setStorageReady(true);
      }
    };

    initializeStorage();
  }, []);

  // Create and hydrate persister once storage is ready
  useEffect(() => {
    if (!storageReady) return;

    let mounted = true;

    const setupPersister = async () => {
      try {
        // Use the cached persister factory so creation begins lazily and is shared
        // across the app instead of being recreated in component effects.
        const p = await getPersister();
        if (!mounted) return;
        setPersister(p);

        // Attempt to restore and hydrate queryClient so UI can use cached data immediately
        if (p && typeof p.restoreClient === "function") {
          const restored = await p.restoreClient();
          if (restored) {
            // restored may contain { clientState } or be the raw dehydrated state
            const maybeClientState = (restored as any).clientState ?? restored;
            try {
              hydrate(queryClient, maybeClientState);
            } catch (err) {
              console.warn(
                "[RootLayout] Failed to hydrate queryClient from persister",
                err,
              );
            }
          }
        }
      } catch (error) {
        console.error("[RootLayout] Failed to create query persister", error);
      } finally {
        if (mounted) setPersisterReady(true);
      }
    };

    setupPersister();

    return () => {
      mounted = false;
    };
  }, [storageReady]);

  // Don't render until storage is ready
  if (!storageReady || !persisterReady) {
    return (
      <View style={{ flex: 1, backgroundColor: theme?.colors?.background }}>
        {/* Storage initialization screen */}
      </View>
    );
  }
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
              {persister ? (
                <PersistQueryClientProvider
                  client={queryClient}
                  persistOptions={{ persister }}
                >
                  <PaperProvider theme={theme || defaultTheme}>
                    <Portal.Host>
                      <WidgetDrawerProvider>
                        <DialogProvider>
                          <DownloadManagerProvider
                            managerOptions={{
                              queueConfig: {
                                maxConcurrentDownloads: 3,
                                allowMobileData: false,
                                allowBackgroundDownloads: true,
                                maxStorageUsage: 5 * 1024 * 1024 * 1024, // 5GB
                              },
                              progressUpdateInterval: 1500,
                              enablePersistence: true,
                            }}
                            indicatorPosition="floating"
                            onInitialized={(success) => {
                              console.log(
                                "Download manager initialized:",
                                success,
                              );
                            }}
                            onError={(error) => {
                              console.error(
                                "Download manager initialization failed:",
                                error,
                              );
                            }}
                          >
                            <StatusBar style={theme.dark ? "light" : "dark"} />
                            <ErrorBoundary context={{ location: "RootLayout" }}>
                              <AppContent />
                            </ErrorBoundary>
                            <QueryDevtools />
                            <GlobalSnackbar />
                          </DownloadManagerProvider>
                        </DialogProvider>
                      </WidgetDrawerProvider>
                    </Portal.Host>
                  </PaperProvider>
                </PersistQueryClientProvider>
              ) : (
                <QueryClientProvider client={queryClient}>
                  <PaperProvider theme={theme || defaultTheme}>
                    <Portal.Host>
                      <WidgetDrawerProvider>
                        <DialogProvider>
                          <DownloadManagerProvider
                            managerOptions={{
                              queueConfig: {
                                maxConcurrentDownloads: 3,
                                allowMobileData: false,
                                allowBackgroundDownloads: true,
                                maxStorageUsage: 5 * 1024 * 1024 * 1024, // 5GB
                              },
                              progressUpdateInterval: 1500,
                              enablePersistence: true,
                            }}
                            indicatorPosition="floating"
                            onInitialized={(success) => {
                              console.log(
                                "Download manager initialized:",
                                success,
                              );
                            }}
                            onError={(error) => {
                              console.error(
                                "Download manager initialization failed:",
                                error,
                              );
                            }}
                          >
                            <StatusBar style={theme.dark ? "light" : "dark"} />
                            <ErrorBoundary context={{ location: "RootLayout" }}>
                              <AppContent />
                            </ErrorBoundary>
                            <QueryDevtools />
                            <GlobalSnackbar />
                          </DownloadManagerProvider>
                        </DialogProvider>
                      </WidgetDrawerProvider>
                    </Portal.Host>
                  </PaperProvider>
                </QueryClientProvider>
              )}
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
  useApiLoggerLifecycle();
  useVoiceCommandHandler();
  useServiceLifecycleCoordination();
  useJellyfinSettingsSync();

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
      <GlobalWidgetDrawer />
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
