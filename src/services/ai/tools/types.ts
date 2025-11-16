import { z } from "zod";

/**
 * Represents the definition of a tool that can be invoked by the LLM.
 * Tools are functions that the AI can call to interact with external systems.
 */
export interface ToolDefinition<TParams = unknown, TResult = unknown> {
  /** Unique identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema defining the tool's parameters */
  parameters: z.ZodSchema<TParams>;
  /** Function that executes the tool's logic */
  execute: (params: TParams) => Promise<ToolResult<TResult>>;
}

/**
 * Result returned by a tool execution.
 * Provides structured data that the LLM can use to formulate responses.
 */
export interface ToolResult<T = unknown> {
  /** Whether the tool execution was successful */
  success: boolean;
  /** Data returned by the tool (if successful) */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Additional metadata about the execution */
  metadata?: {
    /** Time taken to execute the tool in milliseconds */
    executionTime?: number;
    /** Service ID that was accessed */
    serviceId?: string;
    /** Service type that was accessed */
    serviceType?: string;
    /** Additional context-specific metadata */
    [key: string]: unknown;
  };
}

/**
 * Represents a tool invocation in the conversation history.
 * Tracks the state of tool calls made by the LLM.
 */
export interface ToolInvocation {
  /** Unique identifier for this specific tool call */
  toolCallId: string;
  /** Name of the tool that was invoked */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Result returned by the tool (if completed) */
  result?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Current state of the tool invocation */
  state: "pending" | "executing" | "completed" | "failed";
}

/**
 * Error categories for tool execution failures.
 * Used to provide actionable feedback to users.
 */
export enum ToolErrorCategory {
  /** The requested service is not configured in the app */
  SERVICE_NOT_CONFIGURED = "SERVICE_NOT_CONFIGURED",
  /** Authentication failed (invalid API key, credentials, etc.) */
  AUTH_FAILED = "AUTH_FAILED",
  /** Service is unreachable or timed out */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  /** Invalid parameters provided to the tool */
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  /** The operation failed for an unknown reason */
  OPERATION_FAILED = "OPERATION_FAILED",
  /** Network error (VPN, connectivity issues) */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

/**
 * Custom error class for tool execution failures.
 * Provides structured error information with actionable suggestions.
 */
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly category: ToolErrorCategory,
    public readonly actionable: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ToolError";
    Object.setPrototypeOf(this, ToolError.prototype);
  }

  /**
   * Convert the error to a user-friendly message
   */
  toUserMessage(): string {
    return `${this.message} ${this.actionable}`;
  }
}

// ==================== COMMON PARAMETER SCHEMAS ====================

/**
 * Zod schema for service type parameter.
 * Validates that the service type is one of the supported types.
 */
export const serviceTypeSchema = z.enum([
  "sonarr",
  "radarr",
  "lidarr",
  "jellyseerr",
  "jellyfin",
  "qbittorrent",
  "transmission",
  "deluge",
  "sabnzbd",
  "nzbget",
  "rtorrent",
  "prowlarr",
  "bazarr",
  "adguard",
  "homarr",
] as const);

/**
 * Zod schema for media type parameter.
 * Validates that the media type is one of the supported types.
 */
export const mediaTypeSchema = z.enum([
  "series",
  "movie",
  "music",
  "request",
  "unknown",
] as const);

/**
 * Zod schema for date string parameter.
 * Accepts ISO date strings or relative date expressions.
 */
export const dateStringSchema = z
  .string()
  .describe(
    "Date in ISO format (YYYY-MM-DD) or relative expression (today, tomorrow, this week, next month)",
  );

/**
 * Zod schema for date range parameters.
 * Used for calendar and filtering operations.
 */
export const dateRangeSchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

/**
 * Zod schema for pagination parameters.
 */
export const paginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe("Number of results to skip"),
});

/**
 * Zod schema for service ID array parameter.
 */
export const serviceIdsSchema = z
  .array(z.string())
  .optional()
  .describe("Array of service IDs to filter by");

// ==================== TYPE GUARDS ====================

/**
 * Type guard to check if a value is a ToolError
 */
export function isToolError(error: unknown): error is ToolError {
  return error instanceof ToolError;
}

/**
 * Type guard to check if a value is a valid ToolResult
 */
export function isToolResult<T = unknown>(
  value: unknown,
): value is ToolResult<T> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Record<string, unknown>;
  return typeof result.success === "boolean";
}

/**
 * Type guard to check if a value is a valid ToolDefinition
 */
export function isToolDefinition(value: unknown): value is ToolDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const tool = value as Record<string, unknown>;
  return (
    typeof tool.name === "string" &&
    typeof tool.description === "string" &&
    typeof tool.parameters === "object" &&
    typeof tool.execute === "function"
  );
}

/**
 * Type guard to check if a value is a valid ToolInvocation
 */
export function isToolInvocation(value: unknown): value is ToolInvocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const invocation = value as Record<string, unknown>;
  return (
    typeof invocation.toolCallId === "string" &&
    typeof invocation.toolName === "string" &&
    typeof invocation.args === "object" &&
    typeof invocation.state === "string" &&
    ["pending", "executing", "completed", "failed"].includes(
      invocation.state as string,
    )
  );
}

// ==================== HELPER TYPES ====================

/**
 * Extract the parameter type from a ToolDefinition
 */
export type ToolParams<T> =
  T extends ToolDefinition<infer P, unknown> ? P : never;

/**
 * Extract the result type from a ToolDefinition
 */
export type ToolResultData<T> =
  T extends ToolDefinition<unknown, infer R> ? R : never;

/**
 * Type for service type values
 */
export type ToolServiceType = z.infer<typeof serviceTypeSchema>;

/**
 * Type for media type values
 */
export type ToolMediaType = z.infer<typeof mediaTypeSchema>;
