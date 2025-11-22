import EventSourcePolyfill from "react-native-sse";
import { logger } from "@/services/logger/LoggerService";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import type { AIProviderType } from "@/types/ai/AIProvider";

/**
 * Tool definition for OpenRouter API
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Message format for OpenRouter API
 * Supports tool role for sending tool results back to the LLM
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string; // Required when role is "tool"
  name?: string; // Tool name when role is "tool"
  tool_calls?: {
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }[]; // Tool calls made by assistant
}

/**
 * Configuration for streaming requests
 */
export interface StreamingConfig {
  provider: AIProviderType;
  model: string;
  keyId: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
}

/**
 * Tool call information from streaming response
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Options for streaming
 */
export interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (
    fullText: string,
    metadata?: {
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      reasoningText?: string;
    },
  ) => void;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolCallDelta?: (toolCallId: string, delta: string) => void;
  signal?: AbortSignal;
}

/**
 * Service for handling streaming responses from AI providers.
 * Provides two methods: SSE (EventSource) and Fetch (ReadableStream).
 *
 * This service is designed to work reliably on React Native where
 * the Vercel AI SDK's streaming may have issues.
 */
export class StreamingService {
  private static instance: StreamingService | null = null;
  private readonly keyManager: AIKeyManager;

  private constructor() {
    this.keyManager = AIKeyManager.getInstance();
  }

