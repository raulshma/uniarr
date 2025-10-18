import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  SonarrConnector,
  type SonarrQueueItem,
} from "@/connectors/implementations/SonarrConnector";
import type { ServiceConfig } from "@/models/service.types";
import { ApiError, handleApiError } from "@/utils/error.utils";

// Mock network utilities
jest.mock("@/utils/network.utils", () => ({
  testNetworkConnectivity: jest.fn(),
  diagnoseVpnIssues: jest.fn().mockReturnValue([]),
}));

// Mock API test utilities
jest.mock("@/utils/api-test.utils", () => ({
  testSonarrApi: jest.fn(),
  testRadarrApi: jest.fn(),
  testQBittorrentApi: jest.fn(),
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

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    isAxiosError: jest.fn(),
  },
  create: jest.fn(),
  isAxiosError: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    debug: jest.fn(async () => undefined),
    info: jest.fn(async () => undefined),
    warn: jest.fn(async () => undefined),
    error: jest.fn(async () => undefined),
  },
}));

jest.mock("@/utils/error.utils", () => {
  const actual = jest.requireActual<typeof import("@/utils/error.utils")>(
    "@/utils/error.utils",
  );
  const mockHandleApiError = jest.fn((error: unknown) => {
    if (error instanceof actual.ApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new actual.ApiError({
        message: error.message,
        cause: error,
      });
    }

    return new actual.ApiError({
      message: "Mock error",
      cause: error,
    });
  });

  return {
    ...actual,
    handleApiError: mockHandleApiError,
  };
});

const mockedHandleApiError = handleApiError as unknown as jest.MockedFunction<
  typeof handleApiError
>;

const baseConfig: ServiceConfig = {
  id: "service-1",
  name: "Primary Sonarr",
  type: "sonarr",
  url: "http://sonarr.local",
  apiKey: "secret",
  enabled: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const defaultErrorHandler = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError({
      message: error.message,
      cause: error,
    });
  }

  return new ApiError({
    message: "Mock error",
    cause: error,
  });
};

const createConnector = () => new SonarrConnector(baseConfig);

