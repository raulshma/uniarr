/**
 * Optimized selectors for the Conversational AI store.
 *
 * CRITICAL PATTERN: Always use separate selector calls for each primitive value
 * instead of returning object literals. This prevents useSyncExternalStore
 * infinite loops and unnecessary re-renders.
 *
 * ❌ WRONG:
 * ```typescript
 * const { isLoading, isStreaming } = useConversationalAIStore(state => ({
 *   isLoading: state.isLoading,
 *   isStreaming: state.isStreaming,
 * }));
 * ```
 *
 * ✅ CORRECT:
 * ```typescript
 * const isLoading = useConversationalAIStore(selectIsLoading);
 * const isStreaming = useConversationalAIStore(selectIsStreaming);
 * ```
 *
 * This file provides all commonly-used selectors to enforce this pattern.
 */

import type {
  AssistantConfig,
  ConversationSession,
  Message,
} from "@/models/chat.types";
import type { ConversationalAIState } from "@/store/conversationalAIStore";

/**
 * Select the current messages array.
 * Use this to get the complete conversation history.
 */
export const selectMessages = (state: ConversationalAIState): Message[] =>
  state.messages;

/**
 * Select whether the store is currently loading.
 * Use this for loading spinners or disabled states.
 */
export const selectIsLoading = (state: ConversationalAIState): boolean =>
  state.isLoading;

/**
 * Select whether a message is currently streaming.
 * Use this to show typing indicators or lock input.
 */
export const selectIsStreaming = (state: ConversationalAIState): boolean =>
  state.isStreaming;

/**
 * Select the current error, if any.
 * Use this to display error messages to the user.
 */
export const selectError = (state: ConversationalAIState): Error | null =>
  state.error;

/**
 * Select the ID of the currently loaded session.
 * Use this to track which conversation is active.
 */
export const selectCurrentSessionId = (
  state: ConversationalAIState,
): string | null => state.currentSessionId;

/**
 * Select the assistant configuration.
 * Use this to read user preferences for streaming, voice input, etc.
 */
export const selectConfig = (state: ConversationalAIState): AssistantConfig =>
  state.config;

/**
 * Select all sessions.
 * Note: This returns the Map directly. Use selectSessions() in components
 * that need to iterate, as Maps maintain referential equality.
 */
export const selectSessions = (
  state: ConversationalAIState,
): Map<string, ConversationSession> => state.sessions;

/**
 * Select the count of messages in the current conversation.
 * Use this to determine if chat is empty (e.g., show starter questions).
 */
export const selectMessageCount = (state: ConversationalAIState): number =>
  state.messages.length;

/**
 * Select the last message in the conversation, or null if empty.
 * Use this to scroll to the latest message or check the last response.
 */
export const selectLastMessage = (
  state: ConversationalAIState,
): Message | null => {
  if (state.messages.length === 0) {
    return null;
  }
  const last = state.messages[state.messages.length - 1];
  return last ?? null;
};

/**
 * Select the current session object.
 * Use this to read the full session details (title, createdAt, etc.).
 */
export const selectCurrentSession = (
  state: ConversationalAIState,
): ConversationSession | null => {
  if (!state.currentSessionId) {
    return null;
  }

  return state.sessions.get(state.currentSessionId) ?? null;
};

/**
 * Select a list of non-archived sessions sorted by most recent first.
 * Use this for session lists in the UI.
 */
export const selectActiveSessions = (
  state: ConversationalAIState,
): ConversationSession[] =>
  Array.from(state.sessions.values())
    .filter((session) => !session.archived)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

/**
 * Select whether both loading and streaming are false (message send complete).
 * Use this to determine if the UI can accept new input.
 */
export const selectIsIdle = (state: ConversationalAIState): boolean =>
  !state.isLoading && !state.isStreaming;

/**
 * Select whether the assistant is currently processing (loading or streaming).
 * Use this to disable input fields while the AI is responding.
 */
export const selectIsProcessing = (state: ConversationalAIState): boolean =>
  state.isLoading || state.isStreaming;

/**
 * Select the maximum history length from config.
 * Use this to understand pagination boundaries or trimming limits.
 */
export const selectMaxHistoryLength = (state: ConversationalAIState): number =>
  state.config.maxHistoryLength;

/**
 * Select whether streaming is enabled in the config.
 * Use this to determine if progressive updates should be displayed.
 */
export const selectStreamingEnabled = (state: ConversationalAIState): boolean =>
  state.config.enableStreaming;

/**
 * Select whether voice input is allowed.
 * Use this to show or hide voice input buttons.
 */
export const selectVoiceInputAllowed = (
  state: ConversationalAIState,
): boolean => state.config.allowVoiceInput;

/**
 * Select whether auto-save is enabled.
 * Use this to determine persistence behavior.
 */
export const selectAutoSaveEnabled = (state: ConversationalAIState): boolean =>
  state.config.autoSaveSessions;

/**
 * Select the preferred chat text size. This controls rendered font sizes in
 * the chat surface (user messages + markdown rendering).
 */
export const selectChatTextSize = (
  state: ConversationalAIState,
): AssistantConfig["chatTextSize"] => state.config.chatTextSize;
