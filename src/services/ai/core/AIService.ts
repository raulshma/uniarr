import { streamText, generateObject, streamObject } from "ai";
import { z } from "zod";
import { logger } from "@/services/logger/LoggerService";
import { apiLogger } from "@/services/logger/ApiLoggerService";
import { AIProviderManager } from "./AIProviderManager";

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
   * Check if an error is a rate limit (429) error
   */
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
  async streamText(prompt: string, system?: string): Promise<any> {
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

      const result = await streamText({
        model: modelInstance,
        prompt,
        system,
        onChunk: ({ chunk }) => {
          // Optional: Custom chunk processing
          logger.debug("Text stream chunk", { chunkType: chunk.type });
        },
      });

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
          logger.error("Failed to log streamText response", { error });
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
  ): Promise<{ object: T }> {
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
  ): Promise<any> {
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

      const result = await streamObject({
        model: modelInstance,
        schema,
        prompt,
        system,
        onChunk: ({ chunk }: { chunk: unknown }) => {
          logger.debug("Object stream chunk", { chunkType: typeof chunk });
        },
      });

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
          logger.error("Failed to log streamObject response", { error });
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
   */
  async isConfigured(): Promise<boolean> {
    try {
      const provider = this.providerManager.getActiveProvider();
      if (!provider) {
        return false;
      }

      const health = await this.providerManager.healthCheck(provider.provider);
      return health.isHealthy;
    } catch (error) {
      logger.error("Configuration check failed", { error });
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
}
