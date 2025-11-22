import * as FileSystem from "expo-file-system/legacy";
import type { ServiceLog } from "@/models/logger.types";

/**
 * Export format options
 */
export type ExportFormat = "json" | "text";

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Whether to compress the output if it exceeds size threshold */
  compress?: boolean;
  /** Maximum file size in bytes before warning (default: 10MB) */
  maxSizeWarning?: number;
}

/**
 * Export result
 */
export interface ExportResult {
  /** File URI where the export was saved */
  uri: string;
  /** File size in bytes */
  size: number;
  /** Whether the file was compressed */
  compressed: boolean;
  /** Whether the size exceeded the warning threshold */
  sizeWarning: boolean;
}

/**
 * Default maximum file size before warning (10MB)
 */
const DEFAULT_MAX_SIZE_WARNING = 10 * 1024 * 1024;

/**
 * Export logs to JSON format
 */
function exportToJSON(logs: ServiceLog[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs.map((log) => ({
        id: log.id,
        serviceId: log.serviceId,
        serviceName: log.serviceName,
        serviceType: log.serviceType,
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        message: log.message,
        exception: log.exception,
        logger: log.logger,
        method: log.method,
        metadata: log.metadata,
      })),
    },
    null,
    2,
  );
}

/**
 * Export logs to plain text format
 */
function exportToText(logs: ServiceLog[]): string {
  const lines: string[] = [];

  // Header
  lines.push("=".repeat(80));
  lines.push(`Log Export - ${new Date().toISOString()}`);
  lines.push(`Total Logs: ${logs.length}`);
  lines.push("=".repeat(80));
  lines.push("");

  // Log entries
  for (const log of logs) {
    lines.push("-".repeat(80));
    lines.push(
      `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.serviceName}]`,
    );
    lines.push(`Message: ${log.message}`);

    if (log.logger) {
      lines.push(`Logger: ${log.logger}`);
    }

    if (log.method) {
      lines.push(`Method: ${log.method}`);
    }

    if (log.exception) {
      lines.push(`Exception: ${log.exception}`);
    }

    if (log.metadata && Object.keys(log.metadata).length > 0) {
      lines.push(`Metadata: ${JSON.stringify(log.metadata)}`);
    }

    lines.push("");
  }

  lines.push("=".repeat(80));
  lines.push("End of Log Export");
  lines.push("=".repeat(80));

  return lines.join("\n");
}

/**
 * Get file size of a string in bytes
 */
function getStringSize(content: string): number {
  return new Blob([content]).size;
}

/**
 * Export logs to a file
 *
 * @param logs - Array of service logs to export
 * @param options - Export options
 * @returns Export result with file URI and metadata
 */
export async function exportLogs(
  logs: ServiceLog[],
  options: ExportOptions,
): Promise<ExportResult> {
  const { format, maxSizeWarning = DEFAULT_MAX_SIZE_WARNING } = options;

  // Generate content based on format
  let content: string;
  let fileExtension: string;

  if (format === "json") {
    content = exportToJSON(logs);
    fileExtension = "json";
  } else {
    content = exportToText(logs);
    fileExtension = "txt";
  }

  // Check file size
  const size = getStringSize(content);
  const sizeWarning = size > maxSizeWarning;

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `logs-export-${timestamp}.${fileExtension}`;

  // Save to cache directory
  const cacheDir = FileSystem.cacheDirectory || "";
  const uri = `${cacheDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content);

  return {
    uri,
    size,
    compressed: false, // Compression not implemented yet
    sizeWarning,
  };
}

/**
 * Check if export size would exceed warning threshold
 *
 * @param logs - Array of service logs
 * @param format - Export format
 * @param maxSizeWarning - Maximum size before warning (default: 10MB)
 * @returns Whether the export would exceed the warning threshold
 */
export function checkExportSize(
  logs: ServiceLog[],
  format: ExportFormat,
  maxSizeWarning: number = DEFAULT_MAX_SIZE_WARNING,
): boolean {
  // Estimate size without actually generating the full export
  // Use a sample to estimate average log size
  const sampleSize = Math.min(100, logs.length);
  const sample = logs.slice(0, sampleSize);

  let sampleContent: string;
  if (format === "json") {
    sampleContent = exportToJSON(sample);
  } else {
    sampleContent = exportToText(sample);
  }

  const sampleBytes = getStringSize(sampleContent);
  const estimatedTotalSize = (sampleBytes / sampleSize) * logs.length;

  return estimatedTotalSize > maxSizeWarning;
}

/**
 * Format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
