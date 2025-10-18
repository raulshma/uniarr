import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme, Button, TextInput } from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import { Card } from "@/components/common/Card";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import {
  backupRestoreService,
  type AnyBackupData,
} from "@/services/backup/BackupRestoreService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useRouter } from "expo-router";

const EncryptedBackupRestoreScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [isRestoring, setIsRestoring] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [selectedBackup, setSelectedBackup] = useState<AnyBackupData | null>(
    null,
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
    encryptionCard: {
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: 12,
      marginVertical: spacing.sm,
      padding: spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    encryptionTitle: {
      color: theme.colors.onPrimaryContainer,
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.sm,
    },
    passwordInput: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginTop: spacing.sm,
    },
    successText: {
      color: theme.colors.primary,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginTop: spacing.sm,
    },
    backupInfo: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    backupInfoTitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.sm,
    },
    backupInfoText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: 18,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginVertical: spacing.md,
    },
    warningCard: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 12,
      marginVertical: spacing.sm,
      padding: spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.error,
    },
    warningTitle: {
      color: theme.colors.onErrorContainer,
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.sm,
    },
    warningText: {
      color: theme.colors.onErrorContainer,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
  });

  const handleSelectBackup = async () => {
    try {
      setIsRestoring(true);
      setPasswordError("");

      const backupData = await backupRestoreService.selectAndRestoreBackup();

      if (!backupData.encrypted) {
        await alert(
          "Not an Encrypted Backup",
          "The selected backup is not encrypted. Please use the regular restore function.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      setSelectedBackup(backupData);

      await logger.info("Encrypted backup selected successfully", {
        location: "EncryptedBackupRestoreScreen.handleSelectBackup",
        version: backupData.version,
        hasEncryptionInfo: !!backupData.encryptionInfo,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to select backup";
      setPasswordError(errorMsg);
      await logger.error("Failed to select encrypted backup", {
        location: "EncryptedBackupRestoreScreen.handleSelectBackup",
        error: errorMsg,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup || !password.trim()) {
      setPasswordError("Please enter the backup password");
      return;
    }

    try {
      setIsRestoring(true);
      setPasswordError("");

      // Decrypt the selected backup using the service's public method
      if (
        !selectedBackup.encryptionInfo ||
        !selectedBackup.appData.encryptedData
      ) {
        throw new Error("Invalid encrypted backup format");
      }

      const decryptedData = await backupRestoreService.decryptSensitiveData(
        selectedBackup.appData.encryptedData,
        password,
        selectedBackup.encryptionInfo.salt,
        selectedBackup.encryptionInfo.iv,
      );

      // Merge decrypted data with backup data
      const decryptedBackup = {
        ...selectedBackup,
        appData: {
          ...selectedBackup.appData,
          ...decryptedData,
          // Keep non-encrypted data as is
          serviceConfigs:
            decryptedData.serviceConfigs ||
            selectedBackup.appData.serviceConfigs,
          networkScanHistory: selectedBackup.appData.networkScanHistory,
          recentIPs: selectedBackup.appData.recentIPs,
        },
      };

      // Remove encrypted data after decryption
      delete (decryptedBackup as any).appData.encryptedData;

      const hasTmdbCredentials =
        !!decryptedBackup.appData.tmdbCredentials?.apiKey;
      const servicesCount = decryptedBackup.appData.serviceConfigs?.length || 0;
      const servicesText = `${servicesCount} service configuration(s)`;
      const additionalText = hasTmdbCredentials ? " and TMDB credentials" : "";

      await alert(
        "Restore Encrypted Backup?",
        `This will restore ${servicesText}${additionalText} and your settings. This action cannot be undone.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                await backupRestoreService.restoreBackup(decryptedBackup);
                await alert(
                  "Restore Complete",
                  "Your encrypted backup has been restored successfully. The app will now refresh.",
                );

                // Reload the app to reflect restored settings
                setTimeout(() => {
                  router.replace("/(auth)/(tabs)/settings");
                }, 1000);
              } catch (error) {
                const errorMsg =
                  error instanceof Error
                    ? error.message
                    : "Failed to restore backup";
                await alert("Restore Failed", errorMsg);
                await logger.error("Failed to restore encrypted backup", {
                  location: "EncryptedBackupRestoreScreen.handleRestoreBackup",
                  error: errorMsg,
                });
              }
            },
          },
        ],
      );

      await logger.info("Encrypted backup restore completed successfully", {
        location: "EncryptedBackupRestoreScreen.handleRestoreBackup",
        servicesCount,
        hasTmdbCredentials,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to restore encrypted backup";

      if (
        errorMsg.includes("Invalid password") ||
        errorMsg.includes("Decryption failed")
      ) {
        setPasswordError(
          "Invalid password. Please check your password and try again.",
        );
      } else {
        setPasswordError(errorMsg);
      }

      await logger.error("Failed to restore encrypted backup", {
        location: "EncryptedBackupRestoreScreen.handleRestoreBackup",
        error: errorMsg,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const formatBackupDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader
          showTitle
          title="Restore Encrypted Backup"
          showBackButton
          onBackPress={() => router.back()}
        />

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Encrypted Backup Restore</Text>
          <Text style={styles.sectionDescription}>
            Select an encrypted backup file (.json) and enter the password you
            used when creating it.
          </Text>

          <Card style={styles.encryptionCard}>
            <Text style={styles.encryptionTitle}>Security Notice</Text>
            <Text style={styles.sectionDescription}>
              Encrypted backups contain sensitive data that is protected with a
              password. Make sure you have the correct password before
              proceeding.
            </Text>
          </Card>
        </View>

        {/* Backup Selection */}
        {!selectedBackup ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Encrypted Backup</Text>

            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                icon="folder-open"
                loading={isRestoring}
                disabled={isRestoring}
                onPress={handleSelectBackup}
              >
                {isRestoring ? "Loading..." : "Select Encrypted Backup File"}
              </Button>
            </View>

            {passwordError && (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Error</Text>
                <Text style={styles.warningText}>{passwordError}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backup Information</Text>

            <Card style={styles.card}>
              <View style={styles.backupInfo}>
                <Text style={styles.backupInfoTitle}>📁 Backup Details</Text>
                <Text style={styles.backupInfoText}>
                  • Version: {selectedBackup.version}
                  {"\n"}• Created: {formatBackupDate(selectedBackup.timestamp)}
                  {"\n"}• Encryption: XOR-PBKDF2{"\n"}• Services:{" "}
                  {selectedBackup.appData.serviceConfigs?.length || 0}{" "}
                  configured{"\n"}• Has TMDB:{" "}
                  {selectedBackup.appData.tmdbCredentials?.apiKey
                    ? "Yes"
                    : "No"}
                </Text>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Enter Password</Text>
            <Text style={styles.sectionDescription}>
              Enter the password you used when creating this encrypted backup.
            </Text>

            <Card style={styles.card}>
              <TextInput
                label="Backup Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.passwordInput}
                error={!!passwordError}
                disabled={isRestoring}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {passwordError && (
                <Text style={styles.errorText}>{passwordError}</Text>
              )}
            </Card>

            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                icon="lock-open-variant"
                loading={isRestoring}
                disabled={isRestoring || !password.trim()}
                onPress={handleRestoreBackup}
              >
                {isRestoring ? "Restoring..." : "Decrypt and Restore Backup"}
              </Button>

              <Button
                mode="outlined"
                icon="arrow-left"
                disabled={isRestoring}
                onPress={() => {
                  setSelectedBackup(null);
                  setPassword("");
                  setPasswordError("");
                }}
              >
                Select Different Backup
              </Button>
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <Card style={styles.card}>
            <Text style={styles.sectionDescription}>
              <Text style={{ fontWeight: "600" }}>Forgot your password?</Text>
              {"\n"}
              Unfortunately, encrypted backups cannot be restored without the
              correct password. You'll need to create a new backup instead.
              {"\n\n"}
              <Text style={{ fontWeight: "600" }}>Backup not encrypted?</Text>
              {"\n"}
              If your backup is not encrypted, use the regular "Restore from
              File" option instead.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EncryptedBackupRestoreScreen;
