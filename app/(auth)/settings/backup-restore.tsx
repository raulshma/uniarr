import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Text,
  useTheme,
  Button,
  ActivityIndicator,
  Icon,
} from "react-native-paper";
import * as Sharing from "expo-sharing";

import { TabHeader } from "@/components/common/TabHeader";
import { Card } from "@/components/common/Card";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { backupRestoreService } from "@/services/backup/BackupRestoreService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

const BackupRestoreScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [recentBackups, setRecentBackups] = useState<
    { name: string; path: string; modificationTime: number }[]
  >([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  // Load recent backups on mount
  useEffect(() => {
    const loadBackups = async () => {
      setIsLoadingBackups(true);
      try {
        const backups = await backupRestoreService.listBackupFiles();
        setRecentBackups(backups);
      } catch (error) {
        await logger.error("Failed to load backup files", {
          location: "BackupRestoreScreen.loadBackups",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoadingBackups(false);
      }
    };

    void loadBackups();
  }, []);

  const handleCreateBackup = useCallback(async () => {
    try {
      setIsCreatingBackup(true);

      const backupPath = await backupRestoreService.createBackup();
      const fileSize = await backupRestoreService.getBackupFileSize(backupPath);
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

      // Show share dialog
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await alert(
          "Backup Created",
          `Your backup is ready (${fileSizeMB} MB). Share it to save or store locally.`,
          [
            {
              text: "Share",
              style: "default",
              onPress: async () => {
                try {
                  await backupRestoreService.shareBackup(backupPath);
                } catch (error) {
                  await alert(
                    "Share Failed",
                    error instanceof Error
                      ? error.message
                      : "Failed to share backup",
                  );
                }
              },
            },
            {
              text: "Done",
              style: "cancel",
            },
          ],
        );
      } else {
        await alert(
          "Backup Created",
          `Backup saved successfully (${fileSizeMB} MB)`,
        );
      }

      // Refresh backups list
      const backups = await backupRestoreService.listBackupFiles();
      setRecentBackups(backups);

      await logger.info("Backup created successfully", {
        location: "BackupRestoreScreen.handleCreateBackup",
        fileSizeMB: parseFloat(fileSizeMB),
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to create backup";
      await alert("Backup Failed", errorMsg);
      await logger.error("Failed to create backup", {
        location: "BackupRestoreScreen.handleCreateBackup",
        error: errorMsg,
      });
    } finally {
      setIsCreatingBackup(false);
    }
  }, []);

  const handleRestoreBackup = useCallback(async () => {
    try {
      setIsRestoring(true);

      const backupData = await backupRestoreService.selectAndRestoreBackup();

      // Check if it's an encrypted backup
      if (backupData.encrypted) {
        await alert(
          "Encrypted Backup Detected",
          "This backup is encrypted. Please use the 'Restore Encrypted Backup' option to restore it.",
          [{ text: "OK", onPress: () => setIsRestoring(false) }],
        );
        return;
      }

      // Confirm restoration
      const hasTmdbCredentials = !!backupData.appData.tmdbCredentials?.apiKey;
      const servicesCount = backupData.appData.serviceConfigs?.length || 0;
      const servicesText = `${servicesCount} service configuration(s)`;
      const additionalText = hasTmdbCredentials ? " and TMDB credentials" : "";

      await alert(
        "Restore Backup?",
        `This will restore ${servicesText}${additionalText} and your settings. Make sure to select a .json backup file. This action cannot be undone.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsRestoring(false),
          },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                await backupRestoreService.restoreBackup(backupData);
                await alert(
                  "Restore Complete",
                  "Your backup has been restored successfully. The app will now refresh.",
                );

                // Reload the settings store to reflect restored settings
                await new Promise((resolve) => setTimeout(resolve, 1000));
                router.replace("/(auth)/(tabs)/settings");
              } catch (error) {
                const errorMsg =
                  error instanceof Error
                    ? error.message
                    : "Failed to restore backup";
                await alert("Restore Failed", errorMsg);
                await logger.error("Failed to restore backup", {
                  location: "BackupRestoreScreen.handleRestoreBackup",
                  error: errorMsg,
                });
              } finally {
                setIsRestoring(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      // User cancelled or error occurred
      if (!(error instanceof Error && error.message === "Restore cancelled")) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Failed to select backup file";
        await alert("Restore Failed", errorMsg);
        await logger.error("Failed to select backup", {
          location: "BackupRestoreScreen.handleRestoreBackup",
          error: errorMsg,
        });
      }
      setIsRestoring(false);
    }
  }, [router]);

  const handleDeleteBackup = useCallback(
    async (backupPath: string, backupName: string) => {
      await alert(
        "Delete Backup?",
        `Are you sure you want to delete "${backupName}"? This action cannot be undone.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await backupRestoreService.deleteBackup(backupPath);
                const backups = await backupRestoreService.listBackupFiles();
                setRecentBackups(backups);

                await logger.info("Backup deleted", {
                  location: "BackupRestoreScreen.handleDeleteBackup",
                  backupName,
                });
              } catch (error) {
                const errorMsg =
                  error instanceof Error
                    ? error.message
                    : "Failed to delete backup";
                await alert("Delete Failed", errorMsg);
                await logger.error("Failed to delete backup", {
                  location: "BackupRestoreScreen.handleDeleteBackup",
                  error: errorMsg,
                });
              }
            },
          },
        ],
      );
    },
    [],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.lg,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      marginVertical: spacing.xs,
      padding: spacing.md,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginVertical: spacing.sm,
    },
    backupItem: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      marginVertical: spacing.xs,
      padding: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    backupInfo: {
      flex: 1,
    },
    backupName: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.xs,
    },
    backupDate: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: spacing.xl,
    },
    emptyStateText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      textAlign: "center",
      marginTop: spacing.md,
    },
    loadingContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatFileName = (fileName: string) => {
    // Remove 'uniarr-backup-' prefix and '.json' suffix
    return fileName.replace("uniarr-backup-", "").replace(".json", "");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader
          showTitle
          title="Backup & Restore"
          showBackButton
          onBackPress={() => router.back()}
        />

        {/* Backup Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Local Backup</Text>
          <Text style={styles.sectionDescription}>
            Create a backup of your settings, service configurations,
            credentials, and TMDB API key. You can store it locally or share it.
          </Text>

          <Card style={styles.card}>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                icon="backup-restore"
                loading={isCreatingBackup}
                disabled={isCreatingBackup || isRestoring}
                onPress={handleCreateBackup}
              >
                {isCreatingBackup ? "Creating Backup..." : "Create Backup"}
              </Button>
              <Button
                mode="outlined"
                icon="upload-multiple"
                disabled={isCreatingBackup || isRestoring}
                onPress={handleRestoreBackup}
              >
                {isRestoring ? "Restoring..." : "Restore from File"}
              </Button>
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionDescription}>
              Enhanced backup options with selective export and encryption:
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained-tonal"
                icon="export"
                disabled={isCreatingBackup || isRestoring}
                onPress={() => router.push("/(auth)/settings/backup-export")}
              >
                Export Custom Backup
              </Button>
              <Button
                mode="contained-tonal"
                icon="lock-open-variant"
                disabled={isCreatingBackup || isRestoring}
                onPress={() =>
                  router.push("/(auth)/settings/backup-restore-encrypted")
                }
              >
                Restore Encrypted Backup
              </Button>
            </View>
          </Card>
        </View>

        {/* Recent Backups Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Backups</Text>
          <Text style={styles.sectionDescription}>
            Backups stored locally on this device. Swipe or tap to delete.
          </Text>

          {isLoadingBackups ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                animating
                size="large"
                color={theme.colors.primary}
              />
            </View>
          ) : recentBackups.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon
                source="backup-restore"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.emptyStateText}>No local backups yet</Text>
            </View>
          ) : (
            <View>
              {recentBackups.map((backup) => (
                <View key={backup.path} style={styles.backupItem}>
                  <View style={styles.backupInfo}>
                    <Text style={styles.backupName}>
                      {formatFileName(backup.name)}
                    </Text>
                    <Text style={styles.backupDate}>
                      {formatDate(backup.modificationTime)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    <Button
                      mode="contained-tonal"
                      compact
                      icon="upload"
                      disabled={isCreatingBackup || isRestoring}
                      onPress={() => {
                        // Load and restore from local backup
                        alert(
                          "Restore Feature",
                          "Use 'Restore from File' button to restore this backup.",
                        );
                      }}
                    >
                      Use
                    </Button>
                    <Button
                      mode="contained-tonal"
                      compact
                      icon="delete"
                      disabled={isCreatingBackup || isRestoring}
                      onPress={() =>
                        handleDeleteBackup(backup.path, backup.name)
                      }
                    >
                      Delete
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Backups</Text>
          <Card style={styles.card}>
            <Text style={styles.sectionDescription}>
              • Standard backups include your app settings, service
              configurations with credentials, TMDB API key, and network scan
              history{"\n"}• Custom backups allow you to select exactly what to
              export{"\n"}• Encrypted backups protect sensitive data with
              password encryption (XOR-PBKDF2){"\n"}• Backups are stored in JSON
              format for compatibility{"\n"}• You can share backups via email,
              cloud storage, or other apps{"\n"}• Restoring a backup will
              replace your current settings, services, and TMDB configuration
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BackupRestoreScreen;
