import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Text,
  useTheme,
  Button,
  Checkbox,
  TextInput,
  Portal,
  Dialog,
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import { Card } from "@/components/common/Card";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import {
  backupRestoreService,
  type BackupExportOptions,
} from "@/services/backup/BackupRestoreService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useRouter } from "expo-router";

const BackupExportScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [isCreating, setIsCreating] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Get default configuration
  const config = backupRestoreService.getBackupSelectionConfig();
  const [options, setOptions] = useState<BackupExportOptions>(
    backupRestoreService.getDefaultExportOptions(),
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
    checkboxContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    checkboxLabel: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
    },
    sensitiveLabel: {
      color: theme.colors.error,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginTop: spacing.xs,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginVertical: spacing.md,
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
      marginTop: spacing.sm,
    },
    dialog: {
      backgroundColor: theme.colors.surface,
    },
    dialogTitle: {
      color: theme.colors.onSurface,
    },
    dialogContent: {
      color: theme.colors.onSurfaceVariant,
    },
  });

  const handleOptionChange = (
    key: keyof BackupExportOptions,
    value: boolean,
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handlePasswordConfirm = async () => {
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordError("");
    setShowPasswordDialog(false);

    // Create backup with password
    await createBackupWithPassword(password);
  };

  const createBackupWithPassword = async (backupPassword: string) => {
    try {
      setIsCreating(true);

      const backupOptions = { ...options, password: backupPassword };
      const validation =
        backupRestoreService.validateExportOptions(backupOptions);

      if (!validation.isValid) {
        await alert("Validation Error", validation.errors.join("\n"));
        return;
      }

      const backupPath =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const fileSize = await backupRestoreService.getBackupFileSize(backupPath);
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

      await alert(
        "Encrypted Backup Created",
        `Your encrypted backup is ready (${fileSizeMB} MB). Keep your password safe - you'll need it to restore this backup.`,
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

      await logger.info("Encrypted backup created successfully", {
        location: "BackupExportScreen.createBackupWithPassword",
        fileSizeMB: parseFloat(fileSizeMB),
        encrypted: true,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to create encrypted backup";
      await alert("Backup Failed", errorMsg);
      await logger.error("Failed to create encrypted backup", {
        location: "BackupExportScreen.createBackupWithPassword",
        error: errorMsg,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateBackup = async () => {
    if (options.encryptSensitive) {
      setShowPasswordDialog(true);
      return;
    }

    try {
      setIsCreating(true);

      const validation = backupRestoreService.validateExportOptions(options);

      if (!validation.isValid) {
        await alert("Validation Error", validation.errors.join("\n"));
        return;
      }

      const backupPath =
        await backupRestoreService.createSelectiveBackup(options);
      const fileSize = await backupRestoreService.getBackupFileSize(backupPath);
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

      // Show share dialog
      await alert(
        "Backup Created",
        `Your backup is ready (${fileSizeMB} MB).`,
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

      await logger.info("Backup created successfully", {
        location: "BackupExportScreen.handleCreateBackup",
        fileSizeMB: parseFloat(fileSizeMB),
        encrypted: false,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to create backup";
      await alert("Backup Failed", errorMsg);
      await logger.error("Failed to create backup", {
        location: "BackupExportScreen.handleCreateBackup",
        error: errorMsg,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const hasSelectedSensitiveItems =
    (options.includeServiceConfigs && options.includeServiceCredentials) ||
    options.includeTmdbCredentials ||
    options.includeSettings;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader
          showTitle
          title="Export Backup"
          showBackButton
          onBackPress={() => router.back()}
        />

        {/* Data Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Data to Export</Text>
          <Text style={styles.sectionDescription}>
            Choose what data to include in your backup file.
          </Text>

          <Card style={styles.card}>
            {/* Settings */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={options.includeSettings ? "checked" : "unchecked"}
                onPress={() =>
                  handleOptionChange(
                    "includeSettings",
                    !options.includeSettings,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>App Settings</Text>
                {config.settings.sensitive && (
                  <Text style={styles.sensitiveLabel}>
                    May contain sensitive preferences
                  </Text>
                )}
              </View>
            </View>

            {/* Service Configurations */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={options.includeServiceConfigs ? "checked" : "unchecked"}
                onPress={() =>
                  handleOptionChange(
                    "includeServiceConfigs",
                    !options.includeServiceConfigs,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>Service Configurations</Text>
                {config.serviceConfigs.sensitive && (
                  <Text style={styles.sensitiveLabel}>
                    Contains connection details
                  </Text>
                )}
              </View>
            </View>

            {/* Service Credentials */}
            {options.includeServiceConfigs && (
              <View
                style={[styles.checkboxContainer, { marginLeft: spacing.lg }]}
              >
                <Checkbox
                  status={
                    options.includeServiceCredentials ? "checked" : "unchecked"
                  }
                  onPress={() =>
                    handleOptionChange(
                      "includeServiceCredentials",
                      !options.includeServiceCredentials,
                    )
                  }
                />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.checkboxLabel}>Include Credentials</Text>
                  <Text style={styles.sensitiveLabel}>
                    API keys, usernames, passwords
                  </Text>
                </View>
              </View>
            )}

            {/* TMDB Credentials */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={
                  options.includeTmdbCredentials ? "checked" : "unchecked"
                }
                onPress={() =>
                  handleOptionChange(
                    "includeTmdbCredentials",
                    !options.includeTmdbCredentials,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>TMDB API Key</Text>
                {config.tmdbCredentials.sensitive && (
                  <Text style={styles.sensitiveLabel}>
                    Sensitive API credential
                  </Text>
                )}
              </View>
            </View>

            {/* Network History */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={options.includeNetworkHistory ? "checked" : "unchecked"}
                onPress={() =>
                  handleOptionChange(
                    "includeNetworkHistory",
                    !options.includeNetworkHistory,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>Network Scan History</Text>
              </View>
            </View>

            {/* Recent IPs */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={options.includeRecentIPs ? "checked" : "unchecked"}
                onPress={() =>
                  handleOptionChange(
                    "includeRecentIPs",
                    !options.includeRecentIPs,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>Recent IPs</Text>
              </View>
            </View>

            {/* Download Configuration */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={options.includeDownloadConfig ? "checked" : "unchecked"}
                onPress={() =>
                  handleOptionChange(
                    "includeDownloadConfig",
                    !options.includeDownloadConfig,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>Download Configuration</Text>
                <Text style={styles.sensitiveLabel}>
                  Download settings and preferences
                </Text>
              </View>
            </View>

            {/* Services View State */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={
                  options.includeServicesViewState ? "checked" : "unchecked"
                }
                onPress={() =>
                  handleOptionChange(
                    "includeServicesViewState",
                    !options.includeServicesViewState,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>
                  Services View Preferences
                </Text>
                <Text style={styles.sensitiveLabel}>
                  View mode and sort settings
                </Text>
              </View>
            </View>

            {/* Widgets Configuration */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                status={options.includeWidgetsConfig ? "checked" : "unchecked"}
                onPress={() =>
                  handleOptionChange(
                    "includeWidgetsConfig",
                    !options.includeWidgetsConfig,
                  )
                }
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.checkboxLabel}>
                  Dashboard Widget Configurations
                </Text>
                <Text style={styles.sensitiveLabel}>
                  Widget layout and settings
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Encryption Section */}
        {hasSelectedSensitiveItems && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Options</Text>
            <Text style={styles.sectionDescription}>
              Encrypt sensitive data to protect it with a password.
            </Text>

            <Card style={styles.encryptionCard}>
              <Text style={styles.encryptionTitle}>🔐 Password Protection</Text>
              <Text style={styles.dialogContent}>
                When enabled, sensitive data (credentials, API keys) will be
                encrypted with your password. You'll need this password to
                restore the backup.
              </Text>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={options.encryptSensitive ? "checked" : "unchecked"}
                  onPress={() =>
                    handleOptionChange(
                      "encryptSensitive",
                      !options.encryptSensitive,
                    )
                  }
                />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.checkboxLabel}>
                    Encrypt sensitive data
                  </Text>
                  <Text style={styles.sensitiveLabel}>
                    Recommended for security
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              icon={options.encryptSensitive ? "lock" : "backup-restore"}
              loading={isCreating}
              disabled={
                isCreating ||
                (!options.includeSettings &&
                  !options.includeServiceConfigs &&
                  !options.includeTmdbCredentials &&
                  !options.includeNetworkHistory &&
                  !options.includeRecentIPs &&
                  !options.includeDownloadConfig &&
                  !options.includeServicesViewState &&
                  !options.includeWidgetsConfig)
              }
              onPress={handleCreateBackup}
            >
              {isCreating
                ? "Creating Backup..."
                : options.encryptSensitive
                  ? "Create Encrypted Backup"
                  : "Create Backup"}
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* Password Dialog */}
      <Portal>
        <Dialog
          visible={showPasswordDialog}
          onDismiss={() => setShowPasswordDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Set Backup Password
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogContent}>
              Create a strong password to encrypt your sensitive data. You'll
              need this password to restore the backup.
            </Text>

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.passwordInput}
              error={!!passwordError}
            />

            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={styles.passwordInput}
              error={!!passwordError}
            />

            {passwordError ? (
              <Text style={[styles.sensitiveLabel, { marginTop: spacing.sm }]}>
                {passwordError}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button onPress={handlePasswordConfirm} mode="contained">
              Create Backup
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default BackupExportScreen;
