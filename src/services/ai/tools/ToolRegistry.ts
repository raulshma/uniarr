import { tool, type Tool } from "ai";
import type { ToolDefinition } from "./types";
import { logger } from "@/services/logger/LoggerService";

/**
 * Central registry for managing AI tool definitions.
 * Implements singleton pattern to ensure a single source of truth for all tools.
 *
 * The registry provides:
 * - Tool registration and lifecycle management
 * - Conversion to Vercel AI SDK format
 * - Duplicate name validation
 * - Tool retrieval by name or all at once
 *
 * @example
 * ```typescript
 * const registry = ToolRegistry.getInstance();
 * registry.register(myToolDefinition);
 * const vercelTools = registry.toVercelTools();
 * ```
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;

  /** Map of tool name to tool definition */
  private readonly tools = new Map<string, ToolDefinition<any, any>>();

  private constructor() {
    // ToolRegistry initialized
  }

  /**
   * Get the singleton instance of the ToolRegistry
   */
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }

    return ToolRegistry.instance;
  }

  /**
   * Register a tool definition in the registry.
   * Throws an error if a tool with the same name already exists.
   *
   * @param toolDef - The tool definition to register
   * @throws {Error} If a tool with the same name is already registered
   *
   * @example
   * ```typescript
   * registry.register({
   *   name: 'get_media_library',
   *   description: 'Retrieve media from library',
   *   parameters: z.object({ ... }),
   *   execute: async (params) => { ... }
   * });
   * ```
   */
  register<TParams = unknown, TResult = unknown>(
    toolDef: ToolDefinition<TParams, TResult>,
  ): void {
    if (this.tools.has(toolDef.name)) {
      const error = new Error(
        `Tool with name "${toolDef.name}" is already registered. Each tool must have a unique name.`,
      );
      void logger.error("Failed to register tool: duplicate name", {
        toolName: toolDef.name,
        error: error.message,
      });
      throw error;
    }

    this.tools.set(toolDef.name, toolDef);
  }

  /**
   * Unregister a tool from the registry.
   * Does nothing if the tool doesn't exist.
   *
   * @param name - The name of the tool to unregister
   *
   * @example
   * ```typescript
   * registry.unregister('get_media_library');
   * ```
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get a tool definition by name.
   *
   * @param name - The name of the tool to retrieve
   * @returns The tool definition, or undefined if not found
   *
   * @example
   * ```typescript
   * const tool = registry.get('get_media_library');
   * if (tool) {
   *   const result = await tool.execute(params);
   * }
   * ```
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tool definitions.
   *
   * @returns Array of all tool definitions
   *
   * @example
   * ```typescript
   * const allTools = registry.getAll();
   * console.log(`Registered ${allTools.length} tools`);
   * ```
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get the names of all registered tools.
   *
   * @returns Array of tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered.
   *
   * @param name - The name of the tool to check
   * @returns True if the tool is registered, false otherwise
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools.
   *
   * @returns The count of registered tools
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Convert all registered tools to Vercel AI SDK format.
   * This format is required by the `streamText` function from the Vercel AI SDK.
   *
   * @returns Record mapping tool names to Tool instances
   *
   * @example
   * ```typescript
   * import { streamText } from 'ai';
   *
   * const tools = registry.toVercelTools();
   * const result = await streamText({
   *   model: myModel,
   *   messages: [...],
   *   tools,
   * });
   * ```
   */
  toVercelTools(): Record<string, Tool> {
    const vercelTools: Record<string, Tool> = {};

    for (const [name, toolDef] of this.tools.entries()) {
      try {
        // Convert our ToolDefinition to Vercel AI SDK Tool format
        vercelTools[name] = tool({
          description: toolDef.description,
          inputSchema: toolDef.parameters,
          execute: async (params: unknown) => {
            try {
              const startTime = Date.now();
              const result = await toolDef.execute(params);
              const executionTime = Date.now() - startTime;

              // Add execution time to metadata if not already present
              if (result.metadata) {
                result.metadata.executionTime =
                  result.metadata.executionTime ?? executionTime;
              } else if (result.success) {
                // Only add metadata for successful results to avoid overwriting error info
                (result as { metadata?: unknown }).metadata = {
                  executionTime,
                };
              }

              return result;
            } catch (error) {
              void logger.error("Tool execution failed with unhandled error", {
                toolName: name,
                error: error instanceof Error ? error.message : String(error),
              });

              // Return a structured error result
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "An unexpected error occurred",
                metadata: {
                  toolName: name,
                },
              };
            }
          },
        });
      } catch (error) {
        void logger.error("Failed to convert tool to Vercel format", {
          toolName: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return vercelTools;
  }

  /**
   * Clear all registered tools.
   * Useful for testing or resetting the registry.
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Reset the singleton instance.
   * Primarily used for testing purposes.
   */
  static resetInstance(): void {
    if (ToolRegistry.instance) {
      ToolRegistry.instance.clear();
      ToolRegistry.instance = null;
    }
  }
}
