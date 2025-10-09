import { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Text, useTheme, Button, Switch, Portal, Dialog, RadioButton } from 'react-native-paper';

import { Card } from '@/components/common/Card';
import { AnimatedListItem } from '@/components/common/AnimatedComponents';
import { useSettingsStore, selectCloudBackupConfigs } from '@/store/settingsStore';
import { cloudStorageManager, type CloudProvider } from '@/services/backup/CloudStorageService';
import { logger } from '@/services/logger/LoggerService';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

interface CloudBackupSettingsProps {
  delay?: number;
}

export const CloudBackupSettings = ({ delay = 0 }: CloudBackupSettingsProps) => {
  const theme = useTheme<AppTheme>();
  const cloudBackupConfigs = useSettingsStore(selectCloudBackupConfigs);
  const { updateCloudBackupConfig } = useSettingsStore();

  const [isAuthDialogVisible, setIsAuthDialogVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);

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
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    radioGroup: {
      marginTop: spacing.md,
    },
    radioItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    authStatus: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    authStatusText: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      color: theme.colors.onSurfaceVariant,
    },
  });

  const handleToggleEnabled = async (provider: CloudProvider, enabled: boolean) => {
    updateCloudBackupConfig(provider, { enabled });

    if (enabled) {
      // Try to authenticate when enabling
      try {
        const authenticated = await cloudStorageManager.authenticateProvider(provider);
        if (!authenticated) {
          Alert.alert(
            'Authentication Required',
            `Please authenticate with ${provider === 'icloud' ? 'iCloud' : 'Google Drive'} to enable cloud backups.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Authenticate', onPress: () => handleAuthenticate(provider) }
            ]
          );
          // Revert the change if authentication fails
          updateCloudBackupConfig(provider, { enabled: false });
        }
      } catch (error) {
        updateCloudBackupConfig(provider, { enabled: false });
        Alert.alert('Error', 'Failed to authenticate with cloud provider');
      }
    }
  };

  const handleAuthenticate = async (provider: CloudProvider) => {
    setSelectedProvider(provider);
    setIsAuthDialogVisible(true);

    try {
      const authenticated = await cloudStorageManager.authenticateProvider(provider);
      if (authenticated) {
        Alert.alert('Success', `Successfully authenticated with ${provider === 'icloud' ? 'iCloud' : 'Google Drive'}`);
      } else {
        Alert.alert('Authentication Failed', `Could not authenticate with ${provider === 'icloud' ? 'iCloud' : 'Google Drive'}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Authentication failed');
    } finally {
      setIsAuthDialogVisible(false);
      setSelectedProvider(null);
    }
  };

  const handleAutoBackupToggle = (provider: CloudProvider, autoBackup: boolean) => {
    updateCloudBackupConfig(provider, { autoBackup });
  };

  const handleBackupFrequencyChange = (provider: CloudProvider, frequency: 'daily' | 'weekly' | 'monthly') => {
    updateCloudBackupConfig(provider, { backupFrequency: frequency });
  };

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cloud Backup Settings</Text>

        {Object.entries(cloudBackupConfigs).map(([providerKey, config], index) => {
          const provider = providerKey as CloudProvider;
          const isAvailable = cloudStorageManager.getService(provider)?.isAvailable;

          if (!isAvailable) return null;

          return (
            <AnimatedListItem key={provider} index={index} totalItems={Object.keys(cloudBackupConfigs).length}>
              <Card variant="custom" style={styles.settingCard}>
                <View style={styles.settingContent}>
                  <View style={styles.settingIcon}>
                    <Text style={{ fontSize: 20 }}>
                      {provider === 'icloud' ? '☁️' : '🌐'}
                    </Text>
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

                <View style={styles.switchContainer}>
                  <Text style={styles.settingSubtitle}>Enable Cloud Backup</Text>
                  <Switch
                    value={config.enabled}
                    onValueChange={(enabled) => handleToggleEnabled(provider, enabled)}
                  />
                </View>

                {config.enabled && (
                  <>
                    <View style={styles.switchContainer}>
                      <Text style={styles.settingSubtitle}>Auto Backup</Text>
                      <Switch
                        value={config.autoBackup || false}
                        onValueChange={(autoBackup) => handleAutoBackupToggle(provider, autoBackup)}
                      />
                    </View>

                    {config.autoBackup && (
                      <View style={styles.radioGroup}>
                        <Text style={[styles.settingSubtitle, { marginBottom: spacing.sm }]}>
                          Backup Frequency
                        </Text>
                        <RadioButton.Group
                          value={config.backupFrequency || 'weekly'}
                          onValueChange={(frequency) => handleBackupFrequencyChange(provider, frequency as 'daily' | 'weekly' | 'monthly')}
                        >
                          <View style={styles.radioItem}>
                            <RadioButton value="daily" />
                            <Text style={styles.settingSubtitle}>Daily</Text>
                          </View>
                          <View style={styles.radioItem}>
                            <RadioButton value="weekly" />
                            <Text style={styles.settingSubtitle}>Weekly</Text>
                          </View>
                          <View style={styles.radioItem}>
                            <RadioButton value="monthly" />
                            <Text style={styles.settingSubtitle}>Monthly</Text>
                          </View>
                        </RadioButton.Group>
                      </View>
                    )}

                    <View style={styles.authStatus}>
                      <Text style={styles.authStatusText}>
                        Status: {config.enabled ? 'Enabled' : 'Disabled'}
                        {config.autoBackup && ` • Auto backup: ${config.backupFrequency}`}
                      </Text>
                    </View>
                  </>
                )}
              </Card>
            </AnimatedListItem>
          );
        })}
      </View>

      {/* Authentication Dialog */}
      <Portal>
        <Dialog
          visible={isAuthDialogVisible}
          onDismiss={() => {
            setIsAuthDialogVisible(false);
            setSelectedProvider(null);
          }}
          style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            Authenticate {selectedProvider === 'icloud' ? 'iCloud' : 'Google Drive'}
          </Dialog.Title>
          <Dialog.Content style={{ padding: spacing.lg }}>
            <Text style={styles.settingSubtitle}>
              Authenticating with {selectedProvider === 'icloud' ? 'iCloud Drive' : 'Google Drive'}...
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={() => {
                setIsAuthDialogVisible(false);
                setSelectedProvider(null);
              }}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};
