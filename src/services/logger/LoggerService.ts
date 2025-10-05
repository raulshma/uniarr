import AsyncStorage from '@react-native-async-storage/async-storage';

import { LogEntry, LogFilterOptions, LogLevel } from '@/models/logger.types';

const STORAGE_KEY = 'LoggerService:entries';
const MAX_ENTRIES = 1_000;

const levelPriority: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

const createEntryId = () => `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const serializeEntries = (entries: LogEntry[]): string => JSON.stringify(entries);

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
      Boolean(entry && entry.id && entry.level && entry.message && entry.timestamp),
    );
  } catch (error) {
    if (isDevelopment) {
      console.warn('[LoggerService] Failed to parse stored log entries.', error);
    }
    return [];
  }
};

class LoggerService {
  private static instance: LoggerService | null = null;

  private entries: LogEntry[] = [];

  private isInitialized = false;

  private minimumLevel: LogLevel = LogLevel.DEBUG;

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
        console.error('[LoggerService] Failed to load persisted log entries.', error);
      }
      this.entries = [];
    }

    this.isInitialized = true;
  }

  setMinimumLevel(level: LogLevel): void {
    this.minimumLevel = level;
  }

  async clear(): Promise<void> {
    this.entries = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  async log(level: LogLevel, message: string, context?: Record<string, unknown>): Promise<void> {
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
      if (context) {
        consoleMethod(`[${level}] ${message}`, context);
      } else {
        consoleMethod(`[${level}] ${message}`);
      }
    }
  }

  async debug(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context);
  }

  async info(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.INFO, message, context);
  }

  async warn(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.WARN, message, context);
  }

  async error(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.ERROR, message, context);
  }

  async getLogs(options?: LogFilterOptions): Promise<LogEntry[]> {
    await this.ensureInitialized();

    if (!options?.minimumLevel) {
      return [...this.entries];
    }

    const threshold = levelPriority[options.minimumLevel];

    return this.entries.filter((entry) => levelPriority[entry.level] >= threshold);
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
        console.error('[LoggerService] Failed to persist log entries.', error);
      }
    }
  }
}

export const logger = LoggerService.getInstance();
export type { LogEntry, LogFilterOptions };
export { LogLevel };
