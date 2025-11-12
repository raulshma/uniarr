import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import * as SecureStore from "expo-secure-store";

describe("AI provider persistence and rehydration", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    // in-memory mock for expo-secure-store
    store = new Map();

    // @ts-ignore
    SecureStore.getItemAsync.mockImplementation(async (key: string) => {
      return store.has(key) ? (store.get(key) as string) : null;
    });
    // @ts-ignore
    SecureStore.setItemAsync.mockImplementation(
      async (key: string, value: string) => {
        store.set(key, value);
      },
    );
    // Support both deleteItemAsync and removeItemAsync in different mock shapes
    // @ts-ignore
    if (SecureStore.deleteItemAsync) {
      // @ts-ignore
      SecureStore.deleteItemAsync.mockImplementation(async (key: string) => {
        store.delete(key);
      });
    }
    // @ts-ignore
    if (SecureStore.removeItemAsync) {
      // @ts-ignore
      SecureStore.removeItemAsync.mockImplementation(async (key: string) => {
        store.delete(key);
      });
    }
  });

  afterEach(async () => {
    // Reset singletons by reloading modules to avoid cross-test state
    jest.resetModules();
  });

  it("stores a key and rehydrates provider as default after initialize", async () => {
    const keyManager = AIKeyManager.getInstance();
    const providerManager = AIProviderManager.getInstance();

    const createdAt = Date.now();

    const config = {
      provider: "openai",
      apiKey: "sk-test-1234567890",
      // use a model that exists in AI_PROVIDER_MODELS for OpenAI
      modelName: "gpt-4-turbo",
      isDefault: true,
      createdAt,
    } as any;

    await keyManager.storeKey(config);

    // Ensure the secure store contains index and stored key
    const keysArray = Array.from(store.keys());
    // There should be at least two entries: one for the stored key and one for the index
    expect(keysArray.some((k) => k.startsWith("ai_key_"))).toBe(true);
    expect(keysArray).toContain("ai_keys_index");

    // Simulate app reload: initialize provider manager which should read stored keys
    await providerManager.initialize();

    const active = providerManager.getActiveProvider();
    expect(active).not.toBeNull();
    expect(active?.provider).toBe("openai");
  });
});
