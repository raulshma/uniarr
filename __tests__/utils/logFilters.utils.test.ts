import {
  filterByService,
  filterBySeverity,
  filterByTimeRange,
  applyLogFilters,
  clearFilters,
  type LogFilterOptions,
} from "@/utils/logs/logFilters.utils";
import type { ServiceLog } from "@/models/logger.types";

describe("logFilters.utils", () => {
  // Helper function to create mock logs
  const createMockLog = (overrides: Partial<ServiceLog> = {}): ServiceLog => ({
    id: "log-1",
    serviceId: "service-1",
    serviceName: "Test Service",
    serviceType: "sonarr",
    timestamp: new Date("2024-01-01T12:00:00Z"),
    level: "info",
    message: "Test log message",
    ...overrides,
  });

  describe("filterByService", () => {
    it("should filter logs by service IDs", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1" }),
        createMockLog({ id: "2", serviceId: "service-2" }),
        createMockLog({ id: "3", serviceId: "service-1" }),
      ];

      const filtered = filterByService(logs, ["service-1"]);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].serviceId).toBe("service-1");
      expect(filtered[1].serviceId).toBe("service-1");
    });

    it("should return all logs when serviceIds is empty", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1" }),
        createMockLog({ id: "2", serviceId: "service-2" }),
      ];

      const filtered = filterByService(logs, []);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(logs);
    });

    it("should return empty array when no logs match", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1" }),
        createMockLog({ id: "2", serviceId: "service-2" }),
      ];

      const filtered = filterByService(logs, ["service-3"]);

      expect(filtered).toHaveLength(0);
    });

    it("should handle multiple service IDs", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1" }),
        createMockLog({ id: "2", serviceId: "service-2" }),
        createMockLog({ id: "3", serviceId: "service-3" }),
      ];

      const filtered = filterByService(logs, ["service-1", "service-3"]);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].serviceId).toBe("service-1");
      expect(filtered[1].serviceId).toBe("service-3");
    });
  });

  describe("filterBySeverity", () => {
    it("should filter logs by severity level", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", level: "info" }),
        createMockLog({ id: "2", level: "error" }),
        createMockLog({ id: "3", level: "warn" }),
      ];

      const filtered = filterBySeverity(logs, ["error"]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe("error");
    });

    it("should return all logs when levels is empty", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", level: "info" }),
        createMockLog({ id: "2", level: "error" }),
      ];

      const filtered = filterBySeverity(logs, []);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(logs);
    });

    it("should handle multiple severity levels", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", level: "info" }),
        createMockLog({ id: "2", level: "error" }),
        createMockLog({ id: "3", level: "warn" }),
        createMockLog({ id: "4", level: "debug" }),
      ];

      const filtered = filterBySeverity(logs, ["error", "warn"]);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].level).toBe("error");
      expect(filtered[1].level).toBe("warn");
    });

    it("should return empty array when no logs match", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", level: "info" }),
        createMockLog({ id: "2", level: "debug" }),
      ];

      const filtered = filterBySeverity(logs, ["error"]);

      expect(filtered).toHaveLength(0);
    });
  });

  describe("filterByTimeRange", () => {
    it("should filter logs by time range with both since and until", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        }),
        createMockLog({
          id: "2",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
        createMockLog({
          id: "3",
          timestamp: new Date("2024-01-01T14:00:00Z"),
        }),
      ];

      const filtered = filterByTimeRange(
        logs,
        new Date("2024-01-01T11:00:00Z"),
        new Date("2024-01-01T13:00:00Z"),
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("should filter logs with only since date", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        }),
        createMockLog({
          id: "2",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
        createMockLog({
          id: "3",
          timestamp: new Date("2024-01-01T14:00:00Z"),
        }),
      ];

      const filtered = filterByTimeRange(
        logs,
        new Date("2024-01-01T11:00:00Z"),
        undefined,
      );

      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe("2");
      expect(filtered[1].id).toBe("3");
    });

    it("should filter logs with only until date", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        }),
        createMockLog({
          id: "2",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
        createMockLog({
          id: "3",
          timestamp: new Date("2024-01-01T14:00:00Z"),
        }),
      ];

      const filtered = filterByTimeRange(
        logs,
        undefined,
        new Date("2024-01-01T11:00:00Z"),
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("should return all logs when no time range is specified", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        }),
        createMockLog({
          id: "2",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
      ];

      const filtered = filterByTimeRange(logs, undefined, undefined);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(logs);
    });

    it("should include logs at exact boundary times", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
      ];

      const filtered = filterByTimeRange(
        logs,
        new Date("2024-01-01T12:00:00Z"),
        new Date("2024-01-01T12:00:00Z"),
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });
  });

  describe("applyLogFilters", () => {
    it("should apply all filters using AND logic", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          serviceId: "service-1",
          level: "error",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
        createMockLog({
          id: "2",
          serviceId: "service-2",
          level: "error",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
        createMockLog({
          id: "3",
          serviceId: "service-1",
          level: "info",
          timestamp: new Date("2024-01-01T12:00:00Z"),
        }),
        createMockLog({
          id: "4",
          serviceId: "service-1",
          level: "error",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        }),
      ];

      const options: LogFilterOptions = {
        serviceIds: ["service-1"],
        levels: ["error"],
        since: new Date("2024-01-01T11:00:00Z"),
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("should apply only service filter when other filters are not specified", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1" }),
        createMockLog({ id: "2", serviceId: "service-2" }),
      ];

      const options: LogFilterOptions = {
        serviceIds: ["service-1"],
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].serviceId).toBe("service-1");
    });

    it("should apply only severity filter when other filters are not specified", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", level: "error" }),
        createMockLog({ id: "2", level: "info" }),
      ];

      const options: LogFilterOptions = {
        levels: ["error"],
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe("error");
    });

    it("should apply only time range filter when other filters are not specified", () => {
      const logs: ServiceLog[] = [
        createMockLog({
          id: "1",
          timestamp: new Date("2024-01-01T10:00:00Z"),
        }),
        createMockLog({
          id: "2",
          timestamp: new Date("2024-01-01T14:00:00Z"),
        }),
      ];

      const options: LogFilterOptions = {
        since: new Date("2024-01-01T12:00:00Z"),
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("should return all logs when no filters are specified", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1" }),
        createMockLog({ id: "2" }),
      ];

      const options: LogFilterOptions = {};

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(logs);
    });

    it("should return empty array when filters exclude all logs", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1", level: "info" }),
        createMockLog({ id: "2", serviceId: "service-2", level: "debug" }),
      ];

      const options: LogFilterOptions = {
        serviceIds: ["service-3"],
        levels: ["error"],
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(0);
    });

    it("should handle empty serviceIds array", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", serviceId: "service-1" }),
        createMockLog({ id: "2", serviceId: "service-2" }),
      ];

      const options: LogFilterOptions = {
        serviceIds: [],
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(logs);
    });

    it("should handle empty levels array", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1", level: "info" }),
        createMockLog({ id: "2", level: "error" }),
      ];

      const options: LogFilterOptions = {
        levels: [],
      };

      const filtered = applyLogFilters(logs, options);

      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(logs);
    });
  });

  describe("clearFilters", () => {
    it("should return the original unfiltered log set", () => {
      const logs: ServiceLog[] = [
        createMockLog({ id: "1" }),
        createMockLog({ id: "2" }),
        createMockLog({ id: "3" }),
      ];

      const cleared = clearFilters(logs);

      expect(cleared).toHaveLength(3);
      expect(cleared).toEqual(logs);
      expect(cleared).toBe(logs); // Should be the same reference
    });

    it("should work with empty array", () => {
      const logs: ServiceLog[] = [];

      const cleared = clearFilters(logs);

      expect(cleared).toHaveLength(0);
      expect(cleared).toEqual(logs);
    });
  });
});
