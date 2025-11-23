import { HealthAggregationService } from "@/services/health/HealthAggregationService";

// Create a minimal test that doesn't require complex mocking
// This tests the core logic without dependencies

describe("HealthAggregationService", () => {
  let service: HealthAggregationService;

  beforeEach(() => {
    // Clear singleton instance
    (HealthAggregationService as any).instance = null;
    service = HealthAggregationService.getInstance();
  });

  afterEach(() => {
    service.dispose();
  });

  it("should be a singleton", () => {
    const instance1 = HealthAggregationService.getInstance();
    const instance2 = HealthAggregationService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should initialize with empty subscribers", () => {
    expect((service as any).subscribers.size).toBe(0);
  });

  it("should have null lastAggregatedHealth initially", () => {
    expect((service as any).lastAggregatedHealth).toBeNull();
  });

  describe("subscribeToHealthUpdates", () => {
    it("should return unsubscribe function", () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribeToHealthUpdates(callback);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });

    it("should add subscriber", () => {
      const callback = jest.fn();
      service.subscribeToHealthUpdates(callback);

      expect((service as any).subscribers.size).toBe(1);
    });

    it("should remove subscriber on unsubscribe", () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribeToHealthUpdates(callback);

      expect((service as any).subscribers.size).toBe(1);
      unsubscribe();
      expect((service as any).subscribers.size).toBe(0);
    });
  });

  describe("dispose", () => {
    it("should clean up resources", () => {
      const callback = jest.fn();
      service.subscribeToHealthUpdates(callback);

      service.dispose();

      // Verify cleanup
      expect((service as any).subscribers.size).toBe(0);
      expect((service as any).updateInterval).toBeNull();
      expect((service as any).lastAggregatedHealth).toBeNull();
    });
  });
});