describe("SonarrConnector", () => {
  let mockAxiosInstance: MockAxiosInstance;

  beforeEach(() => {
    mockAxiosInstance = createMockAxiosInstance();
    const mockedAxios = jest.requireMock("axios") as {
      default: {
        create: jest.MockedFunction<any>;
        isAxiosError: jest.MockedFunction<any>;
      };
    };
    mockedAxios.default.create.mockReset();
    mockedAxios.default.create.mockReturnValue(mockAxiosInstance);
    mockedHandleApiError.mockReset();
    mockedHandleApiError.mockImplementation(defaultErrorHandler);
    mockedAxios.default.isAxiosError.mockReset();
  });

  it("returns success diagnostics when testConnection passes", async () => {
    const connector = createConnector();
    mockAxiosInstance.get.mockResolvedValue({ data: { version: "4.0.2" } });

    const result = await connector.testConnection();

    expect(result.success).toBe(true);
    expect(result.version).toBe("4.0.2");
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/system/status");
  });

  it("returns failure diagnostics when testConnection fails", async () => {
    const connector = createConnector();
    const error = new Error("Connection refused");
    mockAxiosInstance.get.mockRejectedValue(error);

    const diagnostic = new ApiError({ message: "Connection failed" });
    mockedHandleApiError.mockImplementationOnce(() => diagnostic);
    mockedHandleApiError.mockImplementationOnce(() => diagnostic);

    const result = await connector.testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toBe("Connection failed");
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it("maps series search results correctly", async () => {
    const connector = createConnector();
    const responseSeries = {
      id: 10,
      title: "Foundation",
      sortTitle: "foundation",
      year: 2021,
      status: "continuing",
      overview: "Sci-fi epic.",
      monitored: true,
      images: [
        { coverType: "poster", remoteUrl: "poster-url" },
        { coverType: "fanart", remoteUrl: "fanart-url" },
      ],
      statistics: {
        episodeCount: 10,
        episodeFileCount: 8,
        percentOfEpisodes: 80,
      },
      seasons: [
        {
          id: 1,
          seasonNumber: 1,
          monitored: true,
          statistics: {
            episodeCount: 10,
            episodeFileCount: 8,
            percentOfEpisodes: 80,
          },
        },
      ],
    };

    mockAxiosInstance.get.mockResolvedValue({ data: [responseSeries] });

    const result = await connector.search("Foundation", {
      filters: { language: "en" },
    });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/v3/series/lookup",
      {
        params: { term: "Foundation", language: "en" },
      },
    );
    expect(result).toHaveLength(1);
    const series = result[0]!;
    expect(series).toMatchObject({
      id: 10,
      title: "Foundation",
      posterUrl: "poster-url",
      backdropUrl: "fanart-url",
      statistics: {
        episodeCount: 10,
        episodeFileCount: 8,
        percentOfEpisodes: 80,
      },
    });
    const firstSeason = series.seasons?.[0];
    expect(firstSeason).toBeDefined();
    expect(firstSeason?.statistics).toEqual({
      episodeCount: 10,
      episodeFileCount: 8,
      percentOfEpisodes: 80,
    });
  });

  it("returns all series via getSeries", async () => {
    const connector = createConnector();
    mockAxiosInstance.get.mockResolvedValue({
      data: [
        {
          id: 1,
          title: "Series A",
          status: "continuing",
          monitored: true,
          images: [],
        },
        {
          id: 2,
          title: "Series B",
          status: "ended",
          monitored: false,
          images: [],
        },
      ],
    });

    const result = await connector.getSeries();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/series");
    expect(result.map((seriesItem) => seriesItem.id)).toEqual([1, 2]);
    const secondSeries = result[1]!;
    expect(secondSeries.status).toBe("ended");
  });

  it("creates a series when add is called", async () => {
    const connector = createConnector();
    const responseSeries = {
      id: 42,
      title: "New Show",
      status: "continuing",
      monitored: true,
      images: [],
    };

    mockAxiosInstance.post.mockResolvedValue({ data: responseSeries });

    const payload = {
      tvdbId: 1001,
      title: "New Show",
      rootFolderPath: "/data/shows",
      qualityProfileId: 5,
      searchNow: true,
      addOptions: {
        monitor: "all" as const,
      },
    };

    const result = await connector.add(payload);

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      "/api/v3/series",
      expect.objectContaining({
        tvdbId: 1001,
        title: "New Show",
        qualityProfileId: 5,
        seasonFolder: true,
        monitored: true,
        addOptions: {
          searchForMissingEpisodes: true,
          monitor: "all",
        },
      }),
    );
    expect(result).toMatchObject({ id: 42, title: "New Show" });
  });

  it("maps queue entries correctly", async () => {
    const connector = createConnector();
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        records: [
          {
            id: 7,
            series: { id: 1, title: "Series A" },
            episode: {
              id: 11,
              title: "Episode 1",
              seasonNumber: 1,
              episodeNumber: 1,
            },
            status: "downloading",
            trackedDownloadState: "downloading",
            trackedDownloadStatus: "active",
            downloadId: "abc",
            protocol: "usenet",
            size: 1_000,
            sizeleft: 200,
            timeleft: "00:05:00",
          },
        ],
      },
    });

    const result = await connector.getQueue();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/queue");
    const item: SonarrQueueItem = result[0]!;
    expect(item).toEqual({
      id: 7,
      seriesId: 1,
      seriesTitle: "Series A",
      episodeId: 11,
      episodeTitle: "Episode 1",
      seasonNumber: 1,
      episodeNumber: 1,
      status: "downloading",
      trackedDownloadState: "downloading",
      trackedDownloadStatus: "active",
      downloadId: "abc",
      protocol: "usenet",
      size: 1_000,
      sizeleft: 200,
      timeleft: "00:05:00",
    });
  });

  it("propagates ApiError from search failures", async () => {
    const connector = createConnector();
    const underlyingError = new Error("Service unavailable");
    mockAxiosInstance.get.mockRejectedValue(underlyingError);

    const handled = new ApiError({ message: "Search failed" });
    mockedHandleApiError.mockImplementationOnce(() => handled);

    await expect(connector.search("Failure")).rejects.toBe(handled);
    expect(mockedHandleApiError).toHaveBeenCalledWith(
      underlyingError,
      expect.objectContaining({
        operation: "search",
        endpoint: "/api/v3/series/lookup",
      }),
    );
  });

  it("includes image parameters in getById requests", async () => {
    const connector = createConnector();
    const seriesResponse = {
      id: 1,
      title: "Test Series",
      status: "continuing",
      monitored: true,
      images: [],
      seasons: [
        {
          seasonNumber: 1,
          monitored: true,
          images: [{ coverType: "poster", remoteUrl: "season-poster-url" }],
        },
      ],
    };
    const episodesResponse = [
      {
        id: 1,
        seriesId: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Episode 1",
        hasFile: true,
        monitored: true,
        images: [
          { coverType: "screenshot", remoteUrl: "episode-screenshot-url" },
        ],
      },
    ];

    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === "/api/v3/series/1") {
        return Promise.resolve({ data: seriesResponse });
      }
      if (url === "/api/v3/episode") {
        return Promise.resolve({ data: episodesResponse });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    await connector.getById(1);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/series/1", {
      params: { includeSeasonImages: true },
    });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/episode", {
      params: { seriesId: 1, includeImages: true },
    });
  });

  it("prioritizes API-provided season images over constructed URLs", async () => {
    const connector = createConnector();
    const seriesResponse = {
      id: 1,
      title: "Test Series",
      status: "continuing",
      monitored: true,
      images: [],
      seasons: [
        {
          seasonNumber: 1,
          monitored: true,
          images: [{ coverType: "poster", remoteUrl: "api-season-poster-url" }],
        },
      ],
    };
    const episodesResponse: any[] = [];

    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === "/api/v3/series/1") {
        return Promise.resolve({ data: seriesResponse });
      }
      if (url === "/api/v3/episode") {
        return Promise.resolve({ data: episodesResponse });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    const result = await connector.getById(1);

    expect(result.seasons?.[0]?.posterUrl).toBe("api-season-poster-url");
  });

  it("falls back to constructed season poster URL when API images unavailable", async () => {
    const connector = createConnector();
    const seriesResponse = {
      id: 1,
      title: "Test Series",
      status: "continuing",
      monitored: true,
      images: [],
      seasons: [
        {
          seasonNumber: 1,
          monitored: true,
          images: [], // No images from API
        },
      ],
    };
    const episodesResponse: any[] = [];

    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === "/api/v3/series/1") {
        return Promise.resolve({ data: seriesResponse });
      }
      if (url === "/api/v3/episode") {
        return Promise.resolve({ data: episodesResponse });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    const result = await connector.getById(1);

    expect(result.seasons?.[0]?.posterUrl).toBe(
      "http://sonarr.local/api/v3/mediacover/1/season-1.jpg?apikey=secret",
    );
  });

  it("prioritizes episode screenshot images over poster images", async () => {
    const connector = createConnector();
    const seriesResponse = {
      id: 1,
      title: "Test Series",
      status: "continuing",
      monitored: true,
      images: [],
      seasons: [{ seasonNumber: 1, monitored: true }],
    };
    const episodesResponse = [
      {
        id: 1,
        seriesId: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Episode 1",
        hasFile: true,
        monitored: true,
        images: [
          { coverType: "poster", remoteUrl: "episode-poster-url" },
          { coverType: "screenshot", remoteUrl: "episode-screenshot-url" },
        ],
      },
    ];

    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === "/api/v3/series/1") {
        return Promise.resolve({ data: seriesResponse });
      }
      if (url === "/api/v3/episode") {
        return Promise.resolve({ data: episodesResponse });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    const result = await connector.getById(1);

    expect(result.seasons?.[0]?.episodes?.[0]?.posterUrl).toBe(
      "episode-screenshot-url",
    );
  });

  it("constructs episode poster URL with correct casing when API images unavailable", async () => {
    const connector = createConnector();
    const seriesResponse = {
      id: 1,
      title: "Test Series",
      status: "continuing",
      monitored: true,
      images: [],
      seasons: [{ seasonNumber: 1, monitored: true }],
    };
    const episodesResponse = [
      {
        id: 1,
        seriesId: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Episode 1",
        hasFile: true,
        monitored: true,
        images: [], // No images from API
      },
    ];

    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === "/api/v3/series/1") {
        return Promise.resolve({ data: seriesResponse });
      }
      if (url === "/api/v3/episode") {
        return Promise.resolve({ data: episodesResponse });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    const result = await connector.getById(1);

    expect(result.seasons?.[0]?.episodes?.[0]?.posterUrl).toBe(
      "http://sonarr.local/api/v3/mediacover/1/episode-1-screenshot.jpg?apikey=secret",
    );
  });
});
