import type { ConnectionResult, IConnector } from '@/connectors/base/IConnector';
import type { ServiceConfig, ServiceType } from '@/models/service.types';

import { ConnectorFactory } from '@/connectors/factory/ConnectorFactory';
import { logger } from '@/services/logger/LoggerService';
import { secureStorage } from '@/services/storage/SecureStorage';

interface AddConnectorOptions {
  persist?: boolean;
}

/** Manages the lifecycle of connector instances and their persisted configurations. */
export class ConnectorManager {
  private static instance: ConnectorManager | null = null;

  private readonly connectors = new Map<string, IConnector>();

  private updateStore?: (connectors: Map<string, IConnector>) => void;

  private constructor() {}

  static getInstance(): ConnectorManager {
    if (!ConnectorManager.instance) {
      ConnectorManager.instance = new ConnectorManager();
    }

    return ConnectorManager.instance;
  }

  setUpdateStore(updateStore: (connectors: Map<string, IConnector>) => void) {
    this.updateStore = updateStore;
  }

  /** Load previously saved service configurations and bootstrap connectors for enabled entries. */
  async loadSavedServices(): Promise<void> {
    const configs = await secureStorage.getServiceConfigs();

    await Promise.all(
      configs
        .filter((config) => config.enabled)
        .map(async (config) => {
          try {
            await this.addConnector(config, { persist: false });
          } catch (error) {
            void logger.error('Failed to load connector from storage.', {
              serviceId: config.id,
              serviceType: config.type,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }),
    );
  }

  /** Create and register a connector for the provided configuration. */
  async addConnector(
    config: ServiceConfig,
    options: AddConnectorOptions = {},
  ): Promise<IConnector> {
    logger.debug('[ConnectorManager] Adding connector', { serviceType: config.type, serviceId: config.id });
    
    const existing = this.connectors.get(config.id);
    if (existing) {
      logger.debug('[ConnectorManager] Disposing existing connector', { serviceId: config.id });
      existing.dispose();
      this.connectors.delete(config.id);
    }

    logger.debug('[ConnectorManager] Creating connector via factory');
    const connector = ConnectorFactory.create(config);
    logger.debug('[ConnectorManager] Connector created, adding to map', { serviceId: config.id });
    this.connectors.set(config.id, connector);
    this.updateStore?.(this.connectors);

    if (options.persist !== false) {
      await secureStorage.saveServiceConfig(config);
      logger.debug('[ConnectorManager] Persisted config to storage', { serviceId: config.id });
    }

    void logger.info('Connector registered.', {
      serviceId: config.id,
      serviceType: config.type,
    });

    logger.debug('[ConnectorManager] Connector registration completed', { serviceId: config.id });
    return connector;
  }

  /** Retrieve a connector by its identifier. */
  getConnector(id: string): IConnector | undefined {
    return this.connectors.get(id);
  }

  /** Retrieve connectors filtered by service type. */
  getConnectorsByType(type: ServiceType): IConnector[] {
    return Array.from(this.connectors.values()).filter(
      (connector) => connector.config.type === type,
    );
  }

  /** Return all registered connectors. */
  getAllConnectors(): IConnector[] {
    return Array.from(this.connectors.values());
  }

  /** Remove a connector, dispose it, and optionally remove the persisted configuration. */
  async removeConnector(id: string, { persist = true }: AddConnectorOptions = {}): Promise<void> {
    const connector = this.connectors.get(id);

    if (!connector) {
      return;
    }

    connector.dispose();
    this.connectors.delete(id);
    this.updateStore?.(this.connectors);

    if (persist) {
      await secureStorage.removeServiceConfig(id);
    }

    void logger.info('Connector removed.', {
      serviceId: id,
      serviceType: connector.config.type,
    });
  }

  /** Run connection tests for all registered connectors in parallel. */
  async testAllConnections(): Promise<Map<string, ConnectionResult>> {
    const entries = Array.from(this.connectors.entries());

    const results = await Promise.all(
      entries.map(async ([id, connector]) => {
        try {
          const result = await connector.testConnection();
          return [id, result] as const;
        } catch (error) {
          void logger.error('Connector test failed with unhandled error.', {
            serviceId: id,
            serviceType: connector.config.type,
            message: error instanceof Error ? error.message : String(error),
          });
          return [id, { success: false, message: 'Unhandled connector error.' }] as const;
        }
      }),
    );

    return new Map(results);
  }

  /** Dispose all managed connectors and clear internal state. */
  dispose(): void {
    for (const connector of this.connectors.values()) {
      connector.dispose();
    }
    this.connectors.clear();
    this.updateStore?.(this.connectors);
  }
}
