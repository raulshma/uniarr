import { create } from "zustand";
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

export const useServicesStore = create<ServicesState>((set, get) => ({
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
}));

export const selectActiveServiceId = (state: ServicesState): string | null =>
  state.activeServiceId;
export const selectSelectedServiceIds = (state: ServicesState): string[] =>
  state.selectedServiceIds;
export const selectViewMode = (state: ServicesState): ServicesViewMode =>
  state.viewMode;
export const selectSortKey = (state: ServicesState): ServicesSortKey =>
  state.sortKey;
export const selectSortDirection = (state: ServicesState): SortDirection =>
  state.sortDirection;
