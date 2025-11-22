export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface LogFilterOptions {
  minimumLevel?: LogLevel;
}

// New types for service log retrieval

/**
 * Log level for service logs (normalized across all services)
 */
export type ServiceLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

/**
 * Options for querying logs from a service
 */
export interface LogQueryOptions {
  /** Maximum number of log entries to retrieve */
  limit?: number;
  /** Starting index for pagination */
  startIndex?: number;
  /** Filter by log levels */
  level?: ServiceLogLevel[];
  /** Filter logs from this date onwards */
  since?: Date;
  /** Filter logs up to this date */
  until?: Date;
  /** Search term to filter log messages */
  searchTerm?: string;
}

/**
 * Normalized log entry from a service
 */
export interface ServiceLog {
  /** Unique identifier for the log entry */
  id: string;
  /** ID of the service that generated this log */
  serviceId: string;
  /** Name of the service that generated this log */
  serviceName: string;
  /** Type of the service */
  serviceType: string;
  /** Timestamp when the log was created */
  timestamp: Date;
  /** Log level */
  level: ServiceLogLevel;
  /** Log message */
  message: string;
  /** Exception details if present */
  exception?: string;
  /** Logger name/category if present */
  logger?: string;
  /** Method/function name if present */
  method?: string;
  /** Raw log entry from the service */
  raw?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Information about a log file available from a service
 */
export interface LogFileInfo {
  /** Name of the log file */
  filename: string;
  /** Size of the log file in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** Whether the file can be downloaded */
  canDownload: boolean;
}

/**
 * Health message severity levels
 */
export type HealthMessageSeverity = "info" | "warning" | "error" | "critical";

/**
 * Health message from a service indicating warnings, errors, or informational states
 */
export interface HealthMessage {
  /** Unique identifier for the health message */
  id: string;
  /** ID of the service that generated this message */
  serviceId: string;
  /** Severity level of the health message */
  severity: HealthMessageSeverity;
  /** Health message text */
  message: string;
  /** Timestamp when the message was generated */
  timestamp: Date;
  /** Source component or module that generated the message */
  source?: string;
  /** URL to wiki or documentation for more information */
  wikiUrl?: string;
}
