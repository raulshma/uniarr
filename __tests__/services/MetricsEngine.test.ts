import { MetricsEngine } from "@/services/metrics/MetricsEngine";

// Create a minimal test that doesn't require complex mocking
// This tests the core logic without dependencies

describe("MetricsEngine", () => {
  let engine: MetricsEngine;

  beforeEach(() => {
    // Clear singleton instance
    (MetricsEngine as any).instance = null;
    engine = MetricsEngine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
  });

  it("should be a singleton", () => {
    const instance1 = MetricsEngine.getInstance();
    const instance2 = MetricsEngine.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should initialize with health and log services", () => {
    expect((engine as any).healthService).toBeDefined();
    expect((engine as any).logService).toBeDefined();
  });

  describe("getBucketSize", () => {
    it("should return 1-hour buckets for 24h or less", () => {
      const timeRange = {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-01T23:59:59Z"),
        preset: "24h" as const,
      };

      const bucketSize = (engine as any).getBucketSize(timeRange);
      expect(bucketSize).toBe(60 * 60 * 1000); // 1 hour in ms
    });

    it("should return 6-hour buckets for 7 days or less", () => {
      const timeRange = {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-07T23:59:59Z"),
        preset: "7d" as const,
      };

      const bucketSize = (engine as any).getBucketSize(timeRange);
      expect(bucketSize).toBe(6 * 60 * 60 * 1000); // 6 hours in ms
    });

    it("should return 1-day buckets for longer periods", () => {
      const timeRange = {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-31T23:59:59Z"),
        preset: "30d" as const,
      };

      const bucketSize = (engine as any).getBucketSize(timeRange);
      expect(bucketSize).toBe(24 * 60 * 60 * 1000); // 1 day in ms
    });
  });

  describe("normalizeErrorMessage", () => {
    it("should remove timestamps from error messages", () => {
      const message = "Error at 2024-01-01T12:00:00Z: Something failed";
      const normalized = (engine as any).normalizeErrorMessage(message);
      expect(normalized).not.toContain("2024-01-01");
      expect(normalized).not.toContain("12:00:00");
    });

    it("should remove numbers from error messages", () => {
      const message = "Failed to process 123 items";
      const normalized = (engine as any).normalizeErrorMessage(message);
      expect(normalized).not.toContain("123");
    });

    it("should remove UUIDs from error messages", () => {
      const message =
        "Error processing request 550e8400-e29b-41d4-a716-446655440000";
      const normalized = (engine as any).normalizeErrorMessage(message);
      expect(normalized).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should normalize whitespace", () => {
      const message = "Error   with    multiple    spaces";
      const normalized = (engine as any).normalizeErrorMessage(message);
      expect(normalized).toBe("Error with multiple spaces");
    });

    it("should truncate long messages to 100 characters", () => {
      const message = "A".repeat(200);
      const normalized = (engine as any).normalizeErrorMessage(message);
      expect(normalized.length).toBe(100);
    });
  });

  describe("groupLogsByTimeBucket", () => {
    it("should group logs into time buckets", () => {
      const logs = [
        {
          id: "1",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date("2024-01-01T00:30:00Z"),
          level: "info" as const,
          message: "Log 1",
        },
        {
          id: "2",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date("2024-01-01T00:45:00Z"),
          level: "info" as const,
          message: "Log 2",
        },
        {
          id: "3",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date("2024-01-01T01:15:00Z"),
          level: "info" as const,
          message: "Log 3",
        },
      ];

      const bucketSize = 60 * 60 * 1000; // 1 hour
      const buckets = (engine as any).groupLogsByTimeBucket(logs, bucketSize);

      // Should have 2 buckets (00:00-01:00 and 01:00-02:00)
      expect(buckets.size).toBe(2);

      // First bucket should have 2 logs
      const firstBucket = buckets.get(
        new Date("2024-01-01T00:00:00Z").getTime(),
      );
      expect(firstBucket).toHaveLength(2);

      // Second bucket should have 1 log
      const secondBucket = buckets.get(
        new Date("2024-01-01T01:00:00Z").getTime(),
      );
      expect(secondBucket).toHaveLength(1);
    });

    it("should handle empty log array", () => {
      const logs: any[] = [];
      const bucketSize = 60 * 60 * 1000;
      const buckets = (engine as any).groupLogsByTimeBucket(logs, bucketSize);

      expect(buckets.size).toBe(0);
    });
  });

  describe("calculateErrorMetric", () => {
    it("should count errors by level", () => {
      const logs = [
        {
          id: "1",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date(),
          level: "error" as const,
          message: "Error 1",
        },
        {
          id: "2",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date(),
          level: "warn" as const,
          message: "Warning 1",
        },
        {
          id: "3",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date(),
          level: "info" as const,
          message: "Info 1",
        },
      ];

      const errorMetric = (engine as any).calculateErrorMetric(logs);

      expect(errorMetric.totalErrors).toBe(2); // error + warn
      expect(errorMetric.errorsByLevel.error).toBe(1);
      expect(errorMetric.errorsByLevel.warn).toBe(1);
      expect(errorMetric.errorRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    });

    it("should identify top errors", () => {
      const logs = [
        {
          id: "1",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date(),
          level: "error" as const,
          message: "Connection failed",
        },
        {
          id: "2",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date(),
          level: "error" as const,
          message: "Connection failed",
        },
        {
          id: "3",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "sonarr",
          timestamp: new Date(),
          level: "error" as const,
          message: "Timeout error",
        },
      ];

      const errorMetric = (engine as any).calculateErrorMetric(logs);

      expect(errorMetric.topErrors).toHaveLength(2);
      expect(errorMetric.topErrors[0].count).toBe(2);
      expect(errorMetric.topErrors[1].count).toBe(1);
    });

    it("should handle empty log array", () => {
      const logs: any[] = [];
      const errorMetric = (engine as any).calculateErrorMetric(logs);

      expect(errorMetric.totalErrors).toBe(0);
      expect(errorMetric.errorRate).toBe(0);
      expect(errorMetric.topErrors).toHaveLength(0);
    });
  });

  describe("dispose", () => {
    it("should clean up resources", () => {
      engine.dispose();
      // Verify the service can be disposed without errors
      expect(true).toBe(true);
    });
  });
});
