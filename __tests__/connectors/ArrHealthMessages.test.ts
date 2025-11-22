import { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import { ProwlarrConnector } from "@/connectors/implementations/ProwlarrConnector";
import { LidarrConnector } from "@/connectors/implementations/LidarrConnector";
import type { ServiceConfig } from "@/models/service.types";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Arr Services Health Messages", () => {
  const mockConfig: ServiceConfig = {
    id: "test-service",
    name: "Test Service",
    type: "sonarr",
    url: "http://localhost:8989",
    apiKey: "test-api-key",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockedAxios as any);
  });

  describe("SonarrConnector", () => {
    it("should retrieve and map health messages correctly", async () => {
      const connector = new SonarrConnector(mockConfig);

      const mockHealthResponse = [
        {
          id: 1,
          source: "IndexerStatusCheck",
          type: "error",
          message: "All indexers are unavailable due to failures",
          wikiUrl:
            "https://wiki.servarr.com/sonarr/system#indexers-are-unavailable-due-to-failures",
        },
        {
          id: 2,
          source: "UpdateCheck",
          type: "warning",
          message: "New update is available",
          wikiUrl: "https://wiki.servarr.com/sonarr/system#updates",
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const health = await connector.getHealth();

      expect(health.status).toBe("degraded");
      expect(health.messages).toHaveLength(2);
      expect(health.messages?.[0]).toMatchObject({
        id: "1",
        serviceId: "test-service",
        severity: "error",
        message: "All indexers are unavailable due to failures",
        source: "IndexerStatusCheck",
        wikiUrl:
          "https://wiki.servarr.com/sonarr/system#indexers-are-unavailable-due-to-failures",
      });
      expect(health.messages?.[1]).toMatchObject({
        severity: "warning",
        message: "New update is available",
      });
    });

    it("should return healthy status when no health issues", async () => {
      const connector = new SonarrConnector(mockConfig);

      mockedAxios.get.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const health = await connector.getHealth();

      expect(health.status).toBe("healthy");
      expect(health.message).toBe("Service is healthy");
      expect(health.messages).toHaveLength(0);
    });

    it("should handle errors gracefully", async () => {
      const connector = new SonarrConnector(mockConfig);

      mockedAxios.get.mockRejectedValueOnce(new Error("Connection failed"));

      const health = await connector.getHealth();

      expect(health.status).not.toBe("healthy");
      expect(health.message).toBeTruthy();
      expect(health.lastChecked).toBeInstanceOf(Date);
    });
  });

  describe("RadarrConnector", () => {
    it("should retrieve and map health messages correctly", async () => {
      const radarrConfig = { ...mockConfig, type: "radarr" as const };
      const connector = new RadarrConnector(radarrConfig);

      const mockHealthResponse = [
        {
          id: 1,
          source: "RootFolderCheck",
          type: "error",
          message: "Missing root folder: /movies",
          wikiUrl: "https://wiki.servarr.com/radarr/system#root-folders",
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const health = await connector.getHealth();

      expect(health.status).toBe("degraded");
      expect(health.messages).toHaveLength(1);
      expect(health.messages?.[0].severity).toBe("error");
      expect(health.messages?.[0].message).toBe("Missing root folder: /movies");
    });
  });

  describe("ProwlarrConnector", () => {
    it("should retrieve and map health messages correctly", async () => {
      const prowlarrConfig = { ...mockConfig, type: "prowlarr" as const };
      const connector = new ProwlarrConnector(prowlarrConfig);

      const mockHealthResponse = [
        {
          id: 1,
          source: "IndexerCheck",
          type: "notice",
          message: "No indexers configured",
          wikiUrl: "https://wiki.servarr.com/prowlarr/system#indexers",
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const health = await connector.getHealth();

      expect(health.status).toBe("healthy");
      expect(health.messages).toHaveLength(1);
      expect(health.messages?.[0].severity).toBe("info");
    });
  });

  describe("LidarrConnector", () => {
    it("should retrieve and map health messages correctly", async () => {
      const lidarrConfig = { ...mockConfig, type: "lidarr" as const };
      const connector = new LidarrConnector(lidarrConfig);

      const mockHealthResponse = [
        {
          id: 1,
          source: "ImportMechanismCheck",
          type: "warning",
          message: "No import lists are enabled",
          wikiUrl: "https://wiki.servarr.com/lidarr/system#import-lists",
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });

      const health = await connector.getHealth();

      expect(health.status).toBe("degraded");
      expect(health.messages).toHaveLength(1);
      expect(health.messages?.[0].severity).toBe("warning");
    });
  });
});
