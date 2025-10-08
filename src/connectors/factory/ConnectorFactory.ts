import type { IConnector } from '@/connectors/base/IConnector';
import type { ServiceConfig, ServiceType } from '@/models/service.types';

import { SonarrConnector } from '@/connectors/implementations/SonarrConnector';
import { RadarrConnector } from '@/connectors/implementations/RadarrConnector';
import { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { QBittorrentConnector } from '@/connectors/implementations/QBittorrentConnector';
import { ProwlarrConnector } from '@/connectors/implementations/ProwlarrConnector';

type ConnectorConstructor<TConnector extends IConnector = IConnector> = new (
  config: ServiceConfig,
) => TConnector;

const connectorRegistry: Partial<Record<ServiceType, ConnectorConstructor>> = {
  // SonarrConnector uses specialized generics for its request payload, so we cast to the
  // generic constructor type expected by the registry.
  sonarr: SonarrConnector as ConnectorConstructor,
  radarr: RadarrConnector as ConnectorConstructor,
  jellyseerr: JellyseerrConnector as ConnectorConstructor,
  qbittorrent: QBittorrentConnector as ConnectorConstructor,
  prowlarr: ProwlarrConnector as ConnectorConstructor,
};

/** Factory responsible for creating connector instances based on service metadata. */
export class ConnectorFactory {
  /** Instantiate a connector for the provided service configuration. */
  static create(config: ServiceConfig): IConnector {
    console.log('🏭 [ConnectorFactory] Creating connector for type:', config.type);
    const constructor = connectorRegistry[config.type];

    if (!constructor) {
      console.error('🏭 [ConnectorFactory] Unsupported service type:', config.type);
      throw new Error(`Unsupported service type: ${config.type}`);
    }

    console.log('🏭 [ConnectorFactory] Constructor found, creating instance...');
    const connector = new constructor(config);
    console.log('🏭 [ConnectorFactory] Connector instance created');
    return connector;
  }

  /** Return the list of service types currently supported by the factory. */
  static getSupportedTypes(): ServiceType[] {
    return Object.keys(connectorRegistry).filter((type) => connectorRegistry[type as ServiceType]) as ServiceType[];
  }
}
