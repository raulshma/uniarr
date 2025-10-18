import { useEffect } from "react";
import { widgetService } from "@/services/widgets/WidgetService";
import { logger } from "@/services/logger/LoggerService";

/**
 * Hook to initialize the WidgetService when the component mounts.
 * This ensures widgets are ready as early as possible to avoid showing
 * "No widgets enabled" on initial load.
 */
export const useWidgetServiceInitialization = (): void => {
  useEffect(() => {
    const initializeWidgetService = async () => {
      try {
        await widgetService.initialize();
        logger.debug(
          "[useWidgetServiceInitialization] WidgetService initialized",
        );
      } catch (error) {
        logger.error(
          "[useWidgetServiceInitialization] Failed to initialize WidgetService",
          {
            error,
          },
        );
      }
    };

    initializeWidgetService();
  }, []);
};
