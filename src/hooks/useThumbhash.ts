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
export const useThumbhash = (uri: string | undefined, options: UseThumbhashOptions = {}) => {
  const { autoGenerate = true, generateDelay = 0 } = options;

  const [thumbhash, setThumbhash] = useState<string | undefined>(() =>
    uri ? thumbhashService.getThumbhash(uri) : undefined
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Update thumbhash when URI changes
  useEffect(() => {
    if (!uri) {
      setThumbhash(undefined);
      setIsGenerating(false);
      setHasError(false);
      return;
    }

    // Check if we already have a thumbhash for this URI
    const existingThumbhash = thumbhashService.getThumbhash(uri);
    if (existingThumbhash) {
      setThumbhash(existingThumbhash);
      setIsGenerating(false);
      setHasError(false);
      return;
    }

    // Reset state for new URI
    setThumbhash(undefined);
    setHasError(false);

    // Auto-generate if enabled
    if (autoGenerate) {
      const generate = async () => {
        try {
          setIsGenerating(true);
          setHasError(false);

          const generatedThumbhash = await thumbhashService.generateThumbhash(uri);

          if (generatedThumbhash) {
            setThumbhash(generatedThumbhash);
            setHasError(false);
          } else {
            setHasError(true);
          }
        } catch (error) {
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
    }
  }, [uri, autoGenerate, generateDelay]);

  return {
    thumbhash,
    isGenerating,
    hasError,
    hasThumbhash: !!thumbhash,
  };
};