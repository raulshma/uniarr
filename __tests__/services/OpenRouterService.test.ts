import { OpenRouterService } from "@/services/ai/providers/OpenRouterService";

describe("OpenRouterService", () => {
  let service: OpenRouterService;

  beforeEach(() => {
    service = OpenRouterService.getInstance();
    service.clearCache();
  });

  it("should be a singleton", () => {
    const instance1 = OpenRouterService.getInstance();
    const instance2 = OpenRouterService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should return cached models if available", async () => {
    // Mock the first fetch
    const mockModels = [
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        context_length: 8192,
        pricing: { prompt: "0.03", completion: "0.06" },
      },
    ];

    // Manually set cache
    (service as any).cachedModels = mockModels;
    (service as any).lastFetchTime = Date.now();

    const models = await service.fetchModels();
    expect(models).toEqual(mockModels);
  });

  it("should return cached models without fetching", () => {
    const mockModels = [
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        context_length: 8192,
        pricing: { prompt: "0.03", completion: "0.06" },
      },
    ];

    (service as any).cachedModels = mockModels;

    const cached = service.getCachedModels();
    expect(cached).toEqual(mockModels);
  });

  it("should clear cache", () => {
    (service as any).cachedModels = [{ id: "test" }];
    (service as any).lastFetchTime = Date.now();

    service.clearCache();

    expect(service.getCachedModels()).toBeNull();
  });

  it("should extract model IDs from models", async () => {
    const mockModels = [
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        context_length: 8192,
        pricing: { prompt: "0.03", completion: "0.06" },
      },
      {
        id: "anthropic/claude-3-opus",
        name: "Claude 3 Opus",
        context_length: 200000,
        pricing: { prompt: "0.015", completion: "0.075" },
      },
    ];

    (service as any).cachedModels = mockModels;
    (service as any).lastFetchTime = Date.now();

    const modelIds = await service.getModelIds();
    expect(modelIds).toEqual(["openai/gpt-4", "anthropic/claude-3-opus"]);
  });

  it("should identify free models by :free suffix", () => {
    const freeModel = {
      id: "meta-llama/llama-3-8b-instruct:free",
      name: "Llama 3 8B",
      context_length: 8192,
      pricing: { prompt: "0", completion: "0" },
    };

    expect(service.isModelFree(freeModel)).toBe(true);
  });

  it("should identify free models by zero pricing", () => {
    const freeModel = {
      id: "some-model",
      name: "Free Model",
      context_length: 8192,
      pricing: { prompt: "0", completion: "0" },
    };

    expect(service.isModelFree(freeModel)).toBe(true);
  });

  it("should identify paid models", () => {
    const paidModel = {
      id: "openai/gpt-4",
      name: "GPT-4",
      context_length: 8192,
      pricing: { prompt: "0.03", completion: "0.06" },
    };

    expect(service.isModelFree(paidModel)).toBe(false);
  });

  it("should group models by free/paid status", async () => {
    const mockModels = [
      {
        id: "meta-llama/llama-3-8b-instruct:free",
        name: "Llama 3 8B Free",
        context_length: 8192,
        pricing: { prompt: "0", completion: "0" },
      },
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        context_length: 8192,
        pricing: { prompt: "0.03", completion: "0.06" },
      },
      {
        id: "google/gemini-pro:free",
        name: "Gemini Pro Free",
        context_length: 32768,
        pricing: { prompt: "0", completion: "0" },
      },
    ];

    (service as any).cachedModels = mockModels;
    (service as any).lastFetchTime = Date.now();

    const grouped = await service.getGroupedModels();

    expect(grouped.free).toHaveLength(2);
    expect(grouped.paid).toHaveLength(1);
    expect(grouped.free[0]?.id).toBe("meta-llama/llama-3-8b-instruct:free");
    expect(grouped.paid[0]?.id).toBe("openai/gpt-4");
  });

  it("should get grouped model IDs", async () => {
    const mockModels = [
      {
        id: "meta-llama/llama-3-8b-instruct:free",
        name: "Llama 3 8B Free",
        context_length: 8192,
        pricing: { prompt: "0", completion: "0" },
      },
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        context_length: 8192,
        pricing: { prompt: "0.03", completion: "0.06" },
      },
    ];

    (service as any).cachedModels = mockModels;
    (service as any).lastFetchTime = Date.now();

    const groupedIds = await service.getGroupedModelIds();

    expect(groupedIds.free).toEqual(["meta-llama/llama-3-8b-instruct:free"]);
    expect(groupedIds.paid).toEqual(["openai/gpt-4"]);
  });

  describe("filterModels", () => {
    const mockModels = [
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        description: "Most capable GPT-4 model",
        context_length: 8192,
        pricing: { prompt: "0.03", completion: "0.06" },
        architecture: { modality: "text", instruct_type: "chat" },
        top_provider: {
          is_moderated: true,
          context_length: 8192,
          max_completion_tokens: 4096,
        },
      },
      {
        id: "anthropic/claude-3-opus",
        name: "Claude 3 Opus",
        description: "Most powerful Claude model",
        context_length: 200000,
        pricing: { prompt: "0.015", completion: "0.075" },
        architecture: { modality: "text+image", instruct_type: "chat" },
        top_provider: {
          is_moderated: false,
          context_length: 200000,
          max_completion_tokens: 4096,
        },
      },
      {
        id: "meta-llama/llama-3-8b-instruct:free",
        name: "Llama 3 8B",
        description: "Free Llama model",
        context_length: 8192,
        pricing: { prompt: "0", completion: "0" },
        architecture: { modality: "text", instruct_type: "instruct" },
      },
    ];

    it("should filter by search query", () => {
      const filtered = service.filterModels(mockModels, {
        searchQuery: "claude",
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("anthropic/claude-3-opus");
    });

    it("should filter by modality", () => {
      const filtered = service.filterModels(mockModels, {
        modality: "text+image",
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("anthropic/claude-3-opus");
    });

    it("should filter by min context length", () => {
      const filtered = service.filterModels(mockModels, {
        minContextLength: 100000,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("anthropic/claude-3-opus");
    });

    it("should filter by max context length", () => {
      const filtered = service.filterModels(mockModels, {
        maxContextLength: 10000,
      });
      expect(filtered).toHaveLength(2);
    });

    it("should filter by max prompt price", () => {
      const filtered = service.filterModels(mockModels, {
        maxPromptPrice: 0.02,
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.some((m) => m.id === "anthropic/claude-3-opus")).toBe(
        true,
      );
    });

    it("should filter by max completion price", () => {
      const filtered = service.filterModels(mockModels, {
        maxCompletionPrice: 0.01,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("meta-llama/llama-3-8b-instruct:free");
    });

    it("should filter by moderation status", () => {
      const filtered = service.filterModels(mockModels, {
        isModerated: true,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("openai/gpt-4");
    });

    it("should filter by instruct type", () => {
      const filtered = service.filterModels(mockModels, {
        instructType: "instruct",
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("meta-llama/llama-3-8b-instruct:free");
    });

    it("should apply multiple filters", () => {
      const filtered = service.filterModels(mockModels, {
        modality: "text",
        maxPromptPrice: 0.02,
        minContextLength: 8000,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("meta-llama/llama-3-8b-instruct:free");
    });
  });

  describe("getAvailableModalities", () => {
    it("should extract unique modalities", () => {
      const mockModels = [
        {
          id: "model1",
          name: "Model 1",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { modality: "text" },
        },
        {
          id: "model2",
          name: "Model 2",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { modality: "text+image" },
        },
        {
          id: "model3",
          name: "Model 3",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { modality: "text" },
        },
      ];

      const modalities = service.getAvailableModalities(mockModels);
      expect(modalities).toEqual(["text", "text+image"]);
    });
  });

  describe("getAvailableInstructTypes", () => {
    it("should extract unique instruct types", () => {
      const mockModels = [
        {
          id: "model1",
          name: "Model 1",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { instruct_type: "chat" },
        },
        {
          id: "model2",
          name: "Model 2",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { instruct_type: "instruct" },
        },
        {
          id: "model3",
          name: "Model 3",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { instruct_type: "chat" },
        },
      ];

      const instructTypes = service.getAvailableInstructTypes(mockModels);
      expect(instructTypes).toEqual(["chat", "instruct"]);
    });
  });

  describe("getFilteredGroupedModels", () => {
    it("should return filtered and grouped models", async () => {
      const mockModels = [
        {
          id: "meta-llama/llama-3-8b-instruct:free",
          name: "Llama 3 8B Free",
          context_length: 8192,
          pricing: { prompt: "0", completion: "0" },
          architecture: { modality: "text" },
        },
        {
          id: "openai/gpt-4",
          name: "GPT-4",
          context_length: 8192,
          pricing: { prompt: "0.03", completion: "0.06" },
          architecture: { modality: "text" },
        },
        {
          id: "anthropic/claude-3-opus",
          name: "Claude 3 Opus",
          context_length: 200000,
          pricing: { prompt: "0.015", completion: "0.075" },
          architecture: { modality: "text+image" },
        },
      ];

      (service as any).cachedModels = mockModels;
      (service as any).lastFetchTime = Date.now();

      const grouped = await service.getFilteredGroupedModels({
        modality: "text",
      });

      expect(grouped.free).toHaveLength(1);
      expect(grouped.paid).toHaveLength(1);
      expect(grouped.free[0]?.id).toBe("meta-llama/llama-3-8b-instruct:free");
      expect(grouped.paid[0]?.id).toBe("openai/gpt-4");
    });
  });
});
