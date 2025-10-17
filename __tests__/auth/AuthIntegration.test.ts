import { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import { QBittorrentConnector } from "@/connectors/implementations/QBittorrentConnector";
import type { ServiceConfig } from "@/models/service.types";

// Mock axios to avoid actual network calls
jest.mock("axios", () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
    defaults: {
      withCredentials: false,
    },
  })),
}));

jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Authentication Integration", () => {
  const createMockServiceConfig = (
    type: ServiceConfig["type"],
    overrides: Partial<ServiceConfig> = {},
  ): ServiceConfig => ({
    id: "test-service",
    name: "Test Service",
    type,
    url: "http://localhost:8080",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("JellyseerrConnector", () => {
    it("should use API key authentication", () => {
      const config = createMockServiceConfig("jellyseerr", {
        apiKey: "test-api-key",
      });

      const connector = new JellyseerrConnector(config);

      // Verify the connector was created successfully
      expect(connector).toBeDefined();
      expect(connector.config.type).toBe("jellyseerr");
      expect(connector.config.apiKey).toBe("test-api-key");
    });

    it("should have authentication methods available", () => {
      const config = createMockServiceConfig("jellyseerr", {
        apiKey: "test-api-key",
      });

      const connector = new JellyseerrConnector(config);

      // Check that the connector has the expected methods
      expect(typeof connector.initialize).toBe("function");
      expect(typeof connector.getVersion).toBe("function");
      expect(typeof connector.getRequests).toBe("function");
      expect(typeof connector.search).toBe("function");
    });
  });

  describe("QBittorrentConnector", () => {
    it("should use session authentication", () => {
      const config = createMockServiceConfig("qbittorrent", {
        username: "admin",
        password: "adminadmin",
      });

      const connector = new QBittorrentConnector(config);

      // Verify the connector was created successfully
      expect(connector).toBeDefined();
      expect(connector.config.type).toBe("qbittorrent");
      expect(connector.config.username).toBe("admin");
      expect(connector.config.password).toBe("adminadmin");
    });

    it("should have authentication methods available", () => {
      const config = createMockServiceConfig("qbittorrent", {
        username: "admin",
        password: "adminadmin",
      });

      const connector = new QBittorrentConnector(config);

      // Check that the connector has the expected methods
      expect(typeof connector.initialize).toBe("function");
      expect(typeof connector.getVersion).toBe("function");
      expect(typeof connector.getTorrents).toBe("function");
      expect(typeof connector.pauseTorrent).toBe("function");
    });
  });

  describe("Authentication System Integration", () => {
    it("should handle missing credentials gracefully", () => {
      const configWithoutCredentials = createMockServiceConfig("jellyseerr");

      // Should not throw when creating connector without credentials
      expect(
        () => new JellyseerrConnector(configWithoutCredentials),
      ).not.toThrow();
    });

    it("should handle different service types correctly", () => {
      const jellyseerrConfig = createMockServiceConfig("jellyseerr", {
        apiKey: "test-api-key",
      });

      const qbittorrentConfig = createMockServiceConfig("qbittorrent", {
        username: "admin",
        password: "admin",
      });

      const jellyseerrConnector = new JellyseerrConnector(jellyseerrConfig);
      const qbittorrentConnector = new QBittorrentConnector(qbittorrentConfig);

      expect(jellyseerrConnector.config.type).toBe("jellyseerr");
      expect(qbittorrentConnector.config.type).toBe("qbittorrent");
    });
  });
});
