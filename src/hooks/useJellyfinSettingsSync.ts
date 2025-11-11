import { useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { secureStorage } from "@/services/storage/SecureStorage";
import { extractJellyfinAddress } from "@/utils/jellyfin.utils";
import { logger } from "@/services/logger/LoggerService";

/**
 * Automatically populates Jellyfin server addresses in settings store
 * when the app loads or when services are reloaded.
 *
 * This ensures the "View on Jellyfin" deep linking feature works
 * by extracting the URL from configured Jellyfin connectors.
 */
export const useJellyfinSettingsSync = (): void => {
  const setJellyfinLocalAddress = useSettingsStore(
    (state) => state.setJellyfinLocalAddress,
  );
  const setJellyfinPublicAddress = useSettingsStore(
    (state) => state.setJellyfinPublicAddress,
  );

  useEffect(() => {
    let isMounted = true;

    const syncJellyfinAddresses = async () => {
      try {
        const configs = await secureStorage.getServiceConfigs();
        if (!isMounted) return;

        // Find first enabled Jellyfin service
        const jellyfinConfig = configs.find(
          (config) => config.type === "jellyfin" && config.enabled,
        );

        if (jellyfinConfig) {
          const address = extractJellyfinAddress(jellyfinConfig);
          if (address) {
            setJellyfinLocalAddress(address);
            setJellyfinPublicAddress(address);
          }
        }
      } catch (error) {
        void logger.warn("Failed to sync Jellyfin addresses from settings.", {
          location: "useJellyfinSettingsSync",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void syncJellyfinAddresses();

    return () => {
      isMounted = false;
    };
  }, [setJellyfinLocalAddress, setJellyfinPublicAddress]);
};
