import * as SecureStore from "expo-secure-store";
import { logger } from "@/services/logger/LoggerService";

export type AIProvider = "google" | "openai" | "anthropic" | "openrouter";

export interface AIKeyConfig {
  provider: AIProvider;
  apiKey: string;
  modelName?: string;
  isDefault?: boolean;
  createdAt: number;
  lastUsed?: number;
}

export interface AIKeyValidationResult {
  isValid: boolean;
  error?: string;
}

const SECURE_STORE_PREFIX = "ai_key_";
const KEYS_INDEX_KEY = "ai_keys_index";

/**
 * Manages secure storage and retrieval of AI API keys
 * Uses Expo SecureStore for encrypted storage
 */
export class AIKeyManager {
  private static instance: AIKeyManager;

  private constructor() {}

  static getInstance(): AIKeyManager {
    if (!AIKeyManager.instance) {
      AIKeyManager.instance = new AIKeyManager();
    }
    return AIKeyManager.instance;
  }

  /**
   * Store an API key securely
   */
  async storeKey(config: AIKeyConfig): Promise<void> {
    try {
      // Validate the key first
      const validation = this.validateKey(config.apiKey, config.provider);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid API key format");
      }

      // Ensure createdAt is canonical and used for the storage key id
      const createdAt = config.createdAt ?? Date.now();
      const keyId = this.generateKeyId(config.provider, createdAt);
      const storageKey = `${SECURE_STORE_PREFIX}${keyId}`;

      // Store the encrypted key; include createdAt so callers can rely on it
      await SecureStore.setItemAsync(
        storageKey,
        JSON.stringify({
          ...config,
          createdAt,
          storedAt: Date.now(),
        }),
      );

      // Update the index of stored keys
      await this.addKeyToIndex(keyId);

      logger.info("AI key stored securely", {
        provider: config.provider,
        keyId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to store AI key", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Retrieve a stored API key
   */
  async getKey(keyId: string): Promise<AIKeyConfig | null> {
    try {
      const storageKey = `${SECURE_STORE_PREFIX}${keyId}`;
      const stored = await SecureStore.getItemAsync(storageKey);

      if (!stored) {
        return null;
      }

      const config = JSON.parse(stored) as AIKeyConfig;
      return config;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to retrieve AI key", { error: errorMessage, keyId });
      return null;
    }
  }

  /**
   * List all stored API keys (without revealing the actual keys)
   */
  async listKeys(): Promise<
    ({ keyId: string } & Omit<AIKeyConfig, "apiKey">)[]
  > {
    try {
      const indexStr = await SecureStore.getItemAsync(KEYS_INDEX_KEY);
      if (!indexStr) {
        return [];
      }

      const keyIds = JSON.parse(indexStr) as string[];
      const keys: ({ keyId: string } & Omit<AIKeyConfig, "apiKey">)[] = [];

      for (const keyId of keyIds) {
        const config = await this.getKey(keyId);
        if (config) {
          const { apiKey, ...safeConfig } = config;
          keys.push({ keyId, ...safeConfig });
        }
      }

      return keys;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to list AI keys", { error: errorMessage });
      return [];
    }
  }

  /**
   * List all stored API keys for a specific provider (without revealing the actual keys)
   */
  async listKeysForProvider(
    provider: AIProvider,
  ): Promise<({ keyId: string } & Omit<AIKeyConfig, "apiKey">)[]> {
    try {
      const allKeys = await this.listKeys();
      return allKeys.filter((key) => key.provider === provider);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to list keys for provider", {
        error: errorMessage,
        provider,
      });
      return [];
    }
  }

  /**
   * Get all key IDs for a specific provider
   */
  async getKeyIdsForProvider(provider: AIProvider): Promise<string[]> {
    try {
      const keys = await this.listKeysForProvider(provider);
      return keys.map((k) => k.keyId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to get key IDs for provider", {
        error: errorMessage,
        provider,
      });
      return [];
    }
  }

