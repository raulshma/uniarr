import { z } from "zod";
import type { ToolDefinition, ToolResult } from "./types";
import { ToolError, ToolErrorCategory } from "./types";
import { ConfirmationManager } from "./ConfirmationManager";
import { logger } from "@/services/logger/LoggerService";

/**
 * Parameters for the ConfirmActionTool
 */
const confirmActionParamsSchema = z.object({
  confirmationId: z
    .string()
    .describe("The confirmation ID from a previous tool call"),
  confirmed: z
    .boolean()
    .describe(
      "Whether the user confirmed (true) or cancelled (false) the action",
    ),
});

type ConfirmActionParams = z.infer<typeof confirmActionParamsSchema>;

/**
 * Result data structure for ConfirmActionTool
 */
interface ConfirmActionResult {
  confirmationId: string;
  confirmed: boolean;
  message: string;
  originalToolName?: string;
  originalParams?: Record<string, unknown>;
}

/**
 * ConfirmActionTool - Handle user confirmation responses
 *
 * This tool processes user confirmation responses for destructive actions.
 * When a tool requests confirmation, the LLM should use this tool to
 * record the user's response (confirm or cancel).
 *
 * @example
 * ```typescript
 * // User confirms the action
 * const result = await execute({
 *   confirmationId: 'confirm_123_abc',
 *   confirmed: true
 * });
 *
 * // User cancels the action
 * const result = await execute({
 *   confirmationId: 'confirm_123_abc',
 *   confirmed: false
 * });
 * ```
 */
export const confirmActionTool: ToolDefinition<
  ConfirmActionParams,
  ConfirmActionResult
> = {
  name: "confirm_action",
  description:
    "Process user confirmation for a destructive action. Use this tool when the user responds to a confirmation prompt with 'yes', 'no', 'confirm', 'cancel', or similar responses. Returns the confirmation status and original action details.",
  parameters: confirmActionParamsSchema,

  async execute(
    params: ConfirmActionParams,
  ): Promise<ToolResult<ConfirmActionResult>> {
    const startTime = Date.now();
    const confirmationManager = ConfirmationManager.getInstance();

    try {
      void logger.debug("ConfirmActionTool execution started", { params });

      const { confirmationId, confirmed } = params;

      // Get the pending confirmation
      const pendingConfirmation =
        confirmationManager.getPending(confirmationId);

      if (!pendingConfirmation) {
        throw new ToolError(
          "Confirmation not found or expired",
          ToolErrorCategory.OPERATION_FAILED,
          "The confirmation request has expired or is invalid. Please request the action again.",
          { confirmationId },
        );
      }

      if (confirmed) {
        // User confirmed - mark as confirmed
        const success = confirmationManager.confirmAction(confirmationId);

        if (!success) {
          throw new ToolError(
            "Failed to confirm action",
            ToolErrorCategory.OPERATION_FAILED,
            "The confirmation could not be processed. Please try again.",
            { confirmationId },
          );
        }

        void logger.info("User confirmed destructive action", {
          confirmationId,
          toolName: pendingConfirmation.toolName,
          action: pendingConfirmation.action,
          target: pendingConfirmation.target,
        });

        return {
          success: true,
          data: {
            confirmationId,
            confirmed: true,
            message: `Action confirmed. You can now proceed with "${pendingConfirmation.action}" on "${pendingConfirmation.target}".`,
            originalToolName: pendingConfirmation.toolName,
            originalParams: pendingConfirmation.params,
          },
          metadata: {
            executionTime: Date.now() - startTime,
            action: pendingConfirmation.action,
            severity: pendingConfirmation.severity,
          },
        };
      } else {
        // User cancelled - remove the confirmation
        confirmationManager.cancelAction(confirmationId);

        void logger.info("User cancelled destructive action", {
          confirmationId,
          toolName: pendingConfirmation.toolName,
          action: pendingConfirmation.action,
          target: pendingConfirmation.target,
        });

        return {
          success: true,
          data: {
            confirmationId,
            confirmed: false,
            message: `Action cancelled. "${pendingConfirmation.action}" on "${pendingConfirmation.target}" will not be performed.`,
            originalToolName: pendingConfirmation.toolName,
            originalParams: pendingConfirmation.params,
          },
          metadata: {
            executionTime: Date.now() - startTime,
            action: pendingConfirmation.action,
            severity: pendingConfirmation.severity,
          },
        };
      }
    } catch (error) {
      void logger.error("ConfirmActionTool execution failed", {
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ToolError) {
        return {
          success: false,
          error: error.toUserMessage(),
          metadata: {
            executionTime: Date.now() - startTime,
            errorCategory: error.category,
          },
        };
      }

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while processing confirmation.",
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};
