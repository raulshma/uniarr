import type { IConnector } from '@/connectors/base/IConnector';
import type { ServiceConfig, ServiceType } from '@/models/service.types';

import { SonarrConnector } from '@/connectors/implementations/SonarrConnector';

type ConnectorConstructor<TConnector extends IConnector = IConnector> = new (
  config: ServiceConfig,
) => TConnector;

const connectorRegistry: Partial<Record<ServiceType, ConnectorConstructor>> = {
  // SonarrConnector uses specialized generics for its request payload, so we cast to the
  // generic constructor type expected by the registry.
  sonarr: SonarrConnector as ConnectorConstructor,
};

/** Factory responsible for creating connector instances based on service metadata. */
export class ConnectorFactory {
  /** Instantiate a connector for the provided service configuration. */
  static create(config: ServiceConfig): IConnector {
    const constructor = connectorRegistry[config.type];

    if (!constructor) {
      throw new Error(`Unsupported service type: ${config.type}`);
    }

    return new constructor(config);
  }

  /** Return the list of service types currently supported by the factory. */
  static getSupportedTypes(): ServiceType[] {
    return Object.keys(connectorRegistry).filter((type) => connectorRegistry[type as ServiceType]) as ServiceType[];
  }
}
