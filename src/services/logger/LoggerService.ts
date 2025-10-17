import AsyncStorage from "@react-native-async-storage/async-storage";

import { LogEntry, LogFilterOptions, LogLevel } from "@/models/logger.types";

const STORAGE_KEY = "LoggerService:entries";
const LEVEL_STORAGE_KEY = "LoggerService:level";
const MAX_ENTRIES = 1_000;

const levelPriority: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

const createEntryId = () =>
  `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const serializeEntries = (entries: LogEntry[]): string =>
  JSON.stringify(entries);

const deserializeEntries = (serialized: string | null): LogEntry[] => {
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as LogEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry) =>
      Boolean(
        entry && entry.id && entry.level && entry.message && entry.timestamp,
      ),
    );
  } catch (error) {
    if (isDevelopment) {
      console.warn(
        "[LoggerService] Failed to parse stored log entries.",
        error,
      );
    }
    return [];
  }
};

/**
 * Creates a shallow copy of the provided context and renames commonly
 * recognized Error-like properties so Metro's HMR logging doesn't treat
 * the object as an Error. We intentionally avoid deep cloning to keep
 * performance reasonable for logging.
 */
const sanitizeConsoleContext = (
  context: Record<string, unknown>,
): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...context };

  if (Object.prototype.hasOwnProperty.call(copy, "message")) {
    // Preserve original message under a non-conflicting key.
    copy.contextMessage = copy.message;
    delete copy.message;
  }

  if (Object.prototype.hasOwnProperty.call(copy, "stack")) {
    copy.contextStack = copy.stack;
    delete copy.stack;
  }

  return copy;
};

class LoggerService {
  private static instance: LoggerService | null = null;

  private entries: LogEntry[] = [];

  private isInitialized = false;

  private minimumLevel: LogLevel = LogLevel.DEBUG;

  private levelInitialized = false;

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }

    return LoggerService.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const serializedEntries = await AsyncStorage.getItem(STORAGE_KEY);
      this.entries = deserializeEntries(serializedEntries);
    } catch (error) {
      if (isDevelopment) {
        console.error(
          "[LoggerService] Failed to load persisted log entries.",
          error,
        );
      }
      this.entries = [];
    }

    // Try to load a small persisted minimum level to apply earlier than
    // any external rehydration of the settings store.
    try {
      const storedLevel = await AsyncStorage.getItem(LEVEL_STORAGE_KEY);
      if (
        storedLevel &&
        Object.values(LogLevel).includes(storedLevel as LogLevel)
      ) {
        this.minimumLevel = storedLevel as LogLevel;
      }
    } catch (error) {
      if (isDevelopment) {
        console.warn(
          "[LoggerService] Failed to load persisted log level.",
          error,
        );
      }
    }

    this.isInitialized = true;
  }

  setMinimumLevel(level: LogLevel): void {
    this.minimumLevel = level;
    // Persist small key for faster startup next time
    void AsyncStorage.setItem(LEVEL_STORAGE_KEY, level).catch((error) => {
      if (isDevelopment) {
        console.warn(
          "[LoggerService] Failed to persist minimum log level.",
          error,
        );
      }
    });
  }

  async clear(): Promise<void> {
    this.entries = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureInitialized();

    if (levelPriority[level] < levelPriority[this.minimumLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();

    const entry: LogEntry = {
      id: createEntryId(),
      level,
      message,
      timestamp,
      context,
    };

    this.entries = [...this.entries, entry].slice(-MAX_ENTRIES);
    await this.persistEntries();

    if (isDevelopment) {
      const consoleMethod = this.getConsoleMethod(level);
      // Sanitize context before sending to console to avoid Metro / HMR
      // interpreting objects with top-level `message` or `stack` properties
      // as Error-like and producing a redbox or stack trace.
      const sanitizedContext = context
        ? sanitizeConsoleContext(context)
        : undefined;

      if (sanitizedContext) {
        consoleMethod(`[${level}] ${message}`, sanitizedContext);
      } else {
        consoleMethod(`[${level}] ${message}`);
      }
    }
  }
  async debug(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context);
  }

  async info(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(LogLevel.INFO, message, context);
  }

  async warn(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(LogLevel.WARN, message, context);
  }

  async error(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(LogLevel.ERROR, message, context);
  }

  async getLogs(options?: LogFilterOptions): Promise<LogEntry[]> {
    await this.ensureInitialized();

    if (!options?.minimumLevel) {
      return [...this.entries];
    }

    const threshold = levelPriority[options.minimumLevel];

    return this.entries.filter(
      (entry) => levelPriority[entry.level] >= threshold,
    );
  }

  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    if (level === LogLevel.ERROR) {
      return console.error;
    }

    if (level === LogLevel.WARN) {
      return console.warn;
    }

    return console.log;
  }

  private async persistEntries(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, serializeEntries(this.entries));
    } catch (error) {
      if (isDevelopment) {
        console.error("[LoggerService] Failed to persist log entries.", error);
      }
    }
  }
}

export const logger = LoggerService.getInstance();
export type { LogEntry, LogFilterOptions };
export { LogLevel };
