import * as SecureStore from 'expo-secure-store';

import { logger } from '@/services/logger/LoggerService';
import { type ServiceConfig } from '@/models/service.types';

const INDEX_KEY = 'SecureStorage_index';
const SERVICE_KEY_PREFIX = 'SecureStorage_service_';
const SCAN_HISTORY_KEY = 'SecureStorage_scan_history';
const RECENT_IPS_KEY = 'SecureStorage_recent_ips';

type StoredServiceConfig = Omit<ServiceConfig, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export interface NetworkScanHistory {
  id: string;
  timestamp: string;
  duration: number;
  scannedHosts: number;
  servicesFound: number;
  subnet: string;
  customIp?: string;
  services: Array<{
    type: string;
    name: string;
    url: string;
    port: number;
    version?: string;
    requiresAuth?: boolean;
  }>;
}

export interface RecentIP {
  ip: string;
  timestamp: string;
  subnet?: string;
  servicesFound?: number;
}

class SecureStorage {
  private static instance: SecureStorage | null = null;

  private isInitialized = false;

  private readonly cache = new Map<string, ServiceConfig>();

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }

    return SecureStorage.instance;
  }

  async saveServiceConfig(config: ServiceConfig): Promise<void> {
    console.log('💾 [SecureStorage] Saving service config:', config.type, config.id);
    await this.ensureInitialized();

    const now = new Date();
    const existing = this.cache.get(config.id);

    const normalized: ServiceConfig = {
      ...config,
      createdAt: existing?.createdAt ?? config.createdAt ?? now,
      updatedAt: now,
    };

    console.log('💾 [SecureStorage] Normalized config:', normalized);
    this.cache.set(normalized.id, normalized);
    console.log('💾 [SecureStorage] Config added to cache, persisting...');
    await this.persistConfig(normalized);
    console.log('💾 [SecureStorage] Config persisted, updating index...');
    await this.persistIndex();
    console.log('💾 [SecureStorage] Service config saved successfully');
  }

  async getServiceConfigs(): Promise<ServiceConfig[]> {
    await this.ensureInitialized();

    return Array.from(this.cache.values()).sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }

  async getServiceConfig(id: string): Promise<ServiceConfig | undefined> {
    await this.ensureInitialized();
    return this.cache.get(id);
  }

  async removeServiceConfig(id: string): Promise<void> {
    await this.ensureInitialized();

    this.cache.delete(id);
    await SecureStore.deleteItemAsync(this.getServiceKey(id));
    await this.persistIndex();
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    const ids = Array.from(this.cache.keys());
    await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(this.getServiceKey(id))));
    await SecureStore.deleteItemAsync(INDEX_KEY);
    this.cache.clear();
  }

  async saveNetworkScanHistory(history: NetworkScanHistory): Promise<void> {
    try {
      const existingHistory = await this.getNetworkScanHistory();
      const updatedHistory = [history, ...existingHistory.slice(0, 19)]; // Keep only last 20 scans

      await SecureStore.setItemAsync(SCAN_HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      await logger.error('Failed to save network scan history.', {
        location: 'SecureStorage.saveNetworkScanHistory',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getNetworkScanHistory(): Promise<NetworkScanHistory[]> {
    try {
      const serialized = await SecureStore.getItemAsync(SCAN_HISTORY_KEY);
      if (!serialized) {
        return [];
      }

      return JSON.parse(serialized) as NetworkScanHistory[];
    } catch (error) {
      await logger.error('Failed to read network scan history.', {
        location: 'SecureStorage.getNetworkScanHistory',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async addRecentIP(ip: string, subnet?: string, servicesFound?: number): Promise<void> {
    try {
      const recentIPs = await this.getRecentIPs();
      const existingIndex = recentIPs.findIndex(r => r.ip === ip);

      const recentIP: RecentIP = {
        ip,
        timestamp: new Date().toISOString(),
        subnet,
        servicesFound,
      };

      if (existingIndex >= 0) {
        recentIPs[existingIndex] = recentIP;
      } else {
        recentIPs.unshift(recentIP);
      }

      // Keep only last 10 recent IPs
      const updatedIPs = recentIPs.slice(0, 10);

      await SecureStore.setItemAsync(RECENT_IPS_KEY, JSON.stringify(updatedIPs));
    } catch (error) {
      await logger.error('Failed to add recent IP.', {
        location: 'SecureStorage.addRecentIP',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getRecentIPs(): Promise<RecentIP[]> {
    try {
      const serialized = await SecureStore.getItemAsync(RECENT_IPS_KEY);
      if (!serialized) {
        return [];
      }

      return JSON.parse(serialized) as RecentIP[];
    } catch (error) {
      await logger.error('Failed to read recent IPs.', {
        location: 'SecureStorage.getRecentIPs',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async clearNetworkScanHistory(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SCAN_HISTORY_KEY);
    } catch (error) {
      await logger.error('Failed to clear network scan history.', {
        location: 'SecureStorage.clearNetworkScanHistory',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async clearRecentIPs(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(RECENT_IPS_KEY);
    } catch (error) {
      await logger.error('Failed to clear recent IPs.', {
        location: 'SecureStorage.clearRecentIPs',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const ids = await this.readIndex();

    await Promise.all(
      ids.map(async (id) => {
        const config = await this.readConfig(id);
        if (config) {
          this.cache.set(id, config);
        }
      }),
    );

    this.isInitialized = true;
  }

  private async readIndex(): Promise<string[]> {
    try {
      const serialized = await SecureStore.getItemAsync(INDEX_KEY);
      if (!serialized) {
        return [];
      }

      const parsed = JSON.parse(serialized) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      await logger.error('Failed to read SecureStorage index.', {
        location: 'SecureStorage.readIndex',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async persistIndex(): Promise<void> {
    try {
      const ids = Array.from(this.cache.keys());
      await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
    } catch (error) {
      await logger.error('Failed to persist SecureStorage index.', {
        location: 'SecureStorage.persistIndex',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistConfig(config: ServiceConfig): Promise<void> {
    try {
      const serialized = JSON.stringify(this.serializeConfig(config));
      await SecureStore.setItemAsync(this.getServiceKey(config.id), serialized);
    } catch (error) {
      await logger.error('Failed to persist service config.', {
        location: 'SecureStorage.persistConfig',
        serviceId: config.id,
        serviceType: config.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readConfig(id: string): Promise<ServiceConfig | null> {
    try {
      const serialized = await SecureStore.getItemAsync(this.getServiceKey(id));
      if (!serialized) {
        return null;
      }

      const parsed = JSON.parse(serialized) as StoredServiceConfig;
      return this.deserializeConfig(parsed);
    } catch (error) {
      await logger.warn('Failed to read service config from secure storage.', {
        location: 'SecureStorage.readConfig',
        serviceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private serializeConfig(config: ServiceConfig): StoredServiceConfig {
    return {
      ...config,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private deserializeConfig(config: StoredServiceConfig): ServiceConfig {
    return {
      ...config,
      createdAt: new Date(config.createdAt),
      updatedAt: new Date(config.updatedAt),
    };
  }

  private getServiceKey(id: string): string {
    return `${SERVICE_KEY_PREFIX}${id}`;
  }
}

export const secureStorage = SecureStorage.getInstance();