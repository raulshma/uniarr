import { useEffect, useState } from "react";

import { thumbhashService } from "@/services/image/ThumbhashService";

export interface UseThumbhashOptions {
  /**
   * Whether to automatically generate thumbhash when not available.
   * @default true
   */
  autoGenerate?: boolean;
  /**
   * Delay in ms before attempting to generate thumbhash.
   * Useful for deferring generation to avoid blocking initial render.
   * @default 0
   */
  generateDelay?: number;
}

/**
 * Hook for managing thumbhash for a given URI.
 * Provides thumbhash value and generation state.
 */
export const useThumbhash = (
  uri: string | undefined,
  options: UseThumbhashOptions = {},
) => {
  const { autoGenerate = true, generateDelay = 0 } = options;

  // Compute thumbhash directly from service (derived state)
  const cachedThumbhash = uri ? thumbhashService.getThumbhash(uri) : undefined;

  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [generatedThumbhash, setGeneratedThumbhash] = useState<
    string | undefined
  >(undefined);

  // Only use effect for async generation (legitimate external operation)
  useEffect(() => {
    // Reset generation state when URI changes
    setGeneratedThumbhash(undefined);
    setHasError(false);

    if (!uri || cachedThumbhash || !autoGenerate) {
      setIsGenerating(false);
      return;
    }

    // Auto-generate if enabled and not cached
    const generate = async () => {
      try {
        setIsGenerating(true);
        setHasError(false);

        const generated = await thumbhashService.generateThumbhash(uri);

        if (generated) {
          setGeneratedThumbhash(generated);
          setHasError(false);
        } else {
          setHasError(true);
        }
      } catch {
        setHasError(true);
      } finally {
        setIsGenerating(false);
      }
    };

    if (generateDelay > 0) {
      const timeoutId = setTimeout(generate, generateDelay);
      return () => clearTimeout(timeoutId);
    } else {
      void generate();
    }
  }, [uri, cachedThumbhash, autoGenerate, generateDelay]);

  // Compute final thumbhash value (derived state)
  const thumbhash = cachedThumbhash || generatedThumbhash;

  return {
    thumbhash,
    isGenerating,
    hasError,
    hasThumbhash: !!thumbhash,
  };
};
