import { streamText, generateText, type LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logger } from "@/services/logger/LoggerService";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import type { AIProviderType } from "@/types/ai/AIProvider";
import { ToolRegistry } from "@/services/ai/tools/ToolRegistry";
import {
  ToolError,
  ToolErrorCategory,
  isToolError,
} from "@/services/ai/tools/types";

/**
 * Represents a message in the conversation history.
 * Compatible with Vercel AI SDK message format.
 */
export interface ChatMessage {
  /** Role of the message sender */
  role: "user" | "assistant" | "system";
  /** Content of the message */
  content: string;
  /** Optional tool invocations associated with this message */
  toolInvocations?: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
  }[];
}

/**
 * Options for streaming chat responses.
 * Provides callbacks for various stages of the streaming process.
 */
export interface StreamOptions {
  /** Called when a text chunk is received */
  onChunk?: (chunk: string) => void;
  /** Called when a tool is invoked by the LLM */
  onToolCall?: (toolName: string, args: unknown) => void;
  /** Called when a tool execution completes */
  onToolResult?: (toolName: string, result: unknown) => void;
  /** Called when the stream completes successfully */
  onComplete?: (fullText: string) => void;
  /** Called when an error occurs during streaming */
  onError?: (error: Error) => void;
}

/**
 * Main service for orchestrating LLM interactions with tool support.
 * Implements singleton pattern to ensure consistent state management.
 *
 * Features:
 * - Multi-provider support (OpenRouter, Google AI)
 * - Streaming responses
 * - Tool/function calling integration
 * - Automatic provider configuration from settings
 *
 * @example
 * ```typescript
 * const chatService = AIChatService.getInstance();
 * const messages = [{ role: 'user', content: 'Hello!' }];
 *
 * for await (const chunk of await chatService.sendMessage(messages)) {
 *   console.log(chunk);
 * }
 * ```
 */
export class AIChatService {
  private static instance: AIChatService | null = null;
  private readonly keyManager: AIKeyManager;
  private readonly toolRegistry: ToolRegistry;

  private constructor() {
    this.keyManager = AIKeyManager.getInstance();
    this.toolRegistry = ToolRegistry.getInstance();
    void logger.info("AIChatService initialized");
  }

  /**
   * Get the singleton instance of AIChatService
   */
  static getInstance(): AIChatService {
    if (!AIChatService.instance) {
      AIChatService.instance = new AIChatService();
    }
    return AIChatService.instance;
  }

  /**
   * Get the configured LLM model based on user settings.
   * Retrieves provider, model, and API key from the conversational AI config store.
   *
   * @returns Configured LanguageModel instance
   * @throws {Error} If no valid configuration is found or API key is missing
   *
   * @example
   * ```typescript
   * const model = await chatService.getModel();
   * ```
   */
  async getModel(): Promise<LanguageModel> {
    // Get configuration from store
    const config = useConversationalAIConfigStore.getState().getConfig();

    if (!config.provider || !config.model || !config.keyId) {
      throw new Error(
        "No AI provider configured. Please configure a provider in Settings > AI Configuration.",
      );
    }

    // Retrieve API key from secure storage
    const keyConfig = await this.keyManager.getKey(config.keyId);

    if (!keyConfig) {
      throw new Error(
        `API key not found for key ID: ${config.keyId}. Please reconfigure your AI provider.`,
      );
    }

    // Update last used timestamp
    await this.keyManager.updateLastUsed(config.keyId);

    // Create and return the appropriate model
    return this.createModel(config.provider, config.model, keyConfig.apiKey);
  }

