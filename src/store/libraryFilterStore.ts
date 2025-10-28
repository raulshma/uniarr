import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export { shallow } from "zustand/shallow";

/**
 * Filter criteria for Sonarr/Radarr library views
 */
export interface LibraryFilters {
  tags: number[];
  qualityProfileId?: number;
  monitored?: boolean; // undefined = all, true = monitored only, false = unmonitored only
}

/**
 * Metadata about available filter options
 */
export interface FilterMetadata {
  tags: { id: number; label: string }[];
  qualityProfiles: { id: number; name: string }[];
}

/**
 * Per-service filter state
 */
interface ServiceFilterState {
  filters: LibraryFilters;
  metadata?: FilterMetadata;
}

interface LibraryFilterState {
  // Map of serviceId -> filter state
  serviceFilters: Record<string, ServiceFilterState>;

  // Actions
  setFilters: (serviceId: string, filters: Partial<LibraryFilters>) => void;
  resetFilters: (serviceId: string) => void;
  setMetadata: (serviceId: string, metadata: FilterMetadata) => void;
  getFilters: (serviceId: string) => LibraryFilters;
  getMetadata: (serviceId: string) => FilterMetadata | undefined;
  clearService: (serviceId: string) => void;
  _hasHydrated: boolean;
}

const STORAGE_KEY = "LibraryFilterStore:v1";

const createDefaultFilters = (): LibraryFilters => ({
  tags: [],
  qualityProfileId: undefined,
  monitored: undefined,
});

const createDefaultServiceState = (): ServiceFilterState => ({
  filters: createDefaultFilters(),
  metadata: undefined,
});

export const useLibraryFilterStore = create<LibraryFilterState>()(
  persist(
    (set, get) => ({
      serviceFilters: {},
      _hasHydrated: false,

      setFilters: (serviceId: string, filters: Partial<LibraryFilters>) =>
        set((state) => {
          const currentState =
            state.serviceFilters[serviceId] ?? createDefaultServiceState();

          return {
            serviceFilters: {
              ...state.serviceFilters,
              [serviceId]: {
                ...currentState,
                filters: {
                  ...currentState.filters,
                  ...filters,
                },
              },
            },
          };
        }),

      resetFilters: (serviceId: string) =>
        set((state) => {
          const currentState = state.serviceFilters[serviceId];
          if (!currentState) return state;

          return {
            serviceFilters: {
              ...state.serviceFilters,
              [serviceId]: {
                ...currentState,
                filters: createDefaultFilters(),
              },
            },
          };
        }),

      setMetadata: (serviceId: string, metadata: FilterMetadata) =>
        set((state) => {
          const currentState =
            state.serviceFilters[serviceId] ?? createDefaultServiceState();

          return {
            serviceFilters: {
              ...state.serviceFilters,
              [serviceId]: {
                ...currentState,
                metadata,
              },
            },
          };
        }),

      getFilters: (serviceId: string) => {
        const state = get().serviceFilters[serviceId];
        return state?.filters ?? createDefaultFilters();
      },

      getMetadata: (serviceId: string) => {
        return get().serviceFilters[serviceId]?.metadata;
      },

      clearService: (serviceId: string) =>
        set((state) => {
          const { [serviceId]: _, ...rest } = state.serviceFilters;
          return { serviceFilters: rest };
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        serviceFilters: state.serviceFilters,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
        }
      },
    },
  ),
);

// Selectors
export const selectServiceFilters =
  (serviceId: string) => (state: LibraryFilterState) =>
    state.serviceFilters[serviceId]?.filters ?? createDefaultFilters();

export const selectServiceMetadata =
  (serviceId: string) => (state: LibraryFilterState) =>
    state.serviceFilters[serviceId]?.metadata;

export const selectHasActiveFilters =
  (serviceId: string) =>
  (state: LibraryFilterState): boolean => {
    const filters = state.serviceFilters[serviceId]?.filters;
    if (!filters) return false;

    return (
      filters.tags.length > 0 ||
      filters.qualityProfileId !== undefined ||
      filters.monitored !== undefined
    );
  };
