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
  onThinking,
}: {
  onChunk: (chunk: string) => void;
  onComplete?: (
    finalText?: string,
    thinking?: string,
    metadata?: { tokens?: number; thinking?: string },
  ) => void;
  onError?: (err: Error) => void;
  onThinking?: (thinking: string) => void;
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
        let thinkingText = "";
        let responseMetadata: { tokens?: number; thinking?: string } = {};

        for await (const chunk of result.textStream) {
          fullText += chunk;
          onChunk(chunk);
        }

        // After streaming is complete, try to access extended metadata from the result object
        // The response object from streamText may contain thinking content and token counts for models that support it
        try {
          // @ts-expect-error - accessing extended metadata from response
          const thinkingVal = result.response?.thinking;
          if (thinkingVal) {
            thinkingText = thinkingVal;
            responseMetadata.thinking = thinkingText;
            onThinking?.(thinkingText);
          }

          // Try to get token usage from response usage field
          // @ts-expect-error - accessing usage from response
          const usageVal = result.response?.usage;
          if (usageVal) {
            const usage = usageVal;
            const totalTokens =
              usage.totalTokens ??
              (usage.completionTokens ?? 0) + (usage.promptTokens ?? 0);
            if (totalTokens !== undefined && totalTokens > 0) {
              responseMetadata.tokens = totalTokens;
            }
          }
        } catch {
          // Ignore errors accessing metadata
        }

        // Pass metadata to complete callback (tokens + thinking)
        onComplete?.(fullText, thinkingText || undefined, responseMetadata);
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
    [providerManager, onChunk, onComplete, onError, onThinking],
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
