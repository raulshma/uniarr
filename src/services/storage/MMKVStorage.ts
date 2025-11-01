/**
 * MMKV Storage Singleton with AsyncStorage Fallback
 *
 * Provides eager detection of MMKV availability at startup and falls back to AsyncStorage
 * if MMKV is not available. This abstraction ensures consistent storage behavior across
 * the app with transparent backend selection based on dependencies.
 *
 * Usage: Import and use the singleton instance directly.
 * const mmkvStorage = getInstance();
 * await mmkvStorage.initialize(); // Call during app startup
 */

// Use console for internal storage-layer logging to avoid importing the
// application logger (which would create a circular dependency).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from "react-native-mmkv";
import Constants from "expo-constants";

type StorageBackend = "mmkv" | "asyncstorage";

interface IStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * MMKV Storage Wrapper
 * Wraps react-native-mmkv with a Promise-based API for compatibility with AsyncStorage
 */
class MMKVStorageAdapter implements IStorage {
  private storage: any;

  constructor(mmkvInstance: any) {
    this.storage = mmkvInstance;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const value = this.storage.getString(key);
      return value ?? null;
    } catch (error) {
      console.error("[MMKVStorage] Failed to get item", { key, error });
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.storage.set(key, value);
    } catch (error) {
      console.error("[MMKVStorage] Failed to set item", { key, error });
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.storage.remove(key);
    } catch (error) {
      console.error("[MMKVStorage] Failed to remove item", {
        key,
        error,
      });
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return this.storage.getAllKeys();
    } catch (error) {
      console.error("[MMKVStorage] Failed to get all keys", { error });
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      this.storage.clearAll();
    } catch (error) {
      console.error("[MMKVStorage] Failed to clear storage", { error });
      throw error;
    }
  }
}

/**
 * AsyncStorage Adapter
 * Provides compatibility layer for AsyncStorage (used as fallback)
 */
export class AsyncStorageAdapter implements IStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error("[AsyncStorageAdapter] Failed to get item", {
        key,
        error,
      });
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error("[AsyncStorageAdapter] Failed to set item", {
        key,
        error,
      });
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error("[AsyncStorageAdapter] Failed to remove item", {
        key,
        error,
      });
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return Array.from(await AsyncStorage.getAllKeys());
    } catch (error) {
      console.error("[AsyncStorageAdapter] Failed to get all keys", {
        error,
      });
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error("[AsyncStorageAdapter] Failed to clear storage", {
        error,
      });
      throw error;
    }
  }
}

/**
 * Storage Backend Manager
 * Detects MMKV availability and manages fallback at startup
 */
class StorageBackendManager {
  private static instance: StorageBackendManager;
  private adapter: IStorage | null = null;
  private mmkvInstance: any | undefined;
  private backend: StorageBackend = "asyncstorage";
  private initialized = false;

  private constructor() {}

  static getInstance(): StorageBackendManager {
    if (!StorageBackendManager.instance) {
      StorageBackendManager.instance = new StorageBackendManager();
    }
    return StorageBackendManager.instance;
  }

  /**
   * Initialize storage backend
   * Performs eager detection of MMKV availability and initializes appropriate adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.debug("[StorageBackendManager] Storage already initialized", {
        backend: this.backend,
      });
      return;
    }
    // If running in Expo Go (Constants.appOwnership === 'expo'), the native
    // MMKV / NitroModules will not be available. Detect Expo Go and immediately
    // fall back to AsyncStorage to avoid throwing at startup.
    try {
      if (Constants && Constants.appOwnership === "expo") {
        console.info(
          "[StorageBackendManager] Detected Expo Go (appOwnership=expo). Skipping MMKV and using AsyncStorage fallback",
        );
        this.adapter = new AsyncStorageAdapter();
        this.backend = "asyncstorage";
        this.initialized = true;
        return;
      }
    } catch (err) {
      // If anything goes wrong accessing Constants, continue to attempt MMKV initialization.
      console.debug(
        "[StorageBackendManager] Error checking Constants.appOwnership, proceeding to attempt MMKV",
        { error: err instanceof Error ? err.message : String(err) },
      );
    }

    try {
      const mmkvInstance = createMMKV({ id: "uniarr-storage" });

      // Verify MMKV works by testing a basic operation
      mmkvInstance.set("__test__", "__test__");
      mmkvInstance.remove("__test__");

      this.adapter = new MMKVStorageAdapter(mmkvInstance);
      // keep raw MMKV instance available for sync persisters
      this.mmkvInstance = mmkvInstance;
      this.backend = "mmkv";

      console.info("[StorageBackendManager] Using MMKV storage backend");
    } catch (error) {
      console.warn(
        "[StorageBackendManager] MMKV not available, falling back to AsyncStorage",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      this.adapter = new AsyncStorageAdapter();
      this.backend = "asyncstorage";
    }

    this.initialized = true;
  }

  /**
   * Get current storage adapter
   * Must call initialize() first
   */
  getAdapter(): IStorage {
    if (!this.adapter) {
      throw new Error(
        "Storage adapter not initialized. Call StorageBackendManager.getInstance().initialize() during app startup.",
      );
    }
    return this.adapter;
  }

  /**
   * Get current backend name
   */
  getBackend(): StorageBackend {
    return this.backend;
  }

  /**
   * Check if using MMKV backend
   */
  isMMKV(): boolean {
    return this.backend === "mmkv";
  }

  /**
   * Return the raw MMKV JS instance if available.
   * Useful for sync persisters that require the synchronous MMKV API.
   */
  getMMKVInstance(): any | undefined {
    return this.mmkvInstance;
  }

  /**
   * Check if initialization is complete
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy the storage backend and clean up resources
   * Call this during app shutdown or when storage is no longer needed
   */
  destroy(): void {
    if (this.mmkvInstance) {
      try {
        // MMKV doesn't have an explicit destroy method in the JS API,
        // but clearing reference allows garbage collection
        this.mmkvInstance = undefined;
      } catch (error) {
        console.error("[StorageBackendManager] Error during cleanup", {
          error,
        });
      }
    }
    this.adapter = null;
    this.initialized = false;
  }
}

export { StorageBackendManager, IStorage, StorageBackend };
export default StorageBackendManager;

// Eager initialization helper: promise that begins initialization when the
// module is imported. Consumers can await this to ensure storage is ready
// without having to call initialize() repeatedly from components.
export const storageInitPromise: Promise<void> = (async () => {
  try {
    const manager = StorageBackendManager.getInstance();
    await manager.initialize();
  } catch (err) {
    console.error("[StorageInit] Error during storage initialization", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Initialization errors are logged inside the manager; swallow here so
    // callers can still await without throwing unexpectedly.
  }
})();
