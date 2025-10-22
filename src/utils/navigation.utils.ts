import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { validateDateString } from "./calendar.utils";

/**
 * Navigation utilities for consistent routing patterns across the app
 */

export interface NavigationOptions {
  replace?: boolean;
  validateParams?: boolean;
  fallbackRoute?: string;
}

/**
 * Type-safe navigation utility with parameter validation
 */
export function navigateToRoute<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  router: ReturnType<typeof useRouter>,
  route: string,
  params?: T,
  options: NavigationOptions = {},
): void {
  const {
    replace = false,
    validateParams = true,
    fallbackRoute = "/(auth)/dashboard",
  } = options;

  try {
    // Validate route format
    if (!route.startsWith("/") || !route.includes("(")) {
      console.warn("Invalid route format:", route);
      if (replace) {
        router.replace(fallbackRoute);
      } else {
        router.push(fallbackRoute);
      }
      return;
    }

    // Validate parameters if required
    if (validateParams && params) {
      const missingParams = Object.entries(params)
        .filter(
          ([, value]) => value === undefined || value === null || value === "",
        )
        .map(([key]) => key);

      if (missingParams.length > 0) {
        console.warn("Missing required navigation parameters:", missingParams);
        Alert.alert(
          "Navigation Error",
          "Missing required information to navigate to this page.",
        );
        return;
      }
    }

    // Build route with parameters
    let finalRoute = route;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.set(key, String(value));
        }
      });

      if (query.toString()) {
        finalRoute += `?${query.toString()}`;
      }
    }

    // Navigate
    if (replace) {
      router.replace(finalRoute);
    } else {
      router.push(finalRoute);
    }
  } catch (error) {
    console.error("Navigation failed:", error);
    Alert.alert(
      "Navigation Error",
      "Unable to navigate to the requested page.",
    );
  }
}

/**
 * Safe navigation utility that won't cause infinite loops
 */
export function safeNavigate(
  router: ReturnType<typeof useRouter>,
  route: string,
  params?: Record<string, unknown>,
): void {
  // Prevent navigation to the same route
  if (router.canGoBack()) {
    // This is a simple check - in a real implementation, you'd want to track current route
    navigateToRoute(router, route, params, { replace: false });
  } else {
    navigateToRoute(router, route, params, { replace: true });
  }
}

/**
 * Navigate back safely
 */
export function navigateBack(
  router: ReturnType<typeof useRouter>,
  fallbackRoute = "/(auth)/dashboard",
): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    navigateToRoute(router, fallbackRoute, undefined, { replace: true });
  }
}

/**
 * Common navigation patterns
 */
export const NAVIGATION_ROUTES = {
  // Dashboard
  DASHBOARD: "/(auth)/(tabs)/dashboard",
  DASHBOARD_SEARCH: "/(auth)/dashboard/search",

  // Services
  SERVICES: "/(auth)/(tabs)/services",
  ADD_SERVICE: "/(auth)/add-service",
  EDIT_SERVICE: "/(auth)/edit-service",

  // Downloads
  DOWNLOADS: "/(auth)/(tabs)/downloads",
  RECENTLY_ADDED: "/(auth)/(tabs)/recently-added",

  // Media detail routes
  SONARR_SERIES: (serviceId: string, id: number) =>
    `/(auth)/sonarr/[serviceId]/series/[id]`,
  RADARR_MOVIE: (serviceId: string, id: number) =>
    `/(auth)/radarr/[serviceId]/movies/[id]`,
  JELLYFIN_ITEM: (serviceId: string, itemId: number) =>
    `/(auth)/jellyfin/[serviceId]/details/[itemId]`,
  JELLYSEERR_MEDIA: (serviceId: string, mediaType: string, mediaId: number) =>
    `/(auth)/jellyseerr/[serviceId]/[mediaType]/[mediaId]`,

  // Discovery
  DISCOVER: "/(auth)/discover",
  DISCOVER_SECTION: (sectionId: string) =>
    `/(auth)/discover/section/[sectionId]`,
  DISCOVER_TMDB: "/(auth)/discover/tmdb",
  DISCOVER_TMDB_MEDIA: (mediaType: string, tmdbId: number) =>
    `/(auth)/discover/tmdb/[mediaType]/[tmdbId]`,

  // Calendar
  CALENDAR: "/(auth)/calendar",
  CALENDAR_WITH_DATE: (date: string) => `/(auth)/calendar?date=${date}`,

  // Anime
  ANIME_HUB: "/(auth)/anime-hub",
  ANIME_DETAIL: (malId: number) => `/(auth)/anime-hub/[malId]`,

  // Settings
  SETTINGS: "/(auth)/(tabs)/settings",
  SETTINGS_THEME: "/(auth)/settings/theme-editor",
  SETTINGS_BACKUP: "/(auth)/settings/backup-export",
  SETTINGS_NOTIFICATIONS: "/(auth)/settings/quiet-hours",
  SETTINGS_VOICE: "/(auth)/settings/voice-assistant",

  // Search
  SEARCH: "/(auth)/search",

  // Analytics
  ANALYTICS: "/(auth)/analytics",

  // Network tools
  NETWORK_SCAN: "/(auth)/network-scan",

  // Person details
  PERSON: (personId: number) => `/(auth)/person/[personId]`,
} as const;

