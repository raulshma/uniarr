import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "UniArr",
  slug: "uniarr",
  scheme: "uniarr",
  owner: "throwaway0acc",
  version: "0.0.1",
  orientation: "portrait",
  icon: "./assets/icon.png",
  newArchEnabled: true,
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.uniarr.app",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.raulshma.uniarr",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
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
      "expo-web-browser",
      {
        // Disable web-browser plugin for web platform
        disableWeb: true,
      },
    ],
  ],
  extra: {
    ...config.extra,
    eas: {
      projectId: "35355a36-e839-42ed-866f-8e4b1f4b5600",
    },
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  },
});
