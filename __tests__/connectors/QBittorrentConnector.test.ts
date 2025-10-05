import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { QBittorrentConnector } from '@/connectors/implementations/QBittorrentConnector';
import type { ServiceConfig } from '@/models/service.types';
import type { Torrent } from '@/models/torrent.types';
import { ApiError, handleApiError } from '@/utils/error.utils';

type MockAxiosInstance = {
  get: jest.MockedFunction<any>;
  post: jest.MockedFunction<any>;
  put: jest.MockedFunction<any>;
  delete: jest.MockedFunction<any>;
  defaults: {
    baseURL?: string;
    withCredentials?: boolean;
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

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    isAxiosError: jest.fn(),
  },
  create: jest.fn(),
  isAxiosError: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/logger/LoggerService', () => ({
  logger: {
    debug: jest.fn(async () => undefined),
    info: jest.fn(async () => undefined),
    warn: jest.fn(async () => undefined),
    error: jest.fn(async () => undefined),
  },
}));

jest.mock('@/utils/error.utils', () => {
  const actual = jest.requireActual<typeof import('@/utils/error.utils')>('@/utils/error.utils');
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
      message: 'Mock error',
      cause: error,
    });
  });

  return {
    ...actual,
    handleApiError: mockHandleApiError,
  };
});

const mockedHandleApiError = handleApiError as unknown as jest.MockedFunction<typeof handleApiError>;

const baseConfig: ServiceConfig = {
  id: 'qbittorrent-1',
  name: 'Primary qBittorrent',
  type: 'qbittorrent',
  url: 'http://qbittorrent.local:8080',
  username: 'admin',
  password: 'password123',
  enabled: true,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const createConnector = () => new QBittorrentConnector(baseConfig);

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
    message: 'Mock error',
    cause: error,
  });
};

