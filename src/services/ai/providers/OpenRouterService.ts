import axios from "axios";
import { logger } from "@/services/logger/LoggerService";

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated?: boolean;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
  created?: number;
  supported_generation_methods?: string[];
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface GroupedModels {
  free: OpenRouterModel[];
  paid: OpenRouterModel[];
}

export interface ModelFilters {
  searchQuery?: string;
  modality?: string; // text, image, text+image, etc.
  minContextLength?: number;
  maxContextLength?: number;
  maxPromptPrice?: number;
  maxCompletionPrice?: number;
  supportedMethods?: string[]; // prompt, generate, etc.
  isModerated?: boolean;
  instructType?: string;
}

/**
 * Service for interacting with OpenRouter API
 */
export class OpenRouterService {
  private static instance: OpenRouterService;
  private cachedModels: OpenRouterModel[] | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  private constructor() {}

  static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }

  /**
   * Fetch available models from OpenRouter API
   */
  async fetchModels(apiKey?: string): Promise<OpenRouterModel[]> {
    try {
      // Return cached models if still valid
      const now = Date.now();
      if (this.cachedModels && now - this.lastFetchTime < this.CACHE_DURATION) {
        return this.cachedModels;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add API key if provided (optional for model listing)
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await axios.get<OpenRouterModelsResponse>(
        "https://openrouter.ai/api/v1/models",
        {
          headers,
          timeout: 10000,
        },
      );

      if (response.data && Array.isArray(response.data.data)) {
        this.cachedModels = response.data.data;
        this.lastFetchTime = now;
        logger.info(
          `Fetched ${this.cachedModels.length} models from OpenRouter`,
        );
        return this.cachedModels;
      }

      throw new Error("Invalid response format from OpenRouter API");
    } catch (error) {
      logger.error("Failed to fetch OpenRouter models", { error });
      throw error;
    }
  }

  /**
   * Check if a model is free based on ID suffix or pricing
   */
  isModelFree(model: OpenRouterModel): boolean {
    // Check if model ID ends with :free
    if (model.id.endsWith(":free")) {
      return true;
    }

    // Check if pricing is zero or "0"
    const promptPrice = parseFloat(model.pricing.prompt);
    const completionPrice = parseFloat(model.pricing.completion);

    return promptPrice === 0 && completionPrice === 0;
  }

  /**
   * Group models by free/paid status
   */
  async getGroupedModels(apiKey?: string): Promise<GroupedModels> {
    const models = await this.fetchModels(apiKey);

    const grouped: GroupedModels = {
      free: [],
      paid: [],
    };

    for (const model of models) {
      if (this.isModelFree(model)) {
        grouped.free.push(model);
      } else {
        grouped.paid.push(model);
      }
    }

    return grouped;
  }

  /**
   * Get model IDs for use in the provider configuration
   */
  async getModelIds(apiKey?: string): Promise<string[]> {
    const models = await this.fetchModels(apiKey);
    return models.map((model) => model.id);
  }

  /**
   * Get model IDs grouped by free/paid status
   */
  async getGroupedModelIds(apiKey?: string): Promise<{
    free: string[];
    paid: string[];
  }> {
    const grouped = await this.getGroupedModels(apiKey);
    return {
      free: grouped.free.map((m) => m.id),
      paid: grouped.paid.map((m) => m.id),
    };
  }

  /**
   * Clear cached models (useful for forcing a refresh)
   */
  clearCache(): void {
    this.cachedModels = null;
    this.lastFetchTime = 0;
  }

  /**
   * Get cached models without fetching
   */
  getCachedModels(): OpenRouterModel[] | null {
    return this.cachedModels;
  }

  /**
   * Filter models based on criteria
   */
  filterModels(
    models: OpenRouterModel[],
    filters: ModelFilters,
  ): OpenRouterModel[] {
    let filtered = [...models];

    // Search query filter (searches in id, name, and description)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.name.toLowerCase().includes(query) ||
          model.description?.toLowerCase().includes(query),
      );
    }

    // Modality filter
    if (filters.modality) {
      filtered = filtered.filter(
        (model) => model.architecture?.modality === filters.modality,
      );
    }

    // Context length filters
    if (filters.minContextLength !== undefined) {
      filtered = filtered.filter(
        (model) => model.context_length >= filters.minContextLength!,
      );
    }

    if (filters.maxContextLength !== undefined) {
      filtered = filtered.filter(
        (model) => model.context_length <= filters.maxContextLength!,
      );
    }

    // Pricing filters
    if (filters.maxPromptPrice !== undefined) {
      filtered = filtered.filter(
        (model) => parseFloat(model.pricing.prompt) <= filters.maxPromptPrice!,
      );
    }

    if (filters.maxCompletionPrice !== undefined) {
      filtered = filtered.filter(
        (model) =>
          parseFloat(model.pricing.completion) <= filters.maxCompletionPrice!,
      );
    }

    // Supported methods filter
    if (filters.supportedMethods && filters.supportedMethods.length > 0) {
      filtered = filtered.filter((model) =>
        filters.supportedMethods!.some((method) =>
          model.supported_generation_methods?.includes(method),
        ),
      );
    }

    // Moderation filter
    if (filters.isModerated !== undefined) {
      filtered = filtered.filter(
        (model) => model.top_provider?.is_moderated === filters.isModerated,
      );
    }

    // Instruct type filter
    if (filters.instructType) {
      filtered = filtered.filter(
        (model) => model.architecture?.instruct_type === filters.instructType,
      );
    }

    return filtered;
  }

  /**
   * Get unique modalities from models
   */
  getAvailableModalities(models: OpenRouterModel[]): string[] {
    const modalities = new Set<string>();
    models.forEach((model) => {
      if (model.architecture?.modality) {
        modalities.add(model.architecture.modality);
      }
    });
    return Array.from(modalities).sort();
  }

  /**
   * Get unique instruct types from models
   */
  getAvailableInstructTypes(models: OpenRouterModel[]): string[] {
    const instructTypes = new Set<string>();
    models.forEach((model) => {
      if (model.architecture?.instruct_type) {
        instructTypes.add(model.architecture.instruct_type);
      }
    });
    return Array.from(instructTypes).sort();
  }

  /**
   * Get unique supported generation methods from models
   */
  getAvailableGenerationMethods(models: OpenRouterModel[]): string[] {
    const methods = new Set<string>();
    models.forEach((model) => {
      model.supported_generation_methods?.forEach((method) =>
        methods.add(method),
      );
    });
    return Array.from(methods).sort();
  }

  /**
   * Get filtered and grouped models
   */
  async getFilteredGroupedModels(
    filters: ModelFilters,
    apiKey?: string,
  ): Promise<GroupedModels> {
    const models = await this.fetchModels(apiKey);
    const filtered = this.filterModels(models, filters);

    const grouped: GroupedModels = {
      free: [],
      paid: [],
    };

    for (const model of filtered) {
      if (this.isModelFree(model)) {
        grouped.free.push(model);
      } else {
        grouped.paid.push(model);
      }
    }

    return grouped;
  }
}
