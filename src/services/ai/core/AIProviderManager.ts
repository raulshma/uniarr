import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logger } from "@/services/logger/LoggerService";
import {
  AIProviderType,
  AI_PROVIDER_MODELS,
  AI_PROVIDERS,
} from "@/types/ai/AIProvider";
import { AIKeyManager, AIKeyConfig } from "./AIKeyManager";

export interface AIProviderInstance {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  isValid: boolean;
  error?: string;
}

/**
 * Manages AI provider selection and initialization
 * Supports multiple providers (Google Gemini, OpenAI, Anthropic, etc.)
 */
export class AIProviderManager {
  private static instance: AIProviderManager;
  private keyManager: AIKeyManager;
  private currentProvider: AIProviderInstance | null = null;
  private providers: Map<AIProviderType, AIProviderInstance> = new Map();

  private constructor() {
    this.keyManager = AIKeyManager.getInstance();
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

      for (const keyEntry of storedKeys) {
        // listKeys now returns an object containing the actual storage keyId
        const keyId = keyEntry.keyId;
        const fullConfig = await this.keyManager.getKey(keyId);

        if (fullConfig) {
          await this.registerProvider(fullConfig);
        }
      }

      logger.info("AI provider manager initialized", {
        providersCount: this.providers.size,
      });
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
  async registerProvider(config: AIKeyConfig): Promise<void> {
    try {
      const provider = config.provider;
      const apiKey = config.apiKey;
      const modelName = config.modelName || this.getDefaultModel(provider);

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
        isDefault: this.currentProvider === providerInstance,
      });
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
   * Remove a provider and its stored keys
   */
  async removeProvider(provider: AIProviderType): Promise<void> {
    try {
      // Remove any stored keys for this provider via key manager
      const removedKeys = await this.keyManager.deleteKeysForProvider(provider);

      // Remove from in-memory provider map
      this.providers.delete(provider);

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
      this.currentProvider = null;
      logger.info("All providers cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to clear providers", { error: errorMessage });
      throw error;
    }
  }
}
