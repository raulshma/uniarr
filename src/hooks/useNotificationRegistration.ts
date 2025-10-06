import { useEffect } from 'react';

import { pushNotificationService } from '@/services/notifications/PushNotificationService';
import { serviceHealthMonitor } from '@/services/notifications/ServiceHealthMonitor';
import { logger } from '@/services/logger/LoggerService';
import {
  selectNotificationsEnabled,
  selectServiceHealthNotificationsEnabled,
  useSettingsStore,
} from '@/store/settingsStore';

export const useNotificationRegistration = (): void => {
  const notificationsEnabled = useSettingsStore(selectNotificationsEnabled);
  const serviceHealthNotificationsEnabled = useSettingsStore(selectServiceHealthNotificationsEnabled);

  useEffect(() => {
    void pushNotificationService.initialize();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const shouldMonitorHealth = notificationsEnabled && serviceHealthNotificationsEnabled;

    if (!notificationsEnabled) {
      serviceHealthMonitor.stop();
      void pushNotificationService.unregister();
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      const token = await pushNotificationService.ensureRegistered();
      if (!token && isMounted) {
        await logger.warn('Push notifications enabled but device token unavailable.', {
          location: 'useNotificationRegistration.ensureRegistered',
        });
      }
    })();

    if (shouldMonitorHealth) {
      serviceHealthMonitor.start();
    } else {
      serviceHealthMonitor.stop();
    }

    return () => {
      isMounted = false;
    };
  }, [notificationsEnabled, serviceHealthNotificationsEnabled]);
};
