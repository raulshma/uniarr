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
import { confirmActionTool } from "./ConfirmActionTool";
import { executeWorkflowTool } from "./ExecuteWorkflowTool";
import { webSearchTool } from "./WebSearchTool";
import { mediaDetailsTool } from "./MediaDetailsTool";
import { registerBuiltInWorkflows } from "./workflows";
import { logger } from "@/services/logger/LoggerService";

/**
 * Register all available tools with the ToolRegistry.
 * This function should be called during app initialization to make
 * all tools available to the AI chat service.
 *
 * Safe to call multiple times - will skip registration if tools are already registered.
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

  // Skip registration if tools are already registered
  // This prevents duplicate registration errors during hot reloads or re-renders
  if (registry.count() > 0) {
    void logger.debug("Tools already registered, skipping registration", {
      toolCount: registry.count(),
      toolNames: registry.getToolNames(),
    });
    return;
  }

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

    // Register ConfirmActionTool
    registry.register(confirmActionTool);

    // Register ExecuteWorkflowTool
    registry.register(executeWorkflowTool);

    // Register WebSearchTool (now works on all platforms with custom implementation)
    registry.register(webSearchTool);

    // Register MediaDetailsTool
    registry.register(mediaDetailsTool);

    void logger.info("All AI tools registered successfully", {
      toolCount: registry.count(),
      toolNames: registry.getToolNames(),
    });

    // Register built-in workflows
    registerBuiltInWorkflows();
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
export { WorkflowEngine } from "./WorkflowEngine";
export type {
  ToolDefinition,
  ToolResult,
  ToolInvocation,
  ToolServiceType,
  ToolMediaType,
} from "./types";
export { ToolError, ToolErrorCategory } from "./types";
export type { Workflow, WorkflowStep, WorkflowResult } from "./WorkflowEngine";
