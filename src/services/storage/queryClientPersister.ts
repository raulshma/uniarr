import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageBackendManager } from "./MMKVStorage";
import { logger } from "@/services/logger/LoggerService";
import type { Persister } from "@tanstack/react-query-persist-client";

const PERSIST_KEY = "uniarr:react-query";

/**
 * Create a Persister for TanStack Query that prefers MMKV (sync) and
 * falls back to AsyncStorage (async). Uses the repo logger to warn
 * once when falling back.
 */
export async function createQueryClientPersister(): Promise<Persister> {
  const manager = StorageBackendManager.getInstance();

  // Prefer MMKV sync persister when available
  if (manager.isMMKV()) {
    const mmkv = manager.getMMKVInstance();
    if (mmkv) {
      const syncAdapter = {
        getItem: (key: string) => {
          try {
            const value = mmkv.getString(key);
            return value === undefined ? null : value;
          } catch (error) {
            logger.error("[QueryPersister] MMKV getItem failed", {
              key,
              error,
            });
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            mmkv.set(key, value);
          } catch (error) {
            logger.error("[QueryPersister] MMKV setItem failed", {
              key,
              error,
            });
          }
        },
        removeItem: (key: string) => {
          try {
            mmkv.remove(key);
          } catch (error) {
            logger.error("[QueryPersister] MMKV removeItem failed", {
              key,
              error,
            });
          }
        },
      };

      return createSyncStoragePersister({
        storage: syncAdapter,
        key: PERSIST_KEY,
      });
    }
  }

  // Fallback to AsyncStorage persister
  logger.warn(
    "[QueryPersister] MMKV not available — using AsyncStorage for react-query persistence",
  );

  const asyncPersister: Persister = {
    persistClient: async (client) => {
      try {
        await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(client));
      } catch (error) {
        logger.error(
          "[QueryPersister] Failed to persist client to AsyncStorage",
          { error },
        );
      }
    },
    restoreClient: async () => {
      try {
        const raw = await AsyncStorage.getItem(PERSIST_KEY);
        if (!raw) return undefined;
        try {
          return JSON.parse(raw);
        } catch (error) {
          logger.error("[QueryPersister] Failed to parse persisted client", {
            error,
          });
          return undefined;
        }
      } catch (error) {
        logger.error(
          "[QueryPersister] Failed to restore persisted client from AsyncStorage",
          {
            error,
          },
        );
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await AsyncStorage.removeItem(PERSIST_KEY);
      } catch (error) {
        logger.error(
          "[QueryPersister] Failed to remove persisted client from AsyncStorage",
          {
            error,
          },
        );
      }
    },
  };

  return asyncPersister;
}

export default createQueryClientPersister;

// Singleton wrapper: cache a single persister instance so callers can await
// the same persister without recreating it repeatedly. This is useful for
// performing app-wide initialization before mounting providers.
let _persisterPromise: Promise<Persister> | null = null;

export function getPersister(): Promise<Persister> {
  if (!_persisterPromise) {
    _persisterPromise = (async () => {
      try {
        const p = await createQueryClientPersister();
        return p;
      } catch (err) {
        logger.error("[QueryPersister] Failed to create persister singleton", {
          error: err,
        });
        // Re-throw so callers can handle as needed
        throw err;
      }
    })();
  }

  return _persisterPromise;
}
