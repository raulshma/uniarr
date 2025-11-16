import { ConversationalAIService } from "@/services/ai/conversational-ai/ConversationalAIService";

// Mock out dependencies
jest.mock("@/services/ai/core/AIService");
jest.mock("@/services/ai/core/AIRateLimiter");
jest.mock("@/services/ai/core/AIProviderManager");
jest.mock("@/connectors/manager/ConnectorManager");
jest.mock("@/store/conversationalAIStore");
jest.mock("@/store/conversationalAIConfigStore");
jest.mock("@/services/logger/LoggerService");

describe("ConversationalAIService - Title Generation Provider Logic", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should switch to title provider even if title key id is null and restore previous provider after generation", async () => {
    const service = ConversationalAIService.getInstance();

    // Configure mocked stores
    const configStore = require("@/store/conversationalAIConfigStore");
    configStore.useConversationalAIConfigStore.getState = jest.fn(() => ({
      selectedTitleProvider: "openai",
      selectedTitleModel: "gpt-4-turbo",
      selectedTitleKeyId: null,
      selectedProvider: "google",
      selectedModel: "gemini-2.5-pro",
      selectedKeyId: "key-google-1",
    }));

    // Mock AI provider manager behavior
    const {
      AIProviderManager,
    } = require("@/services/ai/core/AIProviderManager");
    const mockProviderManager = AIProviderManager.getInstance();
    mockProviderManager.getActiveProvider = jest.fn(() => ({
      provider: "google",
      model: "gemini-2.5-pro",
      apiKey: "fake",
      keyId: "key-google-1",
      isValid: true,
    }));
    mockProviderManager.setActiveProvider = jest.fn(() => true);
    mockProviderManager.getProvider = jest.fn().mockReturnValue({
      provider: "openai",
      model: "gpt-4-turbo",
      apiKey: "fake-openai",
      keyId: "key-openai-1",
      isValid: true,
    });

    // Mock aiService.generateText
    const { AIService } = require("@/services/ai/core/AIService");
    const mockAiService = AIService.getInstance();
    mockAiService.generateText = jest.fn(() =>
      Promise.resolve({ text: "Short Title For Chat" }),
    );

    const history = [
      { role: "user", text: "How do I add Jellyfin?" },
      {
        role: "assistant",
        text: "Follow the setup guide and add your server.",
      },
    ];

    const title = await service.generateConversationTitle(history as any);

    expect(title).toBeTruthy();
    expect(mockProviderManager.setActiveProvider).toBeCalledWith("openai");
    expect(mockProviderManager.setActiveProvider).toBeCalledWith("google");
    expect(title).toContain(
      "Short Title For Chat".split(" ").slice(0, 7).join(" "),
    );
  });
});
