import { RadarrConnector } from "@/connectors/implementations/RadarrConnector";

// Mock the axios client
const mockAxios = {
  get: jest.fn(),
};

// Mock error handling utility
jest.mock("@/utils/error.utils", () => ({
  handleApiError: jest.fn((error) => {
    throw error;
  }),
}));

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock("@/services/logger/LoggerService", () => ({
  logger: mockLogger,
}));

describe("RadarrConnector.lookupByTmdbId", () => {
  let connector: RadarrConnector;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a connector instance with mocked client
    connector = new RadarrConnector({
      id: "test_radarr",
      type: "radarr",
      name: "Test Radarr",
      url: "http://localhost:7878",
      apiKey: "test_key",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Replace the client with our mock
    (connector as any).client = mockAxios;
  });

  it("returns a movie when TMDB lookup succeeds", async () => {
    const tmdbId = 123;
    const mockMovie: any = {
      id: 456,
      title: "Test Movie",
      tmdbId: 123,
      imdbId: "tt1234567",
      year: 2024,
    };

    mockAxios.get.mockResolvedValue({ data: [mockMovie] });

    const result = await (connector as any).lookupByTmdbId(tmdbId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(456);
    expect(result?.tmdbId).toBe(123);
    expect(mockAxios.get).toHaveBeenCalledWith(
      "/api/v3/movie/lookup/tmdb",
      expect.objectContaining({
        params: { tmdbId },
      }),
    );
  });

  it("returns undefined when TMDB lookup returns empty array", async () => {
    const tmdbId = 999;

    mockAxios.get.mockResolvedValue({ data: [] });

    const result = await (connector as any).lookupByTmdbId(tmdbId);

    expect(result).toBeUndefined();
  });

  it("returns undefined and logs warning on error", async () => {
    const tmdbId = 123;
    const error = new Error("Network error");

    mockAxios.get.mockRejectedValue(error);

    const result = await (connector as any).lookupByTmdbId(tmdbId);

    expect(result).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[RadarrConnector] TMDB lookup failed",
      expect.objectContaining({
        tmdbId,
        serviceId: "test_radarr",
      }),
    );
  });

  it("calls the correct Radarr endpoint", async () => {
    const tmdbId = 456;
    mockAxios.get.mockResolvedValue({ data: [{ id: 789, tmdbId: 456 }] });

    await (connector as any).lookupByTmdbId(tmdbId);

    expect(mockAxios.get).toHaveBeenCalledWith(
      "/api/v3/movie/lookup/tmdb",
      expect.any(Object),
    );
  });
});
