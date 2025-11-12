import { useEffect } from "react";
import { AppState } from "react-native";

import { apiLogger } from "@/services/logger/ApiLoggerService";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Manages the API logger service lifecycle.
 *
 * Starts periodic cleanup when the app comes to the foreground and stops it
 * when the app goes to the background. The lifecycle only runs when at least
 * one of the API logger features (error or AI logging) is enabled.
 */
export const useApiLoggerLifecycle = (): void => {
  const apiLoggerEnabled = useSettingsStore((state) => state.apiLoggerEnabled);
  const apiLoggerAiLoggingEnabled = useSettingsStore(
    (state) => state.apiLoggerAiLoggingEnabled,
  );

  const lifecycleActive = apiLoggerEnabled || apiLoggerAiLoggingEnabled;

  useEffect(() => {
    if (!lifecycleActive) {
      apiLogger.stop();
      return;
    }

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        void apiLogger.start();
      } else {
        apiLogger.stop();
      }
    });

    return () => {
      subscription.remove();
      apiLogger.stop();
    };
  }, [lifecycleActive]);
};
