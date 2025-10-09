import { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, FlatList } from 'react-native';
import { Text, useTheme, Button, IconButton, Portal, Dialog, TextInput, ActivityIndicator, List, Chip } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { Card } from '@/components/common/Card';
import { AnimatedListItem } from '@/components/common/AnimatedComponents';
import { backupService, type ImportResult } from '@/services/backup';
import { cloudStorageManager, type CloudProvider, type CloudFile } from '@/services/backup/CloudStorageService';
import { logger } from '@/services/logger/LoggerService';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

interface BackupRestoreSectionProps {
  delay?: number;
}

export const BackupRestoreSection = ({ delay = 0 }: BackupRestoreSectionProps) => {
  const theme = useTheme<AppTheme>();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isEncryptionDialogVisible, setIsEncryptionDialogVisible] = useState(false);
  const [isImportDialogVisible, setIsImportDialogVisible] = useState(false);
  const [isCloudDialogVisible, setIsCloudDialogVisible] = useState(false);
  const [isCloudBackupDialogVisible, setIsCloudBackupDialogVisible] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [importEncryptionKey, setImportEncryptionKey] = useState('');
  const [backupFileUri, setBackupFileUri] = useState<string | null>(null);
  const [cloudProviders, setCloudProviders] = useState<CloudProvider[]>([]);
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<CloudProvider | null>(null);
  const [cloudBackups, setCloudBackups] = useState<CloudFile[]>([]);
  const [isLoadingCloudBackups, setIsLoadingCloudBackups] = useState(false);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);

  // Load available cloud providers on mount
  useEffect(() => {
    const loadCloudProviders = async () => {
      try {
        const providers = await backupService.getAvailableCloudProviders();
        setCloudProviders(providers);
      } catch (error) {
        await logger.error('Failed to load cloud providers', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    loadCloudProviders();
  }, []);

  const styles = StyleSheet.create({
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
    settingCard: {
      backgroundColor: theme.colors.elevation.level1,
      marginHorizontal: spacing.xs,
      marginVertical: spacing.xs,
      borderRadius: 12,
      padding: spacing.md,
    },
    settingContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      marginBottom: spacing.xxs,
    },
    settingSubtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
      fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
      marginBottom: spacing.xxs,
    },
    settingValue: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
    },
    buttonGroup: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    dialogContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    textInput: {
      marginBottom: spacing.md,
    },
    warningText: {
      color: theme.colors.error,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      marginTop: spacing.sm,
    },
  });

  const handleCreateBackup = async (withEncryption: boolean = false) => {
    setIsCreatingBackup(true);
    try {
      let key: string | undefined;

      if (withEncryption) {
        setIsEncryptionDialogVisible(true);
        return; // Wait for user input
      }

      const fileUri = await backupService.createBackup(key);

      if (fileUri) {
        const shared = await backupService.shareBackup(fileUri);
        if (!shared) {
          Alert.alert('Backup Created', 'Backup file saved but could not be shared. Check your files app.');
        }
      } else {
        Alert.alert('Backup Failed', 'Failed to create backup. Please try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      await logger.error('Failed to create backup', { error: message });
      Alert.alert('Backup Failed', message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleCreateEncryptedBackup = () => {
    setIsEncryptionDialogVisible(true);
  };

  const handleEncryptionConfirm = async () => {
    if (!encryptionKey.trim()) {
      Alert.alert('Error', 'Please enter an encryption key');
      return;
    }

    setIsEncryptionDialogVisible(false);
    setIsCreatingBackup(true);

    try {
      const fileUri = await backupService.createBackup(encryptionKey.trim());

      if (fileUri) {
        const shared = await backupService.shareBackup(fileUri);
        if (!shared) {
          Alert.alert('Encrypted Backup Created', 'Encrypted backup file saved but could not be shared.');
        }
      } else {
        Alert.alert('Backup Failed', 'Failed to create encrypted backup. Please try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      await logger.error('Failed to create encrypted backup', { error: message });
      Alert.alert('Backup Failed', message);
    } finally {
      setIsCreatingBackup(false);
      setEncryptionKey('');
    }
  };

  const handleImportBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset?.uri) {
        Alert.alert('Error', 'Failed to access backup file');
        return;
      }

      setBackupFileUri(asset.uri);
      setIsImportDialogVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select backup file';
      await logger.error('Failed to select backup file', { error: message });
      Alert.alert('Import Failed', message);
    }
  };

  const handleImportConfirm = async () => {
    if (!backupFileUri) {
      Alert.alert('Error', 'No backup file selected');
      return;
    }

    setIsImportDialogVisible(false);
    setIsImportingBackup(true);

    try {
      const result: ImportResult = await backupService.importBackup(
        backupFileUri,
        importEncryptionKey.trim() || undefined
      );

      if (result.success) {
        Alert.alert(
          'Import Successful',
          `Successfully imported ${result.importedServices} services and ${result.importedSettings ? 'settings' : 'no settings'}.`
        );
      } else {
        Alert.alert(
          'Import Completed with Errors',
          `Imported ${result.importedServices} services and ${result.importedSettings ? 'settings' : 'no settings'}, but encountered errors:\n\n${result.errors.join('\n')}`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import backup';
      await logger.error('Failed to import backup', { error: message });
      Alert.alert('Import Failed', message);
    } finally {
      setIsImportingBackup(false);
      setImportEncryptionKey('');
      setBackupFileUri(null);
    }
  };

  const handleImportCancel = () => {
    setIsImportDialogVisible(false);
    setImportEncryptionKey('');
    setBackupFileUri(null);
  };

  const handleShowCloudBackups = async (provider: CloudProvider) => {
    setSelectedCloudProvider(provider);
    setIsCloudDialogVisible(true);
    setIsLoadingCloudBackups(true);

    try {
      const backups = await backupService.listCloudBackups(provider);
      setCloudBackups(backups);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load cloud backups';
      Alert.alert('Error', message);
    } finally {
      setIsLoadingCloudBackups(false);
    }
  };

  const handleCreateCloudBackup = async (provider: CloudProvider, withEncryption: boolean = false) => {
    setIsCloudBackupDialogVisible(true);
    setSelectedCloudProvider(provider);

    if (!withEncryption) {
      await handleCreateCloudBackupConfirm(provider, undefined);
    }
  };

  const handleCreateCloudBackupConfirm = async (provider: CloudProvider, encryptionKey?: string) => {
    setIsCloudBackupDialogVisible(false);
    setIsUploadingToCloud(true);

    try {
      const remoteUri = await backupService.createAndUploadBackup(provider, encryptionKey);

      if (remoteUri) {
        Alert.alert('Success', `Backup uploaded to ${provider} successfully`);
      } else {
        Alert.alert('Error', `Failed to upload backup to ${provider}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to upload backup to ${provider}`;
      Alert.alert('Error', message);
    } finally {
      setIsUploadingToCloud(false);
      setEncryptionKey('');
      setSelectedCloudProvider(null);
    }
  };

  const handleDownloadCloudBackup = async (backup: CloudFile) => {
    if (!selectedCloudProvider) return;

    setIsCloudDialogVisible(false);

    try {
      // For encrypted backups, we would need to show a dialog for the key
      // For now, assume unencrypted or handle in a separate flow
      const localUri = await backupService.downloadBackupFromCloud(
        selectedCloudProvider,
        backup.uri
      );

      if (localUri) {
        // Import the downloaded backup
        const result: ImportResult = await backupService.importBackup(localUri);

        if (result.success) {
          Alert.alert(
            'Import Successful',
            `Successfully imported ${result.importedServices} services and ${result.importedSettings ? 'settings' : 'no settings'} from cloud backup.`
          );
        } else {
          Alert.alert(
            'Import Completed with Errors',
            `Imported ${result.importedServices} services and ${result.importedSettings ? 'settings' : 'no settings'}, but encountered errors:\n\n${result.errors.join('\n')}`
          );
        }

        // Clean up downloaded file
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download and import backup';
      Alert.alert('Error', message);
    }
  };

  const handleDeleteCloudBackup = async (backup: CloudFile) => {
    if (!selectedCloudProvider) return;

    Alert.alert(
      'Delete Backup',
      `Are you sure you want to delete "${backup.name}" from ${selectedCloudProvider}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await backupService.deleteCloudBackup(selectedCloudProvider, backup.uri);
              if (success) {
                // Refresh the list
                const backups = await backupService.listCloudBackups(selectedCloudProvider);
                setCloudBackups(backups);
                Alert.alert('Success', 'Backup deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete backup');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete backup';
              Alert.alert('Error', message);
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup & Restore</Text>

        <AnimatedListItem index={0} totalItems={2}>
          <Card variant="custom" style={styles.settingCard}>
            <View style={styles.settingContent}>
              <View style={styles.settingIcon}>
                <IconButton icon="backup-restore" size={24} iconColor={theme.colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Create Backup</Text>
                <Text style={styles.settingSubtitle}>Export all settings and service configurations</Text>
              </View>
            </View>
            <View style={styles.buttonGroup}>
              <Button
                mode="contained"
                compact
                onPress={() => handleCreateBackup(false)}
                loading={isCreatingBackup}
                disabled={isCreatingBackup || isImportingBackup}
              >
                Backup
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={handleCreateEncryptedBackup}
                loading={isCreatingBackup}
                disabled={isCreatingBackup || isImportingBackup}
              >
                Encrypted
              </Button>
            </View>
          </Card>
        </AnimatedListItem>

        <AnimatedListItem index={1} totalItems={2}>
          <Card variant="custom" style={styles.settingCard}>
            <View style={styles.settingContent}>
              <View style={styles.settingIcon}>
                <IconButton icon="file-upload" size={24} iconColor={theme.colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Restore Backup</Text>
                <Text style={styles.settingSubtitle}>Import settings and service configurations</Text>
              </View>
            </View>
            <Button
              mode="outlined"
              compact
              onPress={handleImportBackup}
              loading={isImportingBackup}
              disabled={isCreatingBackup || isImportingBackup}
            >
              Import
            </Button>
          </Card>
        </AnimatedListItem>

        {/* Cloud Storage Section */}
        {cloudProviders.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Cloud Storage</Text>

            {cloudProviders.map((provider, index) => (
              <AnimatedListItem key={provider} index={index + 2} totalItems={cloudProviders.length + 2}>
                <Card variant="custom" style={styles.settingCard}>
                  <View style={styles.settingContent}>
                    <View style={styles.settingIcon}>
                      <IconButton
                        icon={provider === 'icloud' ? 'cloud' : 'google-drive'}
                        size={24}
                        iconColor={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingTitle}>
                        {provider === 'icloud' ? 'iCloud Drive' : 'Google Drive'}
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        {provider === 'icloud' ? 'Sync backups with iCloud' : 'Sync backups with Google Drive'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.buttonGroup}>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => handleShowCloudBackups(provider)}
                      loading={isLoadingCloudBackups && selectedCloudProvider === provider}
                      disabled={isCreatingBackup || isImportingBackup || isUploadingToCloud}
                    >
                      View Backups
                    </Button>
                    <Button
                      mode="contained"
                      compact
                      onPress={() => handleCreateCloudBackup(provider, false)}
                      loading={isUploadingToCloud && selectedCloudProvider === provider}
                      disabled={isCreatingBackup || isImportingBackup || isUploadingToCloud}
                    >
                      Backup to Cloud
                    </Button>
                  </View>
                </Card>
              </AnimatedListItem>
            ))}
          </>
        )}
      </View>

      {/* Encryption Key Dialog */}
      <Portal>
        <Dialog
          visible={isEncryptionDialogVisible}
          onDismiss={() => {
            setIsEncryptionDialogVisible(false);
            setEncryptionKey('');
          }}
          style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
        >
          <Dialog.Title style={styles.sectionTitle}>Set Encryption Key</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.settingSubtitle}>
              Enter a password to encrypt your backup. You'll need this same password to restore from this backup.
            </Text>
            <TextInput
              mode="outlined"
              label="Encryption Key"
              value={encryptionKey}
              onChangeText={setEncryptionKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
            />
            <Text style={styles.warningText}>
              ⚠️ Warning: If you lose this password, you won't be able to restore from this backup!
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="outlined" onPress={() => {
              setIsEncryptionDialogVisible(false);
              setEncryptionKey('');
            }}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleEncryptionConfirm}
              disabled={!encryptionKey.trim()}
            >
              Create Encrypted Backup
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Import Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={isImportDialogVisible}
          onDismiss={handleImportCancel}
          style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
        >
          <Dialog.Title style={styles.sectionTitle}>Import Backup</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.settingSubtitle}>
              Importing will replace your current settings and service configurations. This action cannot be undone.
            </Text>
            <Text style={styles.settingSubtitle}>
              If this backup is encrypted, enter the encryption key below:
            </Text>
            <TextInput
              mode="outlined"
              label="Encryption Key (if required)"
              value={importEncryptionKey}
              onChangeText={setImportEncryptionKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
              placeholder="Leave empty if backup is not encrypted"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="outlined" onPress={handleImportCancel}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleImportConfirm}
              loading={isImportingBackup}
              disabled={isImportingBackup}
            >
              {isImportingBackup ? <ActivityIndicator size="small" color={theme.colors.onPrimary} /> : 'Import Backup'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Cloud Backups Dialog */}
      <Portal>
        <Dialog
          visible={isCloudDialogVisible}
          onDismiss={() => {
            setIsCloudDialogVisible(false);
            setSelectedCloudProvider(null);
            setCloudBackups([]);
          }}
          style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            {selectedCloudProvider === 'icloud' ? 'iCloud Drive' : 'Google Drive'} Backups
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {isLoadingCloudBackups ? (
              <View style={{ padding: spacing.lg }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.settingSubtitle, { textAlign: 'center', marginTop: spacing.md }]}>
                  Loading backups...
                </Text>
              </View>
            ) : cloudBackups.length > 0 ? (
              <FlatList
                data={cloudBackups}
                keyExtractor={(item) => item.uri}
                renderItem={({ item }) => (
                  <List.Item
                    title={item.name}
                    description={`${new Date(item.modifiedAt).toLocaleDateString()} • ${Math.round((item.size || 0) / 1024)}KB`}
                    left={(props) => <List.Icon {...props} icon="file" />}
                    right={(props) => (
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        <IconButton
                          {...props}
                          icon="download"
                          size={20}
                          onPress={() => handleDownloadCloudBackup(item)}
                        />
                        <IconButton
                          {...props}
                          icon="delete"
                          size={20}
                          onPress={() => handleDeleteCloudBackup(item)}
                        />
                      </View>
                    )}
                  />
                )}
                style={{ maxHeight: 300 }}
              />
            ) : (
              <View style={{ padding: spacing.lg }}>
                <Text style={[styles.settingSubtitle, { textAlign: 'center' }]}>
                  No backups found in {selectedCloudProvider === 'icloud' ? 'iCloud Drive' : 'Google Drive'}
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={() => {
                setIsCloudDialogVisible(false);
                setSelectedCloudProvider(null);
                setCloudBackups([]);
              }}
            >
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Cloud Backup Creation Dialog */}
      <Portal>
        <Dialog
          visible={isCloudBackupDialogVisible}
          onDismiss={() => {
            setIsCloudBackupDialogVisible(false);
            setSelectedCloudProvider(null);
            setEncryptionKey('');
          }}
          style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            Create Cloud Backup
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.settingSubtitle}>
              Create a backup and upload it to {selectedCloudProvider === 'icloud' ? 'iCloud Drive' : 'Google Drive'}
            </Text>
            <Text style={styles.settingSubtitle}>
              Optionally encrypt the backup with a password:
            </Text>
            <TextInput
              mode="outlined"
              label="Encryption Key (optional)"
              value={encryptionKey}
              onChangeText={setEncryptionKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
              placeholder="Leave empty for unencrypted backup"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={() => {
                setIsCloudBackupDialogVisible(false);
                setSelectedCloudProvider(null);
                setEncryptionKey('');
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => handleCreateCloudBackupConfirm(selectedCloudProvider!, encryptionKey.trim() || undefined)}
              loading={isUploadingToCloud}
              disabled={isUploadingToCloud}
            >
              {isUploadingToCloud ? (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              ) : (
                'Create & Upload'
              )}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};
