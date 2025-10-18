import { useEffect } from "react";
import { AppState } from "react-native";

import { quietHoursService } from "@/services/notifications/QuietHoursService";
import { useSettingsStore } from "@/store/settingsStore";

export const useQuietHoursManager = (): void => {
  const quietHours = useSettingsStore((state) => state.quietHours);
  const bypassCriticalAlerts = useSettingsStore(
    (state) => state.criticalHealthAlertsBypassQuietHours,
  );

  useEffect(() => {
    void quietHoursService.initialize();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        void quietHoursService.flushDueSummaries();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void quietHoursService.onQuietHoursChanged();
  }, [quietHours, bypassCriticalAlerts]);
};
