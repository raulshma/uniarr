/**
 * Central registration file for all AI tools.
 * This file imports all tool implementations and provides a function
 * to register them with the ToolRegistry.
 *
 * @module tools
 */

import { ToolRegistry } from "./ToolRegistry";
import { mediaLibraryTool } from "./MediaLibraryTool";
import { serviceHealthTool } from "./ServiceHealthTool";
import { unifiedSearchTool } from "./UnifiedSearchTool";
import { downloadManagementTool } from "./DownloadManagementTool";
import { calendarTool } from "./CalendarTool";
import { addMediaTool } from "./AddMediaTool";
import { systemInfoTool } from "./SystemInfoTool";
import { logger } from "@/services/logger/LoggerService";

/**
 * Register all available tools with the ToolRegistry.
 * This function should be called during app initialization to make
 * all tools available to the AI chat service.
 *
 * @example
 * ```typescript
 * // In app initialization (e.g., _layout.tsx or App.tsx)
 * import { registerAllTools } from '@/services/ai/tools';
 *
 * registerAllTools();
 * ```
 */
export function registerAllTools(): void {
  const registry = ToolRegistry.getInstance();

  try {
    // Register MediaLibraryTool
    registry.register(mediaLibraryTool);

    // Register ServiceHealthTool
    registry.register(serviceHealthTool);

    // Register UnifiedSearchTool
    registry.register(unifiedSearchTool);

    // Register DownloadManagementTool
    registry.register(downloadManagementTool);

    // Register CalendarTool
    registry.register(calendarTool);

    // Register AddMediaTool
    registry.register(addMediaTool);

    // Register SystemInfoTool
    registry.register(systemInfoTool);

    void logger.info("All AI tools registered successfully", {
      toolCount: registry.count(),
      toolNames: registry.getToolNames(),
    });
  } catch (error) {
    void logger.error("Failed to register AI tools", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get the ToolRegistry instance.
 * Useful for accessing the registry after tools have been registered.
 *
 * @returns The ToolRegistry singleton instance
 */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}

// Re-export commonly used types and classes
export { ToolRegistry } from "./ToolRegistry";
export { ToolContext } from "./ToolContext";
export type {
  ToolDefinition,
  ToolResult,
  ToolInvocation,
  ToolServiceType,
  ToolMediaType,
} from "./types";
export { ToolError, ToolErrorCategory } from "./types";
