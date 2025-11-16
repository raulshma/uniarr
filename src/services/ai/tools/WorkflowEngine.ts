/**
 * WorkflowEngine
 *
 * Orchestrates multi-step tool operations for complex AI assistant workflows.
 * Handles step dependencies, result transformation, and error recovery.
 */

import { logger } from "@/services/logger/LoggerService";
import { ToolRegistry } from "./ToolRegistry";
import { ToolError, ToolErrorCategory } from "./types";

/**
 * Represents a single step in a workflow.
 * Each step invokes a tool with parameters that can reference previous step results.
 */
export interface WorkflowStep {
  /** Unique identifier for this step */
  id: string;
  /** Name of the tool to invoke */
  toolName: string;
  /** Parameters to pass to the tool (can include template variables) */
  params: Record<string, unknown>;
  /** IDs of steps that must complete before this step can execute */
  dependsOn?: string[];
  /** Optional function to transform the result before storing */
  transformResult?: (
    result: unknown,
    previousResults: Map<string, unknown>,
  ) => unknown;
  /** Optional description of what this step does */
  description?: string;
}

/**
 * Represents a complete workflow with multiple steps.
 */
export interface Workflow {
  /** Unique identifier for the workflow */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the workflow does */
  description: string;
  /** Ordered list of steps to execute */
  steps: WorkflowStep[];
  /** Whether this workflow requires user confirmation before execution */
  requiresConfirmation?: boolean;
  /** Tags for categorizing workflows */
  tags?: string[];
}

/**
 * Result of a workflow execution.
 */
export interface WorkflowResult {
  /** Whether the workflow completed successfully */
  success: boolean;
  /** Results from each step, keyed by step ID */
  stepResults: Map<string, unknown>;
  /** Error if workflow failed */
  error?: string;
  /** ID of the step that failed (if applicable) */
  failedStepId?: string;
  /** Total execution time in milliseconds */
  executionTime: number;
}

/**
 * Progress callback for workflow execution.
 */
export interface WorkflowProgressCallback {
  (
    stepId: string,
    stepIndex: number,
    totalSteps: number,
    result?: unknown,
  ): void;
}

/**
 * WorkflowEngine manages and executes multi-step tool workflows.
 * Implements singleton pattern for consistent workflow management.
 *
 * @example
 * ```typescript
 * const engine = WorkflowEngine.getInstance();
 *
 * // Register a workflow
 * engine.registerWorkflow({
 *   id: 'search-and-add',
 *   name: 'Search and Add Media',
 *   description: 'Search for media and add it to a service',
 *   steps: [
 *     {
 *       id: 'search',
 *       toolName: 'search_media',
 *       params: { query: '{{query}}', limit: 5 }
 *     },
 *     {
 *       id: 'add',
 *       toolName: 'add_media',
 *       params: {
 *         tmdbId: '{{search.results[0].tmdbId}}',
 *         serviceType: '{{serviceType}}'
 *       },
 *       dependsOn: ['search']
 *     }
 *   ]
 * });
 *
 * // Execute the workflow
 * const result = await engine.executeWorkflow('search-and-add', {
 *   query: 'Breaking Bad',
 *   serviceType: 'sonarr'
 * });
 * ```
 */
export class WorkflowEngine {
  private static instance: WorkflowEngine | null = null;
  private workflows: Map<string, Workflow>;
  private readonly toolRegistry: ToolRegistry;

  private constructor() {
    this.workflows = new Map();
    this.toolRegistry = ToolRegistry.getInstance();
    void logger.info("WorkflowEngine initialized");
  }

  /**
   * Get the singleton instance of WorkflowEngine
   */
  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Register a workflow with the engine.
   *
   * @param workflow - The workflow to register
   * @throws {ToolError} If a workflow with the same ID already exists
   *
   * @example
   * ```typescript
   * engine.registerWorkflow({
   *   id: 'my-workflow',
   *   name: 'My Workflow',
   *   description: 'Does something useful',
   *   steps: [...]
   * });
   * ```
   */
  registerWorkflow(workflow: Workflow): void {
    if (this.workflows.has(workflow.id)) {
      throw new ToolError(
        `Workflow with ID "${workflow.id}" is already registered`,
        ToolErrorCategory.INVALID_PARAMETERS,
        "Please use a unique workflow ID.",
        { workflowId: workflow.id },
      );
    }

    // Validate workflow structure
    this.validateWorkflow(workflow);

    this.workflows.set(workflow.id, workflow);
    void logger.info("Workflow registered", {
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepCount: workflow.steps.length,
    });
  }

