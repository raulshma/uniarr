import { logger } from "@/services/logger/LoggerService";
import { AIKeyManager, AIKeyConfig } from "./AIKeyManager";

/**
 * Rotation state for a provider's key rotation
 */
export interface KeyRotationState {
  provider: string;
  currentKeyId: string;
  usedKeyIds: string[]; // Keys that have failed (429 errors)
  availableKeyIds: string[]; // Keys that are still available
  lastRotationTime?: number;
  rotationCount: number;
  isRotationBlocked?: boolean; // True if all keys are exhausted
}

/**
 * Manages automatic key rotation when rate limits (429) are encountered
 * Tracks which keys have failed and rotates to the next available key
 */
export class AIKeyRotationManager {
  private static instance: AIKeyRotationManager;
  private keyManager: AIKeyManager;
  private rotationStates: Map<string, KeyRotationState> = new Map();

  private constructor() {
    this.keyManager = AIKeyManager.getInstance();
  }

  static getInstance(): AIKeyRotationManager {
    if (!AIKeyRotationManager.instance) {
      AIKeyRotationManager.instance = new AIKeyRotationManager();
    }
    return AIKeyRotationManager.instance;
  }

  /**
   * Initialize rotation state for a provider with all available keys
   */
  async initializeProvider(
    provider: string,
    availableKeyIds: string[],
  ): Promise<void> {
    if (availableKeyIds.length === 0) {
      logger.warn("No keys available for provider", { provider });
      return;
    }

    // Set first key as current
    const currentKeyId = availableKeyIds[0]!;
    const state: KeyRotationState = {
      provider,
      currentKeyId,
      usedKeyIds: [],
      availableKeyIds: [...availableKeyIds],
      rotationCount: 0,
    };

    this.rotationStates.set(provider, state);

    logger.info("Key rotation state initialized", {
      provider,
      totalKeys: availableKeyIds.length,
      currentKey: currentKeyId,
    });
  }

  /**
   * Get the current active key for a provider
   */
  async getCurrentKey(provider: string): Promise<AIKeyConfig | null> {
    const state = this.rotationStates.get(provider);
    if (!state) {
      logger.warn("No rotation state for provider", { provider });
      return null;
    }

    const keyConfig = await this.keyManager.getKey(state.currentKeyId);
    return keyConfig;
  }

  /**
   * Get the current key ID for a provider
   */
  getCurrentKeyId(provider: string): string | null {
    const state = this.rotationStates.get(provider);
    return state?.currentKeyId || null;
  }

  /**
   * Handle a 429 (Too Many Requests) error and rotate to next available key
   * Returns the new key config if rotation was successful, null if no more keys
   */
  async handleRateLimitError(provider: string): Promise<AIKeyConfig | null> {
    const state = this.rotationStates.get(provider);
    if (!state) {
      logger.error("No rotation state for provider", { provider });
      return null;
    }

    // Add current key to used list if not already there
    if (!state.usedKeyIds.includes(state.currentKeyId)) {
      state.usedKeyIds.push(state.currentKeyId);
    }

    // Update available keys (remove the one that failed)
    state.availableKeyIds = state.availableKeyIds.filter(
      (id) => id !== state.currentKeyId,
    );

    logger.warn("Key exhausted due to rate limit", {
      provider,
      exhaustedKey: state.currentKeyId,
      remainingKeys: state.availableKeyIds.length,
    });

    // If no more keys available, block rotation
    if (state.availableKeyIds.length === 0) {
      state.isRotationBlocked = true;
      logger.error("All keys exhausted for provider", {
        provider,
        usedKeys: state.usedKeyIds.length,
      });
      return null;
    }

    // Rotate to next available key
    const nextKeyId = state.availableKeyIds[0]!;
    state.currentKeyId = nextKeyId;
    state.lastRotationTime = Date.now();
    state.rotationCount += 1;

    const newKeyConfig = await this.keyManager.getKey(nextKeyId);

    logger.info("Key rotated due to rate limit", {
      provider,
      newKey: nextKeyId,
      rotationCount: state.rotationCount,
      usedKeys: state.usedKeyIds.length,
      totalKeys: state.usedKeyIds.length + state.availableKeyIds.length,
    });

    return newKeyConfig;
  }