  static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  /**
   * Get the API endpoint URL for the provider
   */
  private getEndpointUrl(provider: AIProviderType): string {
    switch (provider) {
      case "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions";
      case "openai":
        return "https://api.openai.com/v1/chat/completions";
      case "anthropic":
        return "https://api.anthropic.com/v1/messages";
      case "google":
        // Google uses a different API structure, may need special handling
        throw new Error(
          "Google AI streaming not yet supported via this service",
        );
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get headers for the API request
   */
  private async getHeaders(
    provider: AIProviderType,
    keyId: string,
  ): Promise<Record<string, string>> {
    const keyConfig = await this.keyManager.getKey(keyId);
    if (!keyConfig) {
      throw new Error(`API key not found for keyId: ${keyId}`);
    }

    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    switch (provider) {
      case "openrouter":
        return {
          ...baseHeaders,
          Authorization: `Bearer ${keyConfig.apiKey}`,
          "HTTP-Referer": "https://example.com",
          "X-Title": "UniArr",
        };
      case "openai":
        return {
          ...baseHeaders,
          Authorization: `Bearer ${keyConfig.apiKey}`,
        };
      case "anthropic":
        return {
          ...baseHeaders,
          "x-api-key": keyConfig.apiKey,
          "anthropic-version": "2023-06-01",
        };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Stream using Server-Sent Events (EventSource).
   * This method uses react-native-sse for reliable SSE support on React Native.
   */
  async streamWithSSE(
    config: StreamingConfig,
    options?: StreamingOptions,
  ): Promise<void> {
    let eventSource: EventSourcePolyfill | null = null;
    let fullResponse = "";

    try {
      const url = this.getEndpointUrl(config.provider);
      const headers = await this.getHeaders(config.provider, config.keyId);

      void logger.info("🔄 Starting SSE stream", {
        provider: config.provider,
        model: config.model,
        url,
        messageCount: config.messages.length,
      });

      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: config.messages,
        stream: true,
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = config.tools;
      }

      eventSource = new EventSourcePolyfill(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      // Track tool calls being built
      const toolCalls = new Map<number, ToolCall>();
      const notifiedToolCalls = new Set<number>(); // Track which tool calls we've already notified about

      // Track usage metadata
      let usageData:
        | {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          }
        | undefined;
      let reasoningText = "";

      // Handle incoming messages
      eventSource.addEventListener("message", (event: any) => {
        try {
          if (event.data === "[DONE]") {
            eventSource?.close();

            // Notify about any remaining tool calls that haven't been notified yet
            for (const [index, toolCall] of toolCalls.entries()) {
              if (
                !notifiedToolCalls.has(index) &&
                toolCall.id &&
                toolCall.function.name &&
                toolCall.function.arguments
              ) {
                try {
                  JSON.parse(toolCall.function.arguments);
                  if (options?.onToolCall) {
                    options.onToolCall(toolCall);
                  }
                  notifiedToolCalls.add(index);
                } catch {
                  // Invalid JSON, skip
                }
              }
            }

            // Call onComplete with metadata
            if (options?.onComplete) {
              const metadata: {
                usage?: {
                  promptTokens: number;
                  completionTokens: number;
                  totalTokens: number;
                };
                reasoningText?: string;
              } = {};

              if (
                usageData &&
                usageData.promptTokens !== undefined &&
                usageData.completionTokens !== undefined &&
                usageData.totalTokens !== undefined
              ) {
                metadata.usage = {
                  promptTokens: usageData.promptTokens,
                  completionTokens: usageData.completionTokens,
                  totalTokens: usageData.totalTokens,
                };
              }

              if (reasoningText) {
                metadata.reasoningText = reasoningText;
              }

              // Pass metadata if available
              if (Object.keys(metadata).length > 0) {
                (options.onComplete as any)(fullResponse, metadata);
              } else {
                options.onComplete(fullResponse);
              }
            }

            void logger.info("SSE stream completed", {
              responseLength: fullResponse.length,
              toolCallCount: toolCalls.size,
              usage: usageData,
              hasReasoning: reasoningText.length > 0,
            });
            return;
          }

          const data = JSON.parse(event.data);
          const delta = data.choices?.[0]?.delta;
          const finishReason = data.choices?.[0]?.finish_reason;

          // Capture usage data if present (usually in final chunk)
          if (data.usage) {
            usageData = {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            };
          }

          // Handle text content
          if (delta?.content) {
            fullResponse += delta.content;
            options?.onChunk?.(delta.content);
          }

          // Handle reasoning content (for models that support it)
          if (delta?.reasoning_content) {
            reasoningText += delta.reasoning_content;
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;

              if (!toolCalls.has(index)) {
                // Initialize new tool call
                toolCalls.set(index, {
                  id: toolCallDelta.id || "",
                  type: "function",
                  function: {
                    name: toolCallDelta.function?.name || "",
                    arguments: "",
                  },
                });
              }

              const toolCall = toolCalls.get(index)!;

              // Update tool call with delta
              if (toolCallDelta.id) {
                toolCall.id = toolCallDelta.id;
              }
              if (toolCallDelta.function?.name) {
                toolCall.function.name = toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                toolCall.function.arguments += toolCallDelta.function.arguments;

                // Notify about tool call delta
                if (options?.onToolCallDelta) {
                  options.onToolCallDelta(
                    toolCall.id,
                    toolCallDelta.function.arguments,
                  );
                }
              }
            }
          }

          // When finish_reason is "tool_calls", notify about all complete tool calls
          if (finishReason === "tool_calls") {
            for (const [index, toolCall] of toolCalls.entries()) {
              if (
                !notifiedToolCalls.has(index) &&
                toolCall.id &&
                toolCall.function.name &&
                toolCall.function.arguments
              ) {
                try {
                  // Validate JSON
                  JSON.parse(toolCall.function.arguments);

                  // Notify about complete tool call
                  if (options?.onToolCall) {
                    options.onToolCall(toolCall);
                  }
                  notifiedToolCalls.add(index);
                } catch {
                  // Arguments not yet complete JSON, continue accumulating
                }
              }
            }
          }
        } catch (err) {
          void logger.error("Error parsing SSE message", { error: err });
        }
      });

      // Handle errors
      eventSource.addEventListener("error", (event: any) => {
        void logger.error("SSE error", { event });
        const error = new Error("Stream error occurred");
        options?.onError?.(error);
        eventSource?.close();
      });

      // Handle connection open
      eventSource.addEventListener("open", () => {
        void logger.info("SSE connection opened");
      });

      // Handle abort signal
      if (options?.signal) {
        options.signal.addEventListener("abort", () => {
          void logger.info("SSE stream aborted by user");
          eventSource?.close();
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      void logger.error("Failed to start SSE stream", {
        error: errorMessage,
      });
      eventSource?.close();
      options?.onError?.(
        error instanceof Error ? error : new Error(errorMessage),
      );
      throw error;
    }
  }

  /**
   * Stream using Fetch API with ReadableStream.
   * This method uses native fetch with stream reading for compatibility.
   */
  async streamWithFetch(
    config: StreamingConfig,
    options?: StreamingOptions,
  ): Promise<void> {
    let fullResponse = "";

    try {
      const url = this.getEndpointUrl(config.provider);
      const headers = await this.getHeaders(config.provider, config.keyId);

      void logger.info("🔄 Starting fetch stream", {
        provider: config.provider,
        model: config.model,
        url,
        messageCount: config.messages.length,
      });

      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: config.messages,
        stream: true,
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        requestBody.tools = config.tools;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      const toolCalls = new Map<number, ToolCall>();
      const notifiedToolCalls = new Set<number>(); // Track which tool calls we've already notified about

      // Track usage metadata
      let usageData:
        | {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          }
        | undefined;
      let reasoningText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              // Notify about any remaining tool calls that haven't been notified yet
              for (const [index, toolCall] of toolCalls.entries()) {
                if (
                  !notifiedToolCalls.has(index) &&
                  toolCall.id &&
                  toolCall.function.name &&
                  toolCall.function.arguments
                ) {
                  try {
                    JSON.parse(toolCall.function.arguments);
                    if (options?.onToolCall) {
                      options.onToolCall(toolCall);
                    }
                    notifiedToolCalls.add(index);
                  } catch {
                    // Invalid JSON, skip
                  }
                }
              }

              // Call onComplete with metadata
              if (options?.onComplete) {
                const metadata: {
                  usage?: {
                    promptTokens: number;
                    completionTokens: number;
                    totalTokens: number;
                  };
                  reasoningText?: string;
                } = {};

                if (
                  usageData &&
                  usageData.promptTokens !== undefined &&
                  usageData.completionTokens !== undefined &&
                  usageData.totalTokens !== undefined
                ) {
                  metadata.usage = {
                    promptTokens: usageData.promptTokens,
                    completionTokens: usageData.completionTokens,
                    totalTokens: usageData.totalTokens,
                  };
                }

                if (reasoningText) {
                  metadata.reasoningText = reasoningText;
                }

                // Pass metadata if available
                if (Object.keys(metadata).length > 0) {
                  (options.onComplete as any)(fullResponse, metadata);
                } else {
                  options.onComplete(fullResponse);
                }
              }

              void logger.info("Fetch stream completed", {
                responseLength: fullResponse.length,
                toolCallCount: toolCalls.size,
                usage: usageData,
                hasReasoning: reasoningText.length > 0,
              });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;

              // Capture usage data if present (usually in final chunk)
              if (parsed.usage) {
                usageData = {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                };
              }

              // Handle text content
              if (delta?.content) {
                fullResponse += delta.content;
                options?.onChunk?.(delta.content);
              }

              // Handle reasoning content (for models that support it)
              if (delta?.reasoning_content) {
                reasoningText += delta.reasoning_content;
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index;

                  if (!toolCalls.has(index)) {
                    // Initialize new tool call
                    toolCalls.set(index, {
                      id: toolCallDelta.id || "",
                      type: "function",
                      function: {
                        name: toolCallDelta.function?.name || "",
                        arguments: "",
                      },
                    });
                  }

                  const toolCall = toolCalls.get(index)!;

                  // Update tool call with delta
                  if (toolCallDelta.id) {
                    toolCall.id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function?.name) {
                    toolCall.function.name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    toolCall.function.arguments +=
                      toolCallDelta.function.arguments;

                    // Notify about tool call delta
                    if (options?.onToolCallDelta) {
                      options.onToolCallDelta(
                        toolCall.id,
                        toolCallDelta.function.arguments,
                      );
                    }
                  }
                }
              }

              // When finish_reason is "tool_calls", notify about all complete tool calls
              if (finishReason === "tool_calls") {
                for (const [index, toolCall] of toolCalls.entries()) {
                  if (
                    !notifiedToolCalls.has(index) &&
                    toolCall.id &&
                    toolCall.function.name &&
                    toolCall.function.arguments
                  ) {
                    try {
                      // Validate JSON
                      JSON.parse(toolCall.function.arguments);

                      // Notify about complete tool call
                      if (options?.onToolCall) {
                        options.onToolCall(toolCall);
                      }
                      notifiedToolCalls.add(index);
                    } catch {
                      // Arguments not yet complete JSON, continue accumulating
                    }
                  }
                }
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Notify about any remaining tool calls before completing
      for (const [index, toolCall] of toolCalls.entries()) {
        if (
          !notifiedToolCalls.has(index) &&
          toolCall.id &&
          toolCall.function.name &&
          toolCall.function.arguments
        ) {
          try {
            JSON.parse(toolCall.function.arguments);
            if (options?.onToolCall) {
              options.onToolCall(toolCall);
            }
            notifiedToolCalls.add(index);
          } catch {
            // Invalid JSON, skip
          }
        }
      }

      // Call onComplete with metadata
      if (options?.onComplete) {
        const metadata: {
          usage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          };
          reasoningText?: string;
        } = {};

        if (
          usageData &&
          usageData.promptTokens !== undefined &&
          usageData.completionTokens !== undefined &&
          usageData.totalTokens !== undefined
        ) {
          metadata.usage = {
            promptTokens: usageData.promptTokens,
            completionTokens: usageData.completionTokens,
            totalTokens: usageData.totalTokens,
          };
        }

        if (reasoningText) {
          metadata.reasoningText = reasoningText;
        }

        // Pass metadata if available
        if (Object.keys(metadata).length > 0) {
          (options.onComplete as any)(fullResponse, metadata);
        } else {
          options.onComplete(fullResponse);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        void logger.info("Fetch stream aborted by user");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        void logger.error("Failed to stream with fetch", {
          error: errorMessage,
        });
        options?.onError?.(
          error instanceof Error ? error : new Error(errorMessage),
        );
      }
      throw error;
    }
  }

  /**
   * Stream with automatic method selection.
   * Defaults to SSE but can be configured.
   */
  async stream(
    config: StreamingConfig,
    options?: StreamingOptions & { method?: "sse" | "fetch" },
  ): Promise<void> {
    const method = options?.method || "sse";

    if (method === "sse") {
      return this.streamWithSSE(config, options);
    } else {
      return this.streamWithFetch(config, options);
    }
  }
}
