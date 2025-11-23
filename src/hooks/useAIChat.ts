import { useCallback, useRef } from "react";

import { AIChatService } from "@/services/ai/AIChatService";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import type { Message, ToolInvocation } from "@/models/chat.types";
import { logger } from "@/services/logger/LoggerService";
import { ConfirmationManager } from "@/services/ai/tools/ConfirmationManager";

const createMessageId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

interface UseAIChatOptions {
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
  onConfirmationRequested?: (
    confirmationId: string,
    prompt: string,
    severity: "low" | "medium" | "high",
  ) => void;
  onWorkflowProgress?: (
    workflowId: string,
    workflowName: string,
    stepId: string,
    stepIndex: number,
    totalSteps: number,
  ) => void;
}

interface UseAIChatReturn {
  sendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
}

/**
 * Hook for sending messages to the AI chat service with tool support.
 * Handles streaming responses, tool invocations, and state management.
 */
export function useAIChat(options?: UseAIChatOptions): UseAIChatReturn {
  const {
    onToolCall,
    onToolResult,
    onConfirmationRequested,
    onWorkflowProgress,
  } = options ?? {};

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

  const setErrorState = useCallback(
    (err: Error | null) => useConversationalAIStore.getState().setError(err),
    [],
  );

  const isLoading = useConversationalAIStore((s) => s.isLoading);
  const isStreaming = useConversationalAIStore((s) => s.isStreaming);
  const error = useConversationalAIStore((s) => s.error);
  const messages = useConversationalAIStore((s) => s.messages);

  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMessageIdRef = useRef<string>("");
  const toolInvocationsRef = useRef<Map<string, ToolInvocation>>(new Map());

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      // Ensure a session exists before sending message
      const store = useConversationalAIStore.getState();
      if (!store.currentSessionId) {
        store.createSession("New Chat");
      }

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Create user message
      const userMessage: Message = {
        id: createMessageId(),
        text: trimmed,
        role: "user",
        timestamp: new Date(),
      };

      addMessage(userMessage);
      setLoadingState(true);
      setErrorState(null);

      // Create assistant message placeholder
      const assistantMessageId = createMessageId();
      assistantMessageIdRef.current = assistantMessageId;
      toolInvocationsRef.current.clear();

      const assistantMessage: Message = {
        id: assistantMessageId,
        text: "",
        role: "assistant",
        timestamp: new Date(),
        isStreaming: true,
        toolInvocations: [],
      };

      addMessage(assistantMessage);
      setStreamingState(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Track response time
      const startTime = Date.now();

      try {
        const chatService = AIChatService.getInstance();

        // Build conversation history with windowing to limit context size
        const store = useConversationalAIStore.getState();
        const maxContextMessages = store.config.maxContextMessages ?? 20;

        const conversationHistory = messages
          .filter(
            (msg) => msg.id !== userMessage.id && msg.id !== assistantMessageId,
          )
          .slice(-maxContextMessages) // Only keep last N messages for context
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.text,
          }));

        void logger.debug("Building conversation context", {
          totalMessages: messages.length,
          contextMessages: conversationHistory.length,
          maxContextMessages,
        });

        // Send message with tools
        await chatService.sendMessageWithTools(
          [...conversationHistory, { role: "user", content: trimmed }],
          {
            onChunk: (chunk: string) => {
              addStreamingChunk(assistantMessageId, chunk);
            },
            onToolCall: (toolName: string, args: unknown) => {
              // Track tool invocation with generated ID
              const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              const invocation: ToolInvocation = {
                toolCallId,
                toolName,
                args: args as Record<string, unknown>,
                state: "executing",
              };

              toolInvocationsRef.current.set(toolCallId, invocation);

              // Update the assistant message with the new tool invocation immediately
              const currentMessage = useConversationalAIStore
                .getState()
                .messages.find((m) => m.id === assistantMessageId);

              if (currentMessage) {
                const updatedInvocations = Array.from(
                  toolInvocationsRef.current.values(),
                );
                const updatedMessage: Message = {
                  ...currentMessage,
                  toolInvocations: updatedInvocations,
                };

                // Update the message in the store
                const store = useConversationalAIStore.getState();
                const messageIndex = store.messages.findIndex(
                  (m) => m.id === assistantMessageId,
                );

                if (messageIndex !== -1) {
                  const updatedMessages = [...store.messages];
                  updatedMessages[messageIndex] = updatedMessage;

                  // Update both messages and session
                  if (store.currentSessionId) {
                    const session = store.sessions.get(store.currentSessionId);
                    if (session) {
                      const sessions = new Map(store.sessions);
                      sessions.set(store.currentSessionId, {
                        ...session,
                        messages: updatedMessages,
                        updatedAt: new Date(),
                      });

                      useConversationalAIStore.setState({
                        messages: updatedMessages,
                        sessions,
                      });
                    }
                  } else {
                    useConversationalAIStore.setState({
                      messages: updatedMessages,
                    });
                  }
                }
              }

              // Notify callback
              onToolCall?.(toolName, args);

              void logger.info(`Tool call: ${toolName}`, { args });
            },
            onToolResult: (toolName: string, result: unknown) => {
              // Find the most recent invocation for this tool
              const invocations = Array.from(
                toolInvocationsRef.current.values(),
              );
              const invocation = invocations
                .reverse()
                .find(
                  (inv) =>
                    inv.toolName === toolName && inv.state === "executing",
                );

              if (invocation) {
                invocation.result = result;

                // Check if the result indicates failure
                const isFailure =
                  (result as any)?.success === false ||
                  (result as any)?.error !== undefined;

                invocation.state = isFailure ? "failed" : "completed";
                toolInvocationsRef.current.set(
                  invocation.toolCallId,
                  invocation,
                );

                // Update the assistant message with the completed/failed tool invocation
                const currentMessage = useConversationalAIStore
                  .getState()
                  .messages.find((m) => m.id === assistantMessageId);

                if (currentMessage) {
                  const updatedInvocations = Array.from(
                    toolInvocationsRef.current.values(),
                  );
                  const updatedMessage: Message = {
                    ...currentMessage,
                    toolInvocations: updatedInvocations,
                  };

                  // Update the message in the store
                  const store = useConversationalAIStore.getState();
                  const messageIndex = store.messages.findIndex(
                    (m) => m.id === assistantMessageId,
                  );

                  if (messageIndex !== -1) {
                    const updatedMessages = [...store.messages];
                    updatedMessages[messageIndex] = updatedMessage;

                    // Update both messages and session
                    if (store.currentSessionId) {
                      const session = store.sessions.get(
                        store.currentSessionId,
                      );
                      if (session) {
                        const sessions = new Map(store.sessions);
                        sessions.set(store.currentSessionId, {
                          ...session,
                          messages: updatedMessages,
                          updatedAt: new Date(),
                        });

                        useConversationalAIStore.setState({
                          messages: updatedMessages,
                          sessions,
                        });
                      }
                    } else {
                      useConversationalAIStore.setState({
                        messages: updatedMessages,
                      });
                    }
                  }
                }
              }

              // Notify callback
              onToolResult?.(toolName, result);

              void logger.info(`Tool result: ${toolName}`, {
                result,
                success: !(result as any)?.error,
              });
            },
            onConfirmationRequested: (
              confirmationId: string,
              prompt: string,
              severity: "low" | "medium" | "high",
            ) => {
              // Get the confirmation details from ConfirmationManager
              const confirmationManager = ConfirmationManager.getInstance();
              const pending = confirmationManager.getPending(confirmationId);

              if (pending) {
                // Update the assistant message with confirmation metadata
                const currentMessage = useConversationalAIStore
                  .getState()
                  .messages.find((m) => m.id === assistantMessageId);

                if (currentMessage) {
                  const updatedMessage: Message = {
                    ...currentMessage,
                    metadata: {
                      ...currentMessage.metadata,
                      confirmation: {
                        id: pending.id,
                        action: pending.action,
                        target: pending.target,
                        severity: pending.severity,
                        toolName: pending.toolName,
                        params: pending.params,
                        timestamp: pending.timestamp,
                      },
                    },
                  };

                  // Update the message in the store
                  const store = useConversationalAIStore.getState();
                  const messageIndex = store.messages.findIndex(
                    (m) => m.id === assistantMessageId,
                  );

                  if (messageIndex !== -1) {
                    const updatedMessages = [...store.messages];
                    updatedMessages[messageIndex] = updatedMessage;

                    // Update both messages and session
                    if (store.currentSessionId) {
                      const session = store.sessions.get(
                        store.currentSessionId,
                      );
                      if (session) {
                        const sessions = new Map(store.sessions);
                        sessions.set(store.currentSessionId, {
                          ...session,
                          messages: updatedMessages,
                          updatedAt: new Date(),
                        });

                        useConversationalAIStore.setState({
                          messages: updatedMessages,
                          sessions,
                        });
                      }
                    } else {
                      useConversationalAIStore.setState({
                        messages: updatedMessages,
                      });
                    }
                  }
                }
              }

              // Notify callback
              onConfirmationRequested?.(confirmationId, prompt, severity);

              void logger.info("Confirmation requested", {
                confirmationId,
                prompt,
                severity,
              });
            },
            onWorkflowProgress: (
              workflowId: string,
              workflowName: string,
              stepId: string,
              stepIndex: number,
              totalSteps: number,
            ) => {
              // Update the assistant message with workflow progress
              const currentMessage = useConversationalAIStore
                .getState()
                .messages.find((m) => m.id === assistantMessageId);

              if (currentMessage) {
                const updatedMessage: Message = {
                  ...currentMessage,
                  metadata: {
                    ...currentMessage.metadata,
                    workflowProgress: {
                      workflowId,
                      workflowName,
                      currentStepId: stepId,
                      currentStepIndex: stepIndex,
                      totalSteps,
                      stepDescription: undefined, // Will be updated by workflow engine
                      state: "executing",
                      startTime:
                        currentMessage.metadata?.workflowProgress?.startTime ??
                        Date.now(),
                    },
                  },
                };

                // Update the message in the store
                const store = useConversationalAIStore.getState();
                const messageIndex = store.messages.findIndex(
                  (m) => m.id === assistantMessageId,
                );

                if (messageIndex !== -1) {
                  const updatedMessages = [...store.messages];
                  updatedMessages[messageIndex] = updatedMessage;

                  // Update both messages and session
                  if (store.currentSessionId) {
                    const session = store.sessions.get(store.currentSessionId);
                    if (session) {
                      const sessions = new Map(store.sessions);
                      sessions.set(store.currentSessionId, {
                        ...session,
                        messages: updatedMessages,
                        updatedAt: new Date(),
                      });

                      useConversationalAIStore.setState({
                        messages: updatedMessages,
                        sessions,
                      });
                    }
                  } else {
                    useConversationalAIStore.setState({
                      messages: updatedMessages,
                    });
                  }
                }
              }

              // Notify callback
              onWorkflowProgress?.(
                workflowId,
                workflowName,
                stepId,
                stepIndex,
                totalSteps,
              );

              void logger.info("Workflow progress", {
                workflowId,
                workflowName,
                stepId,
                stepIndex,
                totalSteps,
              });
            },
            onComplete: (
              _fullText: string,
              metadata?: {
                reasoningText?: string;
                usage?: {
                  promptTokens: number;
                  completionTokens: number;
                  totalTokens: number;
                };
              },
            ) => {
              void logger.info("onComplete called in useAIChat", {
                fullTextLength: _fullText.length,
                assistantMessageId,
              });

              // Calculate response time
              const duration = Date.now() - startTime;

              // Update message with final tool invocations and metadata
              const finalInvocations = Array.from(
                toolInvocationsRef.current.values(),
              );

              const currentMessage = useConversationalAIStore
                .getState()
                .messages.find((m) => m.id === assistantMessageId);

              if (currentMessage) {
                // Update the message in the store with tool invocations and metadata
                const updatedMessage: Message = {
                  ...currentMessage,
                  toolInvocations:
                    finalInvocations.length > 0
                      ? finalInvocations
                      : currentMessage.toolInvocations,
                  isStreaming: false,
                  metadata: {
                    ...currentMessage.metadata,
                    duration,
                    ...(metadata?.reasoningText && {
                      reasoningText: metadata.reasoningText,
                    }),
                    ...(metadata?.usage && {
                      usage: metadata.usage,
                      tokens: metadata.usage.totalTokens,
                    }),
                  },
                };

                // Replace the message in the store
                const store = useConversationalAIStore.getState();
                const messageIndex = store.messages.findIndex(
                  (m) => m.id === assistantMessageId,
                );

                if (messageIndex !== -1) {
                  const updatedMessages = [...store.messages];
                  updatedMessages[messageIndex] = updatedMessage;

                  // Update both messages and session
                  if (store.currentSessionId) {
                    const session = store.sessions.get(store.currentSessionId);
                    if (session) {
                      const sessions = new Map(store.sessions);
                      sessions.set(store.currentSessionId, {
                        ...session,
                        messages: updatedMessages,
                        updatedAt: new Date(),
                      });

                      useConversationalAIStore.setState({
                        messages: updatedMessages,
                        sessions,
                      });
                    }
                  } else {
                    useConversationalAIStore.setState({
                      messages: updatedMessages,
                    });
                  }
                }
              }

              completeStreamingMessage(assistantMessageId);
              setStreamingState(false);
              setLoadingState(false);

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
                  const { ConversationalAIService } = await import(
                    "@/services/ai/conversational-ai/ConversationalAIService"
                  );
                  const service = ConversationalAIService.getInstance();
                  const title = await service.generateConversationTitle(
                    session.messages,
                  );
                  if (title && title.length > 0) {
                    store.setCurrentSessionTitle(title);
                  }
                } catch (titleError) {
                  void logger.error("Failed to generate conversation title", {
                    error:
                      titleError instanceof Error
                        ? titleError.message
                        : String(titleError),
                  });
                }
              })();
            },
            onError: (err: Error) => {
              setErrorState(err);
              setMessageError(
                assistantMessageId,
                err.message,
                `I encountered an error: ${err.message}`,
              );
              completeStreamingMessage(assistantMessageId);
              setStreamingState(false);
              setLoadingState(false);

              void logger.error("AI chat error", {
                error: err.message,
              });
            },
          },
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setErrorState(error);
        setMessageError(
          assistantMessageId,
          error.message,
          `I encountered an error: ${error.message}`,
        );
        completeStreamingMessage(assistantMessageId);
        setStreamingState(false);
        setLoadingState(false);

        void logger.error("AI chat error", {
          error: error.message,
        });
      } finally {
        abortControllerRef.current = null;
        assistantMessageIdRef.current = "";
      }
    },
    [
      messages,
      addMessage,
      addStreamingChunk,
      completeStreamingMessage,
      setMessageError,
      setLoadingState,
      setStreamingState,
      setErrorState,
      onToolCall,
      onToolResult,
      onConfirmationRequested,
      onWorkflowProgress,
    ],
  );

  return {
    sendMessage,
    isLoading,
    isStreaming,
    error,
  };
}
