import { create } from 'zustand';

import type { IConnector } from '@/connectors/base/IConnector';
import type { ServiceType } from '@/models/service.types';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';

type ConnectorsState = {
  connectors: Map<string, IConnector>;
  getConnector: (id: string) => IConnector | undefined;
  getConnectorsByType: (type: ServiceType) => IConnector[];
  getAllConnectors: () => IConnector[];
};

export const useConnectorsStore = create<ConnectorsState>((set, get) => {
  const manager = ConnectorManager.getInstance();

  // Set the update callback to sync the store
  manager.setUpdateStore((connectors) => set({ connectors: new Map(connectors) }));

  // Initialize with current connectors
  const initialConnectors = new Map(manager.getAllConnectors().map((c) => [c.config.id, c]));

  return {
    connectors: initialConnectors,
    getConnector: (id) => get().connectors.get(id),
    getConnectorsByType: (type) =>
      Array.from(get().connectors.values()).filter((c) => c.config.type === type),
    getAllConnectors: () => Array.from(get().connectors.values()),
  };
});

export const selectConnectors = (state: ConnectorsState): Map<string, IConnector> => state.connectors;
export const selectGetConnector = (state: ConnectorsState) => state.getConnector;
export const selectGetConnectorsByType = (state: ConnectorsState) => state.getConnectorsByType;
export const selectGetAllConnectors = (state: ConnectorsState) => state.getAllConnectors;