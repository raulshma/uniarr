import type { IConnector } from "@/connectors/base/IConnector";
import type { ServiceConfig, ServiceType } from "@/models/service.types";

import { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { QBittorrentConnector } from "@/connectors/implementations/QBittorrentConnector";
import { TransmissionConnector } from "@/connectors/implementations/TransmissionConnector";
import { DelugeConnector } from "@/connectors/implementations/DelugeConnector";
import { SABnzbdConnector } from "@/connectors/implementations/SABnzbdConnector";
import { ProwlarrConnector } from "@/connectors/implementations/ProwlarrConnector";
import { BazarrConnector } from "@/connectors/implementations/BazarrConnector";
import { logger } from "@/services/logger/LoggerService";

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
    logger.debug("[ConnectorFactory] Creating connector for type", {
      serviceType: config.type,
    });
    const constructor = connectorRegistry[config.type];

    if (!constructor) {
      logger.error("[ConnectorFactory] Unsupported service type", {
        serviceType: config.type,
      });
      throw new Error(`Unsupported service type: ${config.type}`);
    }

    logger.debug("[ConnectorFactory] Constructor found, creating instance", {
      serviceType: config.type,
    });
    const connector = new constructor(config);
    logger.debug("[ConnectorFactory] Connector instance created", {
      serviceId: config.id,
      serviceType: config.type,
    });
    return connector;
  }

  /** Return the list of service types currently supported by the factory. */
  static getSupportedTypes(): ServiceType[] {
    return Object.keys(connectorRegistry).filter(
      (type) => connectorRegistry[type as ServiceType],
    ) as ServiceType[];
  }
}
