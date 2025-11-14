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
  metadata?: {
    tokens?: number;
    duration?: number;
    confidence?: number;
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
}

export interface StreamingMessage {
  id: string;
  chunks: string[];
  currentText: string;
  isComplete: boolean;
}
