import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "UniArr",
  slug: "uniarr",
  scheme: "uniarr",
  owner: "throwaway0acc",
  version: "0.4.2",
  orientation: "portrait",
  icon: "./assets/icon.png",
  newArchEnabled: true,
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1F1F1F", // Dark theme background
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.uniarr.app",
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      // File sharing configuration - allows access to Downloads folder via Files app
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      // Siri Shortcuts Configuration
      NSSiriUsageDescription:
        "UniArr uses Siri to help you manage your media library with voice commands.",
      NSUserActivityTypes: [
        "com.uniarr.app.search",
        "com.uniarr.app.services",
        "com.uniarr.app.downloads",
        "com.uniarr.app.add",
        "com.uniarr.app.requests",
      ],
    },
    associatedDomains: ["applinks:uniarr.com"],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1F1F1F", // Dark theme background
    },
    package: "com.raulshma.uniarr",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // Permissions for file system access
    permissions: [
      "android.permission.INTERNET",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      // For Android 11+ scoped storage - access to Downloads
      "android.permission.MANAGE_EXTERNAL_STORAGE",
    ],
    intentFilters: [
      {
        action: "VIEW",
        data: [
          {
            scheme: "uniarr",
            path: "/auth/callback",
          },
          // Also allow bare scheme for backward compatibility
          {
            scheme: "uniarr",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-build-properties",
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          buildArchs: ["arm64-v8a"],
          usesCleartextTraffic: true,
          // Enable storage access for downloads
          enableRoomDependency: true,
        },
      },
    ],
    [
      "expo-web-browser",
      {
        // Disable web-browser plugin for web platform
        disableWeb: true,
      },
    ],
    [
      "expo-screen-orientation",
      {
        initialOrientation: "DEFAULT",
      },
    ],
    ["react-native-localize", { locales: ["en"] }],
  ],
  extra: {
    ...config.extra,
    eas: {
      projectId: "35355a36-e839-42ed-866f-8e4b1f4b5600",
    },
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  },
});
