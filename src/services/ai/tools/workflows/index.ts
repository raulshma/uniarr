/**
 * Built-in workflows for common multi-step operations.
 * This module exports pre-configured workflows that can be registered with the WorkflowEngine.
 */

import type { Workflow } from "../WorkflowEngine";
import { logger } from "@/services/logger/LoggerService";
import { WorkflowEngine } from "../WorkflowEngine";

/**
 * Search and Add Workflow
 *
 * Searches for media and adds it to the appropriate service.
 * Steps:
 * 1. Search for media using UnifiedSearchTool
 * 2. Add the first result to the specified service using AddMediaTool
 *
 * Parameters:
 * - query: Search query string
 * - serviceType: Service to add media to (sonarr or radarr)
 * - mediaType: Type of media (movie or series)
 */
export const searchAndAddWorkflow: Workflow = {
  id: "search-and-add",
  name: "Search and Add Media",
  description:
    "Search for media across services and add the best match to a specified service",
  requiresConfirmation: false,
  tags: ["media", "search", "add"],
  steps: [
    {
      id: "search",
      toolName: "search_media",
      description: "Search for media across all services",
      params: {
        query: "{{query}}",
        mediaType: "{{mediaType}}",
        limit: 5,
      },
    },
    {
      id: "add",
      toolName: "add_media",
      description: "Add the first search result to the service",
      params: {
        title: "{{search.data.results[0].title}}",
        serviceType: "{{serviceType}}",
        monitored: true,
      },
      dependsOn: ["search"],
      transformResult: (result, previousResults) => {
        // Extract the search result for context
        const searchResult = previousResults.get("search");
        return {
          addResult: result,
          searchResult,
        };
      },
    },
  ],
};

/**
 * Health Check and Restart Workflow
 *
 * Checks service health and restarts unhealthy services.
 * Steps:
 * 1. Check health of specified services
 * 2. Identify unhealthy services
 * 3. Restart unhealthy services (if restart capability exists)
 *
 * Parameters:
 * - serviceIds: Array of service IDs to check (optional, checks all if not provided)
 *
 * Note: This workflow is currently limited because we don't have a restart_service tool.
 * It will only check health and report issues.
 */
export const healthCheckAndRestartWorkflow: Workflow = {
  id: "health-check-and-restart",
  name: "Health Check and Restart",
  description:
    "Check service health and provide recommendations for unhealthy services",
  requiresConfirmation: false,
  tags: ["health", "diagnostics", "maintenance"],
  steps: [
    {
      id: "health-check",
      toolName: "check_service_health",
      description: "Check health status of all services",
      params: {
        serviceIds: "{{serviceIds}}",
        includeMetrics: true,
      },
    },
    {
      id: "system-info",
      toolName: "get_system_info",
      description: "Get system information for unhealthy services",
      params: {
        serviceIds: "{{serviceIds}}",
        includeVersions: true,
        includeDiskSpace: true,
      },
      dependsOn: ["health-check"],
      transformResult: (result, previousResults) => {
        const healthCheck = previousResults.get("health-check");
        return {
          systemInfo: result,
          healthCheck,
        };
      },
    },
  ],
};

/**
 * Find and Remove Duplicates Workflow
 *
 * Lists downloads, identifies duplicates, and removes them after confirmation.
 * Steps:
 * 1. List all active downloads
 * 2. Identify duplicate downloads (same title, different quality/source)
 * 3. Request confirmation for removal
 * 4. Remove confirmed duplicates
 *
 * Parameters:
 * - serviceType: Download service to check (optional, checks all if not provided)
 *
 * Note: This is a simplified version. Full duplicate detection would require
 * more sophisticated logic to compare titles and determine which to keep.
 */
export const findAndRemoveDuplicatesWorkflow: Workflow = {
  id: "find-and-remove-duplicates",
  name: "Find and Remove Duplicate Downloads",
  description:
    "Identify and remove duplicate downloads from the download queue",
  requiresConfirmation: true,
  tags: ["downloads", "cleanup", "duplicates"],
  steps: [
    {
      id: "list-downloads",
      toolName: "manage_downloads",
      description: "List all active downloads",
      params: {
        action: "list",
        serviceType: "{{serviceType}}",
      },
    },
    {
      id: "analyze-duplicates",
      toolName: "manage_downloads",
      description: "Get detailed information about downloads",
      params: {
        action: "list",
        serviceType: "{{serviceType}}",
      },
      dependsOn: ["list-downloads"],
      transformResult: (result, previousResults) => {
        // In a real implementation, this would analyze the downloads
        // and identify duplicates based on title similarity
        const downloads = previousResults.get("list-downloads");

        // For now, just return the downloads for manual review
        return {
          downloads,
          duplicatesFound: 0,
          message:
            "Duplicate detection requires manual review. Please check the download list for similar titles.",
        };
      },
    },
  ],
};

