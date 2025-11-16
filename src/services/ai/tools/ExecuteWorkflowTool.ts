/**
 * ExecuteWorkflowTool
 *
 * Allows the LLM to execute registered workflows for complex multi-step operations.
 */

import { z } from "zod";
import type { ToolDefinition } from "./types";
import { ToolError, ToolErrorCategory } from "./types";
import { WorkflowEngine } from "./WorkflowEngine";
import { logger } from "@/services/logger/LoggerService";

/**
 * Tool for executing multi-step workflows.
 *
 * This tool allows the LLM to invoke complex workflows that orchestrate
 * multiple tool calls in sequence with dependency management.
 *
 * @example
 * ```typescript
 * // LLM invokes this tool to execute a workflow
 * {
 *   workflowId: 'search-and-add',
 *   params: {
 *     query: 'Breaking Bad',
 *     serviceType: 'sonarr',
 *     mediaType: 'series'
 *   }
 * }
 * ```
 */
export const executeWorkflowTool: ToolDefinition = {
  name: "execute_workflow",
  description:
    "Execute a multi-step workflow for complex operations. Available workflows: search-and-add (search and add media), health-check-and-restart (check service health), find-and-remove-duplicates (find duplicate downloads), bulk-add-from-list (add multiple media items), quality-upgrade (find quality upgrades).",
  parameters: z.object({
    workflowId: z
      .string()
      .describe(
        "ID of the workflow to execute (e.g., 'search-and-add', 'health-check-and-restart')",
      ),
    params: z
      .record(z.string(), z.unknown())
      .describe("Parameters to pass to the workflow"),
  }),

  async execute(params) {
    const { workflowId, params: workflowParams } = params as {
      workflowId: string;
      params: Record<string, unknown>;
    };

    void logger.info("Executing workflow via tool", {
      workflowId,
      params: workflowParams,
    });

    try {
      const engine = WorkflowEngine.getInstance();

      // Get workflow to check if it exists
      const workflow = engine.getWorkflow(workflowId);

      if (!workflow) {
        throw new ToolError(
          `Workflow "${workflowId}" not found`,
          ToolErrorCategory.INVALID_PARAMETERS,
          `Available workflows: ${engine.getWorkflowIds().join(", ")}`,
          { workflowId, availableWorkflows: engine.getWorkflowIds() },
        );
      }

      // Execute the workflow
      const result = await engine.executeWorkflow(workflowId, workflowParams);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Workflow execution failed",
          failedStepId: result.failedStepId,
          executionTime: result.executionTime,
          data: {
            workflowId,
            workflowName: workflow.name,
            stepResults: Object.fromEntries(result.stepResults),
          },
        };
      }

      void logger.info("Workflow executed successfully", {
        workflowId,
        executionTime: result.executionTime,
        stepCount: result.stepResults.size,
      });

      return {
        success: true,
        data: {
          workflowId,
          workflowName: workflow.name,
          executionTime: result.executionTime,
          stepResults: Object.fromEntries(result.stepResults),
          message: `Workflow "${workflow.name}" completed successfully in ${result.executionTime}ms`,
        },
      };
    } catch (error) {
      void logger.error("Workflow execution failed", {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ToolError) {
        throw error;
      }

      throw new ToolError(
        `Failed to execute workflow: ${error instanceof Error ? error.message : String(error)}`,
        ToolErrorCategory.OPERATION_FAILED,
        "Please check the workflow parameters and try again.",
        { workflowId, error: String(error) },
      );
    }
  },
};
