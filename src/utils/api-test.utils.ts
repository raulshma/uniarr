import axios, { AxiosError } from "axios";
import { ServiceAuthHelper } from "@/services/auth/ServiceAuthHelper";

export interface ApiTestResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * Test API endpoint with different authentication methods
 */
export async function testApiEndpoint(
  baseUrl: string,
  endpoint: string,
  apiKey?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}${endpoint}`;

  try {
    // Test 1: Try with X-Api-Key header (Sonarr/Radarr standard)
    if (apiKey) {
      try {
        const response = await axios.get(fullUrl, {
          timeout,
          headers: {
            "X-Api-Key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        return {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers as Record<string, string>,
        };
      } catch {
        // X-Api-Key header failed, continue to next test
      }
    }

    // Test 2: Try with query parameter
    if (apiKey) {
      try {
        const urlWithKey = `${fullUrl}?apikey=${encodeURIComponent(apiKey)}`;
        const response = await axios.get(urlWithKey, {
          timeout,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        return {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers as Record<string, string>,
        };
      } catch {
        // Query parameter failed, continue to next test
      }
    }

    // Test 3: Try without authentication (to see what error we get)
    try {
      const response = await axios.get(fullUrl, {
        timeout,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      return {
        success: false,
        status: axiosError.response?.status,
        error: axiosError.message,
        data: axiosError.response?.data,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Sonarr API specifically
 */
export async function testSonarrApi(
  baseUrl: string,
  apiKey?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  return testApiEndpoint(baseUrl, "/api/v3/system/status", apiKey, timeout);
}

/**
 * Test Radarr API specifically
 */
export async function testRadarrApi(
  baseUrl: string,
  apiKey?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  return testApiEndpoint(baseUrl, "/api/v3/system/status", apiKey, timeout);
}

/**
 * Test qBittorrent API specifically
 */
export async function testQBittorrentApi(
  baseUrl: string,
  username?: string,
  password?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}/api/v2/app/version`;

  try {
    // Create a mock service config for testing
    const mockConfig = {
      id: "test-qbittorrent",
      name: "Test qBittorrent",
      type: "qbittorrent" as const,
      url: baseUrl,
      username,
      password,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use the new authentication system
    const authResult = await ServiceAuthHelper.authenticateService(mockConfig);

    if (!authResult.success || !authResult.authenticated) {
      return {
        success: false,
        error: authResult.error || "Authentication failed",
      };
    }

    // Test the actual API endpoint
    const response = await axios.get(fullUrl, {
      timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "UniArr/1.0.0",
      },
      withCredentials: true, // Important for session cookies
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}

/**
 * Test Jellyseerr API specifically
 */
export async function testJellyseerrApi(
  baseUrl: string,
  apiKey?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}/api/v1/status`;

  try {
    // Create a mock service config for testing
    const mockConfig = {
      id: "test-jellyseerr",
      name: "Test Jellyseerr",
      type: "jellyseerr" as const,
      url: baseUrl,
      apiKey,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use the new authentication system
    const authResult = await ServiceAuthHelper.authenticateService(mockConfig);

    if (!authResult.success || !authResult.authenticated) {
      return {
        success: false,
        error: authResult.error || "Authentication failed",
      };
    }

    // Test the actual API endpoint using API key in headers
    const response = await axios.get(fullUrl, {
      timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "UniArr/1.0.0",
        ...(apiKey ? { "X-Api-Key": apiKey } : {}),
      },
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}

/**
 * Test Transmission API specifically
 */
export async function testTransmissionApi(
  baseUrl: string,
  username?: string,
  password?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}/transmission/rpc`;

  try {
    // Create a mock service config for testing
    const mockConfig = {
      id: "test-transmission",
      name: "Test Transmission",
      type: "transmission" as const,
      url: baseUrl,
      username,
      password,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use the new authentication system
    const authResult = await ServiceAuthHelper.authenticateService(mockConfig);

    if (!authResult.success || !authResult.authenticated) {
      return {
        success: false,
        error: authResult.error || "Authentication failed",
      };
    }

    // Test the actual API endpoint
    const response = await axios.post(
      fullUrl,
      {
        method: "session-get",
        arguments: {},
      },
      {
        timeout,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "UniArr/1.0.0",
        },
      },
    );

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}

/**
 * Test Deluge API specifically
 */
export async function testDelugeApi(
  baseUrl: string,
  username?: string,
  password?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}/json`;

  try {
    // Create a mock service config for testing
    const mockConfig = {
      id: "test-deluge",
      name: "Test Deluge",
      type: "deluge" as const,
      url: baseUrl,
      username,
      password,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use the new authentication system
    const authResult = await ServiceAuthHelper.authenticateService(mockConfig);

    if (!authResult.success || !authResult.authenticated) {
      return {
        success: false,
        error: authResult.error || "Authentication failed",
      };
    }

    // Test the actual API endpoint
    const response = await axios.post(
      fullUrl,
      {
        method: "web.get_version",
        params: [],
        id: 1,
        jsonrpc: "2.0",
      },
      {
        timeout,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "UniArr/1.0.0",
        },
      },
    );

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}

/**
 * Test SABnzbd API specifically
 */
export async function testSABnzbdApi(
  baseUrl: string,
  apiKey?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}/api`;

  try {
    // Create a mock service config for testing
    const mockConfig = {
      id: "test-sabnzbd",
      name: "Test SABnzbd",
      type: "sabnzbd" as const,
      url: baseUrl,
      apiKey,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use the new authentication system
    const authResult = await ServiceAuthHelper.authenticateService(mockConfig);

    if (!authResult.success || !authResult.authenticated) {
      return {
        success: false,
        error: authResult.error || "Authentication failed",
      };
    }

    // Test the actual API endpoint
    const response = await axios.get(fullUrl, {
      timeout,
      params: { apikey: apiKey },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "UniArr/1.0.0",
      },
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}

/**
 * Test Bazarr API connectivity and authentication
 */
export async function testBazarrApi(
  baseUrl: string,
  apiKey?: string,
  timeout: number = 15000,
): Promise<ApiTestResult> {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required for Bazarr authentication",
    };
  }

  try {
    // Test 1: Try with X-Api-Key header (Bazarr standard)
    const response = await axios.get(`${baseUrl}/api/system/status`, {
      timeout,
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}
