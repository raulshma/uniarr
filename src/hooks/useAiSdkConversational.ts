import { useCallback, useRef } from "react";
import { streamText, LanguageModel } from "ai";

import { AIProviderManager } from "@/services/ai/core/AIProviderManager";

/**
 * Direct streaming hook for conversational responses.
 *
 * Uses Vercel AI SDK's streamText directly without requiring an API endpoint.
 * Streams incremental updates via callbacks while maintaining conversation state.
 */
export function useAiSdkConversational({
  onChunk,
  onComplete,
  onError,
}: {
  onChunk: (chunk: string) => void;
  onComplete?: (finalText?: string) => void;
  onError?: (err: Error) => void;
}) {
  const providerManager = AIProviderManager.getInstance();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      text: string,
      conversationHistory?: {
        role: "user" | "assistant";
        content: string;
      }[],
    ) => {
      try {
        const activeProvider = providerManager.getActiveProvider();
        if (!activeProvider) {
          throw new Error("No AI provider configured");
        }

        // Get the actual model instance with the configured provider and API key
        let modelInstance: LanguageModel | undefined;
        try {
          modelInstance = providerManager.getModelInstance();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          throw new Error(`Failed to initialize AI model: ${errorMessage}`);
        }

        const messages = conversationHistory
          ? [...conversationHistory, { role: "user" as const, content: text }]
          : [{ role: "user" as const, content: text }];

        // Create abort controller for this stream
        abortControllerRef.current = new AbortController();

        // Call streamText directly using the actual model instance (provider + API key)
        const result = streamText({
          model: modelInstance,
          messages,
          abortSignal: abortControllerRef.current.signal,
          onError({ error: streamError }) {
            // Log the error and propagate it
            const errorMessage =
              streamError instanceof Error
                ? streamError.message
                : String(streamError);
            const fullError = new Error(`AI API Error: ${errorMessage}`);
            onError?.(fullError);
          },
        });

        // Stream the text chunks
        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          onChunk(chunk);
        }

        onComplete?.(fullText);
        return fullText;
      } catch (err) {
        // Don't treat abort errors as real errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        // best-effort: call onError and re-throw
        if (err instanceof Error) {
          onError?.(err);
        } else {
          onError?.(new Error(String(err)));
        }
        throw err;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [providerManager, onChunk, onComplete, onError],
  );

  // Provide an abort method
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const activeProvider = providerManager.getActiveProvider();
  const isAvailable = !!activeProvider;

  return {
    isAvailable,
    sendMessage,
    stopStreaming,
  };
}
