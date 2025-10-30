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

import { logger } from "@/services/logger/LoggerService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from "react-native-mmkv";

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
      logger.error("[MMKVStorage] Failed to get item", { key, error });
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.storage.set(key, value);
    } catch (error) {
      logger.error("[MMKVStorage] Failed to set item", { key, error });
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.storage.remove(key);
    } catch (error) {
      logger.error("[MMKVStorage] Failed to remove item", {
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
      logger.error("[MMKVStorage] Failed to get all keys", { error });
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      this.storage.clearAll();
    } catch (error) {
      logger.error("[MMKVStorage] Failed to clear storage", { error });
      throw error;
    }
  }
}

/**
 * AsyncStorage Adapter
 * Provides compatibility layer for AsyncStorage (used as fallback)
 */
class AsyncStorageAdapter implements IStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      logger.error("[AsyncStorageAdapter] Failed to get item", {
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
      logger.error("[AsyncStorageAdapter] Failed to set item", {
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
      logger.error("[AsyncStorageAdapter] Failed to remove item", {
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
      logger.error("[AsyncStorageAdapter] Failed to get all keys", {
        error,
      });
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      logger.error("[AsyncStorageAdapter] Failed to clear storage", {
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
      logger.debug("[StorageBackendManager] Storage already initialized", {
        backend: this.backend,
      });
      return;
    }

    try {
      const mmkvInstance = createMMKV({ id: "uniarr-storage" });

      // Verify MMKV works by testing a basic operation
      mmkvInstance.set("__test__", "__test__");
      mmkvInstance.remove("__test__");

      this.adapter = new MMKVStorageAdapter(mmkvInstance);
      this.backend = "mmkv";

      logger.info("[StorageBackendManager] Using MMKV storage backend");
    } catch (error) {
      logger.warn(
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
   * Check if initialization is complete
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export { StorageBackendManager, IStorage, StorageBackend };
export default StorageBackendManager;
