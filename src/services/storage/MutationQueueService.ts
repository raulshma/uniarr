import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/services/logger/LoggerService";

const MUTATION_QUEUE_KEY = "MutationQueue_pending";
const MUTATION_QUEUE_INDEX_KEY = "MutationQueue_index";

interface QueuedMutation {
  id: string;
  timestamp: number;
  queryKey: readonly unknown[];
  mutationFn: () => Promise<unknown>;
  variables?: unknown;
  retryCount: number;
  maxRetries: number;
}

class MutationQueueService {
  private static instance: MutationQueueService | null = null;
  private isInitialized = false;
  private queue: QueuedMutation[] = [];
  private processingQueue = false;

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
      const stored = await AsyncStorage.getItem(MUTATION_QUEUE_INDEX_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        const mutations = await Promise.all(
          ids.map((id) => this.getStoredMutation(id)),
        );

        this.queue = mutations.filter((m) => m !== null) as QueuedMutation[];
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

  async addMutation(
    mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
  ): Promise<string> {
    await this.ensureInitialized();

    const id = `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

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
    await AsyncStorage.removeItem(MUTATION_QUEUE_INDEX_KEY);

    this.queue = [];

    await logger.info("Mutation queue cleared", {
      location: "MutationQueueService.clearQueue",
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async persistMutation(mutation: QueuedMutation): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.getMutationKey(mutation.id),
        JSON.stringify(mutation),
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
      await AsyncStorage.setItem(MUTATION_QUEUE_INDEX_KEY, JSON.stringify(ids));
    } catch (error) {
      await logger.error("Failed to persist mutation queue index", {
        location: "MutationQueueService.persistIndex",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getStoredMutation(id: string): Promise<QueuedMutation | null> {
    try {
      const stored = await AsyncStorage.getItem(this.getMutationKey(id));
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as QueuedMutation;
      // Validate that the mutation function exists and is callable
      if (typeof parsed.mutationFn !== "function") {
        await logger.warn("Invalid mutation function in stored mutation", {
          location: "MutationQueueService.getStoredMutation",
          mutationId: id,
        });
        return null;
      }

      return parsed;
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
      await AsyncStorage.removeItem(this.getMutationKey(id));
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
