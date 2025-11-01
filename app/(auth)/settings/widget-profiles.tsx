import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Text,
  useTheme,
  Button,
  TextInput,
  Portal,
  Dialog,
  Divider,
} from "react-native-paper";
import { SkiaLoader } from "@/components/common/SkiaLoader";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { TabHeader } from "@/components/common/TabHeader";
import { Card } from "@/components/common/Card";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { widgetProfileService } from "@/services/widgets/WidgetProfileService";
import { widgetService } from "@/services/widgets/WidgetService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { WidgetProfile } from "@/services/widgets/WidgetProfileService";

const WidgetProfilesScreen = () => {
  const theme = useTheme<AppTheme>();
  const [profiles, setProfiles] = useState<WidgetProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<WidgetProfile | null>(
    null,
  );
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
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
    profileCard: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      marginVertical: spacing.sm,
      padding: spacing.md,
    },
    profileHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },
    profileTitle: {
      flex: 1,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
    },
    profileDescription: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.sm,
    },
    profileMeta: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.md,
    },
    profileActions: {
      flexDirection: "row",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    actionButton: {
      flex: 1,
      minWidth: 80,
    },
    noProfiles: {
      alignItems: "center",
      paddingVertical: spacing.xl,
    },
    noProfilesIcon: {
      marginBottom: spacing.md,
    },
    noProfilesText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
    },
    buttonContainer: {
      gap: spacing.sm,
      marginVertical: spacing.md,
    },
    dialogContent: {
      gap: spacing.md,
    },
  });

  // Load profiles on screen focus
  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, []),
  );

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const loadedProfiles = await widgetProfileService.listProfiles();
      setProfiles(loadedProfiles);
    } catch (error) {
      await logger.error("[WidgetProfilesScreen] Failed to load profiles", {
        error,
      });
      alert("Error", "Failed to load widget profiles. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!profileName.trim()) {
      alert("Error", "Please enter a profile name");
      return;
    }

    try {
      setIsProcessing(true);
      const currentWidgets = await widgetService.getWidgets();

      const profile = await widgetProfileService.saveProfile(
        profileName.trim(),
        currentWidgets,
        profileDescription.trim() || undefined,
      );

      setProfileName("");
      setProfileDescription("");
      setShowCreateDialog(false);

      await alert("Success", `Profile "${profile.name}" created successfully`);

      await loadProfiles();
    } catch (error) {
      await logger.error("[WidgetProfilesScreen] Failed to create profile", {
        error,
      });
      alert("Error", "Failed to create profile. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadProfile = async (profile: WidgetProfile) => {
    try {
      setIsProcessing(true);

      // Use alert with buttons instead of Promise
      alert(
        "Load Profile",
        `Load widget configuration from "${profile.name}"? This will replace your current widget setup.`,
        [
          { text: "Cancel", onPress: () => setIsProcessing(false) },
          {
            text: "Load",
            onPress: async () => {
              try {
                // Restore widgets
                await widgetService.restoreWidgets(profile.widgets);

                await alert(
                  "Success",
                  `Widget configuration loaded from "${profile.name}"`,
                );

                await loadProfiles();
                setIsProcessing(false);
              } catch (error) {
                await logger.error(
                  "[WidgetProfilesScreen] Failed to load profile",
                  {
                    error,
                  },
                );
                alert("Error", "Failed to load profile. Please try again.");
                setIsProcessing(false);
              }
            },
            style: "default",
          },
        ],
      );
    } catch (error) {
      await logger.error("[WidgetProfilesScreen] Failed to load profile", {
        error,
      });
      alert("Error", "Failed to load profile. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleRenameProfile = async () => {
    if (!profileName.trim() || !selectedProfile) {
      return;
    }

    try {
      setIsProcessing(true);
      await widgetProfileService.renameProfile(
        selectedProfile.id,
        profileName.trim(),
      );

      setProfileName("");
      setShowRenameDialog(false);
      setSelectedProfile(null);

      await alert("Success", "Profile renamed successfully");
      await loadProfiles();
    } catch (error) {
      await logger.error("[WidgetProfilesScreen] Failed to rename profile", {
        error,
      });
      alert("Error", "Failed to rename profile. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProfile = async (profile: WidgetProfile) => {
    try {
      alert(
        "Delete Profile",
        `Are you sure you want to delete "${profile.name}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            onPress: async () => {
              try {
                setIsProcessing(true);
                await widgetProfileService.deleteProfile(profile.id);

                await alert("Success", "Profile deleted successfully");
                await loadProfiles();
              } catch (error) {
                await logger.error(
                  "[WidgetProfilesScreen] Failed to delete profile",
                  {
                    error,
                  },
                );
                alert("Error", "Failed to delete profile. Please try again.");
              } finally {
                setIsProcessing(false);
              }
            },
            style: "destructive",
          },
        ],
      );
    } catch (error) {
      await logger.error("[WidgetProfilesScreen] Failed to delete profile", {
        error,
      });
      alert("Error", "Failed to delete profile. Please try again.");
    }
  };

  const handleExportProfile = async (profile: WidgetProfile) => {
    try {
      setIsProcessing(true);
      await widgetProfileService.exportProfile(profile.id);
    } catch (error) {
      await logger.error("[WidgetProfilesScreen] Failed to export profile", {
        error,
      });
      alert("Error", "Failed to export profile. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openRenameDialog = (profile: WidgetProfile) => {
    setSelectedProfile(profile);
    setProfileName(profile.name);
    setShowRenameDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader title="Widget Profiles" />

      {isLoading ? (
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <SkiaLoader size={80} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Profiles</Text>
            <Text style={styles.sectionDescription}>
              Save and load different widget configurations. Use profiles to
              quickly switch between different dashboard setups.
            </Text>

            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={() => {
                  setProfileName("");
                  setProfileDescription("");
                  setShowCreateDialog(true);
                }}
                disabled={isProcessing}
                icon="plus"
              >
                Create Profile
              </Button>
            </View>
          </View>

          {profiles.length === 0 ? (
            <Card>
              <View style={styles.noProfiles}>
                <MaterialCommunityIcons
                  name="folder-open-outline"
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                  style={styles.noProfilesIcon}
                />
                <Text style={styles.noProfilesText}>
                  No widget profiles yet
                </Text>
                <Text style={styles.sectionDescription}>
                  Create your first profile to get started
                </Text>
              </View>
            </Card>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Saved Profiles ({profiles.length})
              </Text>

              {profiles.map((profile, index) => (
                <View key={profile.id}>
                  <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                      <Text style={styles.profileTitle}>{profile.name}</Text>
                      <Text style={styles.profileMeta}>
                        {profile.widgets.length} widgets
                      </Text>
                    </View>

                    {profile.description && (
                      <Text style={styles.profileDescription}>
                        {profile.description}
                      </Text>
                    )}

                    <Text style={styles.profileMeta}>
                      Last updated: {formatDate(profile.updatedAt)}
                    </Text>

                    <View style={styles.profileActions}>
                      <Button
                        mode="outlined"
                        onPress={() => handleLoadProfile(profile)}
                        disabled={isProcessing}
                        style={styles.actionButton}
                        icon="restore"
                        compact
                      >
                        Load
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => openRenameDialog(profile)}
                        disabled={isProcessing}
                        style={styles.actionButton}
                        icon="pencil"
                        compact
                      >
                        Rename
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => handleExportProfile(profile)}
                        disabled={isProcessing}
                        style={styles.actionButton}
                        icon="download"
                        compact
                      >
                        Export
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => handleDeleteProfile(profile)}
                        disabled={isProcessing}
                        textColor={theme.colors.error}
                        style={styles.actionButton}
                        icon="trash-can"
                        compact
                      >
                        Delete
                      </Button>
                    </View>
                  </View>

                  {index < profiles.length - 1 && (
                    <Divider style={{ marginVertical: spacing.sm }} />
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Create Profile Dialog */}
      <Portal>
        <Dialog
          visible={showCreateDialog}
          onDismiss={() => setShowCreateDialog(false)}
        >
          <Dialog.Title>Create New Profile</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <TextInput
              label="Profile Name"
              value={profileName}
              onChangeText={setProfileName}
              disabled={isProcessing}
              placeholder="e.g., Daily Dashboard"
            />
            <TextInput
              label="Description (optional)"
              value={profileDescription}
              onChangeText={setProfileDescription}
              disabled={isProcessing}
              placeholder="e.g., My everyday dashboard setup"
              multiline
              numberOfLines={2}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setShowCreateDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onPress={handleCreateProfile}
              disabled={isProcessing || !profileName.trim()}
              loading={isProcessing}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Rename Profile Dialog */}
      <Portal>
        <Dialog
          visible={showRenameDialog}
          onDismiss={() => setShowRenameDialog(false)}
        >
          <Dialog.Title>Rename Profile</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <TextInput
              label="Profile Name"
              value={profileName}
              onChangeText={setProfileName}
              disabled={isProcessing}
              placeholder="Enter new name"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setShowRenameDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onPress={handleRenameProfile}
              disabled={isProcessing || !profileName.trim()}
              loading={isProcessing}
            >
              Rename
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default WidgetProfilesScreen;
