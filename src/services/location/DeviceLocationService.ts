import * as ExpoLocation from "expo-location";

import { logger } from "@/services/logger/LoggerService";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface CachedLocation {
  coords: Coordinates;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class DeviceLocationService {
  private static instance: DeviceLocationService | null = null;

  private cache: CachedLocation | null = null;

  static getInstance(): DeviceLocationService {
    if (!DeviceLocationService.instance) {
      DeviceLocationService.instance = new DeviceLocationService();
    }

    return DeviceLocationService.instance;
  }

  async ensurePermission(): Promise<boolean> {
    try {
      const existing = await ExpoLocation.getForegroundPermissionsAsync();
      if (existing.granted) {
        return true;
      }

      const request = await ExpoLocation.requestForegroundPermissionsAsync();
      return request.granted;
    } catch (error) {
      await logger.warn("DeviceLocationService: permission request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getCurrentLocation(forceRefresh = false): Promise<Coordinates | null> {
    try {
      if (!forceRefresh && this.cache && !this.isCacheExpired()) {
        return this.cache.coords;
      }

      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        return null;
      }

      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.LocationAccuracy.Balanced,
      });

      const coords: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      this.cache = {
        coords,
        timestamp: Date.now(),
      };

      return coords;
    } catch (error) {
      await logger.warn("DeviceLocationService: failed to read location", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  clearCache(): void {
    this.cache = null;
  }

  private isCacheExpired(): boolean {
    if (!this.cache) {
      return true;
    }

    return Date.now() - this.cache.timestamp > CACHE_TTL_MS;
  }
}

export const deviceLocationService = DeviceLocationService.getInstance();
export { DeviceLocationService };