  /**
   * Set a specific key as default and unset default flag for other keys of the same provider
   */
  async setKeyAsDefault(keyId: string): Promise<void> {
    try {
      const config = await this.getKey(keyId);
      if (!config) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Get all keys for this provider
      const allKeys = await this.listKeysForProvider(config.provider);

      // Update all other keys to not be default
      for (const key of allKeys) {
        if (key.keyId !== keyId) {
          const keyConfig = await this.getKey(key.keyId);
          if (keyConfig && keyConfig.isDefault) {
            const updatedConfig = { ...keyConfig, isDefault: false };
            const storageKey = `${SECURE_STORE_PREFIX}${key.keyId}`;
            await SecureStore.setItemAsync(
              storageKey,
              JSON.stringify(updatedConfig),
            );
          }
        }
      }

      // Set the target key as default
      const updatedConfig = { ...config, isDefault: true };
      const storageKey = `${SECURE_STORE_PREFIX}${keyId}`;
      await SecureStore.setItemAsync(storageKey, JSON.stringify(updatedConfig));

      logger.info("Key set as default", { keyId, provider: config.provider });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to set key as default", {
        error: errorMessage,
        keyId,
      });
      throw error;
    }
  }

  /**
   * Clear default flag for all keys of a provider
   */
  async clearDefaultForProvider(provider: AIProvider): Promise<void> {
    try {
      const keys = await this.listKeysForProvider(provider);

      for (const key of keys) {
        const config = await this.getKey(key.keyId);
        if (config && config.isDefault) {
          const updatedConfig = { ...config, isDefault: false };
          const storageKey = `${SECURE_STORE_PREFIX}${key.keyId}`;
          await SecureStore.setItemAsync(
            storageKey,
            JSON.stringify(updatedConfig),
          );
        }
      }

      logger.info("Cleared default for all keys", { provider });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to clear default", {
        error: errorMessage,
        provider,
      });
      throw error;
    }
  }

  /**
   * Delete a stored API key
   */
  async deleteKey(keyId: string): Promise<void> {
    try {
      const storageKey = `${SECURE_STORE_PREFIX}${keyId}`;
      await SecureStore.deleteItemAsync(storageKey);

      // Remove from index
      await this.removeKeyFromIndex(keyId);

      logger.info("AI key deleted", { keyId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to delete AI key", { error: errorMessage, keyId });
      throw error;
    }
  }

  /**
   * Delete all keys for a specific provider
   */
  async deleteKeysForProvider(provider: AIProvider): Promise<number> {
    try {
      const indexStr = await SecureStore.getItemAsync(KEYS_INDEX_KEY);
      if (!indexStr) {
        return 0;
      }

      const keyIds = JSON.parse(indexStr) as string[];
      let removed = 0;

      for (const keyId of keyIds) {
        const config = await this.getKey(keyId);
        if (config?.provider === provider) {
          await this.deleteKey(keyId);
          removed += 1;
        }
      }

      return removed;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to delete keys for provider", {
        error: errorMessage,
        provider,
      });
      throw error;
    }
  }

  /**
   * Update the last used timestamp for a key
   */
  async updateLastUsed(keyId: string): Promise<void> {
    try {
      const config = await this.getKey(keyId);
      if (!config) {
        throw new Error("Key not found");
      }

      const updatedConfig = {
        ...config,
        lastUsed: Date.now(),
      };

      const storageKey = `${SECURE_STORE_PREFIX}${keyId}`;
      await SecureStore.setItemAsync(storageKey, JSON.stringify(updatedConfig));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to update last used timestamp", {
        error: errorMessage,
        keyId,
      });
      throw error;
    }
  }

  /**
   * Clear all stored keys (destructive operation)
   */
  async clearAllKeys(): Promise<void> {
    try {
      const keys = await this.listKeys();
      for (const key of keys) {
        // listKeys now returns keyId along with metadata
        await this.deleteKey(key.keyId);
      }

      await SecureStore.deleteItemAsync(KEYS_INDEX_KEY);
      logger.info("All AI keys cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to clear all keys", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Validate an API key format and length
   */
  private validateKey(
    apiKey: string,
    provider: AIProvider,
  ): AIKeyValidationResult {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        isValid: false,
        error: "API key cannot be empty",
      };
    }

    // Provider-specific validation
    switch (provider) {
      case "google":
        // Google API keys are typically 39 characters
        if (apiKey.length < 20) {
          return {
            isValid: false,
            error: "Google API key seems too short",
          };
        }
        break;

      case "openai":
        // OpenAI keys start with 'sk-'
        if (!apiKey.startsWith("sk-")) {
          return {
            isValid: false,
            error: 'OpenAI key should start with "sk-"',
          };
        }
        break;

      case "anthropic":
        // Anthropic keys start with 'sk-ant-'
        if (!apiKey.startsWith("sk-ant-")) {
          return {
            isValid: false,
            error: 'Anthropic key should start with "sk-ant-"',
          };
        }
        break;

      case "openrouter":
        // OpenRouter keys start with 'sk-or-'
        if (!apiKey.startsWith("sk-or-")) {
          return {
            isValid: false,
            error: 'OpenRouter key should start with "sk-or-"',
          };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Private helper: Add key ID to the index
   */
  private async addKeyToIndex(keyId: string): Promise<void> {
    try {
      const indexStr = await SecureStore.getItemAsync(KEYS_INDEX_KEY);
      const keyIds = indexStr ? JSON.parse(indexStr) : [];

      if (!keyIds.includes(keyId)) {
        keyIds.push(keyId);
        await SecureStore.setItemAsync(KEYS_INDEX_KEY, JSON.stringify(keyIds));
      }
    } catch (error) {
      logger.error("Failed to add key to index", { error });
    }
  }

  /**
   * Private helper: Remove key ID from the index
   */
  private async removeKeyFromIndex(keyId: string): Promise<void> {
    try {
      const indexStr = await SecureStore.getItemAsync(KEYS_INDEX_KEY);
      if (!indexStr) return;

      const keyIds = JSON.parse(indexStr) as string[];
      const filtered = keyIds.filter((id) => id !== keyId);
      await SecureStore.setItemAsync(KEYS_INDEX_KEY, JSON.stringify(filtered));
    } catch (error) {
      logger.error("Failed to remove key from index", { error });
    }
  }

  /**
   * Private helper: Generate consistent key IDs
   */
  private generateKeyId(provider: AIProvider, createdAt: number): string {
    return `${provider}_${createdAt}`;
  }

  /**
   * Ensure the stored index and each stored JSON are consistent.
   * - Removes index entries that point to missing storage keys
   * - For entries where the stored JSON has a differing createdAt, normalize
   *   the JSON to use the timestamp found in the storage key id so the
   *   keyId -> createdAt mapping is consistent.
   */
  async ensureIndexConsistent(): Promise<void> {
    try {
      const indexStr = await SecureStore.getItemAsync(KEYS_INDEX_KEY);
      if (!indexStr) return;

      const keyIds = JSON.parse(indexStr) as string[];
      const validKeyIds: string[] = [];

      for (const keyId of keyIds) {
        const storageKey = `${SECURE_STORE_PREFIX}${keyId}`;
        const stored = await SecureStore.getItemAsync(storageKey);
        if (!stored) {
          // orphaned index entry; skip
          continue;
        }

        try {
          const config = JSON.parse(stored) as AIKeyConfig;
          // If createdAt in JSON does not match the keyId suffix, normalize it
          const parts = keyId.split("_");
          const suffix = parts[parts.length - 1];
          const parsed = Number(suffix);
          if (!Number.isNaN(parsed) && config.createdAt !== parsed) {
            const normalized = {
              ...config,
              createdAt: parsed,
              storedAt: Date.now(),
            };
            await SecureStore.setItemAsync(
              storageKey,
              JSON.stringify(normalized),
            );
          }

          validKeyIds.push(keyId);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // Malformed JSON; skip this entry
          continue;
        }
      }

      // persist a cleaned index
      await SecureStore.setItemAsync(
        KEYS_INDEX_KEY,
        JSON.stringify(validKeyIds),
      );
    } catch (error) {
      logger.error("Failed to normalize AI keys index", { error });
    }
  }
}
