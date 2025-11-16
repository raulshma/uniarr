import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { useAiSdkConversational } from "@/hooks/useAiSdkConversational";
import { ConversationalAIService } from "@/services/ai/conversational-ai/ConversationalAIService";
import { logger } from "@/services/logger/LoggerService";
import { apiLogger } from "@/services/logger/ApiLoggerService";
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
  const enableStreamingPref = useConversationalAIStore(
    (s) => s.config.enableStreaming,
  );

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
    onComplete: (
      finalText?: string,
      thinking?: string,
      metadata?: { tokens?: number; thinking?: string },
    ) => {
      const id = assistantMessageIdRef.current;
      if (id) {
        if (finalText) {
          // Ensure the final text is appended if not already
          addStreamingChunk(id, finalText);
        }
        completeStreamingMessage(id);
        // Update metadata with tokens and/or thinking if available from SDK response
        const metadataUpdate: Record<string, unknown> = {};
        if (metadata?.tokens !== undefined) {
          metadataUpdate.tokens = metadata.tokens;
        }
        if (thinking) {
          metadataUpdate.thinking = thinking;
        }
        if (Object.keys(metadataUpdate).length > 0) {
          useConversationalAIStore
            .getState()
            .updateMessageMetadata(id, metadataUpdate);
        }

        // After first assistant response completes, auto-generate a title
        void (async () => {
          try {
            const store = useConversationalAIStore.getState();
            const session = store.getCurrentSession();
            if (!session) {
              return;
            }
            const assistantCount = session.messages.filter(
              (m) => m.role === "assistant",
            ).length;
            if (assistantCount !== 1) {
              return;
            }
            const service = ConversationalAIService.getInstance();
            const title = await service.generateConversationTitle(
              session.messages,
            );
            if (title && title.length > 0) {
              store.setCurrentSessionTitle(title);
            }
          } catch {
            // ignore title generation errors
          }
        })();
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
        const startTime = Date.now();

        // If the react SDK is available and user wants streaming, prefer it —
        // it uses the user's configured API key directly and streams via React hooks.
        if (
          enableStreamingPref &&
          sdkAvailable &&
          typeof sendWithSdk === "function"
        ) {
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
          // Update message metadata with optional duration / token info
          try {
            const endTime = Date.now();
            const durationSec = (endTime - startTime) / 1000;

            // First, check if tokens were captured from SDK response
            const currentMessage = useConversationalAIStore
              .getState()
              .messages.find((m) => m.id === assistantMessageId);
            const sdkTokens = currentMessage?.metadata?.tokens;

            // If SDK didn't provide tokens, try to get from API logger
            let tokens = sdkTokens;
            if (tokens === undefined) {
              const entries = await apiLogger.getAiLogs({
                startDate: new Date(startTime - 2000),
                endDate: new Date(endTime + 2000),
                operation: "conversational",
              });

              const match = entries
                .reverse()
                .find((e) => (e.prompt ?? "").trim() === trimmed.trim());

              tokens =
                match?.metadata?.tokenUsage?.totalTokens ??
                match?.metadata?.tokenUsage?.completionTokens ??
                match?.metadata?.tokenUsage?.promptTokens ??
                undefined;
            }

            // Always update with duration; update tokens if we have them
            const metadata: Record<string, unknown> = {
              duration: durationSec,
            };
            if (tokens !== undefined) {
              metadata.tokens = tokens;
            }
            useConversationalAIStore
              .getState()
              .updateMessageMetadata(assistantMessageId, metadata);
          } catch {
            // ignore metadata update errors
          }
          assistantMessageIdRef.current = "";
          return;
        }
        // If SDK is not available or streaming is disabled, try a buffered
        // (non-streaming) generation using the server-side AI path.
        if (!enableStreamingPref) {
          try {
            const service = ConversationalAIService.getInstance();
            assistantMessageIdRef.current = assistantMessageId;
            const historyForService = messages
              .filter(
                (msg) =>
                  msg.id !== userMessage.id && msg.id !== assistantMessageId,
              )
              .map((m) => ({ ...m }));

            const finalText = await service.generateResponse(
              trimmed,
              historyForService as any,
            );
            // Ensure final text appended and mark message as complete
            addStreamingChunk(assistantMessageId, finalText);
            completeStreamingMessage(assistantMessageId);
            // Attach metadata entry to the message (tokens + duration) if present in Ai logs
            try {
              const endTime = Date.now();
              const durationSec = (endTime - startTime) / 1000;

              // First, check if tokens were captured
              const currentMessage = useConversationalAIStore
                .getState()
                .messages.find((m) => m.id === assistantMessageId);
              let tokens = currentMessage?.metadata?.tokens;

              // If not, try to get from API logger
              if (tokens === undefined) {
                const entries = await apiLogger.getAiLogs({
                  startDate: new Date(startTime - 2000),
                  endDate: new Date(endTime + 2000),
                  operation: "conversational",
                });

                const match = entries
                  .reverse()
                  .find((e) => (e.prompt ?? "").trim() === trimmed.trim());

                tokens =
                  match?.metadata?.tokenUsage?.totalTokens ??
                  match?.metadata?.tokenUsage?.completionTokens ??
                  match?.metadata?.tokenUsage?.promptTokens ??
                  undefined;
              }

              // Always update with duration; update tokens if we have them
              const metadata: Record<string, unknown> = {
                duration: durationSec,
              };
              if (tokens !== undefined) {
                metadata.tokens = tokens;
              }
              useConversationalAIStore
                .getState()
                .updateMessageMetadata(assistantMessageId, metadata);
            } catch {
              // ignore metadata update errors
            }
            assistantMessageIdRef.current = "";

            // After first assistant response completes, auto-generate a title
            try {
              const store = useConversationalAIStore.getState();
              const session = store.getCurrentSession();
              if (session) {
                const assistantCount = session.messages.filter(
                  (m) => m.role === "assistant",
                ).length;
                if (assistantCount === 1) {
                  const service = ConversationalAIService.getInstance();
                  const title = await service.generateConversationTitle(
                    session.messages,
                  );
                  if (title && title.length > 0) {
                    store.setCurrentSessionTitle(title);
                  }
                }
              }
            } catch {
              // ignore title generation errors
            }
            return;
          } catch (serverError) {
            const apiError = handleApiError(serverError, {
              operation: "conversational-ai.generate-response",
            });

            setErrorState(apiError);
            setMessageError(
              assistantMessageId,
              apiError.message,
              `I ran into an issue: ${apiError.message}. Please try again in a moment.`,
            );
            completeStreamingMessage(assistantMessageId);
            void logger.error("Conversational AI message failed (generate)", {
              error: apiError.message,
              code: apiError.code,
              messageLength: trimmed.length,
            });
            return;
          }
        }

        // If SDK is not available and streaming preference requested, show an error — we don't fallback to older server-based streaming when using the React SDK exclusively.
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
