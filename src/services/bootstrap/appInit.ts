import { storageInitPromise } from "@/services/storage/MMKVStorage";
import { getPersister } from "@/services/storage/queryClientPersister";
import { logger } from "@/services/logger/LoggerService";
import type { Persister } from "@tanstack/react-query-persist-client";

export type AppInitResult = {
  persister?: Persister;
  restoredState?: unknown;
};

/**
 * Explicit app initializer.
 *
 * Call `initApp()` during early startup to ensure storage backend and
 * react-query persister are created in the correct order.
 */
export async function initApp(): Promise<AppInitResult> {
  try {
    // Ensure storage backend is initialized (this may start on import via storageInitPromise)
    await storageInitPromise;

    // Create/get cached persister
    const persister = await getPersister();

    let restored: unknown = undefined;
    if (persister && typeof persister.restoreClient === "function") {
      try {
        restored = await persister.restoreClient();
      } catch (err) {
        logger.warn("[appInit] Failed to restore persisted query client", {
          error: err,
        });
      }
    }

    return { persister, restoredState: restored };
  } catch (err) {
    logger.error("[appInit] App initialization failed", { error: err });
    // Don't throw — caller (UI) can still render fallback and continue.
    return {};
  }
}

export default initApp;
