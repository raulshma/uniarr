import { AIKeyManager, AIKeyConfig } from "@/services/ai/core/AIKeyManager";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { AIKeyRotationManager } from "@/services/ai/core/AIKeyRotationManager";
import * as SecureStore from "expo-secure-store";

// Mock secure store
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("Key Rotation Integration Tests", () => {
  let keyManager: AIKeyManager;
  let providerManager: AIProviderManager;
  let rotationManager: AIKeyRotationManager;

  // Mock storage
  const storage: Record<string, string> = {};

  beforeEach(async () => {
    // Clear storage
    Object.keys(storage).forEach((key) => delete storage[key]);

    // Setup mocks
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value;
        return Promise.resolve();
      },
    );

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      (key: string) => {
        return Promise.resolve(storage[key] || null);
      },
    );

    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
      (key: string) => {
        delete storage[key];
        return Promise.resolve();
      },
    );

    // Get fresh instances
    keyManager = AIKeyManager.getInstance();
    providerManager = AIProviderManager.getInstance();
    rotationManager = AIKeyRotationManager.getInstance();
  });

  describe("Multiple Keys Configuration", () => {
    it("should allow storing multiple keys for the same provider", async () => {
      const key1: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-1",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now(),
      };

      const key2: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-2",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now() + 1000,
      };

      await keyManager.storeKey(key1);
      await keyManager.storeKey(key2);

      const keys = await keyManager.listKeysForProvider("google");
      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.provider)).toEqual(["google", "google"]);
    });

    it("should retrieve correct keys for a specific provider", async () => {
      const googleKey: AIKeyConfig = {
        provider: "google",
        apiKey: "google-key",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now(),
      };

      const openaiKey: AIKeyConfig = {
        provider: "openai",
        apiKey: "sk-openai",
        modelName: "gpt-4",
        createdAt: Date.now(),
      };

      await keyManager.storeKey(googleKey);
      await keyManager.storeKey(openaiKey);

      const googleKeys = await keyManager.listKeysForProvider("google");
      const openaiKeys = await keyManager.listKeysForProvider("openai");

      expect(googleKeys).toHaveLength(1);
      expect(openaiKeys).toHaveLength(1);
      expect(googleKeys[0]?.provider).toBe("google");
      expect(openaiKeys[0]?.provider).toBe("openai");
    });
  });

  describe("Key Rotation on Rate Limit", () => {
    it("should initialize rotation state with all available keys", async () => {
      const keyIds = ["key1", "key2", "key3"];
      await rotationManager.initializeProvider("google", keyIds);

      const state = rotationManager.getRotationState("google");
      expect(state?.currentKeyId).toBe("key1");
      expect(state?.availableKeyIds).toHaveLength(3);
      expect(state?.usedKeyIds).toHaveLength(0);
    });

    it("should rotate to next key on 429 error", async () => {
      const keyIds = ["key1", "key2", "key3"];
      await rotationManager.initializeProvider("google", keyIds);

      const nextKey = await rotationManager.handleRateLimitError("google");

      const state = rotationManager.getRotationState("google");
      expect(state?.currentKeyId).toBe("key2");
      expect(state?.usedKeyIds).toContain("key1");
      expect(state?.availableKeyIds).toHaveLength(2);
      expect(nextKey).not.toBeNull();
    });

    it("should track used keys correctly", async () => {
      const keyIds = ["key1", "key2", "key3"];
      await rotationManager.initializeProvider("google", keyIds);

      // First rotation
      await rotationManager.handleRateLimitError("google");
      let state = rotationManager.getRotationState("google");
      expect(state?.usedKeyIds).toEqual(["key1"]);
      expect(rotationManager.getUsedKeyCount("google")).toBe(1);

      // Second rotation
      await rotationManager.handleRateLimitError("google");
      state = rotationManager.getRotationState("google");
      expect(state?.usedKeyIds).toEqual(["key1", "key2"]);
      expect(rotationManager.getUsedKeyCount("google")).toBe(2);
    });

    it("should return null when all keys are exhausted", async () => {
      const keyIds = ["key1", "key2"];
      await rotationManager.initializeProvider("google", keyIds);

      // First rotation
      let nextKey = await rotationManager.handleRateLimitError("google");
      expect(nextKey).not.toBeNull();

      // Second rotation - should fail
      nextKey = await rotationManager.handleRateLimitError("google");
      expect(nextKey).toBeNull();

      const state = rotationManager.getRotationState("google");
      expect(state?.isRotationBlocked).toBe(true);
      expect(state?.availableKeyIds).toHaveLength(0);
    });

    it("should reset rotation state when requested", async () => {
      const keyIds = ["key1", "key2", "key3"];
      await rotationManager.initializeProvider("google", keyIds);

      // Rotate keys to exhaust some
      await rotationManager.handleRateLimitError("google");
      await rotationManager.handleRateLimitError("google");

      let state = rotationManager.getRotationState("google");
      expect(state?.usedKeyIds).toHaveLength(2);

      // Reset
      await rotationManager.resetRotationState("google");

      state = rotationManager.getRotationState("google");
      expect(state?.currentKeyId).toBe("key1");
      expect(state?.usedKeyIds).toHaveLength(0);
      expect(state?.availableKeyIds).toHaveLength(3);
      expect(state?.isRotationBlocked).toBe(false);
    });

    it("should report rotation availability correctly", async () => {
      const keyIds = ["key1", "key2"];
      await rotationManager.initializeProvider("google", keyIds);

      expect(rotationManager.canRotate("google")).toBe(true);
      expect(rotationManager.getAvailableKeyCount("google")).toBe(2);

      // After one rotation
      await rotationManager.handleRateLimitError("google");
      expect(rotationManager.canRotate("google")).toBe(true);
      expect(rotationManager.getAvailableKeyCount("google")).toBe(1);

      // After exhausting all keys
      await rotationManager.handleRateLimitError("google");
      expect(rotationManager.canRotate("google")).toBe(false);
      expect(rotationManager.getAvailableKeyCount("google")).toBe(0);
    });
  });

  describe("Provider Manager Integration", () => {
    it("should initialize providers with rotation state", async () => {
      const key1: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-1",
        modelName: "gemini-2.5-flash",
        isDefault: true,
        createdAt: Date.now(),
      };

      const key2: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-2",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now() + 1000,
      };

      await keyManager.storeKey(key1);
      await keyManager.storeKey(key2);

      await providerManager.initialize();

      const rotationState = providerManager.getRotationState("google");
      expect(rotationState?.availableKeyIds).toHaveLength(2);
      expect(rotationState?.currentKeyId).toBeTruthy();
    });

    it("should provide access to all provider keys", async () => {
      const key1: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-1",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now(),
      };

      const key2: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-2",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now() + 1000,
      };

      await keyManager.storeKey(key1);
      await keyManager.storeKey(key2);

      const keys = providerManager.getProviderKeys("google");
      expect(keys).toHaveLength(2);
    });

    it("should report available and used key counts", async () => {
      const key1: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-1",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now(),
      };

      const key2: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-2",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now() + 1000,
      };

      await keyManager.storeKey(key1);
      await keyManager.storeKey(key2);

      await providerManager.initialize();

      expect(providerManager.getAvailableKeyCount("google")).toBe(2);
      expect(providerManager.getUsedKeyCount("google")).toBe(0);
    });

    it("should rotate provider key on demand", async () => {
      const key1: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-1",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now(),
      };

      const key2: AIKeyConfig = {
        provider: "google",
        apiKey: "test-key-2",
        modelName: "gemini-2.5-flash",
        createdAt: Date.now() + 1000,
      };

      await keyManager.storeKey(key1);
      await keyManager.storeKey(key2);

      await providerManager.initialize();

      const initialState = providerManager.getRotationState("google");
      const initialKeyId = initialState?.currentKeyId;

      const rotated = await providerManager.rotateToNextKey("google");

      expect(rotated).not.toBeNull();
      const newState = providerManager.getRotationState("google");
      expect(newState?.currentKeyId).not.toBe(initialKeyId);
    });
  });

  describe("Clean up", () => {
    it("should remove provider rotation state when provider is deleted", async () => {
      const keyIds = ["key1", "key2"];
      await rotationManager.initializeProvider("google", keyIds);

      expect(rotationManager.getRotationState("google")).not.toBeNull();

      rotationManager.removeProvider("google");

      expect(rotationManager.getRotationState("google")).toBeNull();
    });

    it("should clear all rotation states", async () => {
      await rotationManager.initializeProvider("google", ["key1", "key2"]);
      await rotationManager.initializeProvider("openai", ["key3"]);

      let states = rotationManager.getAllRotationStates();
      expect(Object.keys(states)).toHaveLength(2);

      rotationManager.clearAll();

      states = rotationManager.getAllRotationStates();
      expect(Object.keys(states)).toHaveLength(0);
    });
  });
});
