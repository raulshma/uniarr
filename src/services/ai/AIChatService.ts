import { streamText, generateText, stepCountIs, type LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logger } from "@/services/logger/LoggerService";
import { apiLogger } from "@/services/logger/ApiLoggerService";
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
import { ConfirmationManager } from "@/services/ai/tools/ConfirmationManager";
import { WorkflowEngine } from "@/services/ai/tools/WorkflowEngine";
import type { WorkflowProgressCallback } from "@/services/ai/tools/WorkflowEngine";
import {
  StreamingService,
  type ToolDefinition,
} from "@/services/ai/streaming/StreamingService";

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
  /** Called when a confirmation is requested */
  onConfirmationRequested?: (
    confirmationId: string,
    prompt: string,
    severity: "low" | "medium" | "high",
  ) => void;
  /** Called when the stream completes successfully */
  onComplete?: (
    fullText: string,
    metadata?: {
      reasoningText?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    },
  ) => void;
  /** Called when an error occurs during streaming */
  onError?: (error: Error) => void;
  /** Called when a workflow makes progress */
  onWorkflowProgress?: (
    workflowId: string,
    workflowName: string,
    stepId: string,
    stepIndex: number,
    totalSteps: number,
  ) => void;
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
  private readonly workflowEngine: WorkflowEngine;
  private readonly streamingService: StreamingService;

  private constructor() {
    this.keyManager = AIKeyManager.getInstance();
    this.toolRegistry = ToolRegistry.getInstance();
    this.workflowEngine = WorkflowEngine.getInstance();
    this.streamingService = StreamingService.getInstance();
    void logger.info("AIChatService initialized");
  }

  /**
   * Check if a tool result contains a confirmation request.
   * Confirmation requests are indicated by requiresConfirmation flag in the result.
   *
   * @param result - The tool result to check
   * @returns Confirmation details if present, null otherwise
   */
  private checkForConfirmationRequest(result: unknown): {
    confirmationId: string;
    prompt: string;
    severity: "low" | "medium" | "high";
  } | null {
    if (
      result &&
      typeof result === "object" &&
      "data" in result &&
      result.data &&
      typeof result.data === "object"
    ) {
      const data = result.data as Record<string, unknown>;

      if (
        data.requiresConfirmation === true &&
        typeof data.confirmationId === "string" &&
        typeof data.confirmationPrompt === "string"
      ) {
        // Extract severity from confirmation manager
        const confirmationManager = ConfirmationManager.getInstance();
        const pending = confirmationManager.getPending(data.confirmationId);

        return {
          confirmationId: data.confirmationId,
          prompt: data.confirmationPrompt,
          severity: pending?.severity || "medium",
        };
      }
    }

    return null;
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
    const startTime = Date.now();
    let providerType = "unknown";
    let modelName = "unknown";
    let lastUserMessage = "";

    try {
      // Extract info early for logging
      const config = useConversationalAIConfigStore.getState().getConfig();
      providerType = config.provider || "unknown";
      modelName = config.model || "unknown";
      lastUserMessage =
        messages
          .slice()
          .reverse()
          .find((m) => m.role === "user")?.content || "";

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
        let reasoningText: string | undefined;
        let usage:
          | {
              promptTokens: number;
              completionTokens: number;
              totalTokens: number;
            }
          | undefined;

        try {
          // Process the full stream to capture usage data
          for await (const chunk of result.fullStream) {
            if (chunk.type === "text-delta") {
              const text = chunk.text;
              fullText += text;

              // Call onChunk callback if provided
              if (options?.onChunk) {
                options.onChunk(text);
              }

              yield text;
            } else if (chunk.type === "finish") {
              // Extract usage data from finish chunk
              if (chunk.totalUsage) {
                const inputTokens = chunk.totalUsage.inputTokens ?? 0;
                const outputTokens = chunk.totalUsage.outputTokens ?? 0;
                usage = {
                  promptTokens: inputTokens,
                  completionTokens: outputTokens,
                  totalTokens: inputTokens + outputTokens,
                };
              }
              if (chunk.finishReason) {
                reasoningText = String(chunk.finishReason);
              }
            }
          }

          // Call onComplete callback with metadata if provided
          if (options?.onComplete) {
            options.onComplete(fullText, {
              reasoningText,
              usage,
            });
          }

          void logger.debug("Message streaming completed", {
            textLength: fullText.length,
            hasUsage: !!usage,
          });

          // Log successful AI call
          const durationMs = Date.now() - startTime;
          void apiLogger.addAiCall({
            provider: providerType,
            model: modelName,
            operation: "chat",
            status: "success",
            prompt: lastUserMessage,
            response: fullText,
            durationMs,
            metadata: {
              messageCount: messages.length,
              usage,
            },
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

          // Log failed AI call
          const durationMs = Date.now() - startTime;
          void apiLogger.addAiCall({
            provider: providerType,
            model: modelName,
            operation: "chat",
            status: "error",
            prompt: lastUserMessage,
            errorMessage: errorObj.message,
            durationMs,
            metadata: {
              messageCount: messages.length,
            },
          });

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

      // Log failed AI call (outer catch)
      const durationMs = Date.now() - startTime;
      void apiLogger.addAiCall({
        provider: providerType,
        model: modelName,
        operation: "chat",
        status: "error",
        prompt: lastUserMessage,
        errorMessage: errorObj.message,
        durationMs,
        metadata: {
          messageCount: messages.length,
          errorLocation: "outer-catch",
        },
      });

      throw errorObj;
    }
  }

  /**
   * Convert Vercel AI SDK tools to OpenRouter API format.
   *
   * @param vercelTools - Tools in Vercel AI SDK format
   * @returns Tools in OpenRouter API format
   */
  private convertToolsToOpenRouterFormat(
    vercelTools: Record<string, unknown>,
  ): ToolDefinition[] {
    return Object.entries(vercelTools).map(([name, tool]) => {
      const toolDef = tool as {
        description?: string;
        parameters?: Record<string, unknown>;
        inputSchema?: any; // Zod schema
      };

      // Vercel AI SDK uses 'inputSchema' which is a Zod schema
      // We need to convert it to JSON Schema for OpenRouter
      let jsonSchema: Record<string, unknown> | undefined;

      if (toolDef.inputSchema) {
        try {
          // Manually build JSON Schema from Zod schema
          // The zod-to-json-schema library doesn't handle Zod v3.23+ properly
          const zodSchema = toolDef.inputSchema;

          if (zodSchema.def && zodSchema.def.shape) {
            const properties: Record<string, any> = {};
            const required: string[] = [];

            for (const [key, value] of Object.entries(zodSchema.def.shape)) {
              const fieldSchema = value as any;
              const fieldDef = fieldSchema.def;

              // Build property schema
              const propSchema: any = {};

              // Handle type - recursively unwrap Zod wrappers
              let currentDef = fieldDef;

              // Unwrap default, optional, nullable wrappers
              while (
                currentDef &&
                (currentDef.type === "default" ||
                  currentDef.type === "optional" ||
                  currentDef.type === "nullable")
              ) {
                if (currentDef.innerType) {
                  currentDef = currentDef.innerType.def;
                } else {
                  break;
                }
              }

              if (currentDef.type === "string") {
                propSchema.type = "string";
                if (currentDef.checks) {
                  for (const check of currentDef.checks) {
                    if (check.kind === "min")
                      propSchema.minLength = check.value;
                    if (check.kind === "max")
                      propSchema.maxLength = check.value;
                  }
                }
              } else if (currentDef.type === "number") {
                propSchema.type = "number";
                if (currentDef.checks) {
                  for (const check of currentDef.checks) {
                    if (check.kind === "min") propSchema.minimum = check.value;
                    if (check.kind === "max") propSchema.maximum = check.value;
                    if (check.kind === "int") propSchema.type = "integer";
                  }
                }
              } else if (currentDef.type === "enum") {
                propSchema.type = "string";
                propSchema.enum = currentDef.values;
              }

              // Add description if available
              if (fieldSchema.description) {
                propSchema.description = fieldSchema.description;
              }

              properties[key] = propSchema;

              // Check if required (not optional)
              if (fieldDef.type !== "optional") {
                required.push(key);
              }
            }

            jsonSchema = {
              type: "object",
              properties,
              required: required.length > 0 ? required : undefined,
            };

            void logger.warn(`✅ Manually built schema for ${name}`, {
              properties: Object.keys(properties),
              required,
              schema: JSON.stringify(jsonSchema).substring(0, 500),
            });
          }
        } catch (err) {
          void logger.error("Failed to build JSON Schema from Zod", {
            toolName: name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const schema = toolDef.parameters || jsonSchema;

      void logger.warn(`🔧 Converting tool ${name} to OpenRouter format`, {
        name,
        description: toolDef.description,
        hasParameters: !!toolDef.parameters,
        hasInputSchema: !!toolDef.inputSchema,
        hasJsonSchema: !!jsonSchema,
        schemaType: schema ? typeof schema : "undefined",
        schemaKeys: schema ? Object.keys(schema).slice(0, 10) : [],
        fullSchema: JSON.stringify(schema, null, 2).substring(0, 500),
      });

      return {
        type: "function" as const,
        function: {
          name,
          description: toolDef.description,
          parameters: schema,
        },
      };
    });
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
   * @returns Promise that resolves when the message is complete
   * @throws {Error} If model configuration fails or streaming errors occur
   *
   * @example
   * ```typescript
   * const messages = [
   *   { role: 'user', content: 'What movies are in my library?' }
   * ];
   *
   * await chatService.sendMessageWithTools(messages, {
   *   onToolCall: (name, args) => console.log('Tool called:', name),
   *   onToolResult: (name, result) => console.log('Tool result:', result),
   *   onChunk: (text) => console.log(text),
   *   onComplete: (fullText) => console.log('Done:', fullText),
   * });
   * ```
   */
  async sendMessageWithTools(
    messages: ChatMessage[],
    options?: StreamOptions,
  ): Promise<void> {
    void logger.warn("🚀🚀🚀 sendMessageWithTools ENTRY", {
      messageCount: messages.length,
      hasOptions: !!options,
    });

    const startTime = Date.now();
    let providerType = "unknown";
    let modelName = "unknown";
    let lastUserMessage = "";

    try {
      // Extract info early for logging
      const config = useConversationalAIConfigStore.getState().getConfig();
      providerType = config.provider || "unknown";
      modelName = config.model || "unknown";
      lastUserMessage =
        messages
          .slice()
          .reverse()
          .find((m) => m.role === "user")?.content || "";

      void logger.warn("🔧 Config loaded", {
        provider: providerType,
        model: modelName,
        lastUserMessage: lastUserMessage.substring(0, 50),
      });

      void logger.debug("Sending message with tools to LLM", {
        messageCount: messages.length,
        toolCount: this.toolRegistry.count(),
        hasOptions: !!options,
      });

      // Get the configured model
      const model = await this.getModel();

      // Get tools from registry in Vercel AI SDK format
      const allTools = this.toolRegistry.toVercelTools();

      void logger.warn("🔧 All tools from registry", {
        toolNames: Object.keys(allTools),
        toolCount: Object.keys(allTools).length,
        searchWebTool: allTools.search_web
          ? {
              description: (allTools.search_web as any).description,
              hasParameters: !!(allTools.search_web as any).parameters,
              hasInputSchema: !!(allTools.search_web as any).inputSchema,
            }
          : "not found",
      });

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
      const streamingMethod = conversationalConfig.streamingMethod || "sse";

      // Use native streaming with tool support if enabled
      if (enableStreaming) {
        void logger.info("🚀 Using native streaming with tool support", {
          provider: providerType,
          model: modelName,
          method: streamingMethod,
          toolCount: Object.keys(tools).length,
        });

        // Convert tools to OpenRouter format
        const openRouterTools = this.convertToolsToOpenRouterFormat(tools);

        let fullText = "";
        const toolCallsExecuted: {
          id: string;
          name: string;
          arguments: string;
          result: unknown;
        }[] = [];

        try {
          // Track tool execution promises to ensure they complete before follow-up
          const toolExecutionPromises: Promise<void>[] = [];

          // First streaming request - may include tool calls
          await this.streamingService.stream(
            {
              provider: config.provider!,
              model: config.model!,
              keyId: config.keyId!,
              messages: messagesWithSystem.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
              tools: openRouterTools.length > 0 ? openRouterTools : undefined,
            },
            {
              method: streamingMethod,
              onChunk: (chunk) => {
                fullText += chunk;
                options?.onChunk?.(chunk);
              },
              onToolCall: (toolCall) => {
                void logger.debug("Tool call received in stream", {
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                });

                // Notify about tool call (synchronously)
                if (options?.onToolCall) {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    options.onToolCall(toolCall.function.name, args);
                  } catch (err) {
                    void logger.error("Failed to parse tool arguments", {
                      error: err,
                      arguments: toolCall.function.arguments,
                    });
                  }
                }

                // Execute the tool asynchronously and track the promise
                const toolExecutionPromise = (async () => {
                  try {
                    void logger.warn("🔧 Parsing tool call arguments", {
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                      rawArguments: toolCall.function.arguments,
                      argumentsType: typeof toolCall.function.arguments,
                      argumentsLength: toolCall.function.arguments?.length,
                    });

                    const args = JSON.parse(toolCall.function.arguments);

                    void logger.warn("✅ Tool arguments parsed", {
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                      parsedArgs: args,
                      argsKeys: Object.keys(args),
                    });

                    const toolDef = this.toolRegistry.get(
                      toolCall.function.name,
                    );

                    if (!toolDef) {
                      throw new Error(
                        `Tool "${toolCall.function.name}" not found in registry`,
                      );
                    }

                    const result = await toolDef.execute(args);

                    void logger.debug("Tool execution completed", {
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                    });

                    // Store tool call result for follow-up request
                    toolCallsExecuted.push({
                      id: toolCall.id,
                      name: toolCall.function.name,
                      arguments: toolCall.function.arguments,
                      result,
                    });

                    // Check for confirmation request
                    const confirmationRequest =
                      this.checkForConfirmationRequest(result);
                    if (
                      confirmationRequest &&
                      options?.onConfirmationRequested
                    ) {
                      options.onConfirmationRequested(
                        confirmationRequest.confirmationId,
                        confirmationRequest.prompt,
                        confirmationRequest.severity,
                      );
                    }

                    // Notify about tool result
                    if (options?.onToolResult) {
                      options.onToolResult(toolCall.function.name, result);
                    }
                  } catch (err) {
                    void logger.error("Tool execution failed", {
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                      error: err,
                    });

                    // Store error result
                    toolCallsExecuted.push({
                      id: toolCall.id,
                      name: toolCall.function.name,
                      arguments: toolCall.function.arguments,
                      result: {
                        error: err instanceof Error ? err.message : String(err),
                      },
                    });

                    // Notify about error
                    if (options?.onToolResult) {
                      options.onToolResult(toolCall.function.name, {
                        error: err instanceof Error ? err.message : String(err),
                      });
                    }
                  }
                })();

                toolExecutionPromises.push(toolExecutionPromise);
              },
              onComplete: async (completeText, initialMetadata) => {
                // If tools were called, execute them and stream follow-up response
                if (toolExecutionPromises.length > 0) {
                  void logger.info("Tool calls detected, executing tools", {
                    toolCount: toolExecutionPromises.length,
                  });

                  // Execute all tools in parallel (non-blocking for each other)
                  const toolStartTime = Date.now();
                  await Promise.all(toolExecutionPromises);
                  const toolDuration = Date.now() - toolStartTime;

                  void logger.info(
                    "Tools executed, starting follow-up stream",
                    {
                      toolCallCount: toolCallsExecuted.length,
                      toolDurationMs: toolDuration,
                    },
                  );

                  // Build follow-up messages with tool results
                  const followUpMessages: {
                    role: "user" | "assistant" | "system" | "tool";
                    content: string;
                    tool_call_id?: string;
                    name?: string;
                    tool_calls?: {
                      id: string;
                      type: "function";
                      function: {
                        name: string;
                        arguments: string;
                      };
                    }[];
                  }[] = [
                    ...messagesWithSystem.map((msg) => ({
                      role: msg.role,
                      content: msg.content,
                    })),
                    {
                      role: "assistant" as const,
                      content: completeText || "",
                      tool_calls: toolCallsExecuted.map((tc) => ({
                        id: tc.id,
                        type: "function" as const,
                        function: {
                          name: tc.name,
                          arguments: tc.arguments,
                        },
                      })),
                    },
                    ...toolCallsExecuted.map((tc) => ({
                      role: "tool" as const,
                      content: JSON.stringify(tc.result),
                      tool_call_id: tc.id,
                      name: tc.name,
                    })),
                  ];

                  // Stream the follow-up response immediately
                  await this.streamingService.stream(
                    {
                      provider: config.provider!,
                      model: config.model!,
                      keyId: config.keyId!,
                      messages: followUpMessages,
                      tools:
                        openRouterTools.length > 0
                          ? openRouterTools
                          : undefined,
                    },
                    {
                      method: streamingMethod,
                      onChunk: (chunk) => {
                        fullText += chunk;
                        options?.onChunk?.(chunk);
                      },
                      onComplete: (finalText, metadata) => {
                        const durationMs = Date.now() - startTime;

                        void logger.info("Follow-up stream completed", {
                          finalTextLength: finalText?.length || 0,
                          fullTextLength: fullText.length,
                          usage: metadata?.usage,
                          hasReasoning: !!metadata?.reasoningText,
                        });

                        void apiLogger.addAiCall({
                          provider: providerType,
                          model: modelName,
                          operation: "chat-native-streaming-with-tools",
                          status: "success",
                          prompt: lastUserMessage,
                          response: fullText,
                          durationMs,
                          metadata: {
                            messageCount: messages.length,
                            toolCount: Object.keys(tools).length,
                            extras: {
                              toolCallsExecuted: toolCallsExecuted.length,
                              streamingMethod,
                              multiTurn: true,
                              toolDurationMs: toolDuration,
                            },
                          },
                        });

                        if (options?.onComplete) {
                          options.onComplete(fullText, metadata);
                        }
                      },
                      onError: (error) => {
                        void logger.error("Follow-up stream failed", {
                          error: error.message,
                        });
                        if (options?.onComplete) {
                          options.onComplete(fullText);
                        }
                      },
                    },
                  );
                } else {
                  // No tool calls, complete normally
                  const durationMs = Date.now() - startTime;
                  void apiLogger.addAiCall({
                    provider: providerType,
                    model: modelName,
                    operation: "chat-native-streaming-with-tools",
                    status: "success",
                    prompt: lastUserMessage,
                    response: completeText || fullText,
                    durationMs,
                    metadata: {
                      messageCount: messages.length,
                      toolCount: Object.keys(tools).length,
                      extras: {
                        streamingMethod,
                      },
                    },
                  });

                  if (options?.onComplete) {
                    // Pass metadata from initial stream
                    options.onComplete(
                      completeText || fullText,
                      initialMetadata,
                    );
                  }
                }
              },
              onError: (error) => {
                const durationMs = Date.now() - startTime;
                void apiLogger.addAiCall({
                  provider: providerType,
                  model: modelName,
                  operation: "chat-native-streaming-with-tools",
                  status: "error",
                  prompt: lastUserMessage,
                  errorMessage: error.message,
                  durationMs,
                  metadata: {
                    messageCount: messages.length,
                    toolCount: Object.keys(tools).length,
                    extras: {
                      streamingMethod,
                    },
                  },
                });

                if (options?.onError) {
                  options.onError(error);
                }
              },
            },
          );

          return; // Exit early - streaming complete
        } catch (error) {
          const errorObj =
            error instanceof Error ? error : new Error(String(error));
          void logger.error("Native streaming with tools failed", {
            error: errorObj.message,
          });

          if (options?.onError) {
            options.onError(errorObj);
          }

          throw errorObj;
        }
      }

      // Non-streaming mode: use generateText with multi-step tool execution
      if (!enableStreaming) {
        const result = await generateText({
          model,
          messages: messagesWithSystem,
          tools,
          stopWhen: stepCountIs(5), // Allow up to 5 steps for tool calls
        });

        try {
          const fullText = result.text;

          // Process all steps (tool calls and results)
          if (result.steps) {
            for (const step of result.steps) {
              // Process tool calls in this step
              if (step.toolCalls && step.toolCalls.length > 0) {
                for (const toolCall of step.toolCalls) {
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

              // Process tool results in this step
              if (step.toolResults && step.toolResults.length > 0) {
                for (const toolResult of step.toolResults) {
                  void logger.debug("Tool result received (non-streaming)", {
                    toolName: toolResult.toolName,
                    toolCallId: toolResult.toolCallId,
                  });

                  const result =
                    "result" in toolResult ? toolResult.result : undefined;

                  // Check if the tool result contains a confirmation request
                  const confirmationRequest =
                    this.checkForConfirmationRequest(result);

                  if (confirmationRequest) {
                    void logger.info(
                      "Confirmation requested during tool execution (non-streaming)",
                      {
                        confirmationId: confirmationRequest.confirmationId,
                        toolName: toolResult.toolName,
                        severity: confirmationRequest.severity,
                      },
                    );

                    // Call onConfirmationRequested callback if provided
                    if (options?.onConfirmationRequested) {
                      options.onConfirmationRequested(
                        confirmationRequest.confirmationId,
                        confirmationRequest.prompt,
                        confirmationRequest.severity,
                      );
                    }
                  }

                  // Call onToolResult callback if provided
                  if (options?.onToolResult) {
                    options.onToolResult(toolResult.toolName, result);
                  }
                }
              }
            }
          }

          // Extract only usage data from result
          const reasoningText = result.reasoning
            ? String(result.reasoning)
            : undefined;
          const usage = result.usage
            ? {
                promptTokens: result.usage.inputTokens ?? 0,
                completionTokens: result.usage.outputTokens ?? 0,
                totalTokens:
                  (result.usage.inputTokens ?? 0) +
                  (result.usage.outputTokens ?? 0),
              }
            : undefined;

          // Deliver the complete text at once
          if (options?.onChunk) {
            options.onChunk(fullText);
          }

          // Call onComplete callback with metadata if provided
          if (options?.onComplete) {
            options.onComplete(fullText, {
              reasoningText,
              usage,
            });
          }

          void logger.debug("Message with tools (non-streaming) completed", {
            textLength: fullText.length,
            stepCount: result.steps?.length ?? 0,
            hasReasoning: !!reasoningText,
            hasUsage: !!usage,
          });

          // Log successful AI call
          const durationMs = Date.now() - startTime;
          void apiLogger.addAiCall({
            provider: providerType,
            model: modelName,
            operation: "chat-with-tools",
            status: "success",
            prompt: lastUserMessage,
            response: fullText,
            durationMs,
            metadata: {
              messageCount: messages.length,
              toolCount: Object.keys(tools).length,
              usage,
            },
          });
        } catch (error) {
          const errorObj =
            error instanceof Error ? error : new Error(String(error));

          void logger.error("Error during message with tools (non-streaming)", {
            error: errorObj.message,
            formattedError: this.formatError(errorObj),
          });

          // Call onError callback if provided
          if (options?.onError) {
            options.onError(errorObj);
          }

          // Log failed AI call
          const durationMs = Date.now() - startTime;
          void apiLogger.addAiCall({
            provider: providerType,
            model: modelName,
            operation: "chat-with-tools",
            status: "error",
            prompt: lastUserMessage,
            errorMessage: errorObj.message,
            durationMs,
            metadata: {
              messageCount: messages.length,
              toolCount: Object.keys(tools).length,
            },
          });

          throw errorObj;
        }
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

      // Log failed AI call (outer catch)
      const durationMs = Date.now() - startTime;
      void apiLogger.addAiCall({
        provider: providerType,
        model: modelName,
        operation: "chat-with-tools",
        status: "error",
        prompt: lastUserMessage,
        errorMessage: errorObj.message,
        durationMs,
        metadata: {
          messageCount: messages.length,
          errorLocation: "outer-catch",
        },
      });

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
   * Execute a workflow directly (not through LLM).
   * This method can be used to run workflows programmatically with progress tracking.
   *
   * @param workflowId - ID of the workflow to execute
   * @param params - Parameters to pass to the workflow
   * @param onProgress - Optional callback for progress updates
   * @returns Workflow execution result
   * @throws {Error} If workflow execution fails
   *
   * @example
   * ```typescript
   * const result = await chatService.executeWorkflow(
   *   'search-and-add',
   *   { query: 'Breaking Bad', serviceType: 'sonarr' },
   *   (stepId, index, total) => {
   *     console.log(`Step ${index + 1}/${total}: ${stepId}`);
   *   }
   * );
   * ```
   */
  async executeWorkflow(
    workflowId: string,
    params: Record<string, unknown>,
    onProgress?: WorkflowProgressCallback,
  ): Promise<{
    success: boolean;
    stepResults: Map<string, unknown>;
    error?: string;
    failedStepId?: string;
    executionTime: number;
  }> {
    try {
      void logger.info("Executing workflow", {
        workflowId,
        params,
      });

      const result = await this.workflowEngine.executeWorkflow(
        workflowId,
        params,
        onProgress,
      );

      if (!result.success) {
        void logger.error("Workflow execution failed", {
          workflowId,
          error: result.error,
          failedStepId: result.failedStepId,
        });
      } else {
        void logger.info("Workflow execution completed", {
          workflowId,
          executionTime: result.executionTime,
        });
      }

      return result;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      void logger.error("Failed to execute workflow", {
        workflowId,
        error: errorObj.message,
      });

      throw errorObj;
    }
  }

  /**
   * Get the WorkflowEngine instance for direct workflow management.
   *
   * @returns The WorkflowEngine singleton
   *
   * @example
   * ```typescript
   * const engine = chatService.getWorkflowEngine();
   * const workflows = engine.getAllWorkflows();
   * ```
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
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
