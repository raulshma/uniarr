import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { ServiceConfig } from "@/models/service.types";
import type { RadarrQueueItem } from "@/models/movie.types";
import { ApiError, handleApiError } from "@/utils/error.utils";

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
}));

type MockAxiosInstance = {
  get: jest.MockedFunction<any>;
  post: jest.MockedFunction<any>;
  put: jest.MockedFunction<any>;
  delete: jest.MockedFunction<any>;
  defaults: {
    baseURL?: string;
  };
  interceptors: {
    request: {
      use: jest.MockedFunction<any>;
    };
    response: {
      use: jest.MockedFunction<any>;
    };
  };
};

const createMockAxiosInstance = (): MockAxiosInstance => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: {},
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
  id: "radarr-1",
  name: "Primary Radarr",
  type: "radarr",
  url: "http://radarr.local:7878",
  apiKey: "secret-key",
  enabled: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const createConnector = () => new RadarrConnector(baseConfig);

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

describe("RadarrConnector", () => {
  let mockAxiosInstance: MockAxiosInstance;

  beforeEach(() => {
    mockAxiosInstance = createMockAxiosInstance();
    mockAxiosInstance.defaults.baseURL = baseConfig.url;

    const mockedAxios = jest.requireMock("axios") as {
      default: {
        create: jest.MockedFunction<any>;
        isAxiosError: jest.MockedFunction<any>;
      };
    };

    mockedAxios.default.create.mockReset();
    mockedAxios.default.create.mockReturnValue(mockAxiosInstance);
    mockedAxios.default.isAxiosError.mockReset();

    mockedHandleApiError.mockReset();
    mockedHandleApiError.mockImplementation(defaultErrorHandler);
  });

  it("returns mapped movies from getMovies", async () => {
    const connector = createConnector();
    const movieResponse = {
      id: 101,
      title: "Dune: Part Two",
      sortTitle: "dune part two",
      year: 2024,
      status: "released",
      overview: "Epic sci-fi adventure.",
      monitored: true,
      hasFile: false,
      images: [
        { coverType: "poster", url: "/media/poster.jpg" },
        {
          coverType: "fanart",
          remoteUrl: "https://cdn.example.com/backdrop.jpg",
        },
      ],
      ratings: { value: 8.5, votes: 1000, type: "tmdb" },
      statistics: { movieFileCount: 0, sizeOnDisk: 0, percentAvailable: 0 },
      movieFile: {
        id: 2001,
        relativePath: "Dune Part Two.mkv",
        size: 12_345_678,
        dateAdded: "2025-03-01T00:00:00Z",
        sceneName: "dune.part.two.2160p",
        quality: {
          quality: {
            id: 5,
            name: "Bluray-2160p",
            source: "bluray",
            resolution: 2160,
            sort: 10,
          },
          revision: {
            version: 1,
            real: 0,
            isRepack: false,
          },
        },
      },
    };

    mockAxiosInstance.get.mockResolvedValueOnce({ data: [movieResponse] });

    const result = await connector.getMovies();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/movie");
    expect(result).toHaveLength(1);
    const movie = result[0]!;
    expect(movie).toMatchObject({
      id: 101,
      title: "Dune: Part Two",
      monitored: true,
      hasFile: false,
      posterUrl: "http://radarr.local:7878/media/poster.jpg?apikey=secret-key",
      backdropUrl: "https://cdn.example.com/backdrop.jpg",
    });
    expect(movie.movieFile?.quality?.quality?.name).toBe("Bluray-2160p");
    expect(movie.ratings?.value).toBe(8.5);
  });

  it("propagates ApiError when getMovies fails", async () => {
    const connector = createConnector();
    const underlying = new Error("Radarr unavailable");
    const diagnostic = new ApiError({ message: "Failed to load movies" });

    mockAxiosInstance.get.mockRejectedValueOnce(underlying);
    mockedHandleApiError.mockImplementationOnce(() => diagnostic);

    await expect(connector.getMovies()).rejects.toBe(diagnostic);
    expect(mockedHandleApiError).toHaveBeenCalledWith(
      underlying,
      expect.objectContaining({
        operation: "getMovies",
        endpoint: "/api/v3/movie",
      }),
    );
  });

  it("retrieves movie details with getById", async () => {
    const connector = createConnector();
    const response = {
      id: 55,
      title: "Inception",
      monitored: true,
      hasFile: true,
      images: [],
    };

    mockAxiosInstance.get.mockResolvedValueOnce({ data: response });

    const movie = await connector.getById(55);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/movie/55");
    expect(movie).toMatchObject({
      id: 55,
      title: "Inception",
      monitored: true,
    });
  });

  it("creates a movie with add", async () => {
    const connector = createConnector();
    const created = {
      id: 77,
      title: "The Batman Dawn",
      monitored: true,
      hasFile: false,
      images: [],
    };

    mockAxiosInstance.post.mockResolvedValueOnce({ data: created });

    const payload = {
      title: "The Batman: Dawn",
      tmdbId: 1234,
      year: 2022,
      titleSlug: "the-batman-dawn",
      qualityProfileId: 6,
      rootFolderPath: "/mnt/media/movies/",
      monitored: true,
      minimumAvailability: "announced" as const,
      searchOnAdd: true,
    };

    const result = await connector.add(payload);

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      "/api/v3/movie",
      expect.objectContaining({
        title: "The Batman: Dawn",
        tmdbId: 1234,
        path: "/mnt/media/movies/The Batman Dawn (2022)",
        addOptions: {
          searchOnAdd: true,
          searchForMovie: true,
          monitor: "movie",
        },
      }),
    );
    expect(result).toMatchObject({ id: 77, title: "The Batman Dawn" });
  });

  it("updates monitored state via setMonitored", async () => {
    const connector = createConnector();
    const existing = {
      id: 88,
      title: "Arrival",
      monitored: true,
      hasFile: true,
      images: [],
    };

    mockAxiosInstance.get.mockResolvedValueOnce({ data: existing });
    mockAxiosInstance.put.mockResolvedValueOnce({
      data: { ...existing, monitored: false },
    });

    await connector.setMonitored(88, false);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/movie/88");
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      "/api/v3/movie/88",
      expect.objectContaining({ monitored: false }),
    );
  });

  it("propagates ApiError when setMonitored fails", async () => {
    const connector = createConnector();
    const underlying = new Error("Forbidden");
    const diagnostic = new ApiError({ message: "Unable to update movie" });

    mockAxiosInstance.get.mockRejectedValueOnce(underlying);
    mockedHandleApiError.mockImplementationOnce(() => diagnostic);

    await expect(connector.setMonitored(1, true)).rejects.toBe(diagnostic);
    expect(mockedHandleApiError).toHaveBeenCalledWith(
      underlying,
      expect.objectContaining({
        operation: "setMonitored",
        endpoint: "/api/v3/movie/1",
      }),
    );
  });

  it("maps queue records via getQueue", async () => {
    const connector = createConnector();

    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        records: [
          {
            id: 901,
            movie: { id: 777, title: "Edge of Tomorrow" },
            status: "downloading",
            trackedDownloadState: "downloading",
            trackedDownloadStatus: "active",
            protocol: "torrent",
            size: 7_500_000_000,
            sizeleft: 1_200_000_000,
            timeleft: "00:10:00",
          },
        ],
      },
    });

    const queue = await connector.getQueue();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/v3/queue");
    const item: RadarrQueueItem = queue[0]!;
    expect(item).toEqual({
      id: 901,
      movieId: 777,
      title: "Edge of Tomorrow",
      status: "downloading",
      trackedDownloadState: "downloading",
      trackedDownloadStatus: "active",
      protocol: "torrent",
      size: 7_500_000_000,
      sizeleft: 1_200_000_000,
      timeleft: "00:10:00",
    });
  });
});
