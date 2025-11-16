import * as SecureStore from "expo-secure-store";

import { logger } from "@/services/logger/LoggerService";
import { type ServiceConfig } from "@/models/service.types";
import { type S3Credentials } from "@/models/s3.types";
import { storageAdapter } from "./StorageAdapter";

const INDEX_KEY = "SecureStorage_index";
const SERVICE_KEY_PREFIX = "SecureStorage_service_";
const SCAN_HISTORY_KEY = "SecureStorage_scan_history";
const RECENT_IPS_KEY = "SecureStorage_recent_ips";
const S3_ACCESS_KEY_ID = "SecureStorage_s3_access_key_id";
const S3_SECRET_ACCESS_KEY = "SecureStorage_s3_secret_access_key";

export interface NetworkScanHistoryType {
  id: string;
  timestamp: string;
  duration: number;
  scannedHosts: number;
  servicesFound: number;
  subnet: string;
  customIp?: string;
  services: {
    type: string;
    name: string;
    url: string;
    port: number;
    version?: string;
    requiresAuth?: boolean;
  }[];
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
    await this.ensureInitialized();

    const now = new Date();
    const existing = this.cache.get(config.id);

    const normalized: ServiceConfig = {
      ...config,
      createdAt: existing?.createdAt ?? config.createdAt ?? now,
      updatedAt: now,
    };

