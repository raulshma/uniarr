import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logger } from "@/services/logger/LoggerService";
import {
  AIProviderType,
  AI_PROVIDER_MODELS,
  AI_PROVIDERS,
} from "@/types/ai/AIProvider";
import { AIKeyManager, AIKeyConfig } from "./AIKeyManager";
import { AIKeyRotationManager } from "./AIKeyRotationManager";

export interface AIProviderInstance {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  keyId: string; // Track which key ID is being used
  isValid: boolean;
  error?: string;
}

/**
 * Manages AI provider selection and initialization
 * Supports multiple providers (Google Gemini, OpenAI, Anthropic, etc.)
 * Implements automatic key rotation on rate limit (429) errors
 */
export class AIProviderManager {
  private static instance: AIProviderManager;
  private keyManager: AIKeyManager;
  private rotationManager: AIKeyRotationManager;
  private currentProvider: AIProviderInstance | null = null;
  private providers: Map<AIProviderType, AIProviderInstance> = new Map();
  private providerKeyMap: Map<AIProviderType, string[]> = new Map(); // Track all keys per provider
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.keyManager = AIKeyManager.getInstance();
    this.rotationManager = AIKeyRotationManager.getInstance();
  }

  static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager();
    }
    return AIProviderManager.instance;
  }

  /**
   * Initialize providers from stored keys
   */
  async initialize(): Promise<void> {
    try {
      // Normalize stored index and entries before loading providers
      await this.keyManager.ensureIndexConsistent();

      const storedKeys = await this.keyManager.listKeys();

      // Group keys by provider
      const keysByProvider: Map<AIProviderType, string[]> = new Map();
      for (const keyEntry of storedKeys) {
        const provider = keyEntry.provider as AIProviderType;
        if (!keysByProvider.has(provider)) {
          keysByProvider.set(provider, []);
        }
        keysByProvider.get(provider)!.push(keyEntry.keyId);
      }

      // Register providers and initialize rotation
      for (const [provider, keyIds] of keysByProvider) {
        this.providerKeyMap.set(provider, keyIds);
        await this.rotationManager.initializeProvider(
          provider as string,
          keyIds,
        );

        // Find the default key for this provider, or use the first one
        let keyIdToRegister = keyIds[0]!;
        for (const keyId of keyIds) {
          const fullConfig = await this.keyManager.getKey(keyId);
          if (fullConfig?.isDefault) {
            keyIdToRegister = keyId;
            break;
          }
        }

        const fullConfig = await this.keyManager.getKey(keyIdToRegister);
        if (fullConfig) {
          await this.registerProvider(fullConfig, keyIdToRegister);
        }
      }

      logger.info("AI provider manager initialized", {
        providersCount: this.providers.size,
        totalKeys: storedKeys.length,
      });

      this.notifyListeners();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to initialize provider manager", {
        error: errorMessage,
      });
    }
  }

  /**
   * Register a provider with an API key
   */
  async registerProvider(config: AIKeyConfig, keyId?: string): Promise<void> {
    try {
      const provider = config.provider;
      const apiKey = config.apiKey;
      const modelName = config.modelName || this.getDefaultModel(provider);
      const actualKeyId = keyId || `${provider}_${config.createdAt}`;

      // Validate that model is available for provider
      const availableModels = AI_PROVIDER_MODELS[provider] || [];
      if (!availableModels.includes(modelName)) {
        throw new Error(
          `Model ${modelName} not available for ${provider}. Available: ${availableModels.join(", ")}`,
        );
      }

      const providerInstance: AIProviderInstance = {
        provider,
        model: modelName,
        apiKey,
        keyId: actualKeyId,
        isValid: true,
      };

      this.providers.set(provider, providerInstance);

      // Set as default if specified or if it's the first one
      if (config.isDefault || this.currentProvider === null) {
        this.currentProvider = providerInstance;
      }

      logger.info("AI provider registered", {
        provider,
        model: modelName,
        keyId: actualKeyId,
        isDefault: this.currentProvider === providerInstance,
      });

      this.notifyListeners();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to register provider", {
        error: errorMessage,
        provider: config.provider,
      });
      throw error;
    }
  }

  /**
   * Set the active provider
   */
  setActiveProvider(provider: AIProviderType): boolean {
    const instance = this.providers.get(provider);
    if (!instance) {
      logger.warn("Provider not found", { provider });
      return false;
    }

    this.currentProvider = instance;
    logger.info("Active provider changed", { provider });
    this.notifyListeners();
    return true;
  }

  /**
   * Get the currently active provider
   */
  getActiveProvider(): AIProviderInstance | null {
    return this.currentProvider;
  }

  /**
   * Get a specific provider instance
   */
  getProvider(provider: AIProviderType): AIProviderInstance | null {
    return this.providers.get(provider) || null;
  }

  /**
   * List all registered providers
   */
  listProviders(): AIProviderInstance[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: AIProviderType): string[] {
    return AI_PROVIDER_MODELS[provider] || [];
  }

  /**
   * Get provider information
   */
  getProviderInfo(provider: AIProviderType) {
    return AI_PROVIDERS[provider];
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: AIProviderType): boolean {
    return (
      this.providers.has(provider) && this.providers.get(provider)!.isValid
    );
  }

  /**
   * Remove a specific provider key by ID
   */
  async removeProviderKey(keyId: string): Promise<void> {
    try {
      // Get the key to find its provider type
      const config = await this.keyManager.getKey(keyId);
      if (!config) {
        throw new Error(`Key not found: ${keyId}`);
      }

      const provider = config.provider;

      // Delete the specific key from secure storage
      await this.keyManager.deleteKey(keyId);

      // Remove from providerKeyMap
      const providerKeys = this.providerKeyMap.get(provider);
      if (providerKeys) {
        const filtered = providerKeys.filter((id) => id !== keyId);
        this.providerKeyMap.set(provider, filtered);
      }

      // Notify rotation manager
      await this.rotationManager.removeKey(provider as string, keyId);

      // Check if provider has any remaining keys
      const remainingKeyIds = this.providerKeyMap.get(provider) || [];
      if (remainingKeyIds.length === 0) {
        // If no more keys for this provider, remove it completely
        this.providers.delete(provider);

        // If it was the active provider, switch to another
        if (this.currentProvider?.provider === provider) {
          const remaining = Array.from(this.providers.values());
          this.currentProvider =
            remaining.length > 0 ? (remaining[0] as AIProviderInstance) : null;
        }
      } else {
        // Register the next available key if the removed one was active
        const rotationState = this.rotationManager.getRotationState(
          provider as string,
        );
        if (
          rotationState?.currentKeyId === keyId &&
          remainingKeyIds.length > 0
        ) {
          const nextKeyId = remainingKeyIds[0]!;
          const nextConfig = await this.keyManager.getKey(nextKeyId);
          if (nextConfig) {
            await this.registerProvider(nextConfig, nextKeyId);
          }
        }
      }

      logger.info("Provider key removed", {
        keyId,
        provider,
      });

      this.notifyListeners();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to remove provider key", {
        error: errorMessage,
        keyId,
      });
      throw error;
    }
  }

  /**
   * Remove a provider and its stored keys
   */
  async removeProvider(provider: AIProviderType): Promise<void> {
    try {
      // Remove any stored keys for this provider via key manager
      const removedKeys = await this.keyManager.deleteKeysForProvider(provider);

      // Remove from in-memory provider map
      this.providers.delete(provider);
      this.providerKeyMap.delete(provider);

      // Clear rotation state
      this.rotationManager.clearProvider(provider as string);

      // If removed provider was active, switch to first available
      if (this.currentProvider?.provider === provider) {
        const remaining = Array.from(this.providers.values());
        this.currentProvider =
          remaining.length > 0 ? (remaining[0] as AIProviderInstance) : null;
      }

      logger.info("Provider removed", {
        provider,
        removedKeys,
      });

      this.notifyListeners();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to remove provider", {
        error: errorMessage,
        provider,
      });
      throw error;
    }
  }

  /**
   * Perform health check on a provider
   */
  async healthCheck(provider: AIProviderType): Promise<{
    isHealthy: boolean;
    error?: string;
    responseTime?: number;
  }> {
    try {
      const instance = this.providers.get(provider);
      if (!instance) {
        return {
          isHealthy: false,
          error: `Provider ${provider} not registered`,
        };
      }

      const startTime = Date.now();

      // Try to create a model instance (basic validation)
      if (provider === "google") {
        // Use createGoogleGenerativeAI with the API key
        const googleProvider = createGoogleGenerativeAI({
          apiKey: instance.apiKey,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const modelInstance = googleProvider(instance.model);
        // Just instantiating validates the connection
      } else {
        // TODO: Add support for other providers
        return {
          isHealthy: false,
          error: `Health check not implemented for ${provider}`,
        };
      }

      const responseTime = Date.now() - startTime;

      return {
        isHealthy: true,
        responseTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Health check failed", { error: errorMessage, provider });
      return {
        isHealthy: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the model instance for current provider (for streaming/generation)
   * Uses createGoogleGenerativeAI to ensure the API key is properly configured
   */
  getModelInstance() {
    if (!this.currentProvider) {
      throw new Error("No active AI provider configured");
    }

    const { provider, model, apiKey } = this.currentProvider;

    if (provider === "google") {
      // Create a provider instance with the configured API key
      const googleProvider = createGoogleGenerativeAI({
        apiKey: apiKey,
      });
      return googleProvider(model);
    }

    // TODO: Add support for other providers
    throw new Error(`Provider ${provider} not yet implemented`);
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: AIProviderType): string {
    const models = AI_PROVIDER_MODELS[provider];
    return models?.[0] || "unknown";
  }

  /**
   * Clear all providers
   */
  async clearAll(): Promise<void> {
    try {
      this.providers.clear();
      this.providerKeyMap.clear();
      this.currentProvider = null;
      this.rotationManager.clearAll();
      logger.info("All providers cleared");

      this.notifyListeners();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to clear providers", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Rotate to the next available key for a provider (handles 429 rate limit errors)
   * Returns the new provider instance if rotation was successful
   */
  async rotateToNextKey(
    provider: AIProviderType,
  ): Promise<AIProviderInstance | null> {
    try {
      const nextKeyConfig = await this.rotationManager.handleRateLimitError(
        provider as string,
      );

      if (!nextKeyConfig) {
        logger.error("Unable to rotate to next key - all keys exhausted", {
          provider,
        });
        return null;
      }

      // Register the new key as the active provider
      const nextKeyId = this.rotationManager.getCurrentKeyId(provider);
      await this.registerProvider(nextKeyConfig, nextKeyId || undefined);

      const newInstance = this.providers.get(provider);
      if (newInstance) {
        // Update current provider if it's the one being rotated
        if (this.currentProvider?.provider === provider) {
          this.currentProvider = newInstance;
        }

        logger.info("Provider key rotated successfully", {
          provider,
          newKeyId: nextKeyId,
        });

        this.notifyListeners();
        return newInstance;
      }

      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to rotate provider key", {
        error: errorMessage,
        provider,
      });
      return null;
    }
  }

  /**
   * Get all keys for a provider
   */
  getProviderKeys(provider: AIProviderType): string[] {
    return this.providerKeyMap.get(provider) || [];
  }

  /**
   * Get rotation state for a provider
   */
  getRotationState(provider: AIProviderType) {
    return this.rotationManager.getRotationState(provider as string);
  }

  /**
   * Check if a provider can rotate (has more keys available)
   */
  canRotate(provider: AIProviderType): boolean {
    return this.rotationManager.canRotate(provider as string);
  }

  /**
   * Get available keys count for a provider
   */
  getAvailableKeyCount(provider: AIProviderType): number {
    return this.rotationManager.getAvailableKeyCount(provider as string);
  }

  /**
   * Get used (exhausted) keys count for a provider
   */
  getUsedKeyCount(provider: AIProviderType): number {
    return this.rotationManager.getUsedKeyCount(provider as string);
  }

  /**
   * Subscribe to provider state changes. Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (this.listeners.size === 0) {
      return;
    }

    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("AIProviderManager listener threw", { error: message });
      }
    }
  }
}
