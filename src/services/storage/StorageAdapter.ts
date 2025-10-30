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

import { StorageBackendManager } from "./MMKVStorage";
import type { IStorage } from "./MMKVStorage";

/**
 * Unified storage adapter that delegates to the active backend
 * Initialized by StorageBackendManager during app startup
 */
class StorageAdapter implements IStorage {
  private getActiveAdapter(): IStorage {
    const manager = StorageBackendManager.getInstance();

    if (!manager.isInitialized()) {
      throw new Error(
        "Storage adapter not initialized. Ensure StorageBackendManager.getInstance().initialize() is called in app/_layout.tsx",
      );
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
