import { create } from "zustand";

import type { IConnector } from "@/connectors/base/IConnector";
import type { ServiceType } from "@/models/service.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
// Export shallow equality helper for consumers to use with selectors
export { shallow } from "zustand/shallow";

type ConnectorsState = {
  connectors: Map<string, IConnector>;
  // Cached derived arrays to provide stable references to consumers
  connectorIds: string[];
  allConnectorsArray: IConnector[];
  getConnector: (id: string) => IConnector | undefined;
  getConnectorsByType: (type: ServiceType) => IConnector[];
  getAllConnectors: () => IConnector[];
};

export const useConnectorsStore = create<ConnectorsState>((set, get) => {
  const manager = ConnectorManager.getInstance();

  // Set the update callback to sync the store
  manager.setUpdateStore((connectors) =>
    set(() => {
      const map = new Map(connectors);
      return {
        connectors: map,
        connectorIds: Array.from(map.keys()),
        allConnectorsArray: Array.from(map.values()),
      };
    }),
  );

  // Initialize with current connectors
  const initialConnectors = new Map(
    manager.getAllConnectors().map((c) => [c.config.id, c]),
  );

  return {
    connectors: initialConnectors,
    connectorIds: Array.from(initialConnectors.keys()),
    allConnectorsArray: Array.from(initialConnectors.values()),
    getConnector: (id) => get().connectors.get(id),
    getConnectorsByType: (type) =>
      get().allConnectorsArray.filter((c) => c.config.type === type),
    getAllConnectors: () => get().allConnectorsArray,
  };
});

// ============================================================================
// Granular Selectors - Use these to minimize re-renders
// ============================================================================

/**
 * Selects a single connector by ID
 * Returns undefined if connector doesn't exist
 * Components using this only re-render when the specific connector changes
 */
export const selectConnectorById =
  (id: string) =>
  (state: ConnectorsState): IConnector | undefined =>
    state.connectors.get(id);

/**
 * Selects connectors by type
 * Returns a filtered array of connectors matching the specified type
 * Components using this only re-render when connectors of that type change
 */
export const selectConnectorsByType =
  (type: ServiceType) =>
  (state: ConnectorsState): IConnector[] =>
    state.allConnectorsArray.filter((c) => c.config.type === type);

/**
 * Selects connector configuration by ID
 * Returns only the config object, not the entire connector
 * Useful when only config data is needed
 */
export const selectConnectorConfigById =
  (id: string) => (state: ConnectorsState) =>
    state.connectors.get(id)?.config;

/**
 * Selects multiple connectors by IDs
 * Returns an array of connectors for the specified IDs
 * Filters out any IDs that don't exist
 */
export const selectConnectorsByIds =
  (ids: string[]) =>
  (state: ConnectorsState): IConnector[] =>
    ids.map((id) => state.connectors.get(id)).filter(Boolean) as IConnector[];

/**
 * Selects connector IDs only (stable reference)
 * This is a cached array that only changes when connectors are added/removed
 * Prefer this over reading the entire store when only IDs are needed
 */
export const selectConnectorIds = (state: ConnectorsState): string[] =>
  state.connectorIds;

/**
 * Selects all connectors as an array (stable reference)
 * This is a cached array that only changes when connectors change
 * Prefer this over converting the Map yourself
 */
export const selectAllConnectorsArray = (
  state: ConnectorsState,
): IConnector[] => state.allConnectorsArray;

/**
 * Selects the count of connectors
 * Components using this only re-render when the count changes
 */
export const selectConnectorsCount = (state: ConnectorsState): number =>
  state.connectors.size;

/**
 * Checks if a connector exists by ID
 * Returns boolean, useful for conditional rendering
 */
export const selectHasConnector =
  (id: string) =>
  (state: ConnectorsState): boolean =>
    state.connectors.has(id);

// ============================================================================
// Action Selectors - These never cause re-renders
// ============================================================================

/**
 * Selects connector action functions only
 * These are stable references that never change, so they never cause re-renders
 * Use this when you only need to call actions, not read data
 */
export const selectConnectorActions = (state: ConnectorsState) => ({
  getConnector: state.getConnector,
  getConnectorsByType: state.getConnectorsByType,
  getAllConnectors: state.getAllConnectors,
});

// ============================================================================
// Legacy Selectors - Deprecated, use granular selectors above
// ============================================================================

/**
 * @deprecated Use selectConnectorById or selectAllConnectorsArray instead
 * Reading the entire Map causes re-renders even when unrelated connectors change
 */
export const selectConnectors = (
  state: ConnectorsState,
): Map<string, IConnector> => state.connectors;

/**
 * @deprecated Use selectConnectorActions instead to avoid re-renders
 */
export const selectGetConnector = (state: ConnectorsState) =>
  state.getConnector;

/**
 * @deprecated Use selectConnectorActions instead to avoid re-renders
 */
export const selectGetConnectorsByType = (state: ConnectorsState) =>
  state.getConnectorsByType;

/**
 * @deprecated Use selectConnectorActions instead to avoid re-renders
 */
export const selectGetAllConnectors = (state: ConnectorsState) =>
  state.getAllConnectors;
