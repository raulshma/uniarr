import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { useAiSdkConversational } from "@/hooks/useAiSdkConversational";
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
  createNewConversation: (title: string) => string;
  deleteConversation: (sessionId: string) => void;
  loadConversation: (sessionId: string) => void;
}

const createMessageId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Hook that wires the conversational AI service with persisted store state
 * while handling streaming updates and initialization lifecycle.
 */
export function useConversationalAI(): UseConversationalAIReturn {
  // Conversational logic is handled entirely via @ai-sdk/react

  const messages = useConversationalAIStore(selectMessages);
  const isLoading = useConversationalAIStore(selectIsLoading);
  const isStreaming = useConversationalAIStore(selectIsStreaming);
  const error = useConversationalAIStore(selectError);

  // Get action functions directly - don't use selectors for actions to avoid infinite loops
  const addMessage = useCallback(
    (msg: Message) => useConversationalAIStore.getState().addMessage(msg),
    [],
  );
  const addStreamingChunk = useCallback(
    (messageId: string, chunk: string) =>
      useConversationalAIStore.getState().addStreamingChunk(messageId, chunk),
    [],
  );
  const completeStreamingMessage = useCallback(
    (messageId: string) =>
      useConversationalAIStore.getState().completeStreamingMessage(messageId),
    [],
  );
  const setMessageError = useCallback(
    (messageId: string, errorMessage: string, fallbackText?: string) =>
      useConversationalAIStore
        .getState()
        .setMessageError(messageId, errorMessage, fallbackText),
    [],
  );
  const clearHistoryState = useCallback(
    () => useConversationalAIStore.getState().clearHistory(),
    [],
  );
  const setErrorState = useCallback(
    (err: Error | null) => useConversationalAIStore.getState().setError(err),
    [],
  );
  const setLoadingState = useCallback(
    (loading: boolean) =>
      useConversationalAIStore.getState().setLoading(loading),
    [],
  );
  const setStreamingState = useCallback(
    (streaming: boolean) =>
      useConversationalAIStore.getState().setStreaming(streaming),
    [],
  );
  const networkStatus = useNetworkStatus();
  const { isConnected, isInternetReachable, type: networkType } = networkStatus;

  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [providerVersion, setProviderVersion] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMessageIdRef = useRef<string>("");
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
        const activeProvider = providerManager.getActiveProvider();
        let ready = false;
        if (activeProvider) {
          const health = await providerManager.healthCheck(
            activeProvider.provider,
          );
          ready =
            health.isHealthy ||
            (health.error ?? "").toLowerCase().includes("not implemented");
        }
        if (!isMounted) {
          return;
        }

        setIsReady(ready);

        if (ready) {
          // Provide the same simple starter questions inline
          const questions = [
            "Hello! How can you help me?",
            "What can you do?",
            "Tell me something interesting",
            "Show me trending movies",
          ];
          if (isMounted) {
            setStarterQuestions(questions);
          }
          const persistApiLocal = useConversationalAIStore.persist;
          if (persistApiLocal?.hasHydrated?.()) {
            const stateSnapshot = useConversationalAIStore.getState();
            if (!stateSnapshot.currentSessionId) {
              stateSnapshot.createSession("New Chat");
            }
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

    void initializeAssistant();
    if (!persistApi?.hasHydrated?.()) {
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
  }, [providerVersion, providerManager]);

  const {
    isAvailable: sdkAvailable,
    sendMessage: sendWithSdk,
    stopStreaming,
  } = useAiSdkConversational({
    onChunk: (chunk: string) => {
      const id = assistantMessageIdRef.current;
      if (id) {
        addStreamingChunk(id, chunk);
      }
    },
    onComplete: (finalText?: string) => {
      const id = assistantMessageIdRef.current;
      if (id) {
        if (finalText) {
          // Ensure the final text is appended if not already
          addStreamingChunk(id, finalText);
        }
        completeStreamingMessage(id);
      }
    },
    onError: (err) => {
      const id = assistantMessageIdRef.current;
      if (id) {
        setMessageError(id, err.message);
        completeStreamingMessage(id);
      }
    },
  });

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
        isStreaming: true,
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
        // If the react SDK is available and has a provider, prefer it — it uses
        // the user's configured API key directly and streams via React hooks.
        if (sdkAvailable && typeof sendWithSdk === "function") {
          assistantMessageIdRef.current = assistantMessageId;
          // Build conversation history for context
          const conversationHistory = messages
            .filter(
              (msg) =>
                msg.id !== userMessage.id && msg.id !== assistantMessageId,
            )
            .map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.text,
            }));
          await sendWithSdk(trimmed, conversationHistory);
          assistantMessageIdRef.current = "";
          return;
        }
        // If SDK is not available, show an error — we don't fallback to the
        // older server-based streaming when using the React SDK exclusively.
        const noProviderError = new ApiError({
          message:
            "No AI provider configured. Visit settings to add an API key for a provider.",
          code: "NO_PROVIDER",
        });

        setErrorState(noProviderError);
        setMessageError(
          assistantMessageId,
          noProviderError.message,
          "Set up an AI provider to use real-time streaming.",
        );
        completeStreamingMessage(assistantMessageId);
        return;
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
        // Stop react sdk streaming if it was used
        try {
          stopStreaming && stopStreaming();
        } catch {
          // ignore
        }
      }
    },
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      addMessage,
      completeStreamingMessage,
      isOffline,
      isReady,
      isConnected,
      isInternetReachable,
      networkType,
      setMessageError,
      setErrorState,
      setLoadingState,
      setStreamingState,
      sdkAvailable,
      sendWithSdk,
      stopStreaming,
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

  const createNewConversation = useCallback((title: string) => {
    return useConversationalAIStore.getState().createSession(title);
  }, []);

  const deleteConversation = useCallback((sessionId: string) => {
    useConversationalAIStore.getState().deleteSession(sessionId);
  }, []);

  const loadConversation = useCallback((sessionId: string) => {
    useConversationalAIStore.getState().loadSession(sessionId);
  }, []);

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
    createNewConversation,
    deleteConversation,
    loadConversation,
  };
}
