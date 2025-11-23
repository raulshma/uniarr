import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { storageAdapter } from "@/services/storage/StorageAdapter";
// Export shallow equality helper for components to use when selecting parts of the store
export { shallow } from "zustand/shallow";

export type ServicesViewMode = "grid" | "list";
export type ServicesSortKey = "name" | "status" | "type";
export type SortDirection = "asc" | "desc";

type ServicesData = {
  activeServiceId: string | null;
  selectedServiceIds: string[];
  viewMode: ServicesViewMode;
  sortKey: ServicesSortKey;
  sortDirection: SortDirection;
};

export interface ServicesState extends ServicesData {
  setActiveServiceId: (serviceId: string | null) => void;
  setSelectedServiceIds: (serviceIds: string[]) => void;
  toggleServiceSelection: (serviceId: string) => void;
  clearSelection: () => void;
  setViewMode: (mode: ServicesViewMode) => void;
  setSort: (key: ServicesSortKey, direction?: SortDirection) => void;
  reset: () => void;
}

const defaultServicesState: ServicesData = {
  activeServiceId: null,
  selectedServiceIds: [],
  viewMode: "grid",
  sortKey: "name",
  sortDirection: "asc",
};

export const useServicesStore = create<ServicesState>()(
  persist(
    (set, get) => ({
      ...defaultServicesState,
      setActiveServiceId: (serviceId) => set({ activeServiceId: serviceId }),
      setSelectedServiceIds: (serviceIds) =>
        set({ selectedServiceIds: Array.from(new Set(serviceIds)) }),
      toggleServiceSelection: (serviceId) => {
        const { selectedServiceIds } = get();
        const selection = new Set(selectedServiceIds);

        if (selection.has(serviceId)) {
          selection.delete(serviceId);
        } else {
          selection.add(serviceId);
        }

        set({ selectedServiceIds: Array.from(selection) });
      },
      clearSelection: () => set({ selectedServiceIds: [] }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSort: (key, direction) => {
        if (direction) {
          set({ sortKey: key, sortDirection: direction });
          return;
        }

        const { sortKey, sortDirection } = get();
        const isSameKey = key === sortKey;
        const nextDirection: SortDirection =
          isSameKey && sortDirection === "asc" ? "desc" : "asc";

        set({ sortKey: key, sortDirection: nextDirection });
      },
      reset: () => set({ ...defaultServicesState }),
    }),
    {
      name: "ServicesStore:v1",
      // Persist view mode, sort preferences, but not transient selection state
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortKey: state.sortKey,
        sortDirection: state.sortDirection,
      }),
      storage: createJSONStorage(() => storageAdapter),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to rehydrate services store:", error);
          return;
        }

        if (state) {
          // Always clear selection on app start (transient state)
          state.selectedServiceIds = [];
          state.activeServiceId = null;
        }
      },
      migrate: (persistedState) => {
        // Migration logic for future versions
        if (!persistedState) {
          return defaultServicesState;
        }

        const partial = persistedState as Partial<ServicesData>;
        return {
          ...defaultServicesState,
          // Only preserve persistent settings
          viewMode: partial.viewMode ?? defaultServicesState.viewMode,
          sortKey: partial.sortKey ?? defaultServicesState.sortKey,
          sortDirection:
            partial.sortDirection ?? defaultServicesState.sortDirection,
        };
      },
    },
  ),
);

// ============================================================================
// Individual Data Selectors - Use these for granular access
// ============================================================================

/**
 * Selects the active service ID only
 * Components using this only re-render when the active service changes
 */
export const selectActiveServiceId = (state: ServicesState): string | null =>
  state.activeServiceId;

/**
 * Selects the selected service IDs array only
 * Components using this only re-render when the selection changes
 */
export const selectSelectedServiceIds = (state: ServicesState): string[] =>
  state.selectedServiceIds;

/**
 * Selects the view mode only
 * Components using this only re-render when the view mode changes
 */
export const selectViewMode = (state: ServicesState): ServicesViewMode =>
  state.viewMode;

/**
 * Selects the sort key only
 * Components using this only re-render when the sort key changes
 */
export const selectSortKey = (state: ServicesState): ServicesSortKey =>
  state.sortKey;

/**
 * Selects the sort direction only
 * Components using this only re-render when the sort direction changes
 */
export const selectSortDirection = (state: ServicesState): SortDirection =>
  state.sortDirection;

/**
 * Selects the count of selected services
 * Components using this only re-render when the selection count changes
 */
export const selectSelectedServiceCount = (state: ServicesState): number =>
  state.selectedServiceIds.length;

/**
 * Checks if a specific service is selected
 * Returns boolean, useful for conditional rendering
 */
export const selectIsServiceSelected =
  (serviceId: string) =>
  (state: ServicesState): boolean =>
    state.selectedServiceIds.includes(serviceId);

/**
 * Checks if any services are selected
 * Returns boolean, useful for conditional rendering
 */
export const selectHasSelection = (state: ServicesState): boolean =>
  state.selectedServiceIds.length > 0;

/**
 * Checks if a specific service is active
 * Returns boolean, useful for conditional rendering
 */
export const selectIsServiceActive =
  (serviceId: string) =>
  (state: ServicesState): boolean =>
    state.activeServiceId === serviceId;

// ============================================================================
// Grouped Data Selectors - Use these when multiple related values are needed
// Use with shallow equality to prevent re-renders
// ============================================================================

/**
 * Selects sort configuration (key and direction)
 * Use with shallow: useServicesStore(selectSortConfig, shallow)
 */
export const selectSortConfig = (state: ServicesState) => ({
  sortKey: state.sortKey,
  sortDirection: state.sortDirection,
});

/**
 * Selects selection state (active and selected IDs)
 * Use with shallow: useServicesStore(selectSelectionState, shallow)
 */
export const selectSelectionState = (state: ServicesState) => ({
  activeServiceId: state.activeServiceId,
  selectedServiceIds: state.selectedServiceIds,
  selectedCount: state.selectedServiceIds.length,
  hasSelection: state.selectedServiceIds.length > 0,
});

/**
 * Selects view configuration (mode and sort)
 * Use with shallow: useServicesStore(selectViewConfig, shallow)
 */
export const selectViewConfig = (state: ServicesState) => ({
  viewMode: state.viewMode,
  sortKey: state.sortKey,
  sortDirection: state.sortDirection,
});

// ============================================================================
// Action Selectors - These never cause re-renders
// Use these when you only need to call actions, not read data
// ============================================================================

/**
 * Selects selection management actions only
 * These are stable references that never change
 */
export const selectSelectionActions = (state: ServicesState) => ({
  setActiveServiceId: state.setActiveServiceId,
  setSelectedServiceIds: state.setSelectedServiceIds,
  toggleServiceSelection: state.toggleServiceSelection,
  clearSelection: state.clearSelection,
});

/**
 * Selects view management actions only
 * These are stable references that never change
 */
export const selectViewActions = (state: ServicesState) => ({
  setViewMode: state.setViewMode,
  setSort: state.setSort,
});

/**
 * Selects all action functions
 * Use this when you need multiple actions
 * These are stable references that never change
 */
export const selectAllActions = (state: ServicesState) => ({
  setActiveServiceId: state.setActiveServiceId,
  setSelectedServiceIds: state.setSelectedServiceIds,
  toggleServiceSelection: state.toggleServiceSelection,
  clearSelection: state.clearSelection,
  setViewMode: state.setViewMode,
  setSort: state.setSort,
  reset: state.reset,
});
