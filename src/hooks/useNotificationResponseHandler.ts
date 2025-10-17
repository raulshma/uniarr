import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

import { logger } from "@/services/logger/LoggerService";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/models/notification.types";

const ROUTE_MAP: Record<NotificationCategory, string> = {
  downloads: "/(auth)/(tabs)/downloads",
  failures: "/(auth)/(tabs)/downloads",
  requests: "/(auth)/(tabs)/services",
  serviceHealth: "/(auth)/(tabs)/services",
};

export const useNotificationResponseHandler = (): void => {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        try {
          const data = response.notification.request.content.data ?? {};
          const categoryRaw =
            typeof data.category === "string" ? data.category : undefined;
          const category = normalizeCategory(categoryRaw);

          if (!category) {
            return;
          }

          const targetRoute = ROUTE_MAP[category];
          router.push(targetRoute);
        } catch (error) {
          void logger.error("Failed to handle notification response.", {
            location: "useNotificationResponseHandler.listener",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);
};

const normalizeCategory = (
  category: string | undefined,
): NotificationCategory | null => {
  if (!category) {
    return null;
  }

  if (category in NOTIFICATION_CATEGORIES) {
    return category as NotificationCategory;
  }

  return null;
};
