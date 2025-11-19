import { AIRateLimiter } from "@/services/ai/core/AIRateLimiter";
import { AIService } from "@/services/ai/core/AIService";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";
import { handleApiError, type ErrorContext } from "@/utils/error.utils";
import { withRetry, networkRetryCondition } from "@/utils/retry.utils";
import type { Message } from "@/models/chat.types";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";

/**
 * Represents a snapshot of a connector's state for building the system prompt.
 */
interface ServiceStateSnapshot {
  name: string;
  type: string;
  status: string;
  version?: string;
}

/**
 * Conversational AI Assistant Service
 * Manages bidirectional chat with context about user's media infrastructure.
 */
export class ConversationalAIService {
  private static instance: ConversationalAIService | null = null;

  private readonly aiService: AIService;
  private readonly rateLimiter: AIRateLimiter;
  private readonly providerManager: AIProviderManager;
  private readonly connectorManager: ConnectorManager;

  private constructor() {
    this.aiService = AIService.getInstance();
    this.rateLimiter = AIRateLimiter.getInstance();
    this.providerManager = AIProviderManager.getInstance();
    this.connectorManager = ConnectorManager.getInstance();
  }

  static getInstance(): ConversationalAIService {
    if (!ConversationalAIService.instance) {
      ConversationalAIService.instance = new ConversationalAIService();
    }

    return ConversationalAIService.instance;
  }

  /**
   * Build system prompt with current infrastructure context for the LLM.
   */
  private async buildSystemPrompt(): Promise<string> {
    try {
      const connectors = this.connectorManager.getAllConnectors();

      const serviceStates: ServiceStateSnapshot[] = await Promise.all(
        connectors.map(async (connector) => {
          try {
            const [health, version] = await Promise.all([
              connector.getHealth?.(),
              connector
                .getVersion()
                .then((value) => value)
                .catch(() => undefined),
            ]);
            return {
              name: connector.config.name,
              type: connector.config.type,
              status: health?.status ?? "unknown",
              version,
            } satisfies ServiceStateSnapshot;
          } catch (error) {
            void logger.warn(
              "[ConversationalAI] Failed to fetch connector health.",
              {
                serviceId: connector.config.id,
                serviceType: connector.config.type,
                error: error instanceof Error ? error.message : String(error),
              },
            );

            return {
              name: connector.config.name,
              type: connector.config.type,
              status: "error",
            } satisfies ServiceStateSnapshot;
          }
        }),
      );

      const servicesSummary = serviceStates
        .map((service) => {
          const versionInfo = service.version ? ` [v${service.version}]` : "";
          return `- ${service.name} (${service.type}): ${service.status}${versionInfo}`;
        })
        .join("\n");

      return `You are UniArr, an intelligent assistant for media management infrastructure.

You have access to real-time information about the user's media services:

${servicesSummary}

Your capabilities:
1. Analyze service health and diagnose issues
2. Query media databases (TMDB, MyAnimeList, etc.)
3. Review download history and patterns
4. Recommend media based on user taste
5. Suggest optimizations for performance
6. Explain technical concepts in simple terms
7. Help with configuration and setup

Guidelines:
- Be specific and reference actual data from the user's system
- If you need to query multiple services, be transparent
- Provide actionable advice, not just information
- Admit limitations when you can't solve something
- For technical issues, guide the user through diagnostics
- Keep responses conversational but informative
- Use emoji sparingly for clarity
- If something would require real-time API calls you don't have, be honest

Conversation History:
Please use the conversation history provided to maintain context and continuity.`;
    } catch (error) {
      void logger.error("[ConversationalAI] Failed to build system prompt.", {
        error: error instanceof Error ? error.message : String(error),
      });

      return `You are UniArr, an intelligent assistant for media management infrastructure.
Help users with their media services, answer questions, and provide recommendations.
Be conversational, specific, and helpful.`;
    }
  }

