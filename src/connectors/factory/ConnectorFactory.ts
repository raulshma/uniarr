import type { IConnector } from '@/connectors/base/IConnector';
import type { ServiceConfig, ServiceType } from '@/models/service.types';

import { SonarrConnector } from '@/connectors/implementations/SonarrConnector';
import { RadarrConnector } from '@/connectors/implementations/RadarrConnector';
import { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { QBittorrentConnector } from '@/connectors/implementations/QBittorrentConnector';
import { TransmissionConnector } from '@/connectors/implementations/TransmissionConnector';
import { DelugeConnector } from '@/connectors/implementations/DelugeConnector';
import { SABnzbdConnector } from '@/connectors/implementations/SABnzbdConnector';
import { ProwlarrConnector } from '@/connectors/implementations/ProwlarrConnector';
import { BazarrConnector } from '@/connectors/implementations/BazarrConnector';

type ConnectorConstructor<TConnector extends IConnector = IConnector> = new (
  config: ServiceConfig,
) => TConnector;

const connectorRegistry: Partial<Record<ServiceType, ConnectorConstructor>> = {
  // SonarrConnector uses specialized generics for its request payload, so we cast to the
  // generic constructor type expected by the registry.
  sonarr: SonarrConnector as ConnectorConstructor,
  radarr: RadarrConnector as ConnectorConstructor,
  jellyseerr: JellyseerrConnector as ConnectorConstructor,
  jellyfin: JellyfinConnector as ConnectorConstructor,
  qbittorrent: QBittorrentConnector as ConnectorConstructor,
  transmission: TransmissionConnector as ConnectorConstructor,
  deluge: DelugeConnector as ConnectorConstructor,
  sabnzbd: SABnzbdConnector as ConnectorConstructor,
  prowlarr: ProwlarrConnector as ConnectorConstructor,
  bazarr: BazarrConnector as ConnectorConstructor,
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