/**
 * Route validation utilities
 */
export const ROUTE_VALIDATORS = {
  isServiceRoute: (route: string): boolean => {
    return (
      route.includes("/sonarr/") ||
      route.includes("/radarr/") ||
      route.includes("/qbittorrent/") ||
      route.includes("/jellyseerr/") ||
      route.includes("/jellyfin/") ||
      route.includes("/prowlarr/") ||
      route.includes("/bazarr/") ||
      route.includes("/adguard/")
    );
  },

  isMediaRoute: (route: string): boolean => {
    return (
      route.includes("/series/") ||
      route.includes("/movies/") ||
      route.includes("/details/") ||
      route.includes("/tmdb/") ||
      route.includes("/person/")
    );
  },

  isProtectedRoute: (route: string): boolean => {
    return route.startsWith("/(auth)/");
  },

  extractRouteParams: (route: string): Record<string, string> => {
    const params: Record<string, string> = {};
    const url = new URL(route, "http://placeholder.com");
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  },
} as const;

/**
 * Calendar navigation utilities
 */
export const createCalendarNavigation = () => ({
  navigateToCalendar: (router: ReturnType<typeof useRouter>, date?: string) => {
    if (date && validateDateString(date)) {
      navigateToRoute(router, NAVIGATION_ROUTES.CALENDAR_WITH_DATE(date), {
        date,
      });
    } else {
      navigateToRoute(router, NAVIGATION_ROUTES.CALENDAR);
    }
  },

  navigateToToday: (router: ReturnType<typeof useRouter>) => {
    const today = new Date().toISOString().split("T")[0];
    if (today) {
      navigateToRoute(router, NAVIGATION_ROUTES.CALENDAR_WITH_DATE(today), {
        date: today,
      });
    }
  },
});

/**
 * Navigation hooks for common patterns
 */
export const createServiceNavigation = (serviceType: string) => ({
  navigateToDetail: (
    router: ReturnType<typeof useRouter>,
    serviceId: string,
    itemId: number,
  ) => {
    switch (serviceType) {
      case "sonarr":
        navigateToRoute(
          router,
          NAVIGATION_ROUTES.SONARR_SERIES(serviceId, itemId),
          {
            serviceId,
            id: itemId.toString(),
          },
        );
        break;
      case "radarr":
        navigateToRoute(
          router,
          NAVIGATION_ROUTES.RADARR_MOVIE(serviceId, itemId),
          {
            serviceId,
            id: itemId.toString(),
          },
        );
        break;
      case "jellyfin":
        navigateToRoute(
          router,
          NAVIGATION_ROUTES.JELLYFIN_ITEM(serviceId, itemId),
          {
            serviceId,
            itemId: itemId.toString(),
          },
        );
        break;
      default:
        console.warn("Unknown service type for navigation:", serviceType);
    }
  },

  navigateToService: (
    router: ReturnType<typeof useRouter>,
    serviceId: string,
  ) => {
    navigateToRoute(router, `/(${serviceType})/[serviceId]`, { serviceId });
  },
});
