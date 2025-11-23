import { useCallback, useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  useTheme,
  Button,
  TextInput,
  ProgressBar,
  IconButton,
} from "react-native-paper";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { backupRestoreService } from "@/services/backup/BackupRestoreService";
import type { BackupExportOptions } from "@/services/backup/BackupRestoreService";
import type { S3UploadProgress } from "@/models/s3.types";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

const UploadBackupModal = () => {
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();

  const [uploadEncryptionEnabled, setUploadEncryptionEnabled] = useState(false);
  const [uploadPassword, setUploadPassword] = useState("");
  const [uploadPasswordConfirm, setUploadPasswordConfirm] = useState("");
  const [operationProgress, setOperationProgress] =
    useState<S3UploadProgress | null>(null);

  // Mutation for uploading new backup
  const uploadMutation = useMutation({
    mutationFn: async ({
      encryptSensitive,
      password,
    }: {
      encryptSensitive: boolean;
      password?: string;
    }) => {
      await logger.info("Starting S3 backup upload", {
        location: "UploadBackupModal.uploadMutation",
        encryptSensitive,
      });

      // Create backup with all options enabled
      const options: BackupExportOptions = {
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
        encryptSensitive,
        password,
      };

      await backupRestoreService.createBackupWithS3Upload(
        options,
        true,
        (progress: S3UploadProgress) => {
          setOperationProgress(progress);
        },
      );
    },
    onSuccess: () => {
      setOperationProgress(null);
      // Invalidate and refetch backups list
      void queryClient.invalidateQueries({ queryKey: ["s3", "backups"] });

      void logger.info("S3 backup upload completed successfully", {
        location: "UploadBackupModal.uploadMutation.onSuccess",
      });

      // Close modal and show success message
      router.back();
      setTimeout(() => {
        alert("Success", "Backup uploaded to S3 successfully");
      }, 300);
    },
    onError: (error: Error) => {
      setOperationProgress(null);

      void logger.error("S3 backup upload failed", {
        location: "UploadBackupModal.uploadMutation.onError",
        error: error.message,
      });

      alert("Error", error.message || "Failed to upload backup");
    },
    onSettled: () => {
      setOperationProgress(null);
    },
  });

  const handleConfirmUpload = useCallback(() => {
    void logger.info("Confirming backup upload", {
      location: "UploadBackupModal.handleConfirmUpload",
      encryptionEnabled: uploadEncryptionEnabled,
    });

    // Validate password if encryption is enabled
    if (uploadEncryptionEnabled) {
      if (!uploadPassword) {
        alert("Error", "Please enter a password for encryption");
        return;
      }
      if (uploadPassword !== uploadPasswordConfirm) {
        alert("Error", "Passwords do not match");
        return;
      }
      if (uploadPassword.length < 8) {
        alert("Error", "Password must be at least 8 characters long");
        return;
      }
    }

    uploadMutation.mutate({
      encryptSensitive: uploadEncryptionEnabled,
      password: uploadEncryptionEnabled ? uploadPassword : undefined,
    });
  }, [
    uploadEncryptionEnabled,
    uploadPassword,
    uploadPasswordConfirm,
    uploadMutation,
  ]);

  const handleCancel = useCallback(() => {
    if (uploadMutation.isPending) {
      alert(
        "Upload in Progress",
        "Please wait for the upload to complete before closing.",
      );
      return;
    }
    router.back();
  }, [uploadMutation.isPending]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    headerTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
    },
    scrollContainer: {
      padding: spacing.md,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.xs,
    },
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      marginBottom: spacing.md,
    },
    encryptionToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    encryptionToggleText: {
      flex: 1,
      marginRight: spacing.sm,
    },
    encryptionToggleTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.xxs,
    },
    encryptionToggleDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
    passwordInput: {
      marginBottom: spacing.md,
    },
    passwordHint: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginBottom: spacing.md,
    },
    progressContainer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    progressText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Upload Backup</Text>
        <IconButton
          icon="close"
          size={24}
          onPress={handleCancel}
          disabled={uploadMutation.isPending}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionDescription}>
            This will create a new backup with all your current settings and
            upload it to S3.
          </Text>
        </View>

        {/* Encryption Toggle */}
        <View style={styles.section}>
          <View style={styles.encryptionToggle}>
            <View style={styles.encryptionToggleText}>
              <Text style={styles.encryptionToggleTitle}>Encrypt Backup</Text>
              <Text style={styles.encryptionToggleDescription}>
                Protect sensitive data with a password
              </Text>
            </View>
            <Button
              mode={uploadEncryptionEnabled ? "contained" : "outlined"}
              onPress={() =>
                setUploadEncryptionEnabled(!uploadEncryptionEnabled)
              }
              disabled={uploadMutation.isPending}
              compact
            >
              {uploadEncryptionEnabled ? "Enabled" : "Disabled"}
            </Button>
          </View>

          {/* Password Inputs */}
          {uploadEncryptionEnabled && (
            <>
              <TextInput
                mode="outlined"
                label="Password"
                value={uploadPassword}
                onChangeText={setUploadPassword}
                secureTextEntry
                disabled={uploadMutation.isPending}
                style={styles.passwordInput}
                placeholder="Enter password (min 8 characters)"
              />
              <TextInput
                mode="outlined"
                label="Confirm Password"
                value={uploadPasswordConfirm}
                onChangeText={setUploadPasswordConfirm}
                secureTextEntry
                disabled={uploadMutation.isPending}
                style={styles.passwordInput}
                placeholder="Re-enter password"
              />
              <Text style={styles.passwordHint}>
                Remember this password - you&apos;ll need it to restore this
                backup.
              </Text>
            </>
          )}
        </View>

        {/* Progress */}
        {uploadMutation.isPending && operationProgress && (
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={operationProgress.percentage / 100}
              color={theme.colors.primary}
            />
            <Text style={styles.progressText}>
              {uploadEncryptionEnabled
                ? "Encrypting and uploading"
                : "Uploading"}
              : {operationProgress.percentage}%
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            icon="cloud-upload"
            onPress={handleConfirmUpload}
            loading={uploadMutation.isPending}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload Backup"}
          </Button>
          <Button
            mode="outlined"
            onPress={handleCancel}
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadBackupModal;
