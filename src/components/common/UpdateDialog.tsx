import { View, StyleSheet, ScrollView } from "react-native";
import { Dialog, Button, Text, useTheme } from "react-native-paper";
import * as Linking from "expo-linking";
import { useState, useCallback } from "react";
import type { AppTheme } from "@/constants/theme";
import type { UpdateCheckResult } from "@/services/appUpdate/AppUpdateService";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { logger } from "@/services/logger/LoggerService";

export interface UpdateDialogProps {
  visible: boolean;
  updateData?: UpdateCheckResult;
  onDismiss: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Dialog component for displaying app update information
 * Shows version info, truncated release notes with expand option, and download button
 */
export function UpdateDialog({
  visible,
  updateData,
  onDismiss,
  isLoading = false,
  error = null,
}: UpdateDialogProps) {
  const theme = useTheme<AppTheme>();
  const [expandedNotes, setExpandedNotes] = useState(false);

  const handleOpenReleaseUrl = useCallback(async () => {
    if (!updateData?.releaseUrl) {
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(updateData.releaseUrl);
      if (canOpen) {
        await Linking.openURL(updateData.releaseUrl);
      } else {
        void logger.error("Cannot open release URL", {
          location: "UpdateDialog.handleOpenReleaseUrl",
          url: updateData.releaseUrl,
        });
      }
    } catch (err) {
      void logger.error("Failed to open release URL", {
        location: "UpdateDialog.handleOpenReleaseUrl",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [updateData?.releaseUrl]);

  const handleClose = useCallback(() => {
    setExpandedNotes(false);
    onDismiss();
  }, [onDismiss]);

  const styles = StyleSheet.create({
    dialogContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 120,
    },
    section: {
      marginBottom: spacing.md,
    },
    versionRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: spacing.xs,
    },
    versionLabel: {
      flex: 1,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
    versionValue: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      fontWeight: "600" as const,
    },
    releaseNotesContainer: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginVertical: spacing.sm,
    },
    releaseNotesText: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: 20,
    },
    expandButton: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },
    buttonContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
  });

  const dialogTitle = isLoading
    ? "Checking for Updates"
    : error
      ? "Update Check Failed"
      : "App Update Available";

  return (
    <Dialog
      visible={visible}
      onDismiss={handleClose}
      style={{
        borderRadius: borderRadius.xl,
        backgroundColor: theme.colors.elevation.level1,
      }}
    >
      <Dialog.Title style={{ color: theme.colors.onSurface }}>
        {dialogTitle}
      </Dialog.Title>

      <ScrollView
        scrollEnabled={expandedNotes || (error ? true : false)}
        style={styles.dialogContent}
      >
        {isLoading ? (
          <Text style={styles.releaseNotesText}>Checking for updates…</Text>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : updateData ? (
          <>
            {/* Version Information */}
            <View style={styles.section}>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Current Version:</Text>
                <Text style={styles.versionValue}>
                  v{updateData.currentVersion}
                </Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Latest Version:</Text>
                <Text style={styles.versionValue}>
                  v{updateData.latestVersion}
                </Text>
              </View>
            </View>

            {/* Release Notes */}
            {updateData.releaseNotes && (
              <View style={styles.section}>
                <Text
                  style={{
                    color: theme.colors.onSurface,
                    fontSize: theme.custom.typography.labelMedium.fontSize,
                    fontFamily: theme.custom.typography.labelMedium.fontFamily,
                    fontWeight: "600" as const,
                    marginBottom: spacing.xs,
                  }}
                >
                  Release Notes:
                </Text>
                <View style={styles.releaseNotesContainer}>
                  <Text
                    numberOfLines={expandedNotes ? undefined : 3}
                    style={styles.releaseNotesText}
                  >
                    {updateData.releaseNotes}
                  </Text>
                </View>
                {updateData.releaseNotes.length > 200 && (
                  <Button
                    mode="text"
                    compact
                    onPress={() => setExpandedNotes(!expandedNotes)}
                    style={styles.expandButton}
                  >
                    {expandedNotes ? "Show less" : "Show more"}
                  </Button>
                )}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      <Dialog.Actions
        style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}
      >
        <Button mode="outlined" onPress={handleClose}>
          Dismiss
        </Button>
        <Button
          mode="contained"
          onPress={handleOpenReleaseUrl}
          disabled={isLoading || !updateData}
          loading={isLoading}
        >
          Download
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}