  /**
   * Unregister a workflow from the engine.
   *
   * @param workflowId - ID of the workflow to unregister
   * @returns True if workflow was found and removed, false otherwise
   */
  unregisterWorkflow(workflowId: string): boolean {
    const removed = this.workflows.delete(workflowId);
    if (removed) {
      void logger.info("Workflow unregistered", { workflowId });
    }
    return removed;
  }

  /**
   * Get a registered workflow by ID.
   *
   * @param workflowId - ID of the workflow to retrieve
   * @returns The workflow, or undefined if not found
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all registered workflows.
   *
   * @returns Array of all registered workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute a workflow with the given parameters.
   *
   * @param workflowId - ID of the workflow to execute
   * @param initialParams - Initial parameters to pass to the workflow
   * @param onProgress - Optional callback for progress updates
   * @returns Workflow execution result
   * @throws {ToolError} If workflow is not found or execution fails
   *
   * @example
   * ```typescript
   * const result = await engine.executeWorkflow(
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
    initialParams: Record<string, unknown>,
    onProgress?: WorkflowProgressCallback,
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new ToolError(
        `Workflow "${workflowId}" not found`,
        ToolErrorCategory.INVALID_PARAMETERS,
        "Please check the workflow ID and try again.",
        { workflowId },
      );
    }

    void logger.info("Executing workflow", {
      workflowId,
      workflowName: workflow.name,
      stepCount: workflow.steps.length,
    });

    const stepResults = new Map<string, unknown>();
    const executedSteps = new Set<string>();

    try {
      // Execute steps in order, respecting dependencies
      for (const [i, step] of workflow.steps.entries()) {
        // Check dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          for (const depId of step.dependsOn) {
            if (!executedSteps.has(depId)) {
              throw new ToolError(
                `Step "${step.id}" depends on "${depId}" which has not been executed`,
                ToolErrorCategory.OPERATION_FAILED,
                "Workflow configuration error. Please contact support.",
                { stepId: step.id, dependencyId: depId },
              );
            }
          }
        }

        // Execute the step
        try {
          void logger.debug("Executing workflow step", {
            workflowId,
            stepId: step.id,
            stepIndex: i,
            toolName: step.toolName,
          });

          const result = await this.executeStep(
            step,
            initialParams,
            stepResults,
          );

          // Store result
          stepResults.set(step.id, result);
          executedSteps.add(step.id);

          // Call progress callback
          if (onProgress) {
            onProgress(step.id, i, workflow.steps.length, result);
          }

          void logger.debug("Workflow step completed", {
            workflowId,
            stepId: step.id,
            stepIndex: i,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          void logger.error("Workflow step failed", {
            workflowId,
            stepId: step.id,
            stepIndex: i,
            error: errorMessage,
          });

          return {
            success: false,
            stepResults,
            error: errorMessage,
            failedStepId: step.id,
            executionTime: Date.now() - startTime,
          };
        }
      }

      const executionTime = Date.now() - startTime;

      void logger.info("Workflow completed successfully", {
        workflowId,
        workflowName: workflow.name,
        executionTime,
      });

      return {
        success: true,
        stepResults,
        executionTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      void logger.error("Workflow execution failed", {
        workflowId,
        error: errorMessage,
      });

      return {
        success: false,
        stepResults,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a single workflow step.
   *
   * @param step - The step to execute
   * @param initialParams - Initial workflow parameters
   * @param previousResults - Results from previous steps
   * @returns The result of the step execution
   */
  private async executeStep(
    step: WorkflowStep,
    initialParams: Record<string, unknown>,
    previousResults: Map<string, unknown>,
  ): Promise<unknown> {
    // Get the tool
    const tool = this.toolRegistry.get(step.toolName);

    if (!tool) {
      throw new ToolError(
        `Tool "${step.toolName}" not found for step "${step.id}"`,
        ToolErrorCategory.OPERATION_FAILED,
        "Workflow configuration error. Please contact support.",
        { stepId: step.id, toolName: step.toolName },
      );
    }

    // Resolve template variables in parameters
    const resolvedParams = this.resolveTemplateVariables(
      step.params,
      initialParams,
      previousResults,
    );

    // Execute the tool
    const result = await tool.execute(resolvedParams);

    // Transform result if transformer is provided
    if (step.transformResult) {
      return step.transformResult(result, previousResults);
    }

    return result;
  }

