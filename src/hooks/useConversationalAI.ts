import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConversationalAIService } from "@/services/ai/conversational-ai/ConversationalAIService";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { logger } from "@/services/logger/LoggerService";
import { ApiError, handleApiError } from "@/utils/error.utils";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  selectError,
  selectIsLoading,
  selectIsStreaming,
  selectMessages,
} from "@/store/conversationalAISelectors";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import type { Message } from "@/models/chat.types";

interface UseConversationalAIReturn {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  starterQuestions: string[];
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
  setError: (error: Error | null) => void;
  isReady: boolean;
}

const createMessageId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Hook that wires the conversational AI service with persisted store state
 * while handling streaming updates and initialization lifecycle.
 */
export function useConversationalAI(): UseConversationalAIReturn {
  const service = ConversationalAIService.getInstance();

  const messages = useConversationalAIStore(selectMessages);
  const isLoading = useConversationalAIStore(selectIsLoading);
  const isStreaming = useConversationalAIStore(selectIsStreaming);
  const error = useConversationalAIStore(selectError);
  const addMessage = useConversationalAIStore((state) => state.addMessage);
  const addStreamingChunk = useConversationalAIStore(
    (state) => state.addStreamingChunk,
  );
  const completeStreamingMessage = useConversationalAIStore(
    (state) => state.completeStreamingMessage,
  );
  const setMessageError = useConversationalAIStore(
    (state) => state.setMessageError,
  );
  const clearHistoryState = useConversationalAIStore(
    (state) => state.clearHistory,
  );
  const setErrorState = useConversationalAIStore((state) => state.setError);
  const setLoadingState = useConversationalAIStore((state) => state.setLoading);
  const setStreamingState = useConversationalAIStore(
    (state) => state.setStreaming,
  );
  const networkStatus = useNetworkStatus();
  const { isConnected, isInternetReachable, type: networkType } = networkStatus;

  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [providerVersion, setProviderVersion] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const providerManager = AIProviderManager.getInstance();

  const isOffline = useMemo(() => {
    if (isConnected === false) {
      return true;
    }

    if (isInternetReachable === false) {
      return true;
    }

    return false;
  }, [isConnected, isInternetReachable]);

  useEffect(() => {
    const unsubscribe = providerManager.subscribe(() => {
      setProviderVersion((version) => version + 1);
    });

    return unsubscribe;
  }, [providerManager]);

  // Initialize assistant readiness and starter questions.
  useEffect(() => {
    let isMounted = true;

    const initializeAssistant = async () => {
      try {
        const ready = await service.isReady();
        if (!isMounted) {
          return;
        }

        setIsReady(ready);

        if (ready) {
          const questions = await service.getStarterQuestions();
          if (isMounted) {
            setStarterQuestions(questions);
          }

          const stateSnapshot = useConversationalAIStore.getState();
          if (!stateSnapshot.currentSessionId) {
            stateSnapshot.createSession("New Chat");
          }
        }
      } catch (initializeError) {
        const message =
          initializeError instanceof Error
            ? initializeError.message
            : String(initializeError);
        void logger.error("Failed to initialize conversational AI", {
          error: message,
        });
        if (isMounted) {
          setIsReady(false);
        }
      }
    };

    const persistApi = useConversationalAIStore.persist;
    let unsubscribeHydration: (() => void) | undefined;

    if (persistApi?.hasHydrated?.()) {
      void initializeAssistant();
    } else {
      unsubscribeHydration = persistApi?.onFinishHydration?.(() => {
        if (!isMounted) {
          return;
        }
        void initializeAssistant();
      });
    }

    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      unsubscribeHydration?.();
    };
  }, [providerVersion, service]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed || !isReady) {
        return;
      }

      // Abort any in-flight request before starting a new one.
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const userMessage: Message = {
        id: createMessageId(),
        text: trimmed,
        role: "user",
        timestamp: new Date(),
      };

      addMessage(userMessage);
      setLoadingState(true);
      setErrorState(null);

      const assistantMessageId = createMessageId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        text: "",
        role: "assistant",
        timestamp: new Date(),
      };

      if (isOffline) {
        const offlineError = new ApiError({
          message:
            "You appear to be offline. Reconnect to the internet and try again.",
          code: "OFFLINE",
          isNetworkError: true,
          details: {
            isConnected,
            isInternetReachable,
            networkType,
          },
        });

        setErrorState(offlineError);

        const fallbackMessage: Message = {
          id: createMessageId(),
          text: "I can't reach our AI services because the device is offline. Please check your connection and try again.",
          role: "assistant",
          timestamp: new Date(),
          error: offlineError.message,
        };

        addMessage(fallbackMessage);
        setLoadingState(false);
        setStreamingState(false);
        void logger.warn("Conversational AI offline fallback engaged", {
          isConnected,
          isInternetReachable,
          networkType,
        });
        return;
      }

      setLoadingState(true);

      addMessage(assistantMessage);
      setStreamingState(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const history = useConversationalAIStore
          .getState()
          .messages.filter((message) => message.id !== assistantMessageId);

        const stream = await service.streamResponse(trimmed, history);

        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            break;
          }

          addStreamingChunk(assistantMessageId, chunk);
        }

        completeStreamingMessage(assistantMessageId);
      } catch (streamError) {
        const apiError = handleApiError(streamError, {
          operation: "conversational-ai.stream-response",
        });

        setErrorState(apiError);
        setMessageError(
          assistantMessageId,
          apiError.message,
          `I ran into an issue: ${apiError.message}. Please try again in a moment.`,
        );
        completeStreamingMessage(assistantMessageId);
        void logger.error("Conversational AI message failed", {
          error: apiError.message,
          code: apiError.code,
          messageLength: trimmed.length,
        });
      } finally {
        setStreamingState(false);
        setLoadingState(false);
        abortControllerRef.current = null;
      }
    },
    [
      addMessage,
      addStreamingChunk,
      completeStreamingMessage,
      isOffline,
      isReady,
      isConnected,
      isInternetReachable,
      networkType,
      service,
      setMessageError,
      setErrorState,
      setLoadingState,
      setStreamingState,
    ],
  );

  const clearHistory = useCallback(() => {
    clearHistoryState();
    setErrorState(null);
  }, [clearHistoryState, setErrorState]);

  const setError = useCallback(
    (value: Error | null) => {
      setErrorState(value);
    },
    [setErrorState],
  );

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    starterQuestions,
    sendMessage,
    clearHistory,
    setError,
    isReady,
  };
}
