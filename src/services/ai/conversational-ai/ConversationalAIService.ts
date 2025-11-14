import { AIRateLimiter } from "@/services/ai/core/AIRateLimiter";
import { AIService } from "@/services/ai/core/AIService";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { apiLogger } from "@/services/logger/ApiLoggerService";
import { logger } from "@/services/logger/LoggerService";
import { handleApiError, type ErrorContext } from "@/utils/error.utils";
import { withRetry, networkRetryCondition } from "@/utils/retry.utils";
import type { Message } from "@/models/chat.types";

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
  private readonly connectorManager: ConnectorManager;
  private readonly apiLogger = apiLogger;

  private constructor() {
    this.aiService = AIService.getInstance();
    this.rateLimiter = AIRateLimiter.getInstance();
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
   */
  async streamResponse(
    userMessage: string,
    conversationHistory: Message[],
  ): Promise<AsyncIterable<string>> {
    const startTime = Date.now();
    const errorContext: ErrorContext = {
      operation: "conversational-ai.stream-response",
    };

    try {
      const historyCheck = this.rateLimiter.canMakeRequest("generic");
      if (!historyCheck.allowed) {
        throw new Error(
          historyCheck.message ??
            "Rate limit exceeded, please try again later.",
        );
      }

      const systemPrompt = await this.buildSystemPrompt();
      const formattedHistory = conversationHistory
        .map((message) => {
          const role = message.role === "assistant" ? "Assistant" : "User";
          return `${role}: ${message.text}`;
        })
        .join("\n");

      const fullPrompt = formattedHistory
        ? `${formattedHistory}\n\nUser: ${userMessage}`
        : userMessage;

      const streamResult = await this.rateLimiter.executeWithLimit(
        async () =>
          withRetry(() => this.aiService.streamText(fullPrompt, systemPrompt), {
            maxRetries: 2,
            baseDelay: 750,
            maxDelay: 5000,
            backoffFactor: 2,
            retryCondition: networkRetryCondition,
            context: errorContext,
          }),
        "generic",
      );

      const { textStream } = streamResult;

      const generator = async function* () {
        try {
          for await (const chunk of textStream as AsyncIterable<string>) {
            yield chunk;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          void logger.error("[ConversationalAI] Stream error encountered.", {
            error: message,
          });
          throw error;
        }
      };

      const durationMs = Date.now() - startTime;
      void this.apiLogger.addAiCall({
        provider: "google",
        model: "gemini-1.5-flash",
        operation: "conversational",
        status: "success",
        prompt: userMessage,
        durationMs,
      });

      return generator();
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const apiError = handleApiError(error, errorContext);

      await this.apiLogger.addAiCall({
        provider: "google",
        model: "gemini-1.5-flash",
        operation: "conversational",
        status: "error",
        prompt: userMessage,
        errorMessage: apiError.message,
        durationMs,
      });

      void logger.error("[ConversationalAI] Conversational streaming failed.", {
        error: apiError.message,
        code: apiError.code,
        messageLength: userMessage.length,
      });

      throw apiError;
    }
  }

  /**
   * Provide curated starter questions for first-time interactions.
   */
  async getStarterQuestions(): Promise<string[]> {
    const starters = [
      "Why is Sonarr not finding episodes?",
      "What should I watch tonight?",
      "Is my storage running low?",
      "What's the most popular release group this week?",
      "Can you help optimize my download settings?",
      "What quality should I use for anime?",
      "Tell me about the latest episodes in my library",
      "How's my system health overall?",
      "What media am I missing similar to my favorites?",
    ];

    return starters.slice(0, 3);
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
}
