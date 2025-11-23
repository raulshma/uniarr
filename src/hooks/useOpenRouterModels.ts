import { useState, useCallback, useEffect } from "react";
import {
  OpenRouterService,
  OpenRouterModel,
  ModelFilters,
} from "@/services/ai/providers/OpenRouterService";
import { AI_PROVIDER_MODELS } from "@/types/ai/AIProvider";

interface UseOpenRouterModelsOptions {
  apiKey?: string;
  autoFetch?: boolean;
  filters?: ModelFilters;
}

interface UseOpenRouterModelsReturn {
  models: {
    free: OpenRouterModel[];
    paid: OpenRouterModel[];
  };
  allModels: string[];
  loading: boolean;
  error: Error | null;
  availableModalities: string[];
  availableInstructTypes: string[];
  fetchModels: (customFilters?: ModelFilters) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Reusable hook for fetching and managing OpenRouter models
 * Provides filtered and grouped models with metadata
 */
export function useOpenRouterModels({
  apiKey,
  autoFetch = true,
  filters,
}: UseOpenRouterModelsOptions = {}): UseOpenRouterModelsReturn {
  const [models, setModels] = useState<{
    free: OpenRouterModel[];
    paid: OpenRouterModel[];
  }>({ free: [], paid: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [availableModalities, setAvailableModalities] = useState<string[]>([]);
  const [availableInstructTypes, setAvailableInstructTypes] = useState<
    string[]
  >([]);

  const openRouterService = OpenRouterService.getInstance();

  // Use filters directly instead of syncing to ref
  const fetchModels = useCallback(
    async (customFilters?: ModelFilters) => {
      setLoading(true);
      setError(null);

      try {
        // Use customFilters if provided, otherwise use current filters prop
        const activeFilters = customFilters ?? filters ?? {};
        const grouped = await openRouterService.getFilteredGroupedModels(
          activeFilters,
          apiKey,
        );
        setModels(grouped);

        // Fetch all models to get available filter options
        const allModels = await openRouterService.fetchModels(apiKey);
        setAvailableModalities(
          openRouterService.getAvailableModalities(allModels),
        );
        setAvailableInstructTypes(
          openRouterService.getAvailableInstructTypes(allModels),
        );
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);

        // Fallback to static models on error
        setModels({
          free: [],
          paid: AI_PROVIDER_MODELS.openrouter.map((id) => ({
            id,
            name: id,
            context_length: 0,
            pricing: { prompt: "0", completion: "0" },
          })),
        });
      } finally {
        setLoading(false);
      }
    },
    [apiKey, openRouterService, filters],
  );

  const refetch = useCallback(() => fetchModels(), [fetchModels]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      void fetchModels();
    }
  }, [autoFetch, fetchModels]);

  // Combine all models into a flat array
  const allModels = [
    ...models.free.map((m) => m.id),
    ...models.paid.map((m) => m.id),
  ];

  return {
    models,
    allModels,
    loading,
    error,
    availableModalities,
    availableInstructTypes,
    fetchModels,
    refetch,
  };
}