  /**
   * Manually reset the rotation state (e.g., when a new day starts or rate limit resets)
   * This allows previously exhausted keys to be used again
   */
  async resetRotationState(provider: string): Promise<void> {
    const state = this.rotationStates.get(provider);
    if (!state) {
      logger.warn("No rotation state to reset", { provider });
      return;
    }

    // Get all available keys for this provider
    const allKeys = await this.keyManager.listKeys();
    const providerKeys = allKeys
      .filter((k) => k.provider === provider)
      .map((k) => k.keyId);

    if (providerKeys.length === 0) {
      logger.warn("No keys found for provider to reset", { provider });
      return;
    }

    // Reset to initial state with all keys available
    state.currentKeyId = providerKeys[0]!;
    state.usedKeyIds = [];
    state.availableKeyIds = [...providerKeys];
    state.lastRotationTime = undefined;
    state.rotationCount = 0;
    state.isRotationBlocked = false;

    logger.info("Key rotation state reset", {
      provider,
      totalKeys: providerKeys.length,
      currentKey: state.currentKeyId,
    });
  }

  /**
   * Get the current rotation state for a provider
   */
  getRotationState(provider: string): KeyRotationState | null {
    return this.rotationStates.get(provider) || null;
  }

  /**
   * Get rotation status for all providers
   */
  getAllRotationStates(): Record<string, KeyRotationState> {
    const states: Record<string, KeyRotationState> = {};
    this.rotationStates.forEach((state, provider) => {
      states[provider] = { ...state };
    });
    return states;
  }

  /**
   * Check if a provider can rotate (has more keys available)
   */
  canRotate(provider: string): boolean {
    const state = this.rotationStates.get(provider);
    if (!state) return false;
    return state.availableKeyIds.length > 0;
  }

  /**
   * Get available keys count for a provider
   */
  getAvailableKeyCount(provider: string): number {
    const state = this.rotationStates.get(provider);
    if (!state) return 0;
    return state.availableKeyIds.length;
  }

  /**
   * Get used (exhausted) keys count for a provider
   */
  getUsedKeyCount(provider: string): number {
    const state = this.rotationStates.get(provider);
    if (!state) return 0;
    return state.usedKeyIds.length;
  }

  /**
   * Remove a specific key from a provider's rotation state
   */
  removeKey(provider: string, keyId: string): void {
    const state = this.rotationStates.get(provider);
    if (!state) {
      return;
    }

    // Remove from both available and used lists
    state.availableKeyIds = state.availableKeyIds.filter((id) => id !== keyId);
    state.usedKeyIds = state.usedKeyIds.filter((id) => id !== keyId);

    // If the removed key was the current one, switch to first available
    if (state.currentKeyId === keyId) {
      if (state.availableKeyIds.length > 0) {
        state.currentKeyId = state.availableKeyIds[0]!;
      } else if (state.usedKeyIds.length > 0) {
        state.currentKeyId = state.usedKeyIds[0]!;
      }
    }

    logger.info("Key removed from rotation state", {
      provider,
      keyId,
      remainingKeys: state.availableKeyIds.length + state.usedKeyIds.length,
    });
  }

  /**
   * Remove a provider's rotation state (when provider is deleted)
   */
  removeProvider(provider: string): void {
    this.rotationStates.delete(provider);
    logger.info("Key rotation state removed", { provider });
  }

  /**
   * Clear rotation state for a specific provider (alias for removeProvider)
   */
  clearProvider(provider: string): void {
    this.removeProvider(provider);
  }

  /**
   * Clear all rotation states
   */
  clearAll(): void {
    this.rotationStates.clear();
    logger.info("All key rotation states cleared");
  }
}
