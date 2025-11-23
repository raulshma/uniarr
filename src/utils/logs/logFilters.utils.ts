import type { ServiceLog, ServiceLogLevel } from "@/models/logger.types";

/**
 * Filter options for log entries
 */
export interface LogFilterOptions {
  /** Filter by service IDs */
  serviceIds?: string[];
  /** Filter by log severity levels */
  levels?: ServiceLogLevel[];
  /** Filter by time range - start date */
  since?: Date;
  /** Filter by time range - end date */
  until?: Date;
}

/**
 * Filter logs by service IDs
 * @param logs - Array of service logs to filter
 * @param serviceIds - Array of service IDs to include
 * @returns Filtered array of logs matching the specified service IDs
 */
export function filterByService(
  logs: ServiceLog[],
  serviceIds: string[],
): ServiceLog[] {
  if (!serviceIds || serviceIds.length === 0) {
    return logs;
  }
  return logs.filter((log) => serviceIds.includes(log.serviceId));
}

/**
 * Filter logs by severity levels
 * @param logs - Array of service logs to filter
 * @param levels - Array of log levels to include
 * @returns Filtered array of logs matching the specified severity levels
 */
export function filterBySeverity(
  logs: ServiceLog[],
  levels: ServiceLogLevel[],
): ServiceLog[] {
  if (!levels || levels.length === 0) {
    return logs;
  }
  return logs.filter((log) => levels.includes(log.level));
}

/**
 * Filter logs by time range
 * @param logs - Array of service logs to filter
 * @param since - Start date (inclusive)
 * @param until - End date (inclusive)
 * @returns Filtered array of logs within the specified time range
 */
export function filterByTimeRange(
  logs: ServiceLog[],
  since?: Date,
  until?: Date,
): ServiceLog[] {
  return logs.filter((log) => {
    const logTime = log.timestamp.getTime();

    if (since && logTime < since.getTime()) {
      return false;
    }

    if (until && logTime > until.getTime()) {
      return false;
    }

    return true;
  });
}

/**
 * Apply all filters to logs using AND logic
 * @param logs - Array of service logs to filter
 * @param options - Filter options to apply
 * @returns Filtered array of logs matching all specified criteria
 */
export function applyLogFilters(
  logs: ServiceLog[],
  options: LogFilterOptions,
): ServiceLog[] {
  let filteredLogs = logs;

  // Apply service filter
  if (options.serviceIds && options.serviceIds.length > 0) {
    filteredLogs = filterByService(filteredLogs, options.serviceIds);
  }

  // Apply severity filter
  if (options.levels && options.levels.length > 0) {
    filteredLogs = filterBySeverity(filteredLogs, options.levels);
  }

  // Apply time range filter
  if (options.since || options.until) {
    filteredLogs = filterByTimeRange(
      filteredLogs,
      options.since,
      options.until,
    );
  }

  return filteredLogs;
}

/**
 * Clear all filters and return the original unfiltered log set
 * @param logs - Original array of service logs
 * @returns The original unfiltered array
 */
export function clearFilters(logs: ServiceLog[]): ServiceLog[] {
  return logs;
}
