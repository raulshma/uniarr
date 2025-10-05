import axios, { type AxiosError, type AxiosInstance } from 'axios';

import type { AddItemRequest, ConnectionResult, IConnector, SystemHealth } from './IConnector';
import type { ServiceConfig } from '@/models/service.types';
import { handleApiError } from '@/utils/error.utils';
import { logger } from '@/services/logger/LoggerService';

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

    try {
      await this.initialize();
      const version = await this.getVersion();
      const latency = Date.now() - startedAt;

      return {
        success: true,
        message: 'Connection successful.',
        latency,
        version,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'testConnection',
      });

      void logger.error('Connector test failed.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        message: diagnostic.message,
        statusCode: diagnostic.statusCode,
        code: diagnostic.code,
      });

      return {
        success: false,
        message: diagnostic.message,
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
    });

    instance.interceptors.request.use(
      (requestConfig) => {
        void logger.debug('Outgoing connector request.', {
          serviceId: this.config.id,
          serviceType: this.config.type,
          method: requestConfig.method?.toUpperCase(),
          url: requestConfig.url,
        });

        return requestConfig;
      },
      (error) => {
        this.logRequestError(error);
        return Promise.reject(error);
      },
    );

    instance.interceptors.response.use(
      (response) => {
        void logger.debug('Connector response received.', {
          serviceId: this.config.id,
          serviceType: this.config.type,
          status: response.status,
          url: response.config.url,
        });

        return response;
      },
      (error) => {
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