  /**
   * Stream a response to a user message while emitting incremental chunks.
   * Uses the conversational AI specific provider/model configuration.
   */
  async streamResponse(
    userMessage: string,
    conversationHistory: Message[],
  ): Promise<AsyncIterable<string>> {
    const errorContext: ErrorContext = {
      operation: "conversational-ai.stream-response",
    };

    try {
      // Get configuration from store
      const state = useConversationalAIConfigStore.getState();
      const provider = state.selectedProvider;
      const model = state.selectedModel;
      const keyId = state.selectedKeyId;

      if (!provider || !model || !keyId) {
        throw new Error(
          "No AI provider configured for conversational AI. Please select a provider and model in settings.",
        );
      }

      const historyCheck = this.rateLimiter.canMakeRequest("generic");
      if (!historyCheck.allowed) {
        throw new Error(
          historyCheck.message ??
            "Rate limit exceeded, please try again later.",
        );
      }

      const systemPrompt = await this.buildSystemPrompt();
      const formattedHistory = conversationHistory
        .map((m) => {
          return `${m.role === "assistant" ? "Assistant" : "User"}: ${m.text}`;
        })
        .join("\n");

      const fullPrompt = formattedHistory
        ? `${formattedHistory}\n\nUser: ${userMessage}`
        : userMessage;

      // Use plain text streaming directly (more stable than structured streaming)
      const streamResult = await this.rateLimiter.executeWithLimit(
        async () =>
          withRetry(
            () =>
              this.aiService.streamText(fullPrompt, systemPrompt, {
                provider,
                model,
                keyId,
              }),
            {
              maxRetries: 2,
              baseDelay: 750,
              maxDelay: 5000,
              backoffFactor: 2,
              retryCondition: networkRetryCondition,
              context: errorContext,
            },
          ),
        "generic",
      );

      const streamGenerator = streamResult.textStream as AsyncIterable<string>;

      return streamGenerator;
    } catch (error) {
      const apiError = handleApiError(error, errorContext);

      void logger.error("[ConversationalAI] Conversational streaming failed.", {
        error: apiError.message,
        code: apiError.code,
        messageLength: userMessage.length,
      });

      throw apiError;
    }
  }

  /**
   * Generate a buffered response (non-streaming) for a user message.
   * Uses conversational AI provider selection, rate-limiting and logs the
   * result to ApiLogger
   */
  async generateResponse(
    userMessage: string,
    conversationHistory: Message[],
  ): Promise<string> {
    const errorContext = {
      operation: "conversational-ai.generate-response",
    };

    try {
      // Get configuration from store
      const state = useConversationalAIConfigStore.getState();
      const provider = state.selectedProvider;
      const model = state.selectedModel;
      const keyId = state.selectedKeyId;

      if (!provider || !model || !keyId) {
        throw new Error(
          "No AI provider configured for conversational AI. Please select a provider and model in settings.",
        );
      }

      const historyCheck = this.rateLimiter.canMakeRequest("generic");
      if (!historyCheck.allowed) {
        throw new Error(
          historyCheck.message ??
            "Rate limit exceeded, please try again later.",
        );
      }

      const systemPrompt = await this.buildSystemPrompt();
      let formattedHistory = "";
      for (const m of conversationHistory) {
        if (formattedHistory.length) {
          formattedHistory += "\n";
        }
        formattedHistory += `${m.role === "assistant" ? "Assistant" : "User"}: ${m.text}`;
      }

      const fullPrompt = formattedHistory
        ? `${formattedHistory}\n\nUser: ${userMessage}`
        : userMessage;

      const result = await this.aiService.generateText(
        fullPrompt,
        systemPrompt,
        {
          provider,
          model,
          keyId,
        },
      );
      const text = (result?.text ?? "") as string;
      if (!text.trim()) {
        throw new Error("AI provider returned an empty response.");
      }

      return text;
    } catch (err) {
      const apiError = handleApiError(err, errorContext);
      void logger.error("[ConversationalAI] Conversational generate failed.", {
        error: apiError.message,
      });
      throw apiError;
    }
  }

  /**
   * Generate a concise conversation title from the first user/assistant exchange.
   * Returns a sanitized title (Title Case, 4–7 words, no quotes/punctuation).
   */
  async generateConversationTitle(history: Message[]): Promise<string | null> {
    try {
      // Get configuration from store
      const state = useConversationalAIConfigStore.getState();

      // Use title specific config if available, otherwise fallback to chat config
      const provider = state.selectedTitleProvider || state.selectedProvider;
      const model = state.selectedTitleModel || state.selectedModel;
      const keyId = state.selectedTitleKeyId || state.selectedKeyId;

      if (!provider || !model || !keyId) {
        return null;
      }

      const firstUser = history.find((m) => m.role === "user");
      const firstAssistant = history.find((m) => m.role === "assistant");

      if (!firstUser || !firstAssistant) {
        return null;
      }

      const prompt = `You are tasked with naming a chat conversation. Generate a short, human-friendly title summarizing the initial exchange. Follow rules:
- 4 to 7 words
- Title Case
- No punctuation, emojis, quotes, or brackets
- No leading/trailing whitespace
- Avoid generic words like Chat, Conversation

Context:
User: ${firstUser.text}
Assistant: ${firstAssistant.text}

Return only the title.`;

      try {
        const result = await this.aiService.generateText(prompt, undefined, {
          provider,
          model,
          keyId,
        });
        const raw = (result?.text ?? "").trim();
        if (!raw) {
          return null;
        }

        const sanitized = this.sanitizeTitle(raw);
        return sanitized || null;
      } catch (error) {
        logger.warn("[ConversationalAI] Title generation failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    } catch (error) {
      logger.warn("[ConversationalAI] Title generation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private sanitizeTitle(input: string): string {
    const withoutQuotes = input.replace(/["'`]/g, "");
    const withoutPunct = withoutQuotes.replace(/[\p{P}\p{S}]/gu, "");
    const collapsed = withoutPunct.replace(/\s+/g, " ").trim();
    const words = collapsed.split(" ");
    const limited = words
      .slice(0, Math.max(4, Math.min(7, words.length)))
      .join(" ");
    const titleCase = limited
      .toLowerCase()
      .split(" ")
      .map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : w))
      .join(" ");
    return titleCase;
  }

  /**
   * Provide starter questions for first-time interactions.
   * Context-aware questions based on available services.
   */
  async getStarterQuestions(): Promise<string[]> {
    try {
      const connectors = this.connectorManager.getAllConnectors();
      const hasServices = connectors.length > 0;

      if (!hasServices) {
        return [
          "What services can I add to UniArr?",
          "How do I get started with media management?",
          "Tell me about UniArr features",
        ];
      }

      const questions = [
        "What's the current status of all my services?",
        "Are there any issues with my media setup?",
        "How can I optimize my download performance?",
      ];

      // Add service-specific questions based on available connectors
      const hasMediaLibraries = connectors.some((c) =>
        ["radarr", "sonarr", "lidarr", "readarr"].includes(c.config.type),
      );
      const hasDownloadClients = connectors.some((c) =>
        ["qbittorrent", "transmission", "deluge", "sabnzbd"].includes(
          c.config.type,
        ),
      );
      const hasMediaServers = connectors.some((c) =>
        ["jellyfin", "plex", "emby"].includes(c.config.type),
      );

      if (hasMediaLibraries) {
        questions.push("What's upcoming in my media libraries?");
      }

      if (hasDownloadClients) {
        questions.push("Are there any active downloads?");
      }

      if (hasMediaServers) {
        questions.push("What can I watch right now?");
      }

      return questions.slice(0, 6); // Limit to 6 questions max
    } catch (error) {
      void logger.warn(
        "[ConversationalAI] Failed to generate starter questions.",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      return [
        "Hello! How can you help me manage my media?",
        "What services do I have configured?",
        "Can you check my system health?",
      ];
    }
  }

  /**
   * Determine if conversational AI has been configured and is ready for use.
   * Returns false immediately if not configured (doesn't throw).
   */
  async isReady(): Promise<boolean> {
    try {
      return await this.aiService.isConfigured();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logger.debug("[ConversationalAI] Not ready to initialize.", {
        error: message,
      });
      return false;
    }
  }

  /**
   * Create a new conversation session.
   * @param title - The title for the new conversation
   * @returns The session ID of the newly created conversation
   */
  createNewConversation(title: string): string {
    const sessionId = useConversationalAIStore.getState().createSession(title);
    return sessionId;
  }

  /**
   * Delete a conversation session.
   * @param sessionId - The ID of the session to delete
   */
  deleteConversation(sessionId: string): void {
    useConversationalAIStore.getState().deleteSession(sessionId);
  }

  /**
   * Load a conversation session.
   * @param sessionId - The ID of the session to load
   */
  loadConversation(sessionId: string): void {
    useConversationalAIStore.getState().loadSession(sessionId);
  }
}
