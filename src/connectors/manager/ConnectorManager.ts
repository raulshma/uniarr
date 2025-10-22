import type {
  ConnectionResult,
  IConnector,
} from "@/connectors/base/IConnector";
import type { ServiceConfig, ServiceType } from "@/models/service.types";
import type { IDownloadConnector } from "@/connectors/base/IDownloadConnector";
import { isDownloadConnector } from "@/connectors/base/IDownloadConnector";

import { ConnectorFactory } from "@/connectors/factory/ConnectorFactory";
import { logger } from "@/services/logger/LoggerService";
import { secureStorage } from "@/services/storage/SecureStorage";
import { ServiceAuthHelper } from "@/services/auth/ServiceAuthHelper";

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
            void logger.error("Failed to load connector from storage.", {
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
    const existing = this.connectors.get(config.id);
    if (existing) {
      existing.dispose();
      this.connectors.delete(config.id);
      ServiceAuthHelper.clearServiceSession(existing.config);
    }

    const connector = ConnectorFactory.create(config);
    this.connectors.set(config.id, connector);
    this.updateStore?.(this.connectors);

    if (options.persist !== false) {
      await secureStorage.saveServiceConfig(config);
    }

    void logger.info("Connector registered.", {
      serviceId: config.id,
      serviceType: config.type,
    });

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
  async removeConnector(
    id: string,
    { persist = true }: AddConnectorOptions = {},
  ): Promise<void> {
    const connector = this.connectors.get(id);

    if (!connector) {
      return;
    }

    ServiceAuthHelper.clearServiceSession(connector.config);
    connector.dispose();
    this.connectors.delete(id);
    this.updateStore?.(this.connectors);

    if (persist) {
      await secureStorage.removeServiceConfig(id);
    }

    void logger.info("Connector removed.", {
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
          void logger.error("Connector test failed with unhandled error.", {
            serviceId: id,
            serviceType: connector.config.type,
            message: error instanceof Error ? error.message : String(error),
          });
          return [
            id,
            { success: false, message: "Unhandled connector error." },
          ] as const;
        }
      }),
    );

    return new Map(results);
  }

  // ==================== DOWNLOAD CONNECTOR METHODS ====================

  /** Get all download-capable connectors */
  getDownloadConnectors(): IDownloadConnector[] {
    return Array.from(this.connectors.values()).filter(
      (connector): connector is IDownloadConnector & IConnector =>
        isDownloadConnector(connector),
    );
  }

  /** Get download connectors by service type */
  getDownloadConnectorsByType(type: ServiceType): IDownloadConnector[] {
    return this.getConnectorsByType(type).filter(
      (connector): connector is IDownloadConnector & IConnector =>
        isDownloadConnector(connector),
    );
  }

  /** Get a specific download connector by ID */
  getDownloadConnector(id: string): IDownloadConnector | undefined {
    const connector = this.getConnector(id);
    return connector && isDownloadConnector(connector) ? connector : undefined;
  }

  /** Check if a service type supports downloads */
  supportsDownloadType(serviceType: ServiceType): boolean {
    const connectors = this.getConnectorsByType(serviceType);
    return connectors.some((connector) => isDownloadConnector(connector));
  }

  /** Get all service types that support downloads */
  getDownloadSupportedServiceTypes(): ServiceType[] {
    const allConnectors = this.getAllConnectors();
    const downloadCapableTypes = new Set<ServiceType>();

    for (const connector of allConnectors) {
      if (isDownloadConnector(connector)) {
        downloadCapableTypes.add(connector.config.type);
      }
    }

    return Array.from(downloadCapableTypes);
  }

  /** Check if any download connectors are available */
  hasDownloadConnectors(): boolean {
    return this.getDownloadConnectors().length > 0;
  }

  /** Get download connector for a specific content ID and service type */
  getDownloadConnectorForContent(
    serviceType: ServiceType,
    contentId: string,
  ): IDownloadConnector | undefined {
    const downloadConnectors = this.getDownloadConnectorsByType(serviceType);

    // For now, return the first available download connector of the specified type
    // In the future, you might want to implement more sophisticated selection logic
    return downloadConnectors[0];
  }

  /** Get statistics about download-capable connectors */
  getDownloadConnectorStats(): {
    totalConnectors: number;
    downloadCapableConnectors: number;
    downloadCapableTypes: ServiceType[];
    connectorsByType: Record<ServiceType, number>;
  } {
    const allConnectors = this.getAllConnectors();
    const downloadConnectors = this.getDownloadConnectors();
    const downloadCapableTypes = this.getDownloadSupportedServiceTypes();

    const connectorsByType: Record<string, number> = {};

    for (const connector of allConnectors) {
      const type = connector.config.type;
      connectorsByType[type] = (connectorsByType[type] || 0) + 1;
    }

    return {
      totalConnectors: allConnectors.length,
      downloadCapableConnectors: downloadConnectors.length,
      downloadCapableTypes,
      connectorsByType: connectorsByType as Record<ServiceType, number>,
    };
  }

  /** Dispose all managed connectors and clear internal state. */
  dispose(): void {
    for (const connector of this.connectors.values()) {
      ServiceAuthHelper.clearServiceSession(connector.config);
      connector.dispose();
    }
    this.connectors.clear();
    this.updateStore?.(this.connectors);
  }
}