  /**
   * Create a language model instance for the specified provider.
   *
   * @param provider - The AI provider type
   * @param modelName - The model identifier
   * @param apiKey - The API key for authentication
   * @returns Configured LanguageModel instance
   * @throws {Error} If the provider is not supported
   */
  private createModel(
    provider: AIProviderType,
    modelName: string,
    apiKey: string,
  ): LanguageModel {
    switch (provider) {
      case "openrouter": {
        const openrouter = createOpenRouter({
          apiKey,
        });
        void logger.debug("Created OpenRouter model", { modelName });
        return openrouter(modelName);
      }

      case "google": {
        const googleProvider = createGoogleGenerativeAI({
          apiKey,
        });
        void logger.debug("Created Google AI model", { modelName });
        return googleProvider(modelName);
      }

      case "openai":
      case "anthropic":
        throw new Error(
          `Provider ${provider} is not yet supported. Please use OpenRouter or Google AI.`,
        );

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Send a message to the LLM and receive a streaming response.
   * This is the basic chat method without tool support.
   *
   * @param messages - Array of conversation messages
   * @param options - Optional streaming callbacks
   * @returns AsyncIterable that yields text chunks as they arrive
   * @throws {Error} If model configuration fails or streaming errors occur
   *
   * @example
   * ```typescript
   * const messages = [
   *   { role: 'system', content: 'You are a helpful assistant.' },
   *   { role: 'user', content: 'What is the weather like?' }
   * ];
   *
   * for await (const chunk of await chatService.sendMessage(messages, {
   *   onChunk: (text) => console.log(text),
   *   onComplete: (fullText) => console.log('Done:', fullText),
   *   onError: (error) => console.error(error)
   * })) {
   *   // Process each chunk
   * }
   * ```
   */
  async sendMessage(
    messages: ChatMessage[],
    options?: StreamOptions,
  ): Promise<AsyncIterable<string>> {
    try {
      void logger.debug("Sending message to LLM", {
        messageCount: messages.length,
        hasOptions: !!options,
      });

      // Get the configured model
      const model = await this.getModel();

      // Start streaming
      const result = await streamText({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      // Create an async generator to handle the stream
      const formatError = this.formatError.bind(this);
      async function* streamGenerator() {
        let fullText = "";

        try {
          for await (const chunk of result.textStream) {
            fullText += chunk;

            // Call onChunk callback if provided
            if (options?.onChunk) {
              options.onChunk(chunk);
            }

            yield chunk;
          }

          // Call onComplete callback if provided
          if (options?.onComplete) {
            options.onComplete(fullText);
          }

          void logger.debug("Message streaming completed", {
            textLength: fullText.length,
          });
        } catch (error) {
          const errorObj =
            error instanceof Error ? error : new Error(String(error));

          void logger.error("Error during message streaming", {
            error: errorObj.message,
            formattedError: formatError(errorObj),
          });

          // Call onError callback if provided
          if (options?.onError) {
            options.onError(errorObj);
          }

          throw errorObj;
        }
      }

      return streamGenerator();
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      void logger.error("Failed to send message", {
        error: errorObj.message,
        formattedError: this.formatError(errorObj),
      });

      // Call onError callback if provided
      if (options?.onError) {
        options.onError(errorObj);
      }

      throw errorObj;
    }
  }

  /**
   * Build a system prompt that describes UniArr and the available tools.
   * This provides context to the LLM about the application and its capabilities.
   *
   * @param availableToolNames - Array of tool names that are currently available
   * @returns System prompt string
   */
  private buildSystemPrompt(availableToolNames: string[]): string {
    const toolsList =
      availableToolNames.length > 0
        ? availableToolNames.map((name) => `- ${name}`).join("\n")
        : "No tools currently enabled";

    return `You are UniArr AI Assistant, an intelligent assistant for managing self-hosted media automation infrastructure.

**About UniArr:**
UniArr is a mobile-first unified interface that consolidates multiple media services (Sonarr, Radarr, qBittorrent, Jellyfin, Plex, etc.) into a single application. Users manage their entire media automation stack through this app.

**Your Capabilities:**
You have access to the following tools to interact with the user's services:

${toolsList}

**Guidelines:**
1. **Be Proactive**: Use tools to fetch real-time data when answering questions about the user's system
2. **Be Specific**: Reference actual data from their services (movie titles, download status, service health)
3. **Be Transparent**: Let users know when you're checking their services or performing actions
4. **Be Helpful**: Provide actionable advice and troubleshooting steps when issues arise
5. **Be Conversational**: Keep responses friendly and natural, not robotic
6. **Be Honest**: If you can't do something or need more information, say so clearly
7. **Use Tools Wisely**: Only call tools when necessary to answer the user's question

**Context Awareness:**
- Users are managing self-hosted media servers and automation tools
- They may have multiple instances of the same service type (e.g., multiple Radarr instances)
- Services may be offline, misconfigured, or experiencing issues
- Users expect you to help diagnose problems and optimize their setup

**Response Style:**
- Keep responses concise but informative
- Use bullet points for lists or multiple items
- Avoid excessive technical jargon unless the user demonstrates technical knowledge
- Use emojis sparingly and only when they add clarity (e.g., ✅ for success, ⚠️ for warnings)

**Important:**
- Always verify service status before making assumptions
- When adding media, confirm the action was successful
- If a tool call fails, explain what went wrong and suggest alternatives
- Respect user privacy - never share or log sensitive information

Remember: You're here to make media management easier and more efficient for self-hosted enthusiasts.`;
  }

  /**
   * Send a message to the LLM with tool support and receive a streaming response.
   * The LLM can invoke registered tools to interact with external systems.
   *
   * @param messages - Array of conversation messages
   * @param options - Optional streaming callbacks
   * @returns AsyncIterable that yields text chunks and handles tool invocations
   * @throws {Error} If model configuration fails or streaming errors occur
   *
   * @example
   * ```typescript
   * const messages = [
   *   { role: 'user', content: 'What movies are in my library?' }
   * ];
   *
   * const toolInvocations: ToolInvocation[] = [];
   *
   * for await (const chunk of await chatService.sendMessageWithTools(messages, {
   *   onToolCall: (name, args) => console.log('Tool called:', name),
   *   onToolResult: (name, result) => console.log('Tool result:', result),
   *   onChunk: (text) => console.log(text),
   * })) {
   *   // Process each chunk
   * }
   * ```
   */
  async sendMessageWithTools(
    messages: ChatMessage[],
    options?: StreamOptions,
  ): Promise<AsyncIterable<string>> {
    try {
      void logger.debug("Sending message with tools to LLM", {
        messageCount: messages.length,
        toolCount: this.toolRegistry.count(),
        hasOptions: !!options,
      });

      // Get the configured model
      const model = await this.getModel();

      // Get tools from registry in Vercel AI SDK format
      const allTools = this.toolRegistry.toVercelTools();

      // Filter tools based on user's selected tools configuration
      const conversationalConfig = useConversationalAIStore.getState().config;
      const selectedTools = conversationalConfig.selectedTools;

      let tools = allTools;

      // If selectedTools is defined and not empty, filter to only include selected tools
      if (selectedTools && selectedTools.length > 0) {
        tools = Object.fromEntries(
          Object.entries(allTools).filter(([name]) =>
            selectedTools.includes(name),
          ),
        );

        void logger.debug("Tools filtered based on user selection", {
          availableTools: Object.keys(allTools),
          selectedTools,
          activeTools: Object.keys(tools),
        });
      } else {
        void logger.debug("All tools enabled (no filter applied)", {
          toolNames: Object.keys(tools),
        });
      }

      // Build system prompt with available tools
      const systemPrompt = this.buildSystemPrompt(Object.keys(tools));

      // Prepare messages with system prompt
      const messagesWithSystem: {
        role: "user" | "assistant" | "system";
        content: string;
      }[] = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      // Check if streaming is enabled
      const enableStreaming = conversationalConfig.enableStreaming;

      // Use streaming or non-streaming based on user preference
      if (enableStreaming) {
        // Start streaming with tools
        const result = await streamText({
          model,
          messages: messagesWithSystem,
          tools,
        });

        // Create an async generator to handle the stream and tool calls
        const formatError = this.formatError.bind(this);
        async function* streamGenerator() {
          let fullText = "";

          try {
            // Process the stream
            for await (const chunk of result.fullStream) {
              // Handle different chunk types
              if (chunk.type === "text-delta") {
                // Text chunk from the LLM
                const text = chunk.text;
                fullText += text;

                // Call onChunk callback if provided
                if (options?.onChunk) {
                  options.onChunk(text);
                }

                yield text;
              } else if (chunk.type === "tool-call") {
                // LLM is invoking a tool
                void logger.debug("Tool call initiated", {
                  toolName: chunk.toolName,
                  toolCallId: chunk.toolCallId,
                });

                // Call onToolCall callback if provided
                if (options?.onToolCall) {
                  options.onToolCall(chunk.toolName, chunk.input);
                }
              } else if (chunk.type === "tool-result") {
                // Tool execution completed
                void logger.debug("Tool result received", {
                  toolName: chunk.toolName,
                  toolCallId: chunk.toolCallId,
                });

                // Call onToolResult callback if provided
                if (options?.onToolResult) {
                  options.onToolResult(chunk.toolName, chunk.output);
                }
              }
            }

            // Call onComplete callback if provided
            if (options?.onComplete) {
              options.onComplete(fullText);
            }

            void logger.debug("Message with tools streaming completed", {
              textLength: fullText.length,
            });
          } catch (error) {
            const errorObj =
              error instanceof Error ? error : new Error(String(error));

            void logger.error("Error during message with tools streaming", {
              error: errorObj.message,
              formattedError: formatError(errorObj),
            });

            // Call onError callback if provided
            if (options?.onError) {
              options.onError(errorObj);
            }

            throw errorObj;
          }
        }

        return streamGenerator();
      } else {
        // Non-streaming mode: generate complete response at once
        const result = await generateText({
          model,
          messages: messagesWithSystem,
          tools,
        });

        // Create an async generator that yields the complete text at once
        const formatError = this.formatError.bind(this);
        async function* nonStreamGenerator() {
          try {
            const fullText = result.text;

            // Process tool calls if any
            if (result.toolCalls && result.toolCalls.length > 0) {
              for (const toolCall of result.toolCalls) {
                void logger.debug("Tool call initiated (non-streaming)", {
                  toolName: toolCall.toolName,
                  toolCallId: toolCall.toolCallId,
                });

                // Call onToolCall callback if provided
                if (options?.onToolCall) {
                  options.onToolCall(
                    toolCall.toolName,
                    "args" in toolCall ? toolCall.args : {},
                  );
                }
              }
            }

            // Process tool results if any
            if (result.toolResults && result.toolResults.length > 0) {
              for (const toolResult of result.toolResults) {
                void logger.debug("Tool result received (non-streaming)", {
                  toolName: toolResult.toolName,
                  toolCallId: toolResult.toolCallId,
                });

                // Call onToolResult callback if provided
                if (options?.onToolResult) {
                  options.onToolResult(
                    toolResult.toolName,
                    "result" in toolResult ? toolResult.result : undefined,
                  );
                }
              }
            }

            // Yield the complete text at once
            yield fullText;

            // Call onComplete callback if provided
            if (options?.onComplete) {
              options.onComplete(fullText);
            }

            void logger.debug("Message with tools (non-streaming) completed", {
              textLength: fullText.length,
            });
          } catch (error) {
            const errorObj =
              error instanceof Error ? error : new Error(String(error));

            void logger.error(
              "Error during message with tools (non-streaming)",
              {
                error: errorObj.message,
                formattedError: formatError(errorObj),
              },
            );

            // Call onError callback if provided
            if (options?.onError) {
              options.onError(errorObj);
            }

            throw errorObj;
          }
        }

        return nonStreamGenerator();
      }
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      void logger.error("Failed to send message with tools", {
        error: errorObj.message,
        formattedError: this.formatError(errorObj),
      });

      // Call onError callback if provided
      if (options?.onError) {
        options.onError(errorObj);
      }

      throw errorObj;
    }
  }

  /**
   * Format a ToolError into a user-friendly message.
   * Converts technical error details into actionable feedback for users.
   *
   * @param error - The ToolError to format
   * @returns User-friendly error message with actionable suggestions
   *
   * @example
   * ```typescript
   * try {
   *   // ... tool execution
   * } catch (error) {
   *   if (isToolError(error)) {
   *     const message = chatService.formatToolError(error);
   *     console.log(message);
   *   }
   * }
   * ```
   */
  formatToolError(error: ToolError): string {
    const baseMessage = `I encountered an issue: ${error.message}`;

    // Add actionable suggestion if available
    if (error.actionable) {
      return `${baseMessage} ${error.actionable}`;
    }

    // Provide category-specific default suggestions
    switch (error.category) {
      case ToolErrorCategory.SERVICE_NOT_CONFIGURED:
        return `${baseMessage} Please configure the required service in Settings > Services.`;

      case ToolErrorCategory.AUTH_FAILED:
        return `${baseMessage} Please check your API key and credentials in Settings > Services.`;

      case ToolErrorCategory.SERVICE_UNAVAILABLE:
        return `${baseMessage} Please check your network connection and ensure the service is running.`;

      case ToolErrorCategory.INVALID_PARAMETERS:
        return `${baseMessage} Please check the parameters and try again.`;

      case ToolErrorCategory.NETWORK_ERROR:
        return `${baseMessage} Please check your network connection. If you're using a VPN, try disconnecting it.`;

      case ToolErrorCategory.RATE_LIMIT_EXCEEDED:
        return `${baseMessage} Please wait a moment and try again.`;

      case ToolErrorCategory.OPERATION_FAILED:
      default:
        return `${baseMessage} Please try again or contact support if the issue persists.`;
    }
  }

  /**
   * Format a generic error into a user-friendly message.
   * Handles both ToolError and generic Error instances.
   *
   * @param error - The error to format
   * @returns User-friendly error message
   *
   * @example
   * ```typescript
   * try {
   *   // ... some operation
   * } catch (error) {
   *   const message = chatService.formatError(error);
   *   console.log(message);
   * }
   * ```
   */
  formatError(error: unknown): string {
    if (isToolError(error)) {
      return this.formatToolError(error);
    }

    if (error instanceof Error) {
      // Remove stack traces and technical details
      const message = error.message?.split("\n")[0] || "Unknown error";

      // Check for common error patterns
      if (message.includes("API key")) {
        return "There's an issue with your API key. Please check your AI provider configuration in Settings.";
      }

      if (message.includes("network") || message.includes("timeout")) {
        return "I'm having trouble connecting to the AI service. Please check your internet connection and try again.";
      }

      if (message.includes("rate limit")) {
        return "The AI service is currently rate-limited. Please wait a moment and try again.";
      }

      return `An error occurred: ${message}`;
    }

    return "An unexpected error occurred. Please try again.";
  }

  /**
   * Execute an operation with retry logic for transient failures.
   * Automatically retries on network errors and rate limits.
   *
   * @param operation - The async operation to execute
   * @param maxRetries - Maximum number of retry attempts (default: 2)
   * @param retryDelay - Delay between retries in milliseconds (default: 1000)
   * @returns Result of the operation
   * @throws {Error} If all retry attempts fail
   *
   * @example
   * ```typescript
   * const result = await chatService.withRetry(
   *   async () => await someOperation(),
   *   3,
   *   2000
   * );
   * ```
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    retryDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt === maxRetries) {
          // Don't retry or max retries reached
          throw lastError;
        }

        // Log retry attempt
        void logger.warn("Operation failed, retrying", {
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message,
        });

        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, attempt)),
        );
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error("Operation failed after retries");
  }

  /**
   * Check if an error is retryable (transient failure).
   *
   * @param error - The error to check
   * @returns True if the error is retryable, false otherwise
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message?.toLowerCase() || "";

    // Network errors
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    ) {
      return true;
    }

    // Rate limit errors
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }

    // Service unavailable
    if (message.includes("503") || message.includes("unavailable")) {
      return true;
    }

    // ToolError with specific categories
    if (isToolError(error)) {
      return (
        error.category === ToolErrorCategory.SERVICE_UNAVAILABLE ||
        error.category === ToolErrorCategory.NETWORK_ERROR ||
        error.category === ToolErrorCategory.RATE_LIMIT_EXCEEDED
      );
    }

    return false;
  }

  /**
   * Reset the singleton instance.
   * Primarily used for testing purposes.
   */
  static resetInstance(): void {
    if (AIChatService.instance) {
      AIChatService.instance = null;
      void logger.info("AIChatService instance reset");
    }
  }
}
