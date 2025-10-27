import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme, Button, Divider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { TabHeader } from "@/components/common/TabHeader";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { widgetProfileService } from "@/services/widgets/WidgetProfileService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

const BackupRestoreProfilesScreen = () => {
  const theme = useTheme<AppTheme>();
  const [isProcessing, setIsProcessing] = useState(false);

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
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      marginBottom: spacing.md,
    },
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      marginBottom: spacing.md,
    },
    instructionCard: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      marginVertical: spacing.sm,
      padding: spacing.md,
    },
    instructionTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: spacing.sm,
    },
    instructionText: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.sm,
      lineHeight: 20,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginVertical: spacing.md,
    },
    featureList: {
      marginTop: spacing.md,
      gap: spacing.md,
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    featureIcon: {
      marginTop: spacing.xs,
    },
    featureText: {
      flex: 1,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      color: theme.colors.onSurface,
    },
    warningCard: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 12,
      marginVertical: spacing.md,
      padding: spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.error,
    },
    warningTitle: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontWeight: "600" as const,
      color: theme.colors.error,
      marginBottom: spacing.sm,
    },
    warningText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      color: theme.colors.onErrorContainer,
      lineHeight: 18,
    },
  });

  const handleImportProfile = async () => {
    try {
      setIsProcessing(true);

      const profile = await widgetProfileService.importProfile();

      await alert(
        "Success",
        `Profile "${profile.name}" imported successfully. You can now load it from the Widget Profiles screen.`,
      );
    } catch (error) {
      // Check if it's a cancelled operation
      if (error instanceof Error && error.message.includes("cancelled")) {
        // User cancelled, no error needed
        return;
      }

      await logger.error(
        "[BackupRestoreProfilesScreen] Failed to import profile",
        {
          error,
        },
      );
      alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to import profile. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader title="Import Widget Profile" />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Import Profile</Text>
          <Text style={styles.sectionDescription}>
            Load a previously exported widget profile JSON file to restore
            widget configurations.
          </Text>

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>How to Import</Text>
            <Text style={styles.instructionText}>
              1. Tap the "Choose File" button below
            </Text>
            <Text style={styles.instructionText}>
              2. Select a widget profile JSON file from your device
            </Text>
            <Text style={styles.instructionText}>
              3. The profile will be imported and saved
            </Text>
            <Text style={styles.instructionText}>
              4. Go to Widget Profiles to load the imported configuration
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleImportProfile}
              disabled={isProcessing}
              loading={isProcessing}
              icon="file-import"
            >
              Choose File
            </Button>
          </View>
        </View>

        <Divider style={{ marginVertical: spacing.lg }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Features</Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={theme.colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: "600" }}>Widget Order:</Text> Save
                and restore the exact order of your widgets
              </Text>
            </View>

            <View style={styles.featureItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={theme.colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: "600" }}>Widget Settings:</Text>{" "}
                Preserve enabled/disabled status and widget sizes
              </Text>
            </View>

            <View style={styles.featureItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={theme.colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: "600" }}>Custom Configs:</Text> Each
                widget's custom configuration is saved
              </Text>
            </View>

            <View style={styles.featureItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={theme.colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: "600" }}>Portable:</Text> Share
                profiles between devices or users
              </Text>
            </View>

            <View style={styles.featureItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={theme.colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: "600" }}>Multiple Profiles:</Text>
                {" Save as many profiles as you need"}
              </Text>
            </View>
          </View>
        </View>

        <Divider style={{ marginVertical: spacing.lg }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Related Options</Text>

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>Widget Profiles Screen</Text>
            <Text style={styles.instructionText}>
              Go to Settings → Widget Profiles to create, manage, and load
              widget profiles directly in the app.
            </Text>
          </View>

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>Full Backup & Restore</Text>
            <Text style={styles.instructionText}>
              For complete app backup including services and preferences, use
              Settings → Backup & Restore.
            </Text>
          </View>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            <MaterialCommunityIcons name="alert" size={16} /> Important
          </Text>
          <Text style={styles.warningText}>
            Importing a profile will not affect your service configurations.
            Only widget layout and settings are changed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BackupRestoreProfilesScreen;
