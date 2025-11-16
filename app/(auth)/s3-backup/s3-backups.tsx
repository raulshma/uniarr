import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import {
  Text,
  useTheme,
  Button,
  Card,
  IconButton,
  ActivityIndicator,
  Chip,
  Portal,
  Dialog,
  TextInput,
  ProgressBar,
} from "react-native-paper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { s3BackupService } from "@/services/backup/S3BackupService";
import { backupRestoreService } from "@/services/backup/BackupRestoreService";
import type { S3BackupMetadata, S3UploadProgress } from "@/models/s3.types";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import { borderRadius } from "@/constants/sizes";

const S3BackupsScreen = () => {
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<S3BackupMetadata | null>(
    null,
  );
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [operationProgress, setOperationProgress] =
    useState<S3UploadProgress | null>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);

  // Query for fetching S3 backups
  const {
    data: backups = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<S3BackupMetadata[], Error>({
    queryKey: ["s3", "backups"],
    queryFn: async () => {
      await logger.info("Fetching S3 backups", {
        location: "S3BackupsScreen.queryFn",
      });

      return await s3BackupService.listBackups();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });

  const isBusy =
    isLoading || isFetching || isRefreshing || isOperationInProgress;
  const animationsEnabled = shouldAnimateLayout(isBusy, false);

  // Mutation for deleting backup
  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      await s3BackupService.deleteBackup(key);
    },
    onSuccess: () => {
      // Invalidate and refetch backups list
      void queryClient.invalidateQueries({ queryKey: ["s3", "backups"] });
      alert("Success", "Backup deleted successfully");
    },
    onError: (error: Error) => {
      alert("Error", error.message || "Failed to delete backup");
    },
  });

  // Mutation for downloading and restoring backup
  const restoreMutation = useMutation({
    mutationFn: async ({
      key,
      password,
    }: {
      key: string;
      password?: string;
    }) => {
      setIsOperationInProgress(true);
      setOperationProgress(null);

      await backupRestoreService.restoreFromS3(
        key,
        password,
        (progress: S3UploadProgress) => {
          setOperationProgress(progress);
        },
      );
    },
    onSuccess: () => {
      setIsOperationInProgress(false);
      setOperationProgress(null);
      alert(
        "Success",
        "Backup restored successfully. The app will reload to apply changes.",
        [
          {
            text: "OK",
            onPress: () => {
              // Reload the app to apply restored settings
              // In a real app, you might want to use a more graceful reload
              router.replace("/");
            },
          },
        ],
      );
    },
    onError: (error: Error) => {
      setIsOperationInProgress(false);
      setOperationProgress(null);

      // Provide clear error messages for decryption failures
      let errorMessage = error.message || "Failed to restore backup";

      if (
        errorMessage.includes("Decryption failed") ||
        errorMessage.includes("wrong password") ||
        errorMessage.includes("Invalid JSON structure")
      ) {
        errorMessage =
          "Decryption failed. Please verify your password is correct and try again.";
      } else if (
        errorMessage.includes("encrypted") &&
        errorMessage.includes("password")
      ) {
        errorMessage =
          "This backup is encrypted. Please provide the correct password.";
      }

      alert("Error", errorMessage);
    },
    onSettled: () => {
      // Ensure operation state is always reset
      setIsOperationInProgress(false);
      setOperationProgress(null);
    },
  });

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Navigate to S3 settings
  const handleNavigateToSettings = useCallback(() => {
    router.push("/(auth)/s3-backup/s3-settings");
  }, []);

  // Handle delete backup
  const handleDeleteBackup = useCallback((backup: S3BackupMetadata) => {
    setSelectedBackup(backup);
    setDeleteDialogVisible(true);
  }, []);

  // Confirm delete backup
  const handleConfirmDelete = useCallback(() => {
    if (selectedBackup) {
      deleteMutation.mutate(selectedBackup.key);
    }
    setDeleteDialogVisible(false);
    setSelectedBackup(null);
  }, [selectedBackup, deleteMutation]);

  // Cancel delete backup
  const handleCancelDelete = useCallback(() => {
    setDeleteDialogVisible(false);
    setSelectedBackup(null);
  }, []);

  // Handle download/restore backup
  const handleRestoreBackup = useCallback(
    (backup: S3BackupMetadata) => {
      setSelectedBackup(backup);

      // If backup is encrypted, show password dialog
      if (backup.encrypted) {
        setPassword("");
        setPasswordDialogVisible(true);
      } else {
        // Restore without password
        restoreMutation.mutate({ key: backup.key });
      }
    },
    [restoreMutation],
  );

  // Confirm restore with password
  const handleConfirmRestore = useCallback(() => {
    if (selectedBackup) {
      restoreMutation.mutate({
        key: selectedBackup.key,
        password: password || undefined,
      });
    }
    setPasswordDialogVisible(false);
    setSelectedBackup(null);
    setPassword("");
    setPasswordVisible(false);
  }, [selectedBackup, password, restoreMutation]);

  // Cancel restore
  const handleCancelRestore = useCallback(() => {
    setPasswordDialogVisible(false);
    setSelectedBackup(null);
    setPassword("");
    setPasswordVisible(false);
  }, []);

  // Handle upload new backup
  const handleUploadBackup = useCallback(() => {
    void logger.info("Opening upload backup modal", {
      location: "S3BackupsScreen.handleUploadBackup",
    });

    // Navigate to upload modal
    router.push("/(auth)/s3-backup/upload-backup-modal");
  }, []);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }, []);

  // Format date for display
  const formatDate = useCallback((dateInput: any): string => {
    // Accept string or number and coerce to Date safely
    if (!dateInput) return "Unknown date";
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!(date instanceof Date) || isNaN(date.getTime())) return "Unknown date";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      marginBottom: spacing.sm,
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
      borderRadius: borderRadius.xxl,
      marginVertical: spacing.xs,
    },
    backupCard: {
      backgroundColor: theme.colors.elevation.level1,
      elevation: 2,
      borderRadius: borderRadius.lg,
      marginVertical: spacing.xs,
    },
    backupCardContent: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    backupHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.xs,
    },
    backupInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    backupFileName: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      fontWeight: "600" as any,
      marginBottom: spacing.xxs,
    },
    backupMetadata: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
      marginTop: spacing.xxs,
    },
    backupMetadataText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
    backupActions: {
      flexDirection: "row",
      gap: spacing.xxs,
      alignItems: "center",
    },
    emptyStateContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxxl,
      paddingHorizontal: spacing.lg,
    },
    emptyStateIcon: {
      marginBottom: spacing.md,
    },
    emptyStateTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    emptyStateDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    errorContainer: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginVertical: spacing.md,
    },
    errorText: {
      color: theme.colors.onErrorContainer,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      textAlign: "center",
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxxl,
    },
    loadingText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      marginTop: spacing.md,
    },
    encryptedChip: {
      height: 24,
    },
    dialogContent: {
      paddingTop: spacing.md,
    },
    dialogActions: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    passwordInput: {
      marginBottom: spacing.md,
    },
    progressContainer: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    progressText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      textAlign: "center",
      marginTop: spacing.xs,
    },
  });

  // Render loading state
  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <TabHeader title="S3 Backups" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading backups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <TabHeader title="S3 Backups" />
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {error.message || "Failed to load backups"}
            </Text>
          </View>
          <Button
            mode="contained"
            icon="refresh"
            onPress={handleRefresh}
            accessibilityLabel="Retry loading backups"
            style={{ marginTop: spacing.md }}
          >
            Retry
          </Button>
          <Button
            mode="outlined"
            icon="cog"
            onPress={handleNavigateToSettings}
            style={{ marginTop: spacing.sm }}
          >
            Check S3 Settings
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render empty state
  if (backups.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <TabHeader title="S3 Backups" />
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          <View style={styles.emptyStateContainer}>
            <IconButton
              icon="cloud-off-outline"
              size={64}
              iconColor={theme.colors.onSurfaceVariant}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateTitle}>No Backups Found</Text>
            <Text style={styles.emptyStateDescription}>
              You don't have any backups stored in your S3 bucket yet. Create a
              backup to get started.
            </Text>
            <Button
              mode="contained"
              icon="cloud-upload"
              onPress={() => {
                void logger.info("Create Backup button pressed", {
                  location: "S3BackupsScreen.emptyState",
                  isOperationInProgress,
                });
                handleUploadBackup();
              }}
              disabled={isOperationInProgress}
              style={{ marginTop: spacing.sm }}
            >
              Create Backup
            </Button>
            <Button
              mode="outlined"
              icon="cog"
              accessibilityLabel="Open S3 Settings"
              onPress={handleNavigateToSettings}
              style={{ marginTop: spacing.sm }}
            >
              S3 Settings
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render backup list
  return (
    <SafeAreaView style={styles.container}>
      <TabHeader title="S3 Backups" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header Section */}
        <AnimatedSection
          style={styles.section}
          delay={0}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Available Backups</Text>
          <Text style={styles.sectionDescription}>
            {backups.length} backup{backups.length !== 1 ? "s" : ""} found in
            your S3 bucket. Pull down to refresh.
          </Text>
        </AnimatedSection>

        {/* Backup List */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          {backups.map((backup, index) => (
            <AnimatedListItem
              key={backup.key}
              index={index}
              totalItems={backups.length}
              staggerDelay={30}
              animated={animationsEnabled}
            >
              <Card style={styles.backupCard}>
                <Card.Content style={styles.backupCardContent}>
                  <View style={styles.backupHeader}>
                    <View style={styles.backupInfo}>
                      <Text
                        style={styles.backupFileName}
                        numberOfLines={2}
                        ellipsizeMode="middle"
                      >
                        {backup.fileName}
                      </Text>
                      <View style={styles.backupMetadata}>
                        <Text style={styles.backupMetadataText}>
                          {formatFileSize(backup.size)}
                        </Text>
                        <Text style={styles.backupMetadataText}>•</Text>
                        <Text style={styles.backupMetadataText}>
                          {formatDate(backup.lastModified)}
                        </Text>
                      </View>
                      {backup.encrypted && (
                        <Chip
                          icon="lock"
                          mode="outlined"
                          compact
                          style={[
                            styles.encryptedChip,
                            { marginTop: spacing.xs },
                          ]}
                        >
                          Encrypted
                        </Chip>
                      )}
                    </View>
                    <View style={styles.backupActions}>
                      <IconButton
                        icon="download"
                        size={20}
                        iconColor={theme.colors.primary}
                        onPress={() => handleRestoreBackup(backup)}
                        disabled={isOperationInProgress}
                        accessibilityLabel={`Download ${backup.fileName}`}
                        accessibilityHint="Download and restore this backup"
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        iconColor={theme.colors.error}
                        onPress={() => handleDeleteBackup(backup)}
                        disabled={isOperationInProgress}
                        accessibilityLabel={`Delete ${backup.fileName}`}
                        accessibilityHint="Delete this backup from S3"
                      />
                    </View>
                  </View>
                  {/* Inline progress indicator for the selected backup */}
                  {isOperationInProgress &&
                    selectedBackup?.key === backup.key &&
                    operationProgress && (
                      <View style={styles.progressContainer}>
                        <ProgressBar
                          progress={operationProgress.percentage / 100}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.progressText}>
                          {operationProgress.percentage}%
                        </Text>
                      </View>
                    )}
                </Card.Content>
              </Card>
            </AnimatedListItem>
          ))}
        </AnimatedSection>

        {/* Actions Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <View style={styles.card}>
            <Card.Content>
              <Button
                mode="contained"
                icon="cloud-upload"
                onPress={() => {
                  void logger.info("Upload New Backup button pressed", {
                    location: "S3BackupsScreen.actionSection",
                    isOperationInProgress,
                  });
                  handleUploadBackup();
                }}
                disabled={isOperationInProgress}
                style={{ marginBottom: spacing.sm }}
                accessibilityLabel="Upload a new backup to S3"
              >
                Upload New Backup
              </Button>
              <Button
                mode="outlined"
                icon="cog"
                accessibilityLabel="Open S3 Settings"
                onPress={handleNavigateToSettings}
              >
                S3 Settings
              </Button>
            </Card.Content>
          </View>
        </AnimatedSection>
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={handleCancelDelete}
          dismissable={!deleteMutation.isPending}
        >
          <Dialog.Title>Delete Backup</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text>
              Are you sure you want to delete this backup? This action cannot be
              undone.
            </Text>
            {selectedBackup && (
              <Text style={{ marginTop: spacing.sm, fontWeight: "600" }}>
                {selectedBackup.fileName}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={handleCancelDelete}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onPress={handleConfirmDelete}
              loading={deleteMutation.isPending}
              disabled={deleteMutation.isPending}
              textColor={theme.colors.error}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Password Dialog for Encrypted Backups */}
        <Dialog
          visible={passwordDialogVisible}
          onDismiss={handleCancelRestore}
          dismissable={!restoreMutation.isPending}
        >
          <Dialog.Title>Enter Password</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={{ marginBottom: spacing.md }}>
              This backup is encrypted. Please enter the password to decrypt and
              restore.
            </Text>
            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              autoFocus
              disabled={restoreMutation.isPending}
              style={styles.passwordInput}
              right={
                <TextInput.Icon
                  icon={passwordVisible ? "eye-off" : "eye"}
                  onPress={() => setPasswordVisible((v) => !v)}
                  forceTextInputFocus={false}
                />
              }
            />
            {restoreMutation.isPending && operationProgress && (
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={operationProgress.percentage / 100}
                  color={theme.colors.primary}
                />
                <Text style={styles.progressText}>
                  Downloading: {operationProgress.percentage}%
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={handleCancelRestore}
              disabled={restoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onPress={handleConfirmRestore}
              loading={restoreMutation.isPending}
              disabled={restoreMutation.isPending || !password}
            >
              Restore
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Progress Dialog for Non-Encrypted Restore */}
        <Dialog
          visible={
            restoreMutation.isPending &&
            !passwordDialogVisible &&
            operationProgress !== null
          }
          dismissable={false}
        >
          <Dialog.Title>Restoring Backup</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={{ marginBottom: spacing.md }}>
              Please wait while we download and restore your backup...
            </Text>
            {operationProgress && (
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={operationProgress.percentage / 100}
                  color={theme.colors.primary}
                />
                <Text style={styles.progressText}>
                  {operationProgress.percentage}%
                </Text>
              </View>
            )}
          </Dialog.Content>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default S3BackupsScreen;
