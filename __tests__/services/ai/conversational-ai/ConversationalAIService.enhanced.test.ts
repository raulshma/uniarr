import { ConversationalAIService } from "@/services/ai/conversational-ai/ConversationalAIService";

// Mock the dependencies
jest.mock("@/services/ai/core/AIService");
jest.mock("@/services/ai/core/AIRateLimiter");
jest.mock("@/services/ai/core/AIProviderManager");
jest.mock("@/connectors/manager/ConnectorManager");
jest.mock("@/store/conversationalAIStore");
jest.mock("@/store/conversationalAIConfigStore");
jest.mock("@/services/logger/LoggerService");

describe("ConversationalAIService - Enhanced System Prompt", () => {
  let service: ConversationalAIService;
  let mockConnectorManager: jest.Mocked<any>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get the service instance
    service = ConversationalAIService.getInstance();

    // Get the mocked ConnectorManager
    const {
      ConnectorManager,
    } = require("@/connectors/manager/ConnectorManager");
    mockConnectorManager = ConnectorManager.getInstance() as jest.Mocked<any>;
  });

  describe("buildSystemPrompt", () => {
    it("should include service health information in the system prompt", async () => {
      // Mock connectors with different health states
      const mockConnectors = [
        {
          config: { id: "jellyfin-1", name: "Main Jellyfin", type: "jellyfin" },
          getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
          getVersion: jest.fn().mockResolvedValue("10.8.9"),
        },
        {
          config: { id: "sonarr-1", name: "TV Shows", type: "sonarr" },
          getHealth: jest.fn().mockResolvedValue({ status: "degraded" }),
          getVersion: jest.fn().mockResolvedValue("3.2.2"),
        },
        {
          config: { id: "radarr-1", name: "Movies", type: "radarr" },
          getHealth: jest
            .fn()
            .mockRejectedValue(new Error("Connection failed")),
          getVersion: jest.fn().mockRejectedValue(new Error("No version")),
        },
      ];

      mockConnectorManager.getAllConnectors = jest
        .fn()
        .mockReturnValue(mockConnectors);

      // Access the private method using type assertion for testing
      const buildSystemPrompt = (service as any).buildSystemPrompt.bind(
        service,
      );
      const prompt = await buildSystemPrompt();

      // Verify the prompt contains service information
      expect(prompt).toContain("Main Jellyfin (jellyfin): healthy [v10.8.9]");
      expect(prompt).toContain("TV Shows (sonarr): degraded [v3.2.2]");
      expect(prompt).toContain("Movies (radarr): error");
      expect(prompt).toContain(
        "You are UniArr, an intelligent assistant for media management infrastructure",
      );
      expect(prompt).toContain("Your capabilities:");
    });

    it("should handle error cases gracefully", async () => {
      // Mock ConnectorManager to throw an error
      mockConnectorManager.getAllConnectors = jest
        .fn()
        .mockImplementation(() => {
          throw new Error("Manager error");
        });

      // Access the private method using type assertion for testing
      const buildSystemPrompt = (service as any).buildSystemPrompt.bind(
        service,
      );
      const prompt = await buildSystemPrompt();

      // Should return a fallback prompt
      expect(prompt).toContain(
        "You are UniArr, an intelligent assistant for media management infrastructure",
      );
      expect(prompt).not.toContain("Main Jellyfin");
    });

    it("should handle empty connector list", async () => {
      // Mock empty connectors list
      mockConnectorManager.getAllConnectors = jest.fn().mockReturnValue([]);

      // Access the private method using type assertion for testing
      const buildSystemPrompt = (service as any).buildSystemPrompt.bind(
        service,
      );
      const prompt = await buildSystemPrompt();

      // Should still include service context section but empty
      expect(prompt).toContain(
        "You have access to real-time information about the user's media services:",
      );
      expect(prompt).not.toContain("Main Jellyfin");
      expect(prompt).toContain("Your capabilities:");
    });
  });

  describe("getStarterQuestions", () => {
    it("should provide generic questions when no services configured", async () => {
      // Mock empty connectors list
      mockConnectorManager.getAllConnectors = jest.fn().mockReturnValue([]);

      const questions = await service.getStarterQuestions();

      expect(questions).toContain("What services can I add to UniArr?");
      expect(questions).toContain(
        "How do I get started with media management?",
      );
    });

    it("should provide service-specific questions when services available", async () => {
      // Mock mixed service types
      const mockConnectors = [
        { config: { type: "jellyfin" } },
        { config: { type: "radarr" } },
        { config: { type: "qbittorrent" } },
      ];

      mockConnectorManager.getAllConnectors = jest
        .fn()
        .mockReturnValue(mockConnectors);

      const questions = await service.getStarterQuestions();

      expect(questions).toContain(
        "What's the current status of all my services?",
      );
      expect(questions).toContain("What's upcoming in my media libraries?");
      expect(questions).toContain("Are there any active downloads?");
      expect(questions).toContain("What can I watch right now?");
    });

    it("should limit number of returned questions", async () => {
      // Mock many service types to trigger the 6 question limit
      const mockConnectors = Array(10)
        .fill(null)
        .map((_, i) => ({
          config: { type: `service-${i}` },
        }));

      mockConnectorManager.getAllConnectors = jest
        .fn()
        .mockReturnValue(mockConnectors);

      const questions = await service.getStarterQuestions();

      // Should not exceed 6 questions
      expect(questions.length).toBeLessThanOrEqual(6);
    });
  });
});
