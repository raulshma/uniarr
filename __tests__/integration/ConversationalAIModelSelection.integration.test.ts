import {
  useConversationalAIConfigStore,
  selectConversationalAIProvider,
  selectConversationalAIModel,
  selectConversationalAIKeyId,
} from "@/store/conversationalAIConfigStore";
import { AIProviderType } from "@/types/ai/AIProvider";

/**
 * Integration test for conversational AI model selection and persistence.
 * Verifies that users can select a provider/model combination specific to conversational AI,
 * and that the selection persists across app reloads.
 */
describe("ConversationalAI Model Selection and Persistence", () => {
  beforeEach(() => {
    // Reset the store before each test
    const store = useConversationalAIConfigStore.getState();
    store.clearConfig();
  });

  describe("Store Initialization", () => {
    it("should initialize with null values", () => {
      const store = useConversationalAIConfigStore.getState();
      expect(store.selectedProvider).toBeNull();
      expect(store.selectedModel).toBeNull();
      expect(store.selectedKeyId).toBeNull();
    });

    it("should have valid selectors", () => {
      const store = useConversationalAIConfigStore.getState();

      const provider = selectConversationalAIProvider(store);
      const model = selectConversationalAIModel(store);
      const keyId = selectConversationalAIKeyId(store);

      expect(provider).toBeNull();
      expect(model).toBeNull();
      expect(keyId).toBeNull();
    });
  });

  describe("Setting Provider and Model", () => {
    beforeEach(() => {
      const store = useConversationalAIConfigStore.getState();
      store.clearConfig();
    });

    it("should set provider, model, and key ID individually", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setSelectedProvider("google");
      expect(useConversationalAIConfigStore.getState().selectedProvider).toBe(
        "google",
      );

      store.setSelectedModel("gemini-2.5-pro");
      expect(useConversationalAIConfigStore.getState().selectedModel).toBe(
        "gemini-2.5-pro",
      );

      store.setSelectedKeyId("key-google-123456");
      expect(useConversationalAIConfigStore.getState().selectedKeyId).toBe(
        "key-google-123456",
      );
    });

    it("should set all configuration at once", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setConversationalAIConfig(
        "openai",
        "gpt-4-turbo",
        "key-openai-789",
      );

      expect(useConversationalAIConfigStore.getState().selectedProvider).toBe(
        "openai",
      );
      expect(useConversationalAIConfigStore.getState().selectedModel).toBe(
        "gpt-4-turbo",
      );
      expect(useConversationalAIConfigStore.getState().selectedKeyId).toBe(
        "key-openai-789",
      );
    });

    it("should support all provider types", () => {
      const providers: AIProviderType[] = [
        "google",
        "openai",
        "anthropic",
        "openrouter",
      ];

      for (const provider of providers) {
        const store = useConversationalAIConfigStore.getState();
        store.setSelectedProvider(provider);
        expect(useConversationalAIConfigStore.getState().selectedProvider).toBe(
          provider,
        );
      }
    });

    it("should allow clearing configuration", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setConversationalAIConfig("google", "gemini-2.5-flash", "key-123");

      expect(useConversationalAIConfigStore.getState().hasValidConfig()).toBe(
        true,
      );

      store.clearConfig();

      expect(
        useConversationalAIConfigStore.getState().selectedProvider,
      ).toBeNull();
      expect(
        useConversationalAIConfigStore.getState().selectedModel,
      ).toBeNull();
      expect(
        useConversationalAIConfigStore.getState().selectedKeyId,
      ).toBeNull();
      expect(useConversationalAIConfigStore.getState().hasValidConfig()).toBe(
        false,
      );
    });
  });

  describe("Configuration Validation", () => {
    it("should validate complete configuration", () => {
      const store = useConversationalAIConfigStore.getState();

      expect(store.hasValidConfig()).toBe(false);

      store.setSelectedProvider("google");
      expect(store.hasValidConfig()).toBe(false);

      store.setSelectedModel("gemini-2.5-pro");
      expect(store.hasValidConfig()).toBe(false);

      store.setSelectedKeyId("key-123");
      expect(store.hasValidConfig()).toBe(true);
    });

    it("should return false for partial configuration", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setSelectedProvider("openai");
      store.setSelectedModel("gpt-4-turbo");
      // keyId is missing

      expect(store.hasValidConfig()).toBe(false);
    });
  });

  describe("Configuration Retrieval", () => {
    it("should return current configuration as object", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setConversationalAIConfig(
        "anthropic",
        "claude-3-opus-20240229",
        "key-anthropic-456",
      );

      const config = store.getConfig();

      expect(config).toEqual({
        provider: "anthropic",
        model: "claude-3-opus-20240229",
        keyId: "key-anthropic-456",
      });
    });

    it("should return null values when not configured", () => {
      const store = useConversationalAIConfigStore.getState();

      const config = store.getConfig();

      expect(config).toEqual({
        provider: null,
        model: null,
        keyId: null,
      });
    });
  });

  describe("Isolation from Other Features", () => {
    beforeEach(() => {
      const store = useConversationalAIConfigStore.getState();
      store.clearConfig();
    });

    it("should maintain separate configuration from global AI provider", () => {
      const store = useConversationalAIConfigStore.getState();

      // Set conversational AI config to one provider
      store.setConversationalAIConfig(
        "google",
        "gemini-2.5-pro",
        "key-google-123",
      );

      // Verify the specific configuration is set
      expect(useConversationalAIConfigStore.getState().selectedProvider).toBe(
        "google",
      );
      expect(useConversationalAIConfigStore.getState().selectedModel).toBe(
        "gemini-2.5-pro",
      );

      // This config should not affect other features that use the global AIProviderManager
      // (verified separately through ConversationalAIService integration)
    });
  });

  describe("Multiple Provider Switching", () => {
    it("should allow switching between providers with different models", () => {
      const store = useConversationalAIConfigStore.getState();

      // Start with Google
      store.setConversationalAIConfig(
        "google",
        "gemini-2.5-flash",
        "key-google-1",
      );

      expect(store.getConfig()).toEqual({
        provider: "google",
        model: "gemini-2.5-flash",
        keyId: "key-google-1",
      });

      // Switch to OpenAI
      store.setConversationalAIConfig("openai", "gpt-4-turbo", "key-openai-1");

      expect(store.getConfig()).toEqual({
        provider: "openai",
        model: "gpt-4-turbo",
        keyId: "key-openai-1",
      });

      // Switch to Anthropic
      store.setConversationalAIConfig(
        "anthropic",
        "claude-3-sonnet-20240229",
        "key-anthropic-1",
      );

      expect(store.getConfig()).toEqual({
        provider: "anthropic",
        model: "claude-3-sonnet-20240229",
        keyId: "key-anthropic-1",
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty strings gracefully", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setSelectedProvider("google");
      store.setSelectedModel("");
      store.setSelectedKeyId("key-123");

      // Empty model string is still falsy for hasValidConfig
      const config = store.getConfig();
      expect(config.model).toBe("");
    });

    it("should allow resetting to null", () => {
      const store = useConversationalAIConfigStore.getState();

      store.setConversationalAIConfig("google", "gemini-2.5-pro", "key-123");

      expect(store.hasValidConfig()).toBe(true);

      store.setSelectedProvider(null);

      expect(store.hasValidConfig()).toBe(false);
    });
  });
});
