import { create } from "zustand";

export interface WeatherLocationSelection {
  latitude: number;
  longitude: number;
  name: string;
  region: string;
  country: string;
}

interface WeatherLocationStore {
  selectedLocationSearch: WeatherLocationSelection | null;
  selectedLocationMap: WeatherLocationSelection | null;
  setSelectedLocationSearch: (
    location: WeatherLocationSelection | null,
  ) => void;
  setSelectedLocationMap: (location: WeatherLocationSelection | null) => void;
  clearSelections: () => void;
}

export const useWeatherLocationStore = create<WeatherLocationStore>((set) => ({
  selectedLocationSearch: null,
  selectedLocationMap: null,
  setSelectedLocationSearch: (location) =>
    set({ selectedLocationSearch: location }),
  setSelectedLocationMap: (location) => set({ selectedLocationMap: location }),
  clearSelections: () =>
    set({
      selectedLocationSearch: null,
      selectedLocationMap: null,
    }),
}));
