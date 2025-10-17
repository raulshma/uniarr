import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  NotificationCategory,
  NotificationMessage,
  QuietHoursConfig,
} from "@/models/notification.types";
import { logger } from "@/services/logger/LoggerService";
import { pushNotificationService } from "@/services/notifications/PushNotificationService";
import { useSettingsStore } from "@/store/settingsStore";
import {
  createDefaultQuietHoursConfig,
  formatQuietHoursRange,
  getCategoryFriendlyName,
  getNextQuietHoursEnd,
  isQuietHoursActive,
  normalizeQuietHoursConfig,
} from "@/utils/quietHours.utils";

const STORAGE_KEY = "QuietHoursService:queues";
const MAX_QUEUE_LENGTH = 50;

interface DeferredNotificationEntry {
  readonly summary: string;
  readonly createdAt: number;
}

type QuietHoursQueueState = Record<
  NotificationCategory,
  DeferredNotificationEntry[]
>;

const getDefaultConfigForCategory = (
  category: NotificationCategory,
): QuietHoursConfig => {
  switch (category) {
    case "downloads":
    case "failures":
    case "requests":
      return createDefaultQuietHoursConfig("weeknights");
    case "serviceHealth":
    default:
      return createDefaultQuietHoursConfig("everyday");
  }
};

const createEmptyQueueState = (): QuietHoursQueueState => ({
  downloads: [],
  failures: [],
  requests: [],
  serviceHealth: [],
});

class QuietHoursService {
  private static instance: QuietHoursService | null = null;

  private isInitialized = false;

  private queues: QuietHoursQueueState = createEmptyQueueState();

  private readonly flushTimers = new Map<
    NotificationCategory,
    ReturnType<typeof setTimeout>
  >();

  static getInstance(): QuietHoursService {
    if (!QuietHoursService.instance) {
      QuietHoursService.instance = new QuietHoursService();
    }

    return QuietHoursService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.loadState();
    this.isInitialized = true;
    await this.flushDueSummaries();
  }

  async flushDueSummaries(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
      return;
    }

    const state = useSettingsStore.getState();
    const now = new Date();

    await Promise.all(
      (Object.keys(this.queues) as NotificationCategory[]).map((category) =>
        this.flushIfEligible(category, state.quietHours[category], now),
      ),
    );
  }

  async onQuietHoursChanged(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.flushDueSummaries();
  }

  async deliverNotification(
    category: NotificationCategory,
    message: NotificationMessage,
    summary: string,
    options?: { bypassQuietHours?: boolean },
  ): Promise<"delivered" | "deferred"> {
    await this.initialize();

    const config = this.getConfig(category);
    const reference = new Date();

    if (options?.bypassQuietHours) {
      await this.flushIfEligible(category, config, reference);
      await pushNotificationService.presentImmediateNotification(message);
      return "delivered";
    }

    if (!config.enabled || !isQuietHoursActive(config, reference)) {
      await this.flushIfEligible(category, config, reference);
      await pushNotificationService.presentImmediateNotification(message);
      return "delivered";
    }

    this.enqueue(category, summary, reference);
    await this.saveState();

    this.scheduleFlush(category, config, reference);

    await logger.info("Notification deferred due to quiet hours.", {
      location: "QuietHoursService.deliverNotification",
      category,
      summary,
      window: formatQuietHoursRange(config),
    });

    return "deferred";
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.queues = createEmptyQueueState();
        return;
      }

      const parsed = JSON.parse(raw) as Partial<QuietHoursQueueState> | null;
      if (!parsed) {
        this.queues = createEmptyQueueState();
        return;
      }

      this.queues = (
        Object.keys(createEmptyQueueState()) as NotificationCategory[]
      ).reduce((acc, category) => {
        const list = parsed[category];
        acc[category] = Array.isArray(list)
          ? list
              .map((item) => ({
                summary: typeof item.summary === "string" ? item.summary : "",
                createdAt:
                  typeof item.createdAt === "number"
                    ? item.createdAt
                    : Date.now(),
              }))
              .slice(-MAX_QUEUE_LENGTH)
          : [];
        return acc;
      }, createEmptyQueueState());
    } catch (error) {
      this.queues = createEmptyQueueState();
      await logger.warn("Quiet hours queue failed to load.", {
        location: "QuietHoursService.loadState",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queues));
    } catch (error) {
      await logger.warn("Quiet hours queue failed to persist.", {
        location: "QuietHoursService.saveState",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getConfig(category: NotificationCategory): QuietHoursConfig {
    const stateConfig = useSettingsStore.getState().quietHours?.[category];
    const baseConfig = stateConfig ?? getDefaultConfigForCategory(category);
    return normalizeQuietHoursConfig(baseConfig);
  }

  private enqueue(
    category: NotificationCategory,
    summary: string,
    reference: Date,
  ): void {
    const queue = this.queues[category] ?? [];
    const nextEntry: DeferredNotificationEntry = {
      summary,
      createdAt: reference.getTime(),
    };

    this.queues[category] = [
      ...queue.slice(-(MAX_QUEUE_LENGTH - 1)),
      nextEntry,
    ];
  }

  private async flushIfEligible(
    category: NotificationCategory,
    config?: QuietHoursConfig,
    reference: Date = new Date(),
  ): Promise<void> {
    const queue = this.queues[category];
    if (!queue?.length) {
      this.cancelFlushTimer(category);
      return;
    }

    const normalized = normalizeQuietHoursConfig(
      config ?? getDefaultConfigForCategory(category),
    );

    if (normalized.enabled && isQuietHoursActive(normalized, reference)) {
      this.scheduleFlush(category, normalized, reference);
      return;
    }

    const message = this.buildSummaryMessage(category, queue);
    if (message) {
      await pushNotificationService.presentImmediateNotification(message);
      await logger.info("Quiet hours summary delivered.", {
        location: "QuietHoursService.flushIfEligible",
        category,
        count: queue.length,
      });
    }

    this.queues[category] = [];
    this.cancelFlushTimer(category);
    await this.saveState();
  }

  private scheduleFlush(
    category: NotificationCategory,
    config: QuietHoursConfig,
    reference: Date,
  ): void {
    const nextEnd = getNextQuietHoursEnd(config, reference);
    if (!nextEnd) {
      return;
    }

    const delay = Math.max(nextEnd.getTime() - Date.now(), 500);
    this.cancelFlushTimer(category);

    const timer = setTimeout(() => {
      void this.flushCategory(category);
    }, delay);

    this.flushTimers.set(category, timer);
  }

  private cancelFlushTimer(category: NotificationCategory): void {
    const timer = this.flushTimers.get(category);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.flushTimers.delete(category);
  }

  private async flushCategory(category: NotificationCategory): Promise<void> {
    const config = this.getConfig(category);
    await this.flushIfEligible(category, config, new Date());
  }

  private buildSummaryMessage(
    category: NotificationCategory,
    entries: DeferredNotificationEntry[],
  ): NotificationMessage | null {
    if (!entries.length) {
      return null;
    }

    const count = entries.length;
    const preview = entries
      .slice(-3)
      .map((entry) => entry.summary)
      .filter(Boolean)
      .reverse();
    const previewText = preview.join(" • ");

    const title = `${getCategoryFriendlyName(category)} summary (${count})`;
    const body =
      previewText.length > 0
        ? previewText
        : `${count} updates during quiet hours.`;

    return {
      title,
      body,
      category,
      data: {
        isQuietHoursSummary: true,
        category,
        count,
      },
    } satisfies NotificationMessage;
  }
}

export const quietHoursService = QuietHoursService.getInstance();
