import { useEffect } from "react";
import { AppState } from "react-native";

import { apiErrorLogger } from "@/services/logger/ApiErrorLoggerService";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Manages the API error logger service lifecycle
 *
 * Starts periodic cleanup when app comes to foreground
 * Stops periodic cleanup when app goes to background
 *
 * This hook should be called once in the root layout to ensure
 * the error logger runs periodic cleanup tasks efficiently.
 */
export const useApiErrorLoggerLifecycle = (): void => {
  const apiErrorLoggerEnabled = useSettingsStore(
    (state) => state.apiErrorLoggerEnabled,
  );

  // Initialization happens automatically on first call to start()

  // Manage lifecycle based on app state
  useEffect(() => {
    if (!apiErrorLoggerEnabled) {
      return;
    }

    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        // App came to foreground - start periodic cleanup
        void apiErrorLogger.start();
      } else {
        // App went to background - stop periodic cleanup
        apiErrorLogger.stop();
      }
    });

    return () => {
      subscription.remove();
      // Stop service when hook unmounts
      apiErrorLogger.stop();
    };
  }, [apiErrorLoggerEnabled]);
};
