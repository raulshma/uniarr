import axios, { type AxiosError, type AxiosInstance } from 'axios';

import type { AddItemRequest, ConnectionResult, IConnector, SystemHealth } from './IConnector';
import type { ServiceConfig } from '@/models/service.types';
import { handleApiError } from '@/utils/error.utils';
import { logger } from '@/services/logger/LoggerService';
import { testNetworkConnectivity, diagnoseVpnIssues } from '@/utils/network.utils';
import { testSonarrApi, testRadarrApi, testQBittorrentApi, testJellyseerrApi } from '@/utils/api-test.utils';
import { debugLogger } from '@/utils/debug-logger';

/**
 * Abstract base implementation shared by all service connectors.
 */
export abstract class BaseConnector<
  TResource = unknown,
  TCreatePayload = AddItemRequest,
  TUpdatePayload = Partial<TResource>,
> implements IConnector<TResource, TCreatePayload, TUpdatePayload> {
  protected readonly client: AxiosInstance;

  constructor(public readonly config: ServiceConfig) {
    this.client = this.createHttpClient();
  }

  /**
   * Perform connector-specific initialization, such as verifying credentials or loading metadata.
   */
  abstract initialize(): Promise<void>;

  /** Retrieve the remote service version string. */
  abstract getVersion(): Promise<string>;

  /** Dispose of any resources held by the connector. */
  dispose(): void {
    void logger.debug('Connector disposed.', {
      serviceId: this.config.id,
      serviceType: this.config.type,
    });
  }

  /** Test connectivity to the remote service and return diagnostic information. */
  async testConnection(): Promise<ConnectionResult> {
    const startedAt = Date.now();
    debugLogger.startConnectionTest(this.config.type, this.config.url);

    try {
      // For VPN connections, we'll be more lenient with network tests
      // and focus on the actual API endpoint test
      debugLogger.addStep({
        id: 'network-test-start',
        title: 'Testing Network Connectivity',
        status: 'running',
        message: `Testing connection to ${this.config.url}`,
      });
      
      // Test basic network connectivity with increased timeout for VPN
      const networkTimeout = this.config.timeout ?? 15000; // Increased timeout for VPN
      const networkTest = await testNetworkConnectivity(this.config.url, networkTimeout);
      
      if (!networkTest.success) {
        // For VPN connections, don't fail immediately on network test
        // Instead, log the issue and continue with API test
        const vpnIssues = diagnoseVpnIssues({ code: 'ERR_NETWORK', message: networkTest.error }, this.config.type);
        debugLogger.addWarning(
          `Network test failed but continuing with API test: ${networkTest.error}`,
          vpnIssues.join('\n')
        );
        
        // Don't return early - continue with API test
      } else {
        debugLogger.addNetworkTest(true);
      }
      
      // Test API endpoint specifically with more robust error handling
      debugLogger.addStep({
        id: 'api-test-start',
        title: 'Testing API Authentication',
        status: 'running',
        message: `Testing ${this.config.type} API endpoint`,
      });
      
      let apiTest;
      const apiTimeout = Math.max(networkTimeout, 20000); // Ensure API test has enough time
      
      if (this.config.type === 'sonarr') {
        apiTest = await testSonarrApi(this.config.url, this.config.apiKey, apiTimeout);
      } else if (this.config.type === 'radarr') {
        apiTest = await testRadarrApi(this.config.url, this.config.apiKey, apiTimeout);
      } else if (this.config.type === 'qbittorrent') {
        apiTest = await testQBittorrentApi(this.config.url, this.config.username, this.config.password, apiTimeout);
      } else if (this.config.type === 'jellyseerr') {
        apiTest = await testJellyseerrApi(this.config.url, this.config.username, this.config.password, apiTimeout);
      }
      
      if (apiTest && !apiTest.success) {
        const vpnIssues = diagnoseVpnIssues({ 
          code: apiTest.status === 401 ? 'AUTH_ERROR' : 'API_ERROR', 
          message: apiTest.error 
        }, this.config.type);
        
        debugLogger.addError(`API test failed: ${apiTest.error}`, 
          `Status: ${apiTest.status}\nData: ${JSON.stringify(apiTest.data)}\n\nVPN Issues:\n${vpnIssues.join('\n')}`);
        
        return {
          success: false,
          message: `API test failed: ${apiTest.error}. ${vpnIssues.join(' ')}`,
          latency: Date.now() - startedAt,
        };
      }
      
      debugLogger.addSuccess('API authentication successful');
      
      // Test service initialization
      debugLogger.addStep({
        id: 'service-test-start',
        title: 'Testing Service Connection',
        status: 'running',
        message: `Initializing ${this.config.type} service`,
      });
      
      await this.initialize();
      const version = await this.getVersion();
      const latency = Date.now() - startedAt;
      
      debugLogger.addServiceTest(this.config.type, true, version);

      return {
        success: true,
        message: 'Connection successful.',
        latency,
        version,
      };
    } catch (error) {
      // Diagnose VPN-specific issues
      const vpnIssues = diagnoseVpnIssues(error, this.config.type);
      
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'testConnection',
      });

      debugLogger.addError(
        `Service test failed: ${diagnostic.message}`,
        vpnIssues.length > 0 ? `VPN Issues:\n${vpnIssues.join('\n')}` : undefined
      );

      void logger.error('Connector test failed.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        message: diagnostic.message,
        statusCode: diagnostic.statusCode,
        code: diagnostic.code,
        vpnIssues,
      });

      return {
        success: false,
        message: `${diagnostic.message}${vpnIssues.length > 0 ? ` ${vpnIssues.join(' ')}` : ''}`,
        latency: Date.now() - startedAt,
      };
    }
  }

  /**
   * Retrieve a health summary. Connectors can override to call service-specific endpoints.
   */
  async getHealth(): Promise<SystemHealth> {
    try {
      const response = await this.client.get('/health');

      return {
        status: 'healthy',
        message: 'Service responded successfully.',
        lastChecked: new Date(),
        details: typeof response.data === 'object' ? (response.data as Record<string, unknown>) : undefined,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getHealth',
      });

      return {
        status: diagnostic.isNetworkError ? 'offline' : 'degraded',
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  /** Create a configured Axios instance with logging and error handling. */
  protected createHttpClient(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout ?? 30_000,
      headers: this.getDefaultHeaders(),
      ...this.getAuthConfig(),
    });

    instance.interceptors.request.use(
      (requestConfig) => {
        console.log('📤 [BaseConnector] Outgoing request:', {
          method: requestConfig.method?.toUpperCase(),
          url: requestConfig.url,
          fullUrl: `${this.config.url}${requestConfig.url}`,
          headers: requestConfig.headers,
          timeout: requestConfig.timeout,
        });
        
        void logger.debug('Outgoing connector request.', {
          serviceId: this.config.id,
          serviceType: this.config.type,
          method: requestConfig.method?.toUpperCase(),
          url: requestConfig.url,
        });

        return requestConfig;
      },
      (error) => {
        console.error('📤 [BaseConnector] Request setup error:', error);
        this.logRequestError(error);
        return Promise.reject(error);
      },
    );

    instance.interceptors.response.use(
      (response) => {
        console.log('📥 [BaseConnector] Response received:', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          headers: response.headers,
          dataType: typeof response.data,
          dataLength: response.data ? JSON.stringify(response.data).length : 0,
        });
        
        void logger.debug('Connector response received.', {
          serviceId: this.config.id,
          serviceType: this.config.type,
          status: response.status,
          url: response.config.url,
        });

        return response;
      },
      (error) => {
        console.error('📥 [BaseConnector] Response error:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          headers: error.response?.headers,
          data: error.response?.data,
        });
        
        this.handleHttpError(error);
        return Promise.reject(error);
      },
    );

    return instance;
  }

  /**
   * Format default headers for outbound requests.
   */
  protected getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-Api-Key'] = this.config.apiKey;
    }

    return headers;
  }

  /**
   * Get authentication configuration for the HTTP client.
   * Override this method in connectors that use different auth methods.
   */
  protected getAuthConfig(): { auth?: { username: string; password: string } } {
    // Sonarr and Radarr only use API key authentication, not username/password
    if (this.config.type === 'sonarr' || this.config.type === 'radarr') {
      return {};
    }
    
    if (this.config.username && this.config.password) {
      return {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
      };
    }
    return {};
  }

  /** Log and surface Axios errors that occur during the request lifecycle. */
  protected handleHttpError(error: AxiosError): void {
    const diagnostic = handleApiError(error, {
      serviceId: this.config.id,
      serviceType: this.config.type,
      operation: error.config?.method,
      endpoint: error.config?.url,
    });

    void logger.error('Connector request failed.', {
      serviceId: this.config.id,
      serviceType: this.config.type,
      message: diagnostic.message,
      statusCode: diagnostic.statusCode,
      code: diagnostic.code,
    });
  }

  private logRequestError(error: unknown): void {
    const diagnostic = handleApiError(error, {
      serviceId: this.config.id,
      serviceType: this.config.type,
      operation: 'request',
    });

    void logger.error('Connector request setup failed.', {
      serviceId: this.config.id,
      serviceType: this.config.type,
      message: diagnostic.message,
      statusCode: diagnostic.statusCode,
      code: diagnostic.code,
    });
  }

  /** Transform any error into a readable message. */
  protected getErrorMessage(error: unknown): string {
    return handleApiError(error, {
      serviceId: this.config.id,
      serviceType: this.config.type,
    }).message;
  }
}
