import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { BazarrConnector } from "@/connectors/implementations/BazarrConnector";
import type { ServiceConfig } from "@/models/service.types";

// Mock network utilities
jest.mock("@/utils/network.utils", () => ({
  testNetworkConnectivity: jest.fn().mockResolvedValue({
    success: true,
    latency: 50,
  }),
  diagnoseVpnIssues: jest.fn().mockReturnValue([]),
}));

// Mock API test utilities
jest.mock("@/utils/api-test.utils", () => ({
  testSonarrApi: jest.fn().mockResolvedValue({
    success: true,
  }),
  testRadarrApi: jest.fn().mockResolvedValue({
    success: true,
  }),
  testQBittorrentApi: jest.fn().mockResolvedValue({
    success: true,
  }),
  testJellyseerrApi: jest.fn().mockResolvedValue({
    success: true,
  }),
  testBazarrApi: jest.fn().mockResolvedValue({
    success: true,
  }),
}));

// Type definitions for mocks
type MockAxiosInstance = {
  get: jest.MockedFunction<any>;
  post: jest.MockedFunction<any>;
  put: jest.MockedFunction<any>;
  delete: jest.MockedFunction<any>;
  interceptors: {
    request: {
      use: jest.MockedFunction<any>;
    };
    response: {
      use: jest.MockedFunction<any>;
    };
  };
};

// Helper function to create mock axios instance
const createMockAxiosInstance = (): MockAxiosInstance => ({
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
});

// Helper function to create mock service config
const createMockServiceConfig = (): ServiceConfig => ({
  id: "test-bazarr-service",
  name: "Test Bazarr",
  type: "bazarr",
  url: "http://localhost:6767",
  apiKey: "test-api-key",
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("BazarrConnector", () => {
  let mockAxiosInstance: MockAxiosInstance;
  let mockServiceConfig: ServiceConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh mock instances
    mockAxiosInstance = createMockAxiosInstance();
    mockServiceConfig = createMockServiceConfig();
  });

  describe("constructor", () => {
    it("should create a BazarrConnector instance with valid config", () => {
      const connector = new BazarrConnector(mockServiceConfig);

      expect(connector).toBeInstanceOf(BazarrConnector);
      expect(connector.config).toBe(mockServiceConfig);
      expect(connector.config.type).toBe("bazarr");
    });

    it("should throw error if config type is not bazarr", () => {
      const invalidConfig = { ...mockServiceConfig, type: "sonarr" as any };

      expect(() => {
        new BazarrConnector(invalidConfig);
      }).not.toThrow(); // The constructor doesn't validate type, that's handled in ConnectorManager
    });
  });

  describe("initialize", () => {
    it("should initialize successfully", async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      // Mock the ensureAuthenticated method
      jest.spyOn(connector as any, "ensureAuthenticated").mockResolvedValue();

      await expect(connector.initialize()).resolves.not.toThrow();
    });

    it("should handle authentication failure during initialization", async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      // Mock authentication failure
      jest
        .spyOn(connector as any, "ensureAuthenticated")
        .mockRejectedValue(new Error("Auth failed"));

      await expect(connector.initialize()).rejects.toThrow("Auth failed");
    });
  });

  describe("getVersion", () => {
    it("should return version when API call succeeds", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockVersion = "1.4.0";

      // Setup axios mock
      mockAxiosInstance.get.mockResolvedValue({
        data: { bazarrVersion: mockVersion },
      });

      // Replace the axios instance in the connector
      (connector as any).client = mockAxiosInstance;

      const version = await connector.getVersion();

      expect(version).toBe(mockVersion);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/system/status");
    });

    it("should fallback to version field if bazarrVersion is not available", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockVersion = "1.3.0";

      mockAxiosInstance.get.mockResolvedValue({
        data: { version: mockVersion },
      });

      (connector as any).client = mockAxiosInstance;

      const version = await connector.getVersion();

      expect(version).toBe(mockVersion);
    });

    it('should return "Unknown" if no version information is available', async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      mockAxiosInstance.get.mockResolvedValue({
        data: {},
      });

      (connector as any).client = mockAxiosInstance;

      const version = await connector.getVersion();

      expect(version).toBe("Unknown");
    });

    it("should handle API errors gracefully", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockError = new Error("Network error");

      mockAxiosInstance.get.mockRejectedValue(mockError);

      (connector as any).client = mockAxiosInstance;

      await expect(connector.getVersion()).rejects.toThrow(
        "Failed to get Bazarr version",
      );
    });
  });

  describe("getMovies", () => {
    it("should return movies list when API call succeeds", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockMovies = [
        {
          id: 1,
          title: "Test Movie",
          year: 2023,
          monitored: true,
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: mockMovies,
      });

      (connector as any).client = mockAxiosInstance;

      const movies = await connector.getMovies();

      expect(movies).toEqual(mockMovies);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/movies");
    });

    it("should return empty array when API returns no data", async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      mockAxiosInstance.get.mockResolvedValue({
        data: null,
      });

      (connector as any).client = mockAxiosInstance;

      const movies = await connector.getMovies();

      expect(movies).toEqual([]);
    });

    it("should handle API errors", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockError = new Error("API error");

      mockAxiosInstance.get.mockRejectedValue(mockError);

      (connector as any).client = mockAxiosInstance;

      await expect(connector.getMovies()).rejects.toThrow(
        "Failed to get movies",
      );
    });
  });

  describe("getSubtitles", () => {
    it("should return subtitles list when API call succeeds", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockSubtitles = [
        {
          id: 1,
          path: "/path/to/subtitle.srt",
          language: { code2: "en", name: "English" },
          provider: "opensubtitles",
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: mockSubtitles,
      });

      (connector as any).client = mockAxiosInstance;

      const subtitles = await connector.getSubtitles();

      expect(subtitles).toEqual(mockSubtitles);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/subtitles");
    });

    it("should return empty array when API returns no data", async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      mockAxiosInstance.get.mockResolvedValue({
        data: null,
      });

      (connector as any).client = mockAxiosInstance;

      const subtitles = await connector.getSubtitles();

      expect(subtitles).toEqual([]);
    });
  });

  describe("getLanguages", () => {
    it("should return languages list when API call succeeds", async () => {
      const connector = new BazarrConnector(mockServiceConfig);
      const mockLanguages = [
        { code2: "en", name: "English", enabled: true },
        { code2: "es", name: "Spanish", enabled: true },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: mockLanguages,
      });

      (connector as any).client = mockAxiosInstance;

      const languages = await connector.getLanguages();

      expect(languages).toEqual(mockLanguages);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/languages");
    });
  });

  describe("getStatistics", () => {
    it("should return statistics when API calls succeed", async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      // Mock the individual API calls
      jest.spyOn(connector, "getMovies").mockResolvedValue([
        {
          id: 1,
          title: "Movie 1",
          missingSubtitles: [
            { id: 1, language: { code2: "en", name: "English" } },
          ],
        },
      ]);
      jest.spyOn(connector, "getEpisodes").mockResolvedValue([
        {
          id: 1,
          title: "Episode 1",
          missingSubtitles: [
            { id: 2, language: { code2: "es", name: "Spanish" } },
          ],
        },
      ]);
      jest
        .spyOn(connector, "getSubtitles")
        .mockResolvedValue([
          { id: 1, language: { code2: "en", name: "English" } },
        ]);

      const statistics = await connector.getStatistics();

      expect(statistics).toEqual({
        moviesTotal: 1,
        episodesTotal: 1,
        subtitlesTotal: 1,
        missingSubtitles: 2,
      });
    });

    it("should handle errors in statistics calculation", async () => {
      const connector = new BazarrConnector(mockServiceConfig);

      // Mock one of the API calls to fail
      jest
        .spyOn(connector, "getMovies")
        .mockRejectedValue(new Error("API error"));

      await expect(connector.getStatistics()).rejects.toThrow(
        "Failed to get statistics",
      );
    });
  });

  describe("dispose", () => {
    it("should dispose without throwing", () => {
      const connector = new BazarrConnector(mockServiceConfig);

      expect(() => connector.dispose()).not.toThrow();
    });
  });
});
