/**
 * Error Details Storage Service
 *
 * Stores detailed error logs (request/response bodies, headers).
 * Uses MMKV when available, falls back to AsyncStorage in Expo Go.
 * Provides lazy initialization and cleanup operations.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from "react-native-mmkv";
import Constants from "expo-constants";
import { logger } from "@/services/logger/LoggerService";

export interface ErrorDetailsRecord {
  id: string;
  errorId: string;
  requestBody?: string;
  responseBody?: string;
  requestHeaders?: string;
  createdAt: string;
}

interface IErrorDetailsStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

/**
 * MMKV Storage Adapter for error details
 */
class MMKVErrorDetailsAdapter implements IErrorDetailsStorage {
  constructor(private storage: any) {}

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.storage.set(key, value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[MMKVErrorDetails] Failed to set item: ${message}`);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const value = this.storage.getString(key);
      return value ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[MMKVErrorDetails] Failed to get item: ${message}`);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.storage.remove(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[MMKVErrorDetails] Failed to remove item: ${message}`);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return this.storage.getAllKeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[MMKVErrorDetails] Failed to get all keys: ${message}`);
    }
  }
}

/**
 * AsyncStorage Adapter for error details (fallback)
 */
class AsyncStorageErrorDetailsAdapter implements IErrorDetailsStorage {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[AsyncStorageErrorDetails] Failed to set item: ${message}`,
      );
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[AsyncStorageErrorDetails] Failed to get item: ${message}`,
      );
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[AsyncStorageErrorDetails] Failed to remove item: ${message}`,
      );
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return Array.from(await AsyncStorage.getAllKeys());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[AsyncStorageErrorDetails] Failed to get all keys: ${message}`,
      );
    }
  }
}

class ErrorDetailsStorage {
  private adapter: IErrorDetailsStorage | null = null;
  private isInitialized = false;

  /**
   * Lazy initialization - called on first use of capture features
   * Detects Expo Go and falls back to AsyncStorage if MMKV unavailable
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.adapter) {
      return;
    }

    try {
      // Check for Expo Go first
      if (Constants && Constants.appOwnership === "expo") {
        logger.debug(
          "ErrorDetailsStorage: Detected Expo Go, using AsyncStorage fallback",
        );
        this.adapter = new AsyncStorageErrorDetailsAdapter();
        this.isInitialized = true;
        return;
      }
    } catch {
      logger.debug(
        "ErrorDetailsStorage: Could not check Constants, attempting MMKV",
      );
    }

    try {
      // Try to initialize MMKV
      const mmkvInstance = createMMKV({ id: "error_details_storage" });

      // Verify MMKV works with a test operation
      mmkvInstance.set("__test__", "__test__");
      mmkvInstance.remove("__test__");

      this.adapter = new MMKVErrorDetailsAdapter(mmkvInstance);
      this.isInitialized = true;
      logger.debug("ErrorDetailsStorage: Using MMKV backend");
    } catch (error) {
      logger.warn(
        "ErrorDetailsStorage: MMKV not available, falling back to AsyncStorage",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      this.adapter = new AsyncStorageErrorDetailsAdapter();
      this.isInitialized = true;
    }
  }

  /**
   * Store error details (bodies and headers)
   */
  async storeErrorDetails(
    errorId: string,
    details: {
      requestBody?: string;
      responseBody?: string;
      requestHeaders?: string;
    },
  ): Promise<void> {
    try {
      await this.ensureInitialized();

      if (!this.adapter) {
        throw new Error("Storage adapter not initialized");
      }

      const record: ErrorDetailsRecord = {
        id: errorId,
        errorId,
        requestBody: details.requestBody,
        responseBody: details.responseBody,
        requestHeaders: details.requestHeaders,
        createdAt: new Date().toISOString(),
      };

      await this.adapter.setItem(
        `error_details:${errorId}`,
        JSON.stringify(record),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("ErrorDetailsStorage: Failed to store error details", {
        error: message,
        errorId,
      });
      // Don't throw - allow main error log to continue even if storage fails
    }
  }

  /**
   * Retrieve error details by error ID
   */
  async getErrorDetails(errorId: string): Promise<ErrorDetailsRecord | null> {
    try {
      await this.ensureInitialized();

      if (!this.adapter) {
        return null;
      }

      const data = await this.adapter.getItem(`error_details:${errorId}`);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as ErrorDetailsRecord;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("ErrorDetailsStorage: Failed to retrieve error details", {
        error: message,
        errorId,
      });
      return null;
    }
  }

  /**
   * Delete error details by error ID
   */
  async deleteErrorDetails(errorId: string): Promise<void> {
    try {
      await this.ensureInitialized();

      if (!this.adapter) {
        return;
      }

      await this.adapter.removeItem(`error_details:${errorId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("ErrorDetailsStorage: Failed to delete error details", {
        error: message,
        errorId,
      });
      // Don't throw - allow cleanup to continue
    }
  }

  /**
   * Delete error details older than specified days
   * Used for retention policy enforcement
   */
  async deleteOldErrorDetails(retentionDays: number): Promise<number> {
    try {
      await this.ensureInitialized();

      if (!this.adapter) {
        return 0;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;
      const allKeys = await this.adapter.getAllKeys();

      for (const key of allKeys) {
        if (!key.startsWith("error_details:")) {
          continue;
        }

        try {
          const data = await this.adapter.getItem(key);
          if (!data) continue;

          const record = JSON.parse(data) as ErrorDetailsRecord;
          const recordDate = new Date(record.createdAt);

          if (recordDate < cutoffDate) {
            await this.adapter.removeItem(key);
            deletedCount++;
          }
        } catch {
          // Skip malformed entries
        }
      }

      if (deletedCount > 0) {
        logger.debug("ErrorDetailsStorage: Deleted old error details", {
          deletedCount,
          retentionDays,
        });
      }

      return deletedCount;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("ErrorDetailsStorage: Failed to delete old error details", {
        error: message,
        retentionDays,
      });
      return 0;
    }
  }

  /**
   * Delete all error details
   */
  async clearAllErrorDetails(): Promise<void> {
    try {
      await this.ensureInitialized();

      if (!this.adapter) {
        return;
      }

      const allKeys = await this.adapter.getAllKeys();
      for (const key of allKeys) {
        if (key.startsWith("error_details:")) {
          await this.adapter.removeItem(key);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("ErrorDetailsStorage: Failed to clear all error details", {
        error: message,
      });
      // Don't throw - allow cleanup to continue
    }
  }
}

// Export singleton instance
export const errorDetailsStorage = new ErrorDetailsStorage();