    this.cache.set(normalized.id, normalized);
    await this.persistConfig(normalized);
    await this.persistIndex();
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
    const configKey = `${this.getServiceKey(id)}_config`;
    const credsKey = `${this.getServiceKey(id)}_creds`;
    await Promise.all([
      storageAdapter.removeItem(configKey),
      SecureStore.deleteItemAsync(credsKey).catch(() => {}), // Ignore if not exists
    ]);
    await this.persistIndex();
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    const ids = Array.from(this.cache.keys());
    await Promise.all(
      ids.flatMap((id) => [
        storageAdapter.removeItem(`${this.getServiceKey(id)}_config`),
        SecureStore.deleteItemAsync(`${this.getServiceKey(id)}_creds`).catch(
          () => {},
        ),
      ]),
    );
    await SecureStore.deleteItemAsync(INDEX_KEY);
    this.cache.clear();
  }

  async saveNetworkScanHistory(history: NetworkScanHistoryType): Promise<void> {
    try {
      const existingHistory = await this.getNetworkScanHistory();
      const updatedHistory = [history, ...existingHistory.slice(0, 19)]; // Keep only last 20 scans

      await SecureStore.setItemAsync(
        SCAN_HISTORY_KEY,
        JSON.stringify(updatedHistory),
      );
    } catch (error) {
      await logger.error("Failed to save network scan history.", {
        location: "SecureStorage.saveNetworkScanHistory",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getNetworkScanHistory(): Promise<NetworkScanHistoryType[]> {
    try {
      const serialized = await SecureStore.getItemAsync(SCAN_HISTORY_KEY);
      if (!serialized) {
        return [];
      }

      return JSON.parse(serialized) as NetworkScanHistoryType[];
    } catch (error) {
      await logger.error("Failed to read network scan history.", {
        location: "SecureStorage.getNetworkScanHistory",
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async addRecentIP(
    ip: string,
    subnet?: string,
    servicesFound?: number,
  ): Promise<void> {
    try {
      const recentIPs = await this.getRecentIPs();
      const existingIndex = recentIPs.findIndex((r) => r.ip === ip);

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

      await SecureStore.setItemAsync(
        RECENT_IPS_KEY,
        JSON.stringify(updatedIPs),
      );
    } catch (error) {
      await logger.error("Failed to add recent IP.", {
        location: "SecureStorage.addRecentIP",
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
      await logger.error("Failed to read recent IPs.", {
        location: "SecureStorage.getRecentIPs",
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async clearNetworkScanHistory(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SCAN_HISTORY_KEY);
    } catch (error) {
      await logger.error("Failed to clear network scan history.", {
        location: "SecureStorage.clearNetworkScanHistory",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async clearRecentIPs(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(RECENT_IPS_KEY);
    } catch (error) {
      await logger.error("Failed to clear recent IPs.", {
        location: "SecureStorage.clearRecentIPs",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save S3 credentials to secure storage
   * @param credentials - AWS S3 credentials (Access Key ID and Secret Access Key)
   */
  async saveS3Credentials(credentials: S3Credentials): Promise<void> {
    try {
      await SecureStore.setItemAsync(S3_ACCESS_KEY_ID, credentials.accessKeyId);
      await SecureStore.setItemAsync(
        S3_SECRET_ACCESS_KEY,
        credentials.secretAccessKey,
      );

      await logger.info("S3 credentials saved successfully.", {
        location: "SecureStorage.saveS3Credentials",
      });
    } catch (error) {
      await logger.error("Failed to save S3 credentials.", {
        location: "SecureStorage.saveS3Credentials",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retrieve S3 credentials from secure storage
   * @returns S3 credentials or null if not found
   */
  async getS3Credentials(): Promise<S3Credentials | null> {
    try {
      const accessKeyId = await SecureStore.getItemAsync(S3_ACCESS_KEY_ID);
      const secretAccessKey =
        await SecureStore.getItemAsync(S3_SECRET_ACCESS_KEY);

      if (!accessKeyId || !secretAccessKey) {
        return null;
      }

      return {
        accessKeyId,
        secretAccessKey,
      };
    } catch (error) {
      await logger.error("Failed to retrieve S3 credentials.", {
        location: "SecureStorage.getS3Credentials",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Delete S3 credentials from secure storage
   */
  async deleteS3Credentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(S3_ACCESS_KEY_ID);
      await SecureStore.deleteItemAsync(S3_SECRET_ACCESS_KEY);

      await logger.info("S3 credentials deleted successfully.", {
        location: "SecureStorage.deleteS3Credentials",
      });
    } catch (error) {
      await logger.error("Failed to delete S3 credentials.", {
        location: "SecureStorage.deleteS3Credentials",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      await logger.error("Failed to get item from secure storage.", {
        location: "SecureStorage.getItem",
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      await logger.error("Failed to set item in secure storage.", {
        location: "SecureStorage.setItem",
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      await logger.error("Failed to remove item from secure storage.", {
        location: "SecureStorage.removeItem",
        key,
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
      await logger.error("Failed to read SecureStorage index.", {
        location: "SecureStorage.readIndex",
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
      await logger.error("Failed to persist SecureStorage index.", {
        location: "SecureStorage.persistIndex",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistConfig(config: ServiceConfig): Promise<void> {
    try {
      // Non-sensitive config parts (large, non-secret)
      const nonSensitive: Omit<
        ServiceConfig,
        "apiKey" | "username" | "password" | "createdAt" | "updatedAt"
      > & {
        createdAt: string;
        updatedAt: string;
      } = {
        id: config.id,
        type: config.type,
        name: config.name,
        url: config.url,
        enabled: config.enabled,
        proxyUrl: config.proxyUrl,
        timeout: config.timeout,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      };
      const nonSensitiveKey = `${this.getServiceKey(config.id)}_config`;
      await storageAdapter.setItem(
        nonSensitiveKey,
        JSON.stringify(nonSensitive),
      );

      // Sensitive fields only (small, secret-protected)
      const sensitive: Partial<
        Pick<ServiceConfig, "apiKey" | "username" | "password">
      > = {};
      if (config.apiKey !== undefined) sensitive.apiKey = config.apiKey;
      if (config.username !== undefined) sensitive.username = config.username;
      if (config.password !== undefined) sensitive.password = config.password;
      const sensitiveSerialized = JSON.stringify(sensitive);
      const sensitiveKey = `${this.getServiceKey(config.id)}_creds`;
      await SecureStore.setItemAsync(sensitiveKey, sensitiveSerialized);

      if (sensitiveSerialized.length > 1800) {
        await logger.warn("Large sensitive config stored in SecureStore", {
          location: "SecureStorage.persistConfig",
          serviceId: config.id,
          size: sensitiveSerialized.length,
        });
      }
    } catch (error) {
      await logger.error("Failed to persist service config.", {
        location: "SecureStorage.persistConfig",
        serviceId: config.id,
        serviceType: config.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readConfig(id: string): Promise<ServiceConfig | null> {
    try {
      const configKey = `${this.getServiceKey(id)}_config`;
      const credsKey = `${this.getServiceKey(id)}_creds`;

      const configStr = await storageAdapter.getItem(configKey);
      if (!configStr) {
        return null;
      }

      const nonSensitive = JSON.parse(configStr) as Omit<
        ServiceConfig,
        "apiKey" | "username" | "password" | "createdAt" | "updatedAt"
      > & {
        createdAt: string;
        updatedAt: string;
      };

      const credsStr = await SecureStore.getItemAsync(credsKey);
      const sensitive: Partial<
        Pick<ServiceConfig, "apiKey" | "username" | "password">
      > = {};
      if (credsStr) {
        const parsed = JSON.parse(credsStr);
        if (parsed.apiKey !== undefined && parsed.apiKey !== null)
          sensitive.apiKey = parsed.apiKey;
        if (parsed.username !== undefined && parsed.username !== null)
          sensitive.username = parsed.username;
        if (parsed.password !== undefined && parsed.password !== null)
          sensitive.password = parsed.password;
      }

      const config: ServiceConfig = {
        ...nonSensitive,
        ...sensitive,
        createdAt: new Date(nonSensitive.createdAt),
        updatedAt: new Date(nonSensitive.updatedAt),
      };

      return config;
    } catch (error) {
      await logger.warn("Failed to read service config from storage.", {
        location: "SecureStorage.readConfig",
        serviceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private getServiceKey(id: string): string {
    return `${SERVICE_KEY_PREFIX}${id}`;
  }
}

export const secureStorage = SecureStorage.getInstance();
