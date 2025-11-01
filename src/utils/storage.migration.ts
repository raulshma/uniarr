/**
 * Storage Migration Utilities
 *
 * Handles silent auto-migration from AsyncStorage to MMKV on first app launch.
 * Migration runs transparently during app initialization before UI hydration.
 *
 * Strategy:
 * 1. Check for migration flag in MMKV (indicates previous successful migration)
 * 2. If flag missing, copy all AsyncStorage keys to MMKV
 * 3. Set migration flag to mark completion
 * 4. Optionally clean up old AsyncStorage data after verification
 */

import { logger } from "@/services/logger/LoggerService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageBackendManager } from "../services/storage/MMKVStorage";

const MIGRATION_FLAG_KEY = "__storage_migration_complete__";
const MIGRATED_KEYS_KEY = "__storage_migrated_keys__";
const MIGRATION_BATCH_SIZE = 100;

interface MigrationResult {
  success: boolean;
  itemsMigrated: number;
  itemsFailed: number;
  errors: { key: string; error: string }[];
}

/**
 * Perform silent migration from AsyncStorage to MMKV
 * Should be called during app startup before Zustand/Query hydration
 */
export async function performStorageMigration(): Promise<MigrationResult> {
  const manager = StorageBackendManager.getInstance();

  // Only perform migration if using MMKV backend
  if (!manager.isMMKV()) {
    logger.debug(
      "[StorageMigration] Not using MMKV backend, skipping migration",
    );
    return { success: true, itemsMigrated: 0, itemsFailed: 0, errors: [] };
  }

  try {
    const adapter = manager.getAdapter();

    // Check if migration already completed
    const migrationFlag = await adapter.getItem(MIGRATION_FLAG_KEY);
    if (migrationFlag === "true") {
      logger.debug("[StorageMigration] Migration already completed, skipping");
      return { success: true, itemsMigrated: 0, itemsFailed: 0, errors: [] };
    }

    logger.info("[StorageMigration] Starting AsyncStorage → MMKV migration");

    // Get all keys from AsyncStorage
    const asyncStorageKeys = await AsyncStorage.getAllKeys();

    if (asyncStorageKeys.length === 0) {
      logger.info("[StorageMigration] No AsyncStorage data to migrate");
      // Set flag to mark completion
      await adapter.setItem(MIGRATION_FLAG_KEY, "true");
      return { success: true, itemsMigrated: 0, itemsFailed: 0, errors: [] };
    }

    logger.info(
      `[StorageMigration] Found ${asyncStorageKeys.length} items to migrate`,
    );

    let itemsMigrated = 0;
    let itemsFailed = 0;
    const errors: { key: string; error: string }[] = [];
    const migratedKeys: string[] = [];

    // Migrate in batches to avoid memory issues
    for (let i = 0; i < asyncStorageKeys.length; i += MIGRATION_BATCH_SIZE) {
      const batchKeys = asyncStorageKeys.slice(i, i + MIGRATION_BATCH_SIZE);

      // Fetch all values for batch
      const batchValues = await AsyncStorage.multiGet(batchKeys);

      // Migrate to MMKV; collect successfully migrated keys
      for (const [key, value] of batchValues) {
        if (value !== null) {
          try {
            await adapter.setItem(key, value);
            itemsMigrated++;
            migratedKeys.push(key);
          } catch (error) {
            itemsFailed++;
            errors.push({
              key,
              error: error instanceof Error ? error.message : String(error),
            });
            logger.warn(`[StorageMigration] Failed to migrate key: ${key}`, {
              error,
            });
          }
        }
      }

      // Log progress
      const progress = Math.min(
        i + MIGRATION_BATCH_SIZE,
        asyncStorageKeys.length,
      );
      logger.debug(
        `[StorageMigration] Migration progress: ${progress}/${asyncStorageKeys.length}`,
      );
    }

    // Set migration flag to mark completion
    await adapter.setItem(MIGRATION_FLAG_KEY, "true");

    // Persist the list of migrated keys so cleanup can be targeted. Only
    // persist when there were no failures to avoid partial cleanup.
    if (itemsFailed === 0 && migratedKeys.length > 0) {
      try {
        await adapter.setItem(MIGRATED_KEYS_KEY, JSON.stringify(migratedKeys));
      } catch (err) {
        logger.warn("[StorageMigration] Failed to persist migrated keys list", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info(
      `[StorageMigration] Migration completed: ${itemsMigrated} items migrated, ${itemsFailed} failed`,
    );

    return {
      success: itemsFailed === 0,
      itemsMigrated,
      itemsFailed,
      errors,
    };
  } catch (error) {
    logger.error("[StorageMigration] Migration failed with error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      itemsMigrated: 0,
      itemsFailed: 0,
      errors: [
        {
          key: "MIGRATION",
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

/**
 * Clear old AsyncStorage data after successful migration
 * Should only be called after migration is verified to be complete
 * Optional: Run after first successful app launch with MMKV
 */
export async function cleanupAsyncStorage(): Promise<void> {
  try {
    const manager = StorageBackendManager.getInstance();

    // Only perform cleanup when MMKV is active. If MMKV is not available
    // we must not delete AsyncStorage contents as they may hold user
    // configured settings that are still in use.
    if (!manager.isMMKV()) {
      logger.debug(
        "[StorageCleanup] MMKV not available — skipping AsyncStorage cleanup",
      );
      return;
    }

    const adapter = manager.getAdapter();

    // Ensure migration actually completed and we have a record of migrated keys
    const migrationFlag = await adapter.getItem(MIGRATION_FLAG_KEY);
    if (migrationFlag !== "true") {
      logger.debug(
        "[StorageCleanup] Migration flag missing or false — skipping AsyncStorage cleanup",
      );
      return;
    }

    const migratedKeysJson = await adapter.getItem(MIGRATED_KEYS_KEY);
    if (!migratedKeysJson) {
      logger.debug(
        "[StorageCleanup] No migrated-keys metadata found — skipping AsyncStorage cleanup",
      );
      return;
    }

    let migratedKeys: string[];
    try {
      migratedKeys = JSON.parse(migratedKeysJson) as string[];
    } catch (err) {
      logger.warn(
        "[StorageCleanup] Failed to parse migrated keys metadata — skipping cleanup",
        { error: err instanceof Error ? err.message : String(err) },
      );
      return;
    }

    if (!Array.isArray(migratedKeys) || migratedKeys.length === 0) {
      logger.debug(
        "[StorageCleanup] Migrated keys list empty — nothing to remove",
      );
      return;
    }

    // Intersect migrated keys with current AsyncStorage keys to avoid attempting
    // to remove non-existent keys and to provide accurate logging.
    const existingKeys = await AsyncStorage.getAllKeys();
    const candidateKeys = migratedKeys.filter((k) => existingKeys.includes(k));

    if (candidateKeys.length === 0) {
      logger.debug(
        `[StorageCleanup] No migrated AsyncStorage entries found to remove (checked ${migratedKeys.length} migrated keys)`,
      );
      return;
    }

    // Confirm values still present before removing
    const keyValues = await AsyncStorage.multiGet(candidateKeys);
    const keysToRemove = keyValues
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key]) => key);

    if (keysToRemove.length === 0) {
      logger.debug(
        `[StorageCleanup] No AsyncStorage entries with values found to remove (checked ${candidateKeys.length} candidate keys)`,
      );
      return;
    }

    logger.info(
      `[StorageCleanup] Cleaning up ${keysToRemove.length} migrated AsyncStorage items`,
    );

    try {
      await AsyncStorage.multiRemove(keysToRemove);
      logger.info(
        `[StorageCleanup] AsyncStorage cleanup completed (${keysToRemove.length} items removed)`,
      );
      // Optionally remove the migrated-keys metadata since cleanup finished
      try {
        await adapter.removeItem(MIGRATED_KEYS_KEY);
      } catch (rmErr) {
        // Non-fatal: keep metadata for auditing if removal fails
        logger.debug(
          "[StorageCleanup] Failed to remove migrated-keys metadata after cleanup",
          { error: rmErr instanceof Error ? rmErr.message : String(rmErr) },
        );
      }
    } catch (removeError) {
      logger.warn("[StorageCleanup] Failed to remove some AsyncStorage keys", {
        error:
          removeError instanceof Error
            ? removeError.message
            : String(removeError),
        keysAttempted: keysToRemove,
      });
    }
  } catch (error) {
    logger.warn("[StorageCleanup] Failed to clean up AsyncStorage", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Reset storage migration flag for testing/debugging
 * DO NOT USE IN PRODUCTION
 */
export async function resetMigrationFlag(): Promise<void> {
  try {
    const manager = StorageBackendManager.getInstance();
    const adapter = manager.getAdapter();
    await adapter.removeItem(MIGRATION_FLAG_KEY);
    logger.warn("[StorageMigration] Reset migration flag - for testing only");
  } catch (error) {
    logger.error("[StorageMigration] Failed to reset migration flag", {
      error,
    });
  }
}
