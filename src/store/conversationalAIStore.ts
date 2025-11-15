import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StoreApi } from "zustand";

import type {
  AssistantConfig,
  ConversationSession,
  Message,
} from "@/models/chat.types";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import { logger } from "@/services/logger/LoggerService";

const STORE_KEY = "conversational-ai-store";

const defaultConfig: AssistantConfig = {
  enableStreaming: false,
  maxHistoryLength: 50,
  autoSaveSessions: true,
  showTokenCount: false,
  allowVoiceInput: true,
  chatTextSize: "medium",
  enableTools: false,
  selectedTools: [],
};

export interface ConversationalAIState {
  sessions: Map<string, ConversationSession>;
  currentSessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  config: AssistantConfig;
  createSession: (title: string) => string;
  loadSession: (sessionId: string) => void;
  addMessage: (message: Message) => void;
  addStreamingChunk: (messageId: string, chunk: string) => void;
  completeStreamingMessage: (messageId: string) => void;
  setMessageError: (
    messageId: string,
    error: string,
    fallbackText?: string,
  ) => void;
  setError: (error: Error | null) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  clearHistory: () => void;
  deleteSession: (sessionId: string) => void;
  archiveSession: (sessionId: string) => void;
  updateConfig: (config: Partial<AssistantConfig>) => void;
  updateMessageMetadata: (
    messageId: string,
    metadata: Partial<Message["metadata"]>,
  ) => void;
  getSessions: () => ConversationSession[];
  getCurrentSession: () => ConversationSession | null;
  setCurrentSessionTitle: (title: string) => void;
}

type SerializableMessage = Omit<Message, "timestamp"> & {
  timestamp: string;
};

type SerializableSession = Omit<
  ConversationSession,
  "createdAt" | "updatedAt" | "messages"
> & {
  createdAt: string;
  updatedAt: string;
  messages: SerializableMessage[];
};

type SerializableSessions = [string, SerializableSession][];

let setStoreState: StoreApi<ConversationalAIState>["setState"] | null = null;

const serializeMessage = (message: Message): SerializableMessage => ({
  ...message,
  timestamp: message.timestamp.toISOString(),
});

const serializeSession = (
  session: ConversationSession,
): SerializableSession => ({
  ...session,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  messages: session.messages.map(serializeMessage),
});

const deserializeMessage = (message: SerializableMessage): Message => ({
  ...message,
  timestamp: new Date(message.timestamp),
  isStreaming: false,
});

const serializeSessions = (
  sessions: Map<string, ConversationSession>,
): SerializableSessions =>
  Array.from(sessions.entries()).map(([id, session]) => [
    id,
    serializeSession(session),
  ]);

const deserializeSessions = (
  serialized?: SerializableSessions | null,
): Map<string, ConversationSession> => {
  if (!serialized) {
    return new Map();
  }

  return new Map(
    serialized.map(([id, session]) => [
      id,
      {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map(deserializeMessage),
      },
    ]),
  );
};

const clampMessages = (messages: Message[], limit: number): Message[] => {
  if (limit > 0 && messages.length > limit) {
    return messages.slice(messages.length - limit);
  }

  return messages;
};

