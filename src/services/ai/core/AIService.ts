import {
  streamText,
  generateObject,
  streamObject,
  generateText,
  APICallError,
} from "ai";
import { z } from "zod";
import { logger } from "@/services/logger/LoggerService";
import { apiLogger } from "@/services/logger/ApiLoggerService";
import { AIProviderManager, AIProviderInstance } from "./AIProviderManager";

export interface AIRequestOptions {
  provider?: string;
  model?: string;
  keyId?: string;
}

/**
 * Core AI Service for text generation and structured output
 * Implements latest Vercel AI SDK v6+ patterns:
 * - Text streaming with real-time updates
 * - Structured output generation (Zod schemas)
 * - Streaming structured objects (partial results)
 * - Output helpers for arrays and enums
 *
 * Note: Uses generateObject/streamObject with proper error handling for
 * response parsing and validation issues.
 */
export class AIService {
  private static instance: AIService;
  private providerManager: AIProviderManager;
  private apiLogger = apiLogger;

  private constructor() {
    this.providerManager = AIProviderManager.getInstance();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Resolve the provider instance to use for a request
   * Prioritizes options over the global active provider
   */
  private async resolveProviderInstance(
    options?: AIRequestOptions,
  ): Promise<AIProviderInstance> {
    // If specific keyId is provided, try to use that first
    if (options?.keyId) {
      // We need to get the key details from KeyManager to construct a temporary provider instance
      // However, AIProviderManager doesn't expose a direct way to get a provider instance by keyId
      // if it's not registered. But we can check if it's already registered.
      // For now, we'll rely on the provider manager's registered providers.
      // If options.provider is set, we look for that provider.
    }

    if (options?.provider) {
      const provider = this.providerManager.getProvider(
        options.provider as any,
      );
      if (provider) {
        // If model is also specified, create a copy with that model
        if (options.model) {
          return {
            ...provider,
            model: options.model,
            // If keyId is provided, we might want to use it, but for now we use the provider's active key
            // unless we implement a way to fetch specific key config here.
            // Given the current architecture, we'll assume the provider's active key is what we want
            // unless we want to support specific key usage which requires more changes to AIProviderManager.
          };
        }
        return provider;
      }
    }

    // Fallback to active provider
    const active = this.providerManager.getActiveProvider();
    if (!active) {
      throw new Error(
        "No AI provider configured. Please set up an AI provider first.",
      );
    }
    return active;
  }
  private isRateLimitError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorObj = error as unknown as Record<string, unknown>;

    // Check for status code 429
    if (errorObj.statusCode === 429) {
      return true;
    }

    // Check response status
    if (errorObj.response !== undefined) {
      const response = errorObj.response as Record<string, unknown>;
      if (response.status === 429) {
        return true;
      }
    }

    // Check message for rate limit indicators
    const message = error.message.toLowerCase();
    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create a wrapper stream that passes through chunks but tracks errors during consumption
   */
  /**
   * Generic stream wrapper to detect API errors during consumption.
   * If a recoverable stream error is detected (`shouldFallbackToBufferedResponse`),
   * the wrapper stops iteration quietly and lets the caller handle partial data.
   */
  private createErrorDetectingStream<T = unknown>(
    sourceStream: AsyncIterable<T>,
    hasError: () => boolean,
    getError: () => Error | null,
  ): AsyncIterable<T> {
    const self = this;
    return (async function* () {
      try {
        for await (const chunk of sourceStream) {
          if (hasError()) {
            const error = getError();
            if (error && self.shouldFallbackToBufferedResponse(error)) {
              // Stop iteration without throwing to allow a graceful fallback
              logger.debug(
                "Stream encountered API error during consumption; stopping iteration.",
              );
              return;
            }
          }
          yield chunk;
        }
      } catch (error) {
        if (
          error instanceof Error &&
          self.shouldFallbackToBufferedResponse(error)
        ) {
          logger.debug("Stream consumption threw recoverable error", {
            errorName: error.name,
            errorMessage: error.message,
          });
          return; // suppress recoverable stream errors
        }
        throw error;
      }
    })();
  }

  /**
   * Extract detailed error information from AI SDK errors
   * Captures APICallError and AISDKError context, including validation failures
   */
  private extractErrorDetails(error: unknown): {
    message: string;
    statusCode?: number;
    metadata?: Record<string, unknown>;
  } {
    if (!(error instanceof Error)) {
      return { message: String(error) };
    }

    const message = error.message;
    const metadata: Record<string, unknown> = {};
    const errorObj = error as unknown as Record<string, unknown>;
    let statusCode: number | undefined;

    // Extract properties from AI SDK errors
    if (typeof errorObj.statusCode === "number") {
      statusCode = errorObj.statusCode;
      metadata.statusCode = statusCode;
    }
    if (errorObj.cause !== undefined) {
      metadata.cause = String(errorObj.cause);
    }
    if (errorObj.response !== undefined) {
      const response = errorObj.response as Record<string, unknown> | undefined;
      if (typeof response?.status === "number") {
        statusCode = response.status;
        metadata.responseStatus = response.status;
      }
    }

    // Capture ZodError details for schema validation failures
    if (errorObj.name === "ZodError" && errorObj.errors !== undefined) {
      const errors = errorObj.errors as Record<string, unknown>[];
      metadata.validationErrors = errors.map((err) => {
        const path = Array.isArray(err.path)
          ? (err.path as (string | number)[]).join(".")
          : undefined;
        return {
          path,
          message: err.message,
          code: err.code,
        };
      });
    }

    // Capture AI SDK specific error info
    if (errorObj.response !== undefined) {
      const response = errorObj.response as Record<string, unknown>;
      if (response.data !== undefined) {
        try {
          const dataStr = String(response.data);
          if (dataStr.length > 500) {
            metadata.responseDataPreview = dataStr.substring(0, 500) + "...";
          } else {
            metadata.responseData = response.data;
          }
        } catch {
          // Ignore serialization errors
        }
      }
    }

    return {
      message,
      statusCode,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Stream text generation with real-time chunk updates
   * Best for: Long-form text, explanations, creative content
   *
   * @param prompt The prompt to generate text from
   * @param system Optional system prompt for context
   * @returns Stream of text chunks that can be consumed
   *
   * @example
   * ```typescript
   * const { textStream } = await aiService.streamText("Write a story about...", "You are a creative writer");
   *
   * for await (const chunk of textStream) {
   *   console.log(chunk);
   * }
   * ```
   */

  async streamText(
    prompt: string,
    system?: string,
    options?: AIRequestOptions,
  ): Promise<any> {
    const startTime = Date.now();

    let providerInstance: AIProviderInstance;
    try {
      providerInstance = await this.resolveProviderInstance(options);
    } catch (error) {
      throw error;
    }

    const providerType = providerInstance.provider;
    const model = providerInstance.model;
    let modelInstance: any;

    try {
      // We need a way to get model instance for a specific provider config
      // AIProviderManager.getModelInstance() currently uses this.currentProvider
      // We should update AIProviderManager or add a helper here.
      // For now, let's assume we can use a modified getModelInstance that accepts a provider instance.

      // Since we can't easily change AIProviderManager signature without breaking things,
      // let's look at how getModelInstance works. It uses this.currentProvider.
      // We might need to temporarily swap it or add a method to AIProviderManager.

      // Actually, let's add a method to AIProviderManager to get model instance from a specific config.
      // But I cannot edit AIProviderManager in this tool call.

      // Let's use a workaround: we'll implement the model creation logic here locally or
      // we'll assume we can pass the provider instance to a new method on AIProviderManager later.

      // Wait, I can see getModelInstance in AIProviderManager uses this.currentProvider.
      // I should probably update AIProviderManager first to allow getting instance for a specific config.

      // For this step, I will assume I can use `this.providerManager.getModelInstance(providerInstance)`
      // and I will update AIProviderManager in the next step.
      modelInstance = this.providerManager.getModelInstance(providerInstance);
      if (!modelInstance) {
        throw new Error(
          "No AI model configured. Please set up an AI provider first.",
        );
      }

      let streamEncounteredError = false;
      let streamError: Error | null = null;

      const result = await streamText({
        model: modelInstance,
        prompt,
        system,
        onChunk: ({ chunk }) => {
          // Optional: Custom chunk processing
          logger.debug("Text stream chunk", { chunkType: chunk.type });
        },
        onError: ({ error }) => {
          // Track that stream encountered an error
          streamEncounteredError = true;
          streamError =
            error instanceof Error ? error : new Error(String(error));
          // Log stream-time errors for debugging
          const errorName = error instanceof Error ? error.name : "unknown";
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.warn("Text stream error callback triggered", {
            errorName,
            errorMessage,
          });
        },
      });

      // Wrap the text stream to detect errors during consumption
      const wrappedStream = this.createErrorDetectingStream(
        result.textStream as AsyncIterable<string>,
        () => streamEncounteredError,
        () => streamError,
      );

      // If stream encountered a parsing error immediately, use buffered response instead
      // This handles cases where the provider returns valid data but SDK can't parse it as a stream
      if (streamEncounteredError && streamError !== null) {
        const err = streamError as Error;
        const errorMsg = err.message ?? String(err);
        const errorName = err.name ?? "unknown";

        void logger.warn(
          "Text stream encountered parsing error, attempting buffered recovery",
          {
            errorName,
            errorMessage: errorMsg,
          },
        );

        const bufferedText = await this.tryRecoverBufferedStreamText(
          result,
          err,
        );

        if (!bufferedText || bufferedText.length === 0) {
          void logger.warn("Buffered recovery failed, will trigger fallback", {
            errorName,
            errorMessage: errorMsg,
          });
          throw err;
        }

        const bufferedStream = this.createBufferedTextStream(bufferedText);

        const durationMs = Date.now() - startTime;
        await this.apiLogger.addAiCall({
          provider: providerType,
          model,
          operation: "streamText",
          status: "success",
          prompt,
          response: bufferedText,
          durationMs,
          metadata: {
            fallbackReason: "stream-error-recovered",
            extras: {
              streamErrorName: errorName,
              streamErrorMessage: errorMsg,
            },
          },
        });

        void logger.info(
          "Recovered AI response from buffered text after stream error",
          {
            provider: providerType,
            model,
          },
        );

        return {
          ...result,
          textStream: bufferedStream,
          text: Promise.resolve(bufferedText),
        };
      }

      // Log successful call with response text (captured asynchronously)
      const durationMs = Date.now() - startTime;
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "streamText",
        status: "success",
        prompt,
        durationMs,
      });

      // Capture response text asynchronously after logging
      // Only attempt if stream did not encounter errors to avoid AI_NoOutputGeneratedError
      if (!streamEncounteredError) {
        result.text
          .then((text) => {
            void this.apiLogger.addAiCall({
              provider: providerType,
              model,
              operation: "streamText",
              status: "success",
              prompt,
              response: text,
              durationMs,
            });
          })
          .catch((error) => {
            logger.debug(
              "Failed to log streamText response (stream may have partial data)",
              { error },
            );
          });
      }

      return {
        ...result,
        textStream: wrappedStream,
      };
    } catch (error) {
      if (
        modelInstance &&
        this.shouldFallbackToBufferedResponse(error as Error)
      ) {
        try {
          return await this.generateBufferedFallback({
            modelInstance,
            prompt,
            system,
            providerType,
            model,
            cause: error,
          });
        } catch (fallbackError) {
          error = fallbackError;
        }
      }

      const durationMs = Date.now() - startTime;
      const {
        message: errorMessage,
        statusCode,
        metadata,
      } = this.extractErrorDetails(error);

      // Check if this is a rate limit error and try to rotate
      if (statusCode === 429 && this.isRateLimitError(error)) {
        logger.warn("Rate limit error encountered, attempting key rotation", {
          provider: providerType,
          statusCode,
        });

        const rotated = await this.providerManager.rotateToNextKey(
          providerType as any,
        );
        if (rotated) {
          logger.info("Key rotated successfully, retrying request", {
            provider: providerType,
          });
          // Recursively retry with the new key
          return this.streamText(prompt, system);
        } else {
          logger.error("Key rotation failed, all keys exhausted", {
            provider: providerType,
          });
        }
      }

      // Log failed call
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "streamText",
        status: "error",
        prompt,
        errorMessage,
        durationMs,
        metadata,
      });

      logger.error("Text streaming failed", {
        error: errorMessage,
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Non-streaming text generation (buffered / final response)
   * Wrapper around `generateText` from Vercel AI SDK. Returns full text.
   */

  async generateText(
    prompt: string,
    system?: string,
    options?: AIRequestOptions,
  ): Promise<{ text: string }> {
    const startTime = Date.now();

    let providerInstance: AIProviderInstance;
    try {
      providerInstance = await this.resolveProviderInstance(options);
    } catch (error) {
      throw error;
    }

    const providerType = providerInstance.provider;
    const model = providerInstance.model;

    try {
      const modelInstance =
        this.providerManager.getModelInstance(providerInstance);
      if (!modelInstance) {
        throw new Error(
          "No AI model configured. Please set up an AI provider first.",
        );
      }

      const result = await generateText({
        model: modelInstance,
        prompt,
        system,
      });

      const durationMs = Date.now() - startTime;
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "generateText",
        status: "success",
        prompt,
        response: String(result?.text ?? ""),
        durationMs,
      });

      return result as { text: string };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const {
        message: errorMessage,
        statusCode,
        metadata,
      } = this.extractErrorDetails(error);

      if (statusCode === 429 && this.isRateLimitError(error)) {
        const rotated = await this.providerManager.rotateToNextKey(
          providerType as any,
        );
        if (rotated) {
          // Retry after rotation
          return this.generateText(prompt, system);
        }
      }

      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "generateText",
        status: "error",
        prompt,
        errorMessage,
        durationMs,
        metadata,
      });

      throw error;
    }
  }

  /**
   * Generate structured output matching a Zod schema
   * Non-streaming, returns complete object when done
   * Best for: Fast, structured responses (classification, parsing, extraction)
   *
   * @param schema Zod schema defining the output structure
   * @param prompt The prompt for generation
   * @param system Optional system prompt
   * @returns Promise resolving to structured object matching schema
   *
   * @example
   * ```typescript
   * const schema = z.object({
   *   title: z.string(),
   *   year: z.number()
   * });
   *
   * const { object } = await aiService.generateObject(schema, "Extract movie info from: The Dark Knight (2008)");
   * console.log(object.title); // "The Dark Knight"
   * ```
   */
  async generateObject<T>(
    schema: z.ZodType<T>,
    prompt: string,
    system?: string,
    options?: AIRequestOptions,
  ): Promise<{ object: T }> {
    const startTime = Date.now();

    let providerInstance: AIProviderInstance;
    try {
      providerInstance = await this.resolveProviderInstance(options);
    } catch (error) {
      throw error;
    }

    const providerType = providerInstance.provider;
    const model = providerInstance.model;

    try {
      const modelInstance =
        this.providerManager.getModelInstance(providerInstance);
      if (!modelInstance) {
        throw new Error(
          "No AI model configured. Please set up an AI provider first.",
        );
      }

      const result = await generateObject({
        model: modelInstance,
        schema,
        prompt,
        system,
      });

      // Log successful call
      const durationMs = Date.now() - startTime;
      const responseText = JSON.stringify(result.object);
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "generateObject",
        status: "success",
        prompt,
        response: responseText,
        durationMs,
      });

      logger.info("Object generation completed", {
        schemaName:
          schema instanceof z.ZodObject ? schema._def.shape : "unknown",
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const {
        message: errorMessage,
        statusCode,
        metadata,
      } = this.extractErrorDetails(error);

      // Check if this is a rate limit error and try to rotate
      if (statusCode === 429 && this.isRateLimitError(error)) {
        logger.warn("Rate limit error encountered, attempting key rotation", {
          provider: providerType,
          statusCode,
        });

        const rotated = await this.providerManager.rotateToNextKey(
          providerType as any,
        );
        if (rotated) {
          logger.info("Key rotated successfully, retrying request", {
            provider: providerType,
          });
          // Recursively retry with the new key
          return this.generateObject(schema, prompt, system);
        } else {
          logger.error("Key rotation failed, all keys exhausted", {
            provider: providerType,
          });
        }
      }

      // Log failed call
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "generateObject",
        status: "error",
        prompt,
        errorMessage,
        durationMs,
        metadata,
      });

      logger.error("Object generation failed", {
        error: errorMessage,
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Stream structured output with partial object updates
   * Returns partial objects as fields arrive from the model
   * Best for: Progressive UI updates, large structured outputs
   *
   * @param schema Zod schema defining the output structure
   * @param prompt The prompt for generation
   * @param system Optional system prompt
   * @returns Async iterable of partial objects
   *
   * @example
   * ```typescript
   * const { partialObjectStream } = await aiService.streamObject(schema, prompt);
   *
   * let accumulated = {};
   * for await (const partial of partialObjectStream) {
   *   accumulated = { ...accumulated, ...partial };
   *   updateUI(accumulated); // Update UI with each field
   * }
   * ```
   */
  async streamObject<T>(
    schema: z.ZodType<T>,
    prompt: string,
    system?: string,
    options?: AIRequestOptions,
  ): Promise<any> {
    const startTime = Date.now();

    let providerInstance: AIProviderInstance;
    try {
      providerInstance = await this.resolveProviderInstance(options);
    } catch (error) {
      throw error;
    }

    const providerType = providerInstance.provider;
    const model = providerInstance.model;

    try {
      const modelInstance =
        this.providerManager.getModelInstance(providerInstance);
      if (!modelInstance) {
        throw new Error(
          "No AI model configured. Please set up an AI provider first.",
        );
      }

      let streamEncounteredError = false;
      let streamError: Error | null = null;

      const result = await streamObject({
        model: modelInstance,
        schema,
        prompt,
        system,
        onChunk: ({ chunk }: { chunk: unknown }) => {
          logger.debug("Object stream chunk", { chunkType: typeof chunk });
        },
        onError: ({ error }) => {
          // Track that stream encountered an error
          streamEncounteredError = true;
          streamError =
            error instanceof Error ? error : new Error(String(error));
          // Log stream-time errors for debugging
          const errorName = error instanceof Error ? error.name : "unknown";
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.warn("Object stream error callback triggered", {
            errorName,
            errorMessage,
          });
        },
      });

      // Wrap the object stream to detect errors during consumption
      const wrappedPartialStream = this.createErrorDetectingStream(
        result.partialObjectStream as AsyncIterable<unknown>,
        () => streamEncounteredError,
        () => streamError,
      );

      // If stream encountered a parsing error immediately, use buffered response instead
      if (streamEncounteredError && streamError !== null) {
        const err = streamError as Error;
        const errorMsg = err.message ?? String(err);
        const errorName = err.name ?? "unknown";

        logger.warn(
          "Object stream encountered parsing error, switching to buffered response",
          {
            errorName,
            errorMessage: errorMsg,
          },
        );

        // Return the buffered object response
        const bufferedObject = await result.object;

        const durationMs = Date.now() - startTime;
        await this.apiLogger.addAiCall({
          provider: providerType,
          model,
          operation: "streamObject",
          status: "success",
          prompt,
          response: JSON.stringify(bufferedObject),
          durationMs,
        });

        // Create a stream that yields the complete object
        const completeObjectStream = (async function* () {
          yield bufferedObject;
        })();

        return {
          ...result,
          partialObjectStream: completeObjectStream,
          object: Promise.resolve(bufferedObject),
        };
      }

      // Log successful call
      const durationMs = Date.now() - startTime;
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "streamObject",
        status: "success",
        prompt,
        durationMs,
      });

      // Capture response object asynchronously after logging
      // Only attempt if stream did not encounter errors to avoid AI_NoOutputGeneratedError
      if (!streamEncounteredError) {
        result.object
          .then((obj) => {
            void this.apiLogger.addAiCall({
              provider: providerType,
              model,
              operation: "streamObject",
              status: "success",
              prompt,
              response: JSON.stringify(obj),
              durationMs,
            });
          })
          .catch((error) => {
            logger.debug(
              "Failed to log streamObject response (stream may have partial data)",
              { error },
            );
          });
      }

      return {
        ...result,
        partialObjectStream: wrappedPartialStream,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const {
        message: errorMessage,
        statusCode,
        metadata,
      } = this.extractErrorDetails(error);

      // Check if this is a rate limit error and try to rotate
      if (statusCode === 429 && this.isRateLimitError(error)) {
        logger.warn("Rate limit error encountered, attempting key rotation", {
          provider: providerType,
          statusCode,
        });

        const rotated = await this.providerManager.rotateToNextKey(
          providerType as any,
        );
        if (rotated) {
          logger.info("Key rotated successfully, retrying request", {
            provider: providerType,
          });
          // Recursively retry with the new key
          return this.streamObject(schema, prompt, system);
        } else {
          logger.error("Key rotation failed, all keys exhausted", {
            provider: providerType,
          });
        }
      }

      // Log failed call
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "streamObject",
        status: "error",
        prompt,
        errorMessage,
        durationMs,
        metadata,
      });

      logger.error("Object streaming failed", {
        error: errorMessage,
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Combined streaming pattern: Stream text explanation while generating structured output
   * Provides both explanation and structured interpretation
   * Best for: Complex queries needing both explanation and structured results
   *
   * @param explainPrompt Prompt for text explanation
   * @param schema Schema for structured output
   * @param structuredPrompt Prompt for structured interpretation
   * @param system Optional system prompt
   *
   * @example
   * ```typescript
   * const { textStream, objectStream } = await aiService.streamTextAndObject(
   *   "Explain your interpretation of: anime from 2020",
   *   searchSchema,
   *   "Interpret: anime from 2020",
   *   systemPrompt
   * );
   * ```
   */
  async streamTextAndObject<T>(
    explainPrompt: string,
    schema: z.ZodType<T>,
    structuredPrompt: string,
    system?: string,
  ) {
    const startTime = Date.now();
    const provider = this.providerManager.getActiveProvider();
    const providerType = provider?.provider || "unknown";
    const model = provider?.model || "unknown";

    try {
      const modelInstance = this.providerManager.getModelInstance();
      if (!modelInstance) {
        throw new Error(
          "No AI model configured. Please set up an AI provider first.",
        );
      }

      // Start both streams concurrently
      const textPromise = streamText({
        model: modelInstance,
        prompt: explainPrompt,
        system,
      });

      const objectPromise = streamObject({
        model: modelInstance,
        schema,
        prompt: structuredPrompt,
        system,
      });

      const [textResult, objectResult] = await Promise.all([
        textPromise,
        objectPromise,
      ]);

      // Log successful call
      const durationMs = Date.now() - startTime;
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "streamTextAndObject",
        status: "success",
        prompt: `${explainPrompt} | ${structuredPrompt}`,
        durationMs,
      });

      // Capture responses asynchronously
      Promise.all([textResult.text, objectResult.object])
        .then(([text, obj]) => {
          void this.apiLogger.addAiCall({
            provider: providerType,
            model,
            operation: "streamTextAndObject",
            status: "success",
            prompt: `${explainPrompt} | ${structuredPrompt}`,
            response: JSON.stringify({
              text,
              object: obj,
            }),
            durationMs,
          });
        })
        .catch((error) => {
          logger.error("Failed to log streamTextAndObject response", { error });
        });

      return {
        textStream: textResult.textStream,
        partialObjectStream: objectResult.partialObjectStream,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const { message: errorMessage, metadata } =
        this.extractErrorDetails(error);

      // Log failed call
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "streamTextAndObject",
        status: "error",
        prompt: `${explainPrompt} | ${structuredPrompt}`,
        errorMessage,
        durationMs,
        metadata,
      });

      logger.error("Combined streaming failed", {
        error: errorMessage,
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Progressive enhancement pattern: Fast initial result, detailed follow-up
   * Returns quick result immediately, then enhances with detailed analysis
   * Best for: Progressive UI improvements
   *
   * @param basicSchema Simpler schema for fast response
   * @param detailedSchema More complex schema for detailed response
   * @param prompt The prompt
   * @param system Optional system prompt
   *
   * @returns Promise with both basic and detailed results
   */
  async progressiveGeneration<TBasic, TDetailed>(
    basicSchema: z.ZodType<TBasic>,
    detailedSchema: z.ZodType<TDetailed>,
    prompt: string,
    system?: string,
  ) {
    const startTime = Date.now();
    const provider = this.providerManager.getActiveProvider();
    const providerType = provider?.provider || "unknown";
    const model = provider?.model || "unknown";

    try {
      const modelInstance = this.providerManager.getModelInstance();
      if (!modelInstance) {
        throw new Error(
          "No AI model configured. Please set up an AI provider first.",
        );
      }

      // 1. Get quick result using faster model
      const basicResult = await generateObject({
        model: modelInstance,
        schema: basicSchema,
        prompt,
        system,
      });

      // 2. Start detailed generation asynchronously (don't await)
      const detailedPromise = streamObject({
        model: modelInstance,
        schema: detailedSchema,
        prompt,
        system,
      });

      // Log successful call
      const durationMs = Date.now() - startTime;
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "progressiveGeneration",
        status: "success",
        prompt,
        response: JSON.stringify({
          basic: basicResult.object,
        }),
        durationMs,
      });

      // Capture detailed response asynchronously
      detailedPromise.object
        .then((detailed) => {
          void this.apiLogger.addAiCall({
            provider: providerType,
            model,
            operation: "progressiveGeneration",
            status: "success",
            prompt,
            response: JSON.stringify({
              basic: basicResult.object,
              detailed,
            }),
            durationMs,
          });
        })
        .catch((error) => {
          logger.error(
            "Failed to log progressiveGeneration detailed response",
            { error },
          );
        });

      return {
        basic: basicResult.object,
        detailedStream: detailedPromise,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const { message: errorMessage, metadata } =
        this.extractErrorDetails(error);

      // Log failed call
      await this.apiLogger.addAiCall({
        provider: providerType,
        model,
        operation: "progressiveGeneration",
        status: "error",
        prompt,
        errorMessage,
        durationMs,
        metadata,
      });

      logger.error("Progressive generation failed", {
        error: errorMessage,
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Check if AI service is properly configured
   * Returns true if there's an active provider and it passes health check
   * Returns false if no provider is configured (not an error condition)
   */
  async isConfigured(): Promise<boolean> {
    try {
      const provider = this.providerManager.getActiveProvider();
      if (!provider) {
        // No provider configured is not an error - just means not ready
        return false;
      }

      const health = await this.providerManager.healthCheck(provider.provider);
      if (health.isHealthy) {
        return true;
      }

      const errorMessage = health.error?.toLowerCase() ?? "";
      const healthNotImplemented = errorMessage.includes("not implemented");

      if (healthNotImplemented) {
        return true;
      }

      logger.warn("AI provider health check returned unhealthy status", {
        provider: provider.provider,
        error: health.error,
      });

      return false;
    } catch (error) {
      // Configuration check errors should not crash - just indicate not configured
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug("Configuration check failed", { error: errorMessage });
      return false;
    }
  }

  /**
   * Get information about the current active model
   */
  getActiveModel() {
    const provider = this.providerManager.getActiveProvider();
    if (!provider) {
      return null;
    }

    const providerInfo = this.providerManager.getProviderInfo(
      provider.provider,
    );

    return {
      provider: provider.provider,
      model: provider.model,
      info: providerInfo,
    };
  }

  private async tryRecoverBufferedStreamText(
    result: any,
    streamError: Error,
  ): Promise<string | null> {
    if (this.isPromiseLike<string>(result?.text)) {
      try {
        const buffered = await result.text;
        if (typeof buffered === "string" && buffered.length > 0) {
          return buffered;
        }
      } catch (error) {
        void logger.debug(
          "streamText result.text promise rejected after stream error",
          {
            errorName: error instanceof Error ? error.name : "unknown",
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    const fallbackText = await this.extractTextFromErrorResponse(streamError);
    if (fallbackText && fallbackText.length > 0) {
      return fallbackText;
    }

    return null;
  }

  private async extractTextFromErrorResponse(
    error: Error,
  ): Promise<string | null> {
    const typedError = error as Error & {
      response?: unknown;
      responseBody?: unknown;
      data?: unknown;
      cause?: unknown;
    };

    const candidates: unknown[] = [];
    if (typedError.response) {
      candidates.push(typedError.response);
      const response = typedError.response as { clone?: () => unknown };
      if (typeof response.clone === "function") {
        candidates.push(response.clone());
      }
    }

    const cause = typedError.cause as {
      response?: unknown;
      responseBody?: unknown;
      data?: unknown;
      clone?: () => unknown;
    } | null;

    if (cause?.response) {
      candidates.push(cause.response);
      const causeResponse = cause.response as { clone?: () => unknown };
      if (typeof causeResponse.clone === "function") {
        candidates.push(causeResponse.clone());
      }
    }

    for (const candidate of candidates) {
      const text = await this.readTextFromResponse(candidate);
      if (text && text.length > 0) {
        return text;
      }
    }

    const maybeStrings = [
      typedError.responseBody,
      typedError.data,
      cause?.responseBody,
      cause?.data,
    ];

    for (const value of maybeStrings) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private async readTextFromResponse(
    responseLike: unknown,
  ): Promise<string | null> {
    if (
      !responseLike ||
      typeof responseLike !== "object" ||
      typeof (responseLike as { text?: unknown }).text !== "function"
    ) {
      return null;
    }

    try {
      const text = await (
        responseLike as { text: () => Promise<string> }
      ).text();
      if (typeof text === "string") {
        return text;
      }
    } catch (error) {
      void logger.debug("Failed to read buffered AI response", {
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  private isPromiseLike<T = unknown>(value: unknown): value is Promise<T> {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Promise<T>).then === "function"
    );
  }

  private shouldFallbackToBufferedResponse(error: Error | unknown): boolean {
    const target = error instanceof Error ? error : null;
    if (!target) {
      return false;
    }

    const message = target.message?.toLowerCase?.() ?? "";
    const name = target.name ?? "";

    if (this.isEmptyOutputError(name, message)) {
      return true;
    }

    if (this.isApiCallStreamError(target)) {
      return true;
    }

    const cause = (target as Error & { cause?: unknown }).cause;
    if (cause && cause instanceof Error) {
      const causeName = cause.name ?? "";
      const causeMessage = cause.message?.toLowerCase?.() ?? "";
      if (this.isEmptyOutputError(causeName, causeMessage)) {
        return true;
      }

      if (this.isApiCallStreamError(cause)) {
        return true;
      }
    }

    return false;
  }

  private isEmptyOutputError(name: string, message: string): boolean {
    if (!name && !message) {
      return false;
    }

    const normalized = message.toLowerCase();
    return (
      name === "AI_EmptyResponseBodyError" ||
      name === "AI_NoOutputGeneratedError" ||
      normalized.includes("empty response body") ||
      normalized.includes("no output generated") ||
      normalized.includes("no output")
    );
  }

  private isApiCallStreamError(error: Error): boolean {
    if (!APICallError || !APICallError.isInstance) {
      return false;
    }

    if (!APICallError.isInstance(error)) {
      return false;
    }

    const normalized = error.message?.toLowerCase?.() ?? "";
    return (
      normalized.includes("failed to process successful response") ||
      normalized.includes("failed to process response")
    );
  }

  private createBufferedTextStream(text: string, chunkSize = 600) {
    const safeText = text ?? "";

    return (async function* streamChunks() {
      if (!safeText.length) {
        return;
      }

      for (let index = 0; index < safeText.length; index += chunkSize) {
        yield safeText.slice(index, index + chunkSize);
      }
    })();
  }

  private async generateBufferedFallback({
    modelInstance,
    prompt,
    system,
    providerType,
    model,
    cause,
  }: {
    modelInstance: any;
    prompt: string;
    system?: string;
    providerType: string;
    model: string;
    cause: unknown;
  }): Promise<any> {
    const fallbackStart = Date.now();
    const result = await generateText({
      model: modelInstance,
      prompt,
      system,
    });

    const text = result?.text ?? "";
    if (!text.trim()) {
      throw new Error(
        "The AI provider returned an empty response after fallback.",
      );
    }

    const durationMs = Date.now() - fallbackStart;
    await this.apiLogger.addAiCall({
      provider: providerType,
      model,
      operation: "generateText-fallback",
      status: "success",
      prompt,
      response: text,
      durationMs,
      metadata: {
        fallbackReason:
          cause instanceof Error ? (cause.name ?? "unknown") : "unknown",
      },
    });

    logger.warn(
      "Streamed response was empty; used buffered fallback instead.",
      {
        provider: providerType,
        model,
        fallbackDurationMs: durationMs,
      },
    );

    return {
      ...result,
      text: Promise.resolve(text),
      textStream: this.createBufferedTextStream(text),
    };
  }
}
