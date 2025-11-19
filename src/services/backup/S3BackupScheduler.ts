/**
 * S3 Backup Scheduler
 *
 * Handles automatic scheduled backups to S3 using Expo BackgroundFetch.
 * Supports daily, weekly, and monthly backup frequencies.
 *
 * Features:
 * - Schedule automatic backups to S3
 * - Configurable backup frequency (daily, weekly, monthly)
 * - Background execution without UI blocking
 * - Comprehensive logging for monitoring
 * - Graceful error handling
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

import { logger } from "@/services/logger/LoggerService";
import { useSettingsStore } from "@/store/settingsStore";
import { backupRestoreService } from "./BackupRestoreService";
import type { BackupExportOptions } from "./BackupRestoreService";

const S3_BACKUP_TASK = "s3-automatic-backup";

// Backup intervals in seconds
const BACKUP_INTERVALS = {
  daily: 24 * 60 * 60, // 24 hours
  weekly: 7 * 24 * 60 * 60, // 7 days
  monthly: 30 * 24 * 60 * 60, // 30 days
};

/**
 * S3 Backup Scheduler Service
 * Manages automatic scheduled backups to S3
 */
export class S3BackupScheduler {
  private static instance: S3BackupScheduler;
  private isRegistered: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): S3BackupScheduler {
    if (!S3BackupScheduler.instance) {
      S3BackupScheduler.instance = new S3BackupScheduler();
    }
    return S3BackupScheduler.instance;
  }

  /**
   * Register background task for automatic S3 backups
   */
  async registerBackgroundTask(): Promise<void> {
    try {
      await logger.info("Registering S3 automatic backup task", {
        location: "S3BackupScheduler.registerBackgroundTask",
      });

      // Check if automatic backups are enabled in settings
      const settings = useSettingsStore.getState();
      if (!settings.s3AutoBackupEnabled) {
        await logger.info(
          "S3 automatic backups disabled in settings, skipping registration",
          {
            location: "S3BackupScheduler.registerBackgroundTask",
          },
        );
        return;
      }

      // Validate S3 configuration
      if (!settings.s3BucketName || !settings.s3Region) {
        await logger.warn(
          "S3 configuration incomplete, cannot register automatic backups",
          {
            location: "S3BackupScheduler.registerBackgroundTask",
            hasBucketName: !!settings.s3BucketName,
            hasRegion: !!settings.s3Region,
          },
        );
        return;
      }

      // Check if task is already registered
      const isTaskRegistered =
        await TaskManager.isTaskRegisteredAsync(S3_BACKUP_TASK);

      if (isTaskRegistered) {
        await logger.info("S3 backup task already registered", {
          location: "S3BackupScheduler.registerBackgroundTask",
        });
        this.isRegistered = true;
        return;
      }

      // Define the background task
      TaskManager.defineTask(
        S3_BACKUP_TASK,
        async (): Promise<BackgroundFetch.BackgroundFetchResult> => {
          try {
            await logger.info("S3 automatic backup task started", {
              location: "S3BackupScheduler.backgroundTask",
            });

            // Execute the backup
            await this.executeAutomaticBackup();

            await logger.info(
              "S3 automatic backup task completed successfully",
              {
                location: "S3BackupScheduler.backgroundTask",
              },
            );

            return BackgroundFetch.BackgroundFetchResult.NewData;
          } catch (error) {
            await logger.error("S3 automatic backup task failed", {
              location: "S3BackupScheduler.backgroundTask",
              error: error instanceof Error ? error.message : String(error),
            });

            return BackgroundFetch.BackgroundFetchResult.Failed;
          }
        },
      );

      // Get backup frequency from settings
      const frequency = settings.s3AutoBackupFrequency || "daily";
      const interval = BACKUP_INTERVALS[frequency];

      // Register the background fetch task
      await BackgroundFetch.registerTaskAsync(S3_BACKUP_TASK, {
        minimumInterval: interval,
        stopOnTerminate: false, // Continue after app termination
        startOnBoot: true, // Start on device boot
      });

      this.isRegistered = true;

      await logger.info("S3 automatic backup task registered successfully", {
        location: "S3BackupScheduler.registerBackgroundTask",
        frequency,
        interval,
      });
    } catch (error) {
      await logger.error("Failed to register S3 automatic backup task", {
        location: "S3BackupScheduler.registerBackgroundTask",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unregister background task
   */
  async unregisterBackgroundTask(): Promise<void> {
    try {
      await logger.info("Unregistering S3 automatic backup task", {
        location: "S3BackupScheduler.unregisterBackgroundTask",
      });

      await BackgroundFetch.unregisterTaskAsync(S3_BACKUP_TASK);
      this.isRegistered = false;

      await logger.info("S3 automatic backup task unregistered successfully", {
        location: "S3BackupScheduler.unregisterBackgroundTask",
      });
    } catch (error) {
      await logger.error("Failed to unregister S3 automatic backup task", {
        location: "S3BackupScheduler.unregisterBackgroundTask",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if background task is registered
   */
  isBackgroundTaskRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Get status of background fetch
   */
  async getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status ?? BackgroundFetch.BackgroundFetchStatus.Denied;
    } catch (error) {
      await logger.error("Failed to get background fetch status", {
        location: "S3BackupScheduler.getBackgroundFetchStatus",
        error: error instanceof Error ? error.message : String(error),
      });
      return BackgroundFetch.BackgroundFetchStatus.Denied;
    }
  }

  /**
   * Get last automatic backup timestamp
   */
  async getLastBackupTimestamp(): Promise<Date | null> {
    try {
      const settings = useSettingsStore.getState();
      const timestamp = settings.s3LastAutoBackupTimestamp;

      if (!timestamp) {
        return null;
      }

      return new Date(timestamp);
    } catch (error) {
      await logger.error("Failed to get last backup timestamp", {
        location: "S3BackupScheduler.getLastBackupTimestamp",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Manually trigger automatic backup (for testing or user-initiated backup)
   */
  async triggerManualBackup(): Promise<void> {
    try {
      await logger.info("Manual S3 backup triggered", {
        location: "S3BackupScheduler.triggerManualBackup",
      });

      await this.executeAutomaticBackup();

      await logger.info("Manual S3 backup completed successfully", {
        location: "S3BackupScheduler.triggerManualBackup",
      });
    } catch (error) {
      await logger.error("Manual S3 backup failed", {
        location: "S3BackupScheduler.triggerManualBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute automatic backup
   * Creates a comprehensive backup and uploads to S3
   * @private
   */
  private async executeAutomaticBackup(): Promise<void> {
    try {
      await logger.info("Executing automatic S3 backup", {
        location: "S3BackupScheduler.executeAutomaticBackup",
      });

      // Get settings
      const settings = useSettingsStore.getState();

      // Verify S3 is configured
      if (!settings.s3BucketName || !settings.s3Region) {
        throw new Error("S3 configuration incomplete");
      }

      // Create comprehensive backup options
      const backupOptions: BackupExportOptions = {
        includeSettings: true,
        includeServiceConfigs: true,
        includeServiceCredentials: true,
        includeTmdbCredentials: true,
        includeNetworkHistory: true,
        includeRecentIPs: true,
        includeDownloadConfig: true,
        includeServicesViewState: true,
        includeLibraryFilters: true,
        includeWidgetsConfig: true,
        includeWidgetConfigCredentials: true,
        includeWidgetSecureCredentials: true,
        includeWidgetProfiles: true,
        includeWidgetProfileCredentials: true,
        includeVoiceAssistantConfig: true,
        includeBookmarkHealthChecks: true,
        includeByokConfig: true,
        includeAiConfig: true,
        includeApiLoggingConfig: true,
        includeConversationalAISettings: true,
        includeConversationalAIProviderConfig: true,
        includeS3BackupConfig: true,
        encryptSensitive: false, // Don't encrypt for automatic backups by default
      };

      await logger.info("Creating backup with comprehensive options", {
        location: "S3BackupScheduler.executeAutomaticBackup",
        options: backupOptions,
      });

      // Create backup and upload to S3
      const result = await backupRestoreService.createBackupWithS3Upload(
        backupOptions,
        true, // Upload to S3
        undefined, // No progress callback for background task
      );

      // Update last backup timestamp
      await this.updateLastBackupTimestamp();

      await logger.info("Automatic S3 backup completed successfully", {
        location: "S3BackupScheduler.executeAutomaticBackup",
        hasLocalPath: !!result.localPath,
        hasS3Key: !!result.s3Key,
        s3Key: result.s3Key,
      });
    } catch (error) {
      await logger.error("Failed to execute automatic S3 backup", {
        location: "S3BackupScheduler.executeAutomaticBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update last backup timestamp in settings
   * @private
   */
  private async updateLastBackupTimestamp(): Promise<void> {
    try {
      const settings = useSettingsStore.getState();
      settings.setS3LastAutoBackupTimestamp(new Date().toISOString());

      await logger.info("Last backup timestamp updated", {
        location: "S3BackupScheduler.updateLastBackupTimestamp",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await logger.error("Failed to update last backup timestamp", {
        location: "S3BackupScheduler.updateLastBackupTimestamp",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const s3BackupScheduler = S3BackupScheduler.getInstance();
