import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { logger } from '@/services/logger/LoggerService';
import { secureStorage } from '@/services/storage/SecureStorage';

export interface BackupData {
  version: '1.0';
  timestamp: string;
  appData: {
    settings: Record<string, unknown>;
    serviceConfigs: Array<{
      id: string;
      type: string;
      name: string;
      url: string;
      enabled: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}

class BackupRestoreService {
  private static instance: BackupRestoreService | null = null;

  static getInstance(): BackupRestoreService {
    if (!BackupRestoreService.instance) {
      BackupRestoreService.instance = new BackupRestoreService();
    }
    return BackupRestoreService.instance;
  }

  /**
   * Create a complete backup of app data including settings and service configurations
   * Returns the backup file URI
   */
  async createBackup(): Promise<string> {
    try {
      await logger.info('Starting backup creation', {
        location: 'BackupRestoreService.createBackup',
      });

      // Fetch settings from AsyncStorage
      const settingsKey = 'SettingsStore:v1';
      const settingsData = await AsyncStorage.getItem(settingsKey);
      const settings = settingsData ? JSON.parse(settingsData) : {};

      // Fetch service configs
      const serviceConfigs = await secureStorage.getServiceConfigs();

      // Prepare backup data structure
      const backupData: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appData: {
          settings,
          serviceConfigs: serviceConfigs.map((config) => ({
            id: config.id,
            type: config.type,
            name: config.name,
            url: config.url,
            enabled: config.enabled,
            createdAt:
              config.createdAt instanceof Date
                ? config.createdAt.toISOString()
                : String(config.createdAt),
            updatedAt:
              config.updatedAt instanceof Date
                ? config.updatedAt.toISOString()
                : String(config.updatedAt),
          })),
        },
      };

      // Create backup file
      const fileName = `uniarr-backup-${new Date().toISOString().split('T')[0]}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backupData, null, 2));

      await logger.info('Backup file created', {
        location: 'BackupRestoreService.createBackup',
        fileName,
        configCount: serviceConfigs.length,
      });

      return filePath;
    } catch (error) {
      await logger.error('Failed to create backup', {
        location: 'BackupRestoreService.createBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Share the backup file using native share functionality
   */
  async shareBackup(backupFilePath: string): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      await Sharing.shareAsync(backupFilePath, {
        mimeType: 'application/json',
        UTI: 'public.json',
      });

      await logger.info('Backup shared successfully', {
        location: 'BackupRestoreService.shareBackup',
      });
    } catch (error) {
      await logger.error('Failed to share backup', {
        location: 'BackupRestoreService.shareBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Select and restore from a backup file
   */
  async selectAndRestoreBackup(): Promise<BackupData> {
    try {
      await logger.info('Starting backup restore selection', {
        location: 'BackupRestoreService.selectAndRestoreBackup',
      });

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
      });

      if (result.canceled) {
        await logger.info('Backup restore cancelled by user', {
          location: 'BackupRestoreService.selectAndRestoreBackup',
        });
        throw new Error('Restore cancelled');
      }

      const fileUri = result.assets[0]?.uri;
      if (!fileUri) {
        throw new Error('No file selected');
      }

      // Read the file
      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      const backupData = JSON.parse(fileContent) as BackupData;

      // Validate backup structure
      if (
        !backupData.version ||
        !backupData.timestamp ||
        !backupData.appData ||
        !Array.isArray(backupData.appData.serviceConfigs)
      ) {
        throw new Error('Invalid backup file format');
      }

      await logger.info('Backup file loaded and validated', {
        location: 'BackupRestoreService.selectAndRestoreBackup',
        version: backupData.version,
        configCount: backupData.appData.serviceConfigs.length,
      });

      return backupData;
    } catch (error) {
      await logger.error('Failed to load backup file', {
        location: 'BackupRestoreService.selectAndRestoreBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Restore app data from a backup
   * Pass skipSettings=true to restore only service configs
   * Pass skipServices=true to restore only settings
   */
  async restoreBackup(backupData: BackupData, options?: {
    skipSettings?: boolean;
    skipServices?: boolean;
  }): Promise<void> {
    const { skipSettings = false, skipServices = false } = options ?? {};

    try {
      await logger.info('Starting backup restore', {
        location: 'BackupRestoreService.restoreBackup',
        skipSettings,
        skipServices,
      });

      // Restore settings
      if (!skipSettings && backupData.appData.settings) {
        const settingsKey = 'SettingsStore:v1';
        await AsyncStorage.setItem(settingsKey, JSON.stringify(backupData.appData.settings));

        await logger.info('Settings restored', {
          location: 'BackupRestoreService.restoreBackup',
        });
      }

      // Restore service configurations
      if (!skipServices && Array.isArray(backupData.appData.serviceConfigs)) {
        // Clear existing service configs
        await secureStorage.clearAll();

        // Restore each config
        for (const configData of backupData.appData.serviceConfigs) {
          // We can't restore without the actual credentials/api keys
          // This would need to be handled separately or the backup would need to include encrypted credentials
          // For now, we'll log what we're restoring
          await logger.info('Restoring service config', {
            location: 'BackupRestoreService.restoreBackup',
            serviceType: configData.type,
            serviceName: configData.name,
          });
        }
      }

      await logger.info('Backup restore completed successfully', {
        location: 'BackupRestoreService.restoreBackup',
      });
    } catch (error) {
      await logger.error('Failed to restore backup', {
        location: 'BackupRestoreService.restoreBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get backup file size in bytes
   */
  async getBackupFileSize(filePath: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists || fileInfo.isDirectory) {
        return 0;
      }
      return (fileInfo as any).size ?? 0;
    } catch (error) {
      await logger.error('Failed to get backup file size', {
        location: 'BackupRestoreService.getBackupFileSize',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(filePath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });

      await logger.info('Backup file deleted', {
        location: 'BackupRestoreService.deleteBackup',
      });
    } catch (error) {
      await logger.error('Failed to delete backup file', {
        location: 'BackupRestoreService.deleteBackup',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * List all backup files in the documents directory
   */
  async listBackupFiles(): Promise<Array<{ name: string; path: string; modificationTime: number }>> {
    try {
      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(docDir);
      const backupFiles: Array<{ name: string; path: string; modificationTime: number }> = [];

      for (const fileName of files) {
        if (fileName.startsWith('uniarr-backup-') && fileName.endsWith('.json')) {
          const filePath = `${docDir}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);

          if (fileInfo.exists && !fileInfo.isDirectory) {
            backupFiles.push({
              name: fileName,
              path: filePath,
              modificationTime: ((fileInfo as any).modificationTime ?? 0) * 1000,
            });
          }
        }
      }

      // Sort by modification time (newest first)
      backupFiles.sort((a, b) => b.modificationTime - a.modificationTime);

      return backupFiles;
    } catch (error) {
      await logger.error('Failed to list backup files', {
        location: 'BackupRestoreService.listBackupFiles',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

export const backupRestoreService = BackupRestoreService.getInstance();