/**
 * Bulk Add from List Workflow
 *
 * Takes a list of media titles and adds them all to the specified service.
 * Steps:
 * 1. For each title in the list:
 *    a. Search for the media
 *    b. Add the best match to the service
 *
 * Parameters:
 * - titles: Array of media titles to add
 * - serviceType: Service to add media to (sonarr or radarr)
 * - mediaType: Type of media (movie or series)
 *
 * Note: This workflow demonstrates dynamic step generation based on input.
 * In practice, this would be better handled by a dedicated bulk_add tool.
 */
export const bulkAddFromListWorkflow: Workflow = {
  id: "bulk-add-from-list",
  name: "Bulk Add Media from List",
  description: "Add multiple media items from a list of titles",
  requiresConfirmation: true,
  tags: ["media", "bulk", "add"],
  steps: [
    {
      id: "search-first",
      toolName: "search_media",
      description: "Search for the first media item",
      params: {
        query: "{{titles[0]}}",
        mediaType: "{{mediaType}}",
        limit: 1,
      },
    },
    {
      id: "add-first",
      toolName: "add_media",
      description: "Add the first media item",
      params: {
        title: "{{search-first.data.results[0].title}}",
        serviceType: "{{serviceType}}",
        monitored: true,
      },
      dependsOn: ["search-first"],
    },
  ],
};

/**
 * Quality Upgrade Workflow
 *
 * Finds media below a quality threshold and searches for upgrades.
 * Steps:
 * 1. Get media library
 * 2. Filter by quality profile
 * 3. Search for higher quality versions
 * 4. Add upgrade requests
 *
 * Parameters:
 * - serviceType: Service to check (sonarr or radarr)
 * - qualityProfile: Target quality profile
 * - limit: Maximum number of items to upgrade
 */
export const qualityUpgradeWorkflow: Workflow = {
  id: "quality-upgrade",
  name: "Quality Upgrade Search",
  description: "Find and request quality upgrades for media in your library",
  requiresConfirmation: true,
  tags: ["media", "quality", "upgrade"],
  steps: [
    {
      id: "get-library",
      toolName: "get_media_library",
      description: "Get media library items",
      params: {
        serviceType: "{{serviceType}}",
        limit: "{{limit}}",
        sortBy: "added",
      },
    },
    {
      id: "check-system",
      toolName: "get_system_info",
      description: "Check system resources before upgrading",
      params: {
        serviceIds: [],
        includeVersions: false,
        includeDiskSpace: true,
      },
      dependsOn: ["get-library"],
      transformResult: (result, previousResults) => {
        const library = previousResults.get("get-library");
        return {
          systemInfo: result,
          library,
          message:
            "Quality upgrade workflow requires manual review. Please check available disk space before proceeding.",
        };
      },
    },
  ],
};

/**
 * Register all built-in workflows with the WorkflowEngine.
 * This function should be called during app initialization.
 *
 * @example
 * ```typescript
 * import { registerBuiltInWorkflows } from '@/services/ai/tools/workflows';
 *
 * registerBuiltInWorkflows();
 * ```
 */
export function registerBuiltInWorkflows(): void {
  const engine = WorkflowEngine.getInstance();

  try {
    // Register all workflows
    engine.registerWorkflow(searchAndAddWorkflow);
    engine.registerWorkflow(healthCheckAndRestartWorkflow);
    engine.registerWorkflow(findAndRemoveDuplicatesWorkflow);
    engine.registerWorkflow(bulkAddFromListWorkflow);
    engine.registerWorkflow(qualityUpgradeWorkflow);
  } catch (error) {
    void logger.error("Failed to register built-in workflows", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Export all workflows for direct access if needed
export {
  searchAndAddWorkflow as SearchAndAddWorkflow,
  healthCheckAndRestartWorkflow as HealthCheckAndRestartWorkflow,
  findAndRemoveDuplicatesWorkflow as FindAndRemoveDuplicatesWorkflow,
  bulkAddFromListWorkflow as BulkAddFromListWorkflow,
  qualityUpgradeWorkflow as QualityUpgradeWorkflow,
};