describe('QBittorrentConnector', () => {
  let mockAxiosInstance: MockAxiosInstance;

  beforeEach(() => {
    mockAxiosInstance = createMockAxiosInstance();
    mockAxiosInstance.defaults.baseURL = baseConfig.url;

    const mockedAxios = jest.requireMock('axios') as {
      default: { create: jest.MockedFunction<any>; isAxiosError: jest.MockedFunction<any> };
    };

    mockedAxios.default.create.mockReset();
    mockedAxios.default.create.mockReturnValue(mockAxiosInstance);
    mockedAxios.default.isAxiosError.mockReset();

    mockedHandleApiError.mockReset();
    mockedHandleApiError.mockImplementation(defaultErrorHandler);
  });

  it('authenticates with username and password', async () => {
    const connector = createConnector();
    
    // Mock successful authentication
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: 'Ok.',
      headers: {
        'set-cookie': ['SID=abc123; Path=/; HttpOnly'],
      },
    });

    // Mock version check after authentication
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: 'v4.6.2',
    });

    await connector.initialize();
    const version = await connector.getVersion();

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/v2/auth/login',
      'username=admin&password=password123',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'http://qbittorrent.local:8080',
        },
      }),
    );
    expect(version).toBe('v4.6.2');
  });

  it('throws error when authentication fails', async () => {
    const connector = createConnector();
    
    // Mock failed authentication - qBittorrent returns "Fails." when credentials are wrong
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: 'Fails.',
      headers: {}, // No set-cookie header means no session cookie
    });

    await expect(connector.initialize()).rejects.toThrow('qBittorrent authentication failed. Server responded with: "Fails." This usually means incorrect username or password. Default credentials are admin/adminadmin.');
  });

  it('throws error when credentials are missing', async () => {
    const configWithoutCredentials: ServiceConfig = {
      ...baseConfig,
      username: undefined,
      password: undefined,
    };
    
    const connector = new QBittorrentConnector(configWithoutCredentials);

    await expect(connector.initialize()).rejects.toThrow('qBittorrent credentials are required.');
  });

  it('returns mapped torrents from getTorrents', async () => {
    const connector = createConnector();
    
    // Mock authentication
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: 'Ok.',
      headers: {
        'set-cookie': ['SID=abc123; Path=/; HttpOnly'],
      },
    });

    const torrentResponse = {
      hash: 'abc123def456',
      name: 'Ubuntu 22.04 LTS',
      state: 'downloading',
      category: 'linux',
      tags: 'iso,ubuntu',
      progress: 0.75,
      total_size: 4_000_000_000,
      downloaded: 3_000_000_000,
      uploaded: 500_000_000,
      ratio: 0.167,
      dlspeed: 10_000_000,
      upspeed: 1_000_000,
      eta: 100,
      added_on: 1640995200,
      completion_on: 0,
      seeding_time: 0,
      last_activity: 1640995300,
      num_seeds: 5,
      num_complete: 10,
      num_leechs: 2,
      num_incomplete: 8,
      availability: 0.8,
    };

    mockAxiosInstance.get.mockResolvedValueOnce({ data: [torrentResponse] });

    const result = await connector.getTorrents();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v2/torrents/info', {
      params: {
        category: undefined,
        tag: undefined,
        filter: undefined,
      },
    });
    expect(result).toHaveLength(1);
    const torrent: Torrent = result[0]!;
    expect(torrent).toMatchObject({
      hash: 'abc123def456',
      name: 'Ubuntu 22.04 LTS',
      state: 'downloading',
      category: 'linux',
      tags: ['iso', 'ubuntu'],
      progress: 0.75,
      size: 4_000_000_000,
      downloaded: 3_000_000_000,
      uploaded: 500_000_000,
      ratio: 0.167,
      downloadSpeed: 10_000_000,
      uploadSpeed: 1_000_000,
      eta: 100,
      addedOn: 1640995200,
      completedOn: 0,
      seedingTime: 0,
      lastActivity: 1640995300,
      seeds: {
        connected: 5,
        total: 10,
      },
      peers: {
        connected: 2,
        total: 8,
      },
      availability: 0.8,
    });
  });

  it('handles torrent operations correctly', async () => {
    const connector = createConnector();
    
    // Mock authentication
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: 'Ok.',
      headers: {
        'set-cookie': ['SID=abc123; Path=/; HttpOnly'],
      },
    });

    const hash = 'abc123def456';

    // Test pause torrent
    mockAxiosInstance.post.mockResolvedValueOnce({ data: 'Ok.' });
    await connector.pauseTorrent(hash);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/v2/torrents/pause',
      'hashes=abc123def456',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );

    // Test resume torrent
    mockAxiosInstance.post.mockResolvedValueOnce({ data: 'Ok.' });
    await connector.resumeTorrent(hash);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/v2/torrents/resume',
      'hashes=abc123def456',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );

    // Test delete torrent
    mockAxiosInstance.post.mockResolvedValueOnce({ data: 'Ok.' });
    await connector.deleteTorrent(hash, true);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/v2/torrents/delete',
      'hashes=abc123def456&deleteFiles=true',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );
  });

  it('propagates ApiError when operations fail', async () => {
    const connector = createConnector();
    const underlying = new Error('qBittorrent unavailable');
    const diagnostic = new ApiError({ message: 'Failed to get torrents' });

    // Mock authentication
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: 'Ok.',
      headers: {
        'set-cookie': ['SID=abc123; Path=/; HttpOnly'],
      },
    });

    mockAxiosInstance.get.mockRejectedValueOnce(underlying);
    mockedHandleApiError.mockImplementationOnce(() => diagnostic);

    await expect(connector.getTorrents()).rejects.toBe(diagnostic);
    expect(mockedHandleApiError).toHaveBeenCalledWith(
      underlying,
      expect.objectContaining({
        operation: 'getTorrents',
        endpoint: '/api/v2/torrents/info',
      }),
    );
  });
});