export const useConversationalAIStore = create<ConversationalAIState>()(
  persist(
    (set, get) => {
      setStoreState = set;
      return {
        sessions: new Map(),
        currentSessionId: null,
        messages: [],
        isLoading: false,
        isStreaming: false,
        error: null,
        config: defaultConfig,

        createSession: (title: string) => {
          const sessionId = `session-${Date.now()}`;
          const session: ConversationSession = {
            id: sessionId,
            title,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            archived: false,
          };

          set((state) => {
            const sessions = new Map(state.sessions);
            sessions.set(sessionId, session);

            return {
              sessions,
              currentSessionId: sessionId,
              messages: [],
            };
          });

          return sessionId;
        },

        loadSession: (sessionId: string) => {
          const session = get().sessions.get(sessionId);
          if (session) {
            set({
              currentSessionId: sessionId,
              messages: [...session.messages],
              error: null,
            });
          }
        },

        addMessage: (message: Message) => {
          set((state) => {
            const appended = [...state.messages, message];
            const trimmed = clampMessages(
              appended,
              state.config.maxHistoryLength,
            );

            if (!state.currentSessionId) {
              return { messages: trimmed };
            }

            const existingSession = state.sessions.get(state.currentSessionId);
            if (!existingSession) {
              return { messages: trimmed };
            }

            const sessions = new Map(state.sessions);
            sessions.set(state.currentSessionId, {
              ...existingSession,
              messages: trimmed,
              updatedAt: new Date(),
            });

            return {
              messages: trimmed,
              sessions,
            };
          });
        },

        addStreamingChunk: (messageId: string, chunk: string) => {
          set((state) => {
            const targetIndex = state.messages.findIndex(
              (msg) => msg.id === messageId,
            );

            if (targetIndex === -1) {
              return {};
            }

            const updatedMessages = state.messages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    text: msg.text + chunk,
                    isStreaming: true,
                  }
                : msg,
            );

            if (!state.currentSessionId) {
              return { messages: updatedMessages };
            }

            const existingSession = state.sessions.get(state.currentSessionId);
            if (!existingSession) {
              return { messages: updatedMessages };
            }

            const sessions = new Map(state.sessions);
            sessions.set(state.currentSessionId, {
              ...existingSession,
              messages: updatedMessages,
              updatedAt: new Date(),
            });

            return {
              messages: updatedMessages,
              sessions,
            };
          });
        },

        completeStreamingMessage: (messageId: string) => {
          set((state) => {
            const targetIndex = state.messages.findIndex(
              (msg) => msg.id === messageId,
            );

            if (targetIndex === -1) {
              return {};
            }

            const updatedMessages = state.messages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    isStreaming: false,
                  }
                : msg,
            );

            if (!state.currentSessionId) {
              return { messages: updatedMessages };
            }

            const existingSession = state.sessions.get(state.currentSessionId);
            if (!existingSession) {
              return { messages: updatedMessages };
            }

            const sessions = new Map(state.sessions);
            sessions.set(state.currentSessionId, {
              ...existingSession,
              messages: updatedMessages,
              updatedAt: new Date(),
            });

            return {
              messages: updatedMessages,
              sessions,
            };
          });
        },

        setMessageError: (
          messageId: string,
          errorMessage: string,
          fallbackText?: string,
        ) => {
          set((state) => {
            const targetIndex = state.messages.findIndex(
              (msg) => msg.id === messageId,
            );

            if (targetIndex === -1) {
              return {};
            }

            const updatedMessages = state.messages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    text: fallbackText ?? msg.text,
                    error: errorMessage,
                    isStreaming: false,
                  }
                : msg,
            );

            if (!state.currentSessionId) {
              return { messages: updatedMessages };
            }

            const existingSession = state.sessions.get(state.currentSessionId);
            if (!existingSession) {
              return { messages: updatedMessages };
            }

            const sessions = new Map(state.sessions);
            sessions.set(state.currentSessionId, {
              ...existingSession,
              messages: updatedMessages,
              updatedAt: new Date(),
            });

            return {
              messages: updatedMessages,
              sessions,
            };
          });
        },

        setError: (error: Error | null) => set({ error }),

        setLoading: (loading: boolean) => set({ isLoading: loading }),

        setStreaming: (streaming: boolean) => set({ isStreaming: streaming }),

        clearHistory: () => {
          set((state) => {
            if (!state.currentSessionId) {
              return { messages: [] };
            }

            const existingSession = state.sessions.get(state.currentSessionId);
            if (!existingSession) {
              return { messages: [] };
            }

            const sessions = new Map(state.sessions);
            sessions.set(state.currentSessionId, {
              ...existingSession,
              messages: [],
              updatedAt: new Date(),
            });

            return {
              messages: [],
              sessions,
            };
          });
        },

        deleteSession: (sessionId: string) => {
          set((state) => {
            const sessions = new Map(state.sessions);
            sessions.delete(sessionId);

            if (state.currentSessionId === sessionId) {
              return {
                sessions,
                currentSessionId: null,
                messages: [],
              };
            }

            return { sessions };
          });
        },

        archiveSession: (sessionId: string) => {
          set((state) => {
            const existingSession = state.sessions.get(sessionId);
            if (!existingSession) {
              return {};
            }

            const sessions = new Map(state.sessions);
            sessions.set(sessionId, {
              ...existingSession,
              archived: true,
              updatedAt: new Date(),
            });

            return { sessions };
          });
        },

        setCurrentSessionTitle: (title: string) => {
          set((state) => {
            const sessionId = state.currentSessionId;
            if (!sessionId) {
              return {};
            }

            const existingSession = state.sessions.get(sessionId);
            if (!existingSession) {
              return {};
            }

            const sessions = new Map(state.sessions);
            sessions.set(sessionId, {
              ...existingSession,
              title,
              updatedAt: new Date(),
            });

            return { sessions };
          });
        },

        updateConfig: (config: Partial<AssistantConfig>) => {
          set((state) => ({
            config: {
              ...defaultConfig,
              ...state.config,
              ...config,
            },
          }));
        },

        updateMessageMetadata: (messageId: string, metadata) => {
          set((state) => {
            const idx = state.messages.findIndex((m) => m.id === messageId);
            if (idx === -1) {
              return {};
            }

            const updatedMessages = state.messages.map((m) =>
              m.id === messageId
                ? { ...m, metadata: { ...m.metadata, ...metadata } }
                : m,
            );

            if (!state.currentSessionId) {
              return { messages: updatedMessages };
            }

            const existingSession = state.sessions.get(state.currentSessionId);
            if (!existingSession) {
              return { messages: updatedMessages };
            }

            const sessions = new Map(state.sessions);
            sessions.set(state.currentSessionId, {
              ...existingSession,
              messages: updatedMessages,
              updatedAt: new Date(),
            });

            return {
              messages: updatedMessages,
              sessions,
            };
          });
        },

        getSessions: () => {
          return Array.from(get().sessions.values())
            .filter((session) => !session.archived)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        },

        getCurrentSession: () => {
          const state = get();
          if (!state.currentSessionId) {
            return null;
          }

          return state.sessions.get(state.currentSessionId) ?? null;
        },
      };
    },
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => storageAdapter),
      partialize: (state) => ({
        sessions: serializeSessions(state.sessions),
        currentSessionId: state.currentSessionId,
        config: state.config,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          void logger.error("Failed to rehydrate conversational AI store", {
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        if (!state) {
          return;
        }

        const sessions = deserializeSessions(
          state.sessions as unknown as SerializableSessions | undefined,
        );

        const currentSessionId = state.currentSessionId ?? null;
        const currentMessages = currentSessionId
          ? (sessions.get(currentSessionId)?.messages ?? [])
          : [];

        setStoreState?.(() => ({
          sessions,
          currentSessionId,
          messages: [...currentMessages],
          config: {
            ...defaultConfig,
            ...(state.config ?? {}),
          },
          isLoading: false,
          isStreaming: false,
        }));
      },
    },
  ),
);