  /**
   * Resolve template variables in parameters.
   * Template variables use the format {{variableName}} or {{stepId.path.to.value}}.
   *
   * @param params - Parameters with potential template variables
   * @param initialParams - Initial workflow parameters
   * @param previousResults - Results from previous steps
   * @returns Parameters with resolved values
   */
  private resolveTemplateVariables(
    params: Record<string, unknown>,
    initialParams: Record<string, unknown>,
    previousResults: Map<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.includes("{{")) {
        // Extract template variable
        const match = value.match(/\{\{(.+?)\}\}/);
        if (match && match[1]) {
          const variable = match[1].trim();
          resolved[key] = this.resolveVariable(
            variable,
            initialParams,
            previousResults,
          );
        } else {
          resolved[key] = value;
        }
      } else if (typeof value === "object" && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveTemplateVariables(
          value as Record<string, unknown>,
          initialParams,
          previousResults,
        );
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Resolve a single template variable.
   *
   * @param variable - Variable path (e.g., "query" or "search.results[0].tmdbId")
   * @param initialParams - Initial workflow parameters
   * @param previousResults - Results from previous steps
   * @returns Resolved value
   */
  private resolveVariable(
    variable: string,
    initialParams: Record<string, unknown>,
    previousResults: Map<string, unknown>,
  ): unknown {
    // Check if it's a simple variable from initial params
    if (variable in initialParams) {
      return initialParams[variable];
    }

    // Check if it's a path to a previous step result
    const parts = variable.split(".");
    if (parts.length > 1 && parts[0]) {
      const stepId = parts[0];
      const stepResult = previousResults.get(stepId);

      if (stepResult !== undefined) {
        // Navigate the path
        let current: unknown = stepResult;
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];

          if (!part) {
            continue;
          }

          // Handle array indexing (e.g., results[0])
          const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/);
          if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
            const arrayName = arrayMatch[1];
            const index = parseInt(arrayMatch[2], 10);

            if (
              current &&
              typeof current === "object" &&
              arrayName in current
            ) {
              const array = (current as Record<string, unknown>)[arrayName];
              if (Array.isArray(array) && index < array.length) {
                current = array[index];
              } else {
                return undefined;
              }
            } else {
              return undefined;
            }
          } else {
            // Regular property access
            if (current && typeof current === "object" && part in current) {
              current = (current as Record<string, unknown>)[part];
            } else {
              return undefined;
            }
          }
        }

        return current;
      }
    }

    // Variable not found
    void logger.warn("Template variable not found", {
      variable,
      availableInitialParams: Object.keys(initialParams),
      availableStepResults: Array.from(previousResults.keys()),
    });

    return undefined;
  }

  /**
   * Validate a workflow structure.
   *
   * @param workflow - The workflow to validate
   * @throws {ToolError} If workflow is invalid
   */
  private validateWorkflow(workflow: Workflow): void {
    // Check for empty steps
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new ToolError(
        `Workflow "${workflow.id}" has no steps`,
        ToolErrorCategory.INVALID_PARAMETERS,
        "Workflows must have at least one step.",
        { workflowId: workflow.id },
      );
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        throw new ToolError(
          `Workflow "${workflow.id}" has duplicate step ID: ${step.id}`,
          ToolErrorCategory.INVALID_PARAMETERS,
          "Each step must have a unique ID.",
          { workflowId: workflow.id, stepId: step.id },
        );
      }
      stepIds.add(step.id);
    }

    // Check for invalid dependencies
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            throw new ToolError(
              `Step "${step.id}" depends on non-existent step "${depId}"`,
              ToolErrorCategory.INVALID_PARAMETERS,
              "Step dependencies must reference valid step IDs.",
              { workflowId: workflow.id, stepId: step.id, dependencyId: depId },
            );
          }
        }
      }
    }

    // Check for circular dependencies (simple check)
    for (const step of workflow.steps) {
      if (step.dependsOn && step.dependsOn.includes(step.id)) {
        throw new ToolError(
          `Step "${step.id}" has circular dependency on itself`,
          ToolErrorCategory.INVALID_PARAMETERS,
          "Steps cannot depend on themselves.",
          { workflowId: workflow.id, stepId: step.id },
        );
      }
    }
  }

  /**
   * Get the number of registered workflows.
   *
   * @returns Count of registered workflows
   */
  count(): number {
    return this.workflows.size;
  }

  /**
   * Get all workflow IDs.
   *
   * @returns Array of workflow IDs
   */
  getWorkflowIds(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Reset the singleton instance.
   * Primarily used for testing purposes.
   */
  static resetInstance(): void {
    if (WorkflowEngine.instance) {
      WorkflowEngine.instance = null;
      void logger.info("WorkflowEngine instance reset");
    }
  }
}
