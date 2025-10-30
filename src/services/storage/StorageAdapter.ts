/**
 * Unified Storage Adapter
 *
 * Provides a single interface for all storage operations in the app.
 * Automatically uses the initialized backend (MMKV or AsyncStorage) from StorageBackendManager.
 * This adapter is used throughout the codebase by services, hooks, and state management.
 *
 * Usage:
 * import { storageAdapter } from '@/services/storage/StorageAdapter';
 *
 * // Use like AsyncStorage
 * await storageAdapter.getItem('key');
 * await storageAdapter.setItem('key', 'value');
 * await storageAdapter.removeItem('key');
 * await storageAdapter.clear();
 */

import { StorageBackendManager, AsyncStorageAdapter } from "./MMKVStorage";
import { logger } from "@/services/logger/LoggerService";
import type { IStorage } from "./MMKVStorage";

/**
 * Unified storage adapter that delegates to the active backend
 * Initialized by StorageBackendManager during app startup
 */
class StorageAdapter implements IStorage {
  private fallbackAdapter: IStorage | null = null;
  private fallbackWarned = false;

  private getActiveAdapter(): IStorage {
    const manager = StorageBackendManager.getInstance();

    // If storage manager hasn't finished initialization yet, use AsyncStorage
    // as a safe fallback so rehydration and early reads don't throw.
    if (!manager.isInitialized()) {
      if (!this.fallbackAdapter) {
        this.fallbackAdapter = new AsyncStorageAdapter();
      }
      // Log a single warning so developers know MMKV/native NitroModules
      // are not available and AsyncStorage is being used instead.
      if (!this.fallbackWarned) {
        logger.warn(
          "[StorageAdapter] MMKV backend not yet initialized — using AsyncStorage fallback. This may be expected in Expo Go.",
        );
        this.fallbackWarned = true;
      }
      return this.fallbackAdapter;
    }

    return manager.getAdapter();
  }

  async getItem(key: string): Promise<string | null> {
    return this.getActiveAdapter().getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.getActiveAdapter().setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this.getActiveAdapter().removeItem(key);
  }

  async getAllKeys(): Promise<string[]> {
    return this.getActiveAdapter().getAllKeys();
  }

  async clear(): Promise<void> {
    return this.getActiveAdapter().clear();
  }

  /**
   * Get current backend type (for debugging/logging)
   */
  getBackendType(): "mmkv" | "asyncstorage" {
    return StorageBackendManager.getInstance().getBackend();
  }

  /**
   * Check if using MMKV
   */
  isUsingMMKV(): boolean {
    return StorageBackendManager.getInstance().isMMKV();
  }
}

// Export singleton instance
export const storageAdapter = new StorageAdapter();

export default storageAdapter;
