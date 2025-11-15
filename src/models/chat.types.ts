/**
 * Tool invocation state for tracking tool execution in messages.
 */
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  state: "pending" | "executing" | "completed" | "failed";
}

/**
 * Chat message types for conversational assistant.
 */
export interface Message {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean;
  error?: string;
  toolInvocations?: ToolInvocation[];
  metadata?: {
    tokens?: number;
    duration?: number;
    confidence?: number;
    thinking?: string;
    reasoningText?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    card?: {
      // Optional rich card payload used by assistant messages when rendering
      // media preview cards (poster, title, metadata and actions).
      id?: string;
      tmdbId?: number;
      title?: string;
      posterUrl?: string;
      backdropUrl?: string;
      year?: number;
      genres?: string[];
      overview?: string;
      source?: string;
    };
  };
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

export interface ConversationState {
  currentSessionId: string | null;
  sessions: Map<string, ConversationSession>;
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  isStreaming: boolean;
}

export interface AssistantConfig {
  enableStreaming: boolean;
  maxHistoryLength: number;
  autoSaveSessions: boolean;
  showTokenCount: boolean;
  allowVoiceInput: boolean;
  /** Preferred chat text size used for chat messages and markdown rendering */
  chatTextSize?: "extra-small" | "small" | "medium" | "large";
  /** Enable AI tools for service interaction (experimental) */
  enableTools?: boolean;
  /** Selected tool names to be available to the AI (when enableTools is true) */
  selectedTools?: string[];
}

export interface StreamingMessage {
  id: string;
  chunks: string[];
  currentText: string;
  isComplete: boolean;
}
