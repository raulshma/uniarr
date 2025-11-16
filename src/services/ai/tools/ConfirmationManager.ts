/**
 * ConfirmationManager
 *
 * Manages user confirmations for destructive AI tool actions.
 * Stores pending confirmations in memory with automatic expiration.
 */

export interface PendingConfirmation {
  id: string;
  action: string;
  target: string;
  severity: "low" | "medium" | "high";
  toolName: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export class ConfirmationManager {
  private static instance: ConfirmationManager;
  private pendingConfirmations: Map<string, PendingConfirmation>;
  private readonly DEFAULT_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.pendingConfirmations = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfirmationManager {
    if (!ConfirmationManager.instance) {
      ConfirmationManager.instance = new ConfirmationManager();
    }
    return ConfirmationManager.instance;
  }

  /**
   * Request user confirmation for a destructive action
   * @returns Confirmation ID
   */
  public requestConfirmation(
    confirmation: Omit<PendingConfirmation, "id" | "timestamp">,
  ): string {
    const id = this.generateConfirmationId();
    const pendingConfirmation: PendingConfirmation = {
      ...confirmation,
      id,
      timestamp: Date.now(),
    };

    this.pendingConfirmations.set(id, pendingConfirmation);

    // Auto-cleanup expired confirmations
    this.clearExpired(this.DEFAULT_EXPIRATION_MS);

    return id;
  }

  /**
   * Confirm and execute a pending action
   * @returns true if confirmation was found and confirmed, false otherwise
   */
  public confirmAction(confirmationId: string): boolean {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      return false;
    }

    // Check if expired
    if (this.isExpired(confirmation)) {
      this.pendingConfirmations.delete(confirmationId);
      return false;
    }

    // Remove from pending (action will be executed by caller)
    this.pendingConfirmations.delete(confirmationId);
    return true;
  }

  /**
   * Cancel a pending action
   * @returns true if confirmation was found and cancelled, false otherwise
   */
  public cancelAction(confirmationId: string): boolean {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      return false;
    }

    this.pendingConfirmations.delete(confirmationId);
    return true;
  }

  /**
   * Get a pending confirmation by ID
   */
  public getPending(confirmationId: string): PendingConfirmation | undefined {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(confirmation)) {
      this.pendingConfirmations.delete(confirmationId);
      return undefined;
    }

    return confirmation;
  }

  /**
   * Clear all expired confirmations
   * @param maxAge Maximum age in milliseconds (default: 5 minutes)
   */
  public clearExpired(maxAge: number = this.DEFAULT_EXPIRATION_MS): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, confirmation] of this.pendingConfirmations.entries()) {
      if (now - confirmation.timestamp > maxAge) {
        expiredIds.push(id);
      }
    }

    expiredIds.forEach((id) => this.pendingConfirmations.delete(id));
  }

  /**
   * Get all pending confirmations (for debugging/testing)
   */
  public getAllPending(): PendingConfirmation[] {
    this.clearExpired();
    return Array.from(this.pendingConfirmations.values());
  }

  /**
   * Clear all pending confirmations (for testing)
   */
  public clearAll(): void {
    this.pendingConfirmations.clear();
  }

  /**
   * Check if a confirmation has expired
   */
  private isExpired(confirmation: PendingConfirmation): boolean {
    return Date.now() - confirmation.timestamp > this.DEFAULT_EXPIRATION_MS;
  }

  /**
   * Generate a unique confirmation ID
   */
  private generateConfirmationId(): string {
    return `confirm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
