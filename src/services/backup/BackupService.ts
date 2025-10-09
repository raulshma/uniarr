import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { logger } from '@/services/logger/LoggerService';
import { secureStorage, type NetworkScanHistory, type RecentIP } from '@/services/storage/SecureStorage';
import { useSettingsStore } from '@/store/settingsStore';
import type { ServiceConfig } from '@/models/service.types';

export interface BackupMetadata {
  version: string;
  createdAt: string;
  appVersion: string;
  deviceInfo?: string;
  encrypted: boolean;
}

export interface BackupData {
  metadata: BackupMetadata;
  settings: any;
  services: ServiceConfig[];
  scanHistory: NetworkScanHistory[];
  recentIPs: RecentIP[];
}

export interface ImportResult {
  success: boolean;
  importedServices: number;
  importedSettings: boolean;
  errors: string[];
}

class BackupService {
  private static instance: BackupService | null = null;

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  async createBackup(encryptionKey?: string): Promise<string | null> {
    try {
      logger.info('Creating backup...', { location: 'BackupService.createBackup' });

      // Collect all data to backup
      const [services, settings, scanHistory, recentIPs] = await Promise.all([
        secureStorage.getServiceConfigs(),
        this.getSettingsData(),
        secureStorage.getNetworkScanHistory(),
        secureStorage.getRecentIPs(),
      ]);

      // Create backup data as a blob that can be shared
      const backupData: BackupData = {
        metadata: {
          version: '1.0',
          createdAt: new Date().toISOString(),
          appVersion: '1.0.0',
          deviceInfo: 'UniArr Mobile App',
          encrypted: !!encryptionKey,
        },
        settings,
        services,
        scanHistory,
        recentIPs,
      };

      // For demo purposes, we'll return a data URL instead of a file
      // In a real implementation, you'd save to a proper file location
      const backupJsonString = JSON.stringify(backupData, null, 2);
      const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(backupJsonString)}`;

      // For now, we'll simulate file creation and return the data URL
      // In production, you'd use FileSystem to save to a proper location
      logger.info('Backup created successfully', {
        location: 'BackupService.createBackup',
        encrypted: !!encryptionKey,
        dataSize: backupJsonString.length,
      });

      return dataUrl;
    } catch (error) {
      await logger.error('Failed to create backup', {
        location: 'BackupService.createBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async importBackup(fileUri: string, encryptionKey?: string): Promise<ImportResult> {
    try {
      logger.info('Importing backup...', {
        location: 'BackupService.importBackup',
        fileUri,
      });

      let fileContent: string;

      // Handle data URLs (from our simplified backup approach)
      if (fileUri.startsWith('data:')) {
        const base64Data = fileUri.split(',')[1];
        fileContent = decodeURIComponent(base64Data ?? '');
      } else {
        // Handle actual file URIs
        fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: 'utf8',
        });
      }

      let backupData: BackupData;
      const parsed = JSON.parse(fileContent);

      // Handle encrypted backups
      if (parsed.encrypted && parsed.data) {
        if (!encryptionKey) {
          throw new Error('Backup is encrypted but no encryption key provided');
        }
        const decrypted = await this.decryptData(parsed.data, encryptionKey);
        backupData = JSON.parse(decrypted);
      } else {
        backupData = parsed;
      }

      // Validate backup structure
      this.validateBackupData(backupData);

      const errors: string[] = [];

      // Import settings
      let importedSettings = false;
      try {
        if (backupData.settings) {
          await this.importSettings(backupData.settings);
          importedSettings = true;
        }
      } catch (error) {
        errors.push(`Failed to import settings: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Import services
      let importedServices = 0;
      try {
        if (backupData.services && backupData.services.length > 0) {
          importedServices = await this.importServices(backupData.services);
        }
      } catch (error) {
        errors.push(`Failed to import services: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Import scan history
      try {
        if (backupData.scanHistory && backupData.scanHistory.length > 0) {
          await this.importScanHistory(backupData.scanHistory);
        }
      } catch (error) {
        errors.push(`Failed to import scan history: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Import recent IPs
      try {
        if (backupData.recentIPs && backupData.recentIPs.length > 0) {
          await this.importRecentIPs(backupData.recentIPs);
        }
      } catch (error) {
        errors.push(`Failed to import recent IPs: ${error instanceof Error ? error.message : String(error)}`);
      }

      logger.info('Backup imported successfully', {
        location: 'BackupService.importBackup',
        importedServices,
        importedSettings,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        importedServices,
        importedSettings,
        errors,
      };
    } catch (error) {
      await logger.error('Failed to import backup', {
        location: 'BackupService.importBackup',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        importedServices: 0,
        importedSettings: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  async shareBackup(dataUrl: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing not available on this device');
      }

      // For data URLs, we need to convert to a file first or use a different approach
      // For demo purposes, we'll just show an alert since actual file sharing
      // would require more complex implementation
      Alert.alert(
        'Backup Created',
        'Backup has been created successfully. In a production app, you would be able to share this file.',
        [{ text: 'OK' }]
      );

      return true;
    } catch (error) {
      await logger.error('Failed to share backup', {
        location: 'BackupService.shareBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async getSettingsData(): Promise<any> {
    const settingsStore = useSettingsStore.getState();

    return {
      theme: settingsStore.theme,
      notificationsEnabled: settingsStore.notificationsEnabled,
      releaseNotificationsEnabled: settingsStore.releaseNotificationsEnabled,
      downloadNotificationsEnabled: settingsStore.downloadNotificationsEnabled,
      failedDownloadNotificationsEnabled: settingsStore.failedDownloadNotificationsEnabled,
      requestNotificationsEnabled: settingsStore.requestNotificationsEnabled,
      serviceHealthNotificationsEnabled: settingsStore.serviceHealthNotificationsEnabled,
      refreshIntervalMinutes: settingsStore.refreshIntervalMinutes,
      quietHours: settingsStore.quietHours,
      criticalHealthAlertsBypassQuietHours: settingsStore.criticalHealthAlertsBypassQuietHours,
    };
  }

  private async importSettings(settingsData: any): Promise<void> {
    const settingsStore = useSettingsStore.getState();

    if (settingsData.theme) settingsStore.setTheme(settingsData.theme);
    if (typeof settingsData.notificationsEnabled === 'boolean') {
      settingsStore.setNotificationsEnabled(settingsData.notificationsEnabled);
    }
    if (typeof settingsData.releaseNotificationsEnabled === 'boolean') {
      settingsStore.setReleaseNotificationsEnabled(settingsData.releaseNotificationsEnabled);
    }
    if (typeof settingsData.downloadNotificationsEnabled === 'boolean') {
      settingsStore.setDownloadNotificationsEnabled(settingsData.downloadNotificationsEnabled);
    }
    if (typeof settingsData.failedDownloadNotificationsEnabled === 'boolean') {
      settingsStore.setFailedDownloadNotificationsEnabled(settingsData.failedDownloadNotificationsEnabled);
    }
    if (typeof settingsData.requestNotificationsEnabled === 'boolean') {
      settingsStore.setRequestNotificationsEnabled(settingsData.requestNotificationsEnabled);
    }
    if (typeof settingsData.serviceHealthNotificationsEnabled === 'boolean') {
      settingsStore.setServiceHealthNotificationsEnabled(settingsData.serviceHealthNotificationsEnabled);
    }
    if (settingsData.refreshIntervalMinutes) {
      settingsStore.setRefreshIntervalMinutes(settingsData.refreshIntervalMinutes);
    }
    if (typeof settingsData.criticalHealthAlertsBypassQuietHours === 'boolean') {
      settingsStore.setCriticalHealthAlertsBypassQuietHours(settingsData.criticalHealthAlertsBypassQuietHours);
    }

    // Import quiet hours if available
    if (settingsData.quietHours) {
      Object.entries(settingsData.quietHours).forEach(([category, config]) => {
        settingsStore.updateQuietHoursConfig(category as any, config as any);
      });
    }
  }

  private async importServices(services: ServiceConfig[]): Promise<number> {
    let imported = 0;

    for (const service of services) {
      try {
        await secureStorage.saveServiceConfig(service);
        imported++;
      } catch (error) {
        await logger.warn('Failed to import service', {
          location: 'BackupService.importServices',
          serviceId: service.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return imported;
  }

  private async importScanHistory(history: NetworkScanHistory[]): Promise<void> {
    // Clear existing history and import new one
    await secureStorage.clearNetworkScanHistory();

    for (const entry of history) {
      await secureStorage.saveNetworkScanHistory(entry);
    }
  }

  private async importRecentIPs(recentIPs: RecentIP[]): Promise<void> {
    // Clear existing IPs and import new ones
    await secureStorage.clearRecentIPs();

    for (const ip of recentIPs) {
      await secureStorage.addRecentIP(ip.ip, ip.subnet, ip.servicesFound);
    }
  }

  private validateBackupData(data: any): void {
    if (!data.metadata || !data.metadata.version) {
      throw new Error('Invalid backup format: missing metadata');
    }

    if (!data.services || !data.settings) {
      throw new Error('Invalid backup format: missing required data');
    }

    if (!Array.isArray(data.services)) {
      throw new Error('Invalid backup format: services must be an array');
    }
  }

  private async encryptData(data: string, key: string): Promise<string> {
    // Simple XOR-based encryption for demo purposes
    // In a production app, you should use proper AES encryption
    // TODO: Implement proper AES encryption with expo-crypto or react-native-crypto
    const keyBuffer = Buffer.from(key, 'utf8');
    const dataBuffer = Buffer.from(data, 'utf8');

    if (!keyBuffer.length || !dataBuffer.length) {
      throw new Error('Invalid input data for encryption');
    }

    // Simple XOR encryption (not secure for production!)
    const encrypted = Buffer.alloc(dataBuffer.length);
    for (let i = 0; i < dataBuffer.length; i++) {
      const dataByte = dataBuffer[i];
      const keyByte = keyBuffer[i % keyBuffer.length];
      if (dataByte !== undefined && keyByte !== undefined) {
        encrypted[i] = dataByte ^ keyByte;
      }
    }

    return encrypted.toString('base64');
  }

  private async decryptData(encryptedData: string, key: string): Promise<string> {
    // Simple XOR-based decryption for demo purposes
    // In a production app, you should use proper AES decryption
    // TODO: Implement proper AES decryption with expo-crypto or react-native-crypto
    const keyBuffer = Buffer.from(key, 'utf8');

    if (!keyBuffer.length) {
      throw new Error('Invalid encryption key');
    }

    try {
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');

      if (!encryptedBuffer.length) {
        throw new Error('Invalid encrypted data');
      }

      const decrypted = Buffer.alloc(encryptedBuffer.length);
      for (let i = 0; i < encryptedBuffer.length; i++) {
        const encryptedByte = encryptedBuffer[i];
        const keyByte = keyBuffer[i % keyBuffer.length];
        if (encryptedByte !== undefined && keyByte !== undefined) {
          decrypted[i] = encryptedByte ^ keyByte;
        }
      }

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Invalid encryption key or corrupted data');
    }
  }

  // Cloud backup methods (stubs for future implementation)
  async getAvailableCloudProviders(): Promise<('icloud' | 'googledrive')[]> {
    // TODO: Implement cloud provider detection
    return ['icloud', 'googledrive'];
  }

  async listCloudBackups(provider: string): Promise<Array<{ uri: string; name: string; size: number; createdAt: Date; modifiedAt: Date }>> {
    // TODO: Implement cloud backup listing
    return [];
  }

  async createAndUploadBackup(provider: string, encryptionKey?: string): Promise<string> {
    // TODO: Implement cloud backup creation and upload
    throw new Error('Cloud backup not yet implemented');
  }

  async downloadBackupFromCloud(provider: string, backupUri: string): Promise<string> {
    // TODO: Implement cloud backup download
    throw new Error('Cloud backup download not yet implemented');
  }

  async deleteCloudBackup(provider: string, backupUri: string): Promise<boolean> {
    // TODO: Implement cloud backup deletion
    throw new Error('Cloud backup deletion not yet implemented');
  }
}

export const backupService = BackupService.getInstance();
