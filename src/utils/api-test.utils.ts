import axios, { AxiosError } from 'axios';

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
  timeout: number = 10000
): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}${endpoint}`;
  console.log('🧪 [ApiTest] Testing endpoint:', fullUrl);
  console.log('🧪 [ApiTest] API Key provided:', apiKey ? 'Yes' : 'No');

  try {
    // Test 1: Try with X-Api-Key header (Sonarr/Radarr standard)
    if (apiKey) {
      console.log('🧪 [ApiTest] Testing with X-Api-Key header...');
      try {
        const response = await axios.get(fullUrl, {
          timeout,
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        console.log('✅ [ApiTest] X-Api-Key header worked:', {
          status: response.status,
          dataType: typeof response.data,
          hasData: !!response.data,
        });

        return {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers as Record<string, string>,
        };
      } catch (error) {
        console.log('❌ [ApiTest] X-Api-Key header failed:', {
          status: (error as AxiosError).response?.status,
          message: (error as AxiosError).message,
        });
      }
    }

    // Test 2: Try with query parameter
    if (apiKey) {
      console.log('🧪 [ApiTest] Testing with query parameter...');
      try {
        const urlWithKey = `${fullUrl}?apikey=${encodeURIComponent(apiKey)}`;
        const response = await axios.get(urlWithKey, {
          timeout,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        console.log('✅ [ApiTest] Query parameter worked:', {
          status: response.status,
          dataType: typeof response.data,
          hasData: !!response.data,
        });

        return {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers as Record<string, string>,
        };
      } catch (error) {
        console.log('❌ [ApiTest] Query parameter failed:', {
          status: (error as AxiosError).response?.status,
          message: (error as AxiosError).message,
        });
      }
    }

    // Test 3: Try without authentication (to see what error we get)
    console.log('🧪 [ApiTest] Testing without authentication...');
    try {
      const response = await axios.get(fullUrl, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('⚠️ [ApiTest] No authentication required:', {
        status: response.status,
        dataType: typeof response.data,
        hasData: !!response.data,
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.log('❌ [ApiTest] No auth failed:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      });

      return {
        success: false,
        status: axiosError.response?.status,
        error: axiosError.message,
        data: axiosError.response?.data,
      };
    }
  } catch (error) {
    console.error('❌ [ApiTest] All tests failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test Sonarr API specifically
 */
export async function testSonarrApi(baseUrl: string, apiKey?: string): Promise<ApiTestResult> {
  return testApiEndpoint(baseUrl, '/api/v3/system/status', apiKey);
}

/**
 * Test Radarr API specifically
 */
export async function testRadarrApi(baseUrl: string, apiKey?: string): Promise<ApiTestResult> {
  return testApiEndpoint(baseUrl, '/api/v3/system/status', apiKey);
}

/**
 * Test qBittorrent API specifically
 */
export async function testQBittorrentApi(baseUrl: string, username?: string, password?: string): Promise<ApiTestResult> {
  const fullUrl = `${baseUrl}/api/v2/app/version`;
  console.log('🧪 [ApiTest] Testing qBittorrent API:', fullUrl);

  try {
    // qBittorrent doesn't use API key, it uses session-based auth
    const response = await axios.get(fullUrl, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('✅ [ApiTest] qBittorrent API worked:', {
      status: response.status,
      data: response.data,
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    console.log('❌ [ApiTest] qBittorrent API failed:', {
      status: axiosError.response?.status,
      message: axiosError.message,
      data: axiosError.response?.data,
    });

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message,
      data: axiosError.response?.data,
    };
  }
}