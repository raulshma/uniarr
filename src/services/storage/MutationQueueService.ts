import { logger } from "@/services/logger/LoggerService";
import { storageAdapter } from "@/services/storage/StorageAdapter";

const MUTATION_QUEUE_KEY = "MutationQueue_pending";
const MUTATION_QUEUE_INDEX_KEY = "MutationQueue_index";

interface PersistedQueuedMutation {
  id: string;
  timestamp: number;
  queryKey: readonly unknown[];
  variables?: unknown;
  operationKey?: string;
  payload?: unknown;
  retryCount: number;
  maxRetries: number;
}

export interface QueuedMutation extends PersistedQueuedMutation {
  mutationFn?: () => Promise<unknown>;
}

export type MutationHandler = (
  payload: unknown,
  variables?: unknown,
) => Promise<unknown>;

type AddQueuedMutationInput = Omit<
  QueuedMutation,
  "id" | "timestamp" | "retryCount"
>;

class MutationQueueService {
  private static instance: MutationQueueService | null = null;
  private isInitialized = false;
  private queue: QueuedMutation[] = [];
  private processingQueue = false;
  private runtimeMutationFns = new Map<string, () => Promise<unknown>>();
  private mutationHandlers = new Map<string, MutationHandler>();

  static getInstance(): MutationQueueService {
    if (!MutationQueueService.instance) {
      MutationQueueService.instance = new MutationQueueService();
    }
    return MutationQueueService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const stored = await storageAdapter.getItem(MUTATION_QUEUE_INDEX_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        const mutations = await Promise.all(
          ids.map((id) => this.getStoredMutation(id)),
        );

        this.queue = mutations.filter((m) => m !== null) as QueuedMutation[];

        // Clean up malformed entries from index/storage so we don't repeatedly
        // attempt to hydrate invalid payloads.
        const hydratedIds = new Set(this.queue.map((mutation) => mutation.id));
        const staleIds = ids.filter((id) => !hydratedIds.has(id));

        if (staleIds.length > 0) {
          await Promise.all(
            staleIds.map((id) => this.removeStoredMutation(id)),
          );
          await this.persistIndex();
        }
      }

      this.isInitialized = true;
      await logger.info("Mutation queue initialized", {
        location: "MutationQueueService.initialize",
        queueLength: this.queue.length,
      });
    } catch (error) {
      await logger.error("Failed to initialize mutation queue", {
        location: "MutationQueueService.initialize",
        error: error instanceof Error ? error.message : String(error),
      });
      this.queue = [];
      this.isInitialized = true;
    }
  }

  registerMutationHandler(
    operationKey: string,
    handler: MutationHandler,
  ): void {
    this.mutationHandlers.set(operationKey, handler);
  }

  unregisterMutationHandler(operationKey: string): void {
    this.mutationHandlers.delete(operationKey);
  }

  clearMutationHandlers(): void {
    this.mutationHandlers.clear();
  }

  async addMutation(mutation: AddQueuedMutationInput): Promise<string> {
    await this.ensureInitialized();

    if (typeof mutation.mutationFn !== "function" && !mutation.operationKey) {
      throw new Error(
        "Queued mutation requires either mutationFn or operationKey",
      );
    }

    const id = `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    if (typeof mutation.mutationFn === "function") {
      this.runtimeMutationFns.set(id, mutation.mutationFn);
    }

    this.queue.push(queuedMutation);
    await this.persistMutation(queuedMutation);
    await this.persistIndex();

    await logger.info("Mutation added to queue", {
      location: "MutationQueueService.addMutation",
      mutationId: id,
      queryKey: JSON.stringify(mutation.queryKey),
    });

    return id;
  }

  async getPendingMutations(): Promise<QueuedMutation[]> {
    await this.ensureInitialized();
    return [...this.queue];
  }

  async removeMutation(id: string): Promise<void> {
    await this.ensureInitialized();

    const index = this.queue.findIndex((m) => m.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.runtimeMutationFns.delete(id);
      await this.removeStoredMutation(id);
      await this.persistIndex();

      await logger.info("Mutation removed from queue", {
        location: "MutationQueueService.removeMutation",
        mutationId: id,
      });
    }
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.ensureInitialized();

    const mutation = this.queue.find((m) => m.id === id);
    if (mutation) {
      mutation.retryCount++;
      await this.persistMutation(mutation);

      await logger.info("Mutation retry count incremented", {
        location: "MutationQueueService.incrementRetryCount",
        mutationId: id,
        retryCount: mutation.retryCount,
      });
    }
  }

  async clearQueue(): Promise<void> {
    await this.ensureInitialized();

    const ids = this.queue.map((m) => m.id);
    await Promise.all(ids.map((id) => this.removeStoredMutation(id)));
    await storageAdapter.removeItem(MUTATION_QUEUE_INDEX_KEY);

    this.queue = [];
    this.runtimeMutationFns.clear();

    await logger.info("Mutation queue cleared", {
      location: "MutationQueueService.clearQueue",
    });
  }

  resolveMutationExecutor(
    mutation: Pick<
      QueuedMutation,
      "id" | "mutationFn" | "operationKey" | "payload" | "variables"
    >,
  ): (() => Promise<unknown>) | null {
    if (typeof mutation.mutationFn === "function") {
      return mutation.mutationFn;
    }

    const runtimeMutation = this.runtimeMutationFns.get(mutation.id);
    if (typeof runtimeMutation === "function") {
      return runtimeMutation;
    }

    if (mutation.operationKey) {
      const handler = this.mutationHandlers.get(mutation.operationKey);
      if (handler) {
        return () => handler(mutation.payload, mutation.variables);
      }
    }

    return null;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async persistMutation(mutation: QueuedMutation): Promise<void> {
    try {
      const persisted: PersistedQueuedMutation = {
        id: mutation.id,
        timestamp: mutation.timestamp,
        queryKey: mutation.queryKey,
        variables: mutation.variables,
        operationKey: mutation.operationKey,
        payload: mutation.payload,
        retryCount: mutation.retryCount,
        maxRetries: mutation.maxRetries,
      };

      await storageAdapter.setItem(
        this.getMutationKey(mutation.id),
        JSON.stringify(persisted),
      );
    } catch (error) {
      await logger.error("Failed to persist mutation", {
        location: "MutationQueueService.persistMutation",
        mutationId: mutation.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistIndex(): Promise<void> {
    try {
      const ids = this.queue.map((m) => m.id);
      await storageAdapter.setItem(
        MUTATION_QUEUE_INDEX_KEY,
        JSON.stringify(ids),
      );
    } catch (error) {
      await logger.error("Failed to persist mutation queue index", {
        location: "MutationQueueService.persistIndex",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getStoredMutation(id: string): Promise<QueuedMutation | null> {
    try {
      const stored = await storageAdapter.getItem(this.getMutationKey(id));
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as Partial<PersistedQueuedMutation>;

      if (
        typeof parsed.id !== "string" ||
        typeof parsed.timestamp !== "number" ||
        !Array.isArray(parsed.queryKey) ||
        typeof parsed.retryCount !== "number" ||
        typeof parsed.maxRetries !== "number"
      ) {
        await logger.warn("Invalid persisted queued mutation payload", {
          location: "MutationQueueService.getStoredMutation",
          mutationId: id,
        });
        return null;
      }

      return {
        id: parsed.id,
        timestamp: parsed.timestamp,
        queryKey: parsed.queryKey,
        variables: parsed.variables,
        operationKey:
          typeof parsed.operationKey === "string"
            ? parsed.operationKey
            : undefined,
        payload: parsed.payload,
        retryCount: parsed.retryCount,
        maxRetries: parsed.maxRetries,
      };
    } catch (error) {
      await logger.error("Failed to get stored mutation", {
        location: "MutationQueueService.getStoredMutation",
        mutationId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async removeStoredMutation(id: string): Promise<void> {
    try {
      await storageAdapter.removeItem(this.getMutationKey(id));
    } catch (error) {
      await logger.error("Failed to remove stored mutation", {
        location: "MutationQueueService.removeStoredMutation",
        mutationId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getMutationKey(id: string): string {
    return `${MUTATION_QUEUE_KEY}_${id}`;
  }

  // For testing purposes - allow direct access to queue
  getQueueForTesting(): QueuedMutation[] {
    return [...this.queue];
  }

  setProcessingQueue(processing: boolean): void {
    this.processingQueue = processing;
  }

  isProcessingQueue(): boolean {
    return this.processingQueue;
  }
}

export const mutationQueueService = MutationQueueService.getInstance();
