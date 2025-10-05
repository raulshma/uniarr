import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View, ScrollView } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { Text, useTheme, Button, Switch, IconButton, Chip, Portal, Dialog } from 'react-native-paper';
import ConfirmDialog from '@/components/common/ConfirmDialog/ConfirmDialog';
import { Card } from '@/components/common/Card';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { imageCacheService, type ImageCacheUsage } from '@/services/image/ImageCacheService';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';
import { useSettingsStore } from '@/store/settingsStore';

const SettingsScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [refreshIntervalVisible, setRefreshIntervalVisible] = useState(false);
  const theme = useTheme<AppTheme>();

  // Settings store
  const {
    theme: themePreference,
    notificationsEnabled,
    refreshIntervalMinutes,
    setTheme,
    setNotificationsEnabled,
    setRefreshIntervalMinutes,
  } = useSettingsStore();
  const [imageCacheUsage, setImageCacheUsage] = useState<ImageCacheUsage>({
    size: 0,
    fileCount: 0,
    formattedSize: '0 B',
  });
  const [isFetchingCacheUsage, setIsFetchingCacheUsage] = useState(false);
  const [isClearingImageCache, setIsClearingImageCache] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    scrollContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingTop: spacing.sm,
    },
    backButton: {
      marginRight: spacing.md,
    },
    title: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      color: theme.colors.onBackground,
      fontWeight: '600',
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      color: theme.colors.onBackground,
      fontWeight: '600',
      marginBottom: spacing.md,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    settingLabel: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      color: theme.colors.onSurface,
    },
    settingValue: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      color: theme.colors.onSurfaceVariant,
    },
    themeOptions: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    themeChip: {
      borderRadius: 16,
    },
    signOutButton: {
      marginTop: spacing.lg,
      marginBottom: 0,
    },
  });

  const loadImageCacheUsage = useCallback(async () => {
    setIsFetchingCacheUsage(true);
    try {
      const usage = await imageCacheService.getCacheUsage();
      setImageCacheUsage(usage);
    } catch (error) {
      const message = getReadableErrorMessage(error);
      void logger.error('SettingsScreen: failed to load image cache usage.', { error: message });
      Alert.alert('Unable to load cache usage', message);
    } finally {
      setIsFetchingCacheUsage(false);
    }
  }, []);

  useEffect(() => {
    void loadImageCacheUsage();
  }, [loadImageCacheUsage]);

  const handleClearImageCache = async () => {
    setIsClearingImageCache(true);
    try {
      await imageCacheService.clearCache();
      await loadImageCacheUsage();
      Alert.alert('Image cache cleared', 'Poster images will be refreshed on next load.');
    } catch (error) {
      const message = getReadableErrorMessage(error);
      void logger.error('SettingsScreen: failed to clear image cache.', { error: message });
      Alert.alert('Unable to clear image cache', message);
    } finally {
      setIsClearingImageCache(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(public)/login');
    } catch (signOutError) {
      const message =
        signOutError instanceof Error
          ? signOutError.message
          : 'Unable to sign out. Please try again.';

      Alert.alert('Sign out failed', message);
    }
  };

  const confirmSignOut = () => setConfirmVisible(true);

  const handleThemeSelection = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme as any);
  };

  const handleRefreshIntervalPress = () => {
    setRefreshIntervalVisible(true);
  };

  const handleRefreshIntervalSelect = (minutes: number) => {
    setRefreshIntervalMinutes(minutes);
    setRefreshIntervalVisible(false);
  };

  const getThemeChipColor = (chipTheme: 'light' | 'dark' | 'system') => {
    if (themePreference === chipTheme) {
      return {
        backgroundColor: theme.colors.primary,
        textColor: theme.colors.onPrimary,
      };
    }
    return {
      backgroundColor: theme.colors.surfaceVariant,
      textColor: theme.colors.onSurfaceVariant,
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
            style={styles.backButton}
            iconColor={theme.colors.onBackground}
          />
      <Text style={styles.title}>Settings</Text>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Card contentPadding="md">
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Theme</Text>
              <View style={styles.themeOptions}>
                <Chip
                  mode="outlined"
                  style={[
                    styles.themeChip,
                    { backgroundColor: getThemeChipColor('light').backgroundColor }
                  ]}
                  textStyle={{ color: getThemeChipColor('light').textColor }}
                  onPress={() => handleThemeSelection('light')}
                >
                  Light
                </Chip>
                <Chip
                  mode="outlined"
                  style={[
                    styles.themeChip,
                    { backgroundColor: getThemeChipColor('dark').backgroundColor }
                  ]}
                  textStyle={{ color: getThemeChipColor('dark').textColor }}
                  onPress={() => handleThemeSelection('dark')}
                >
                  Dark
                </Chip>
                <Chip
                  mode="outlined"
                  style={[
                    styles.themeChip,
                    { backgroundColor: getThemeChipColor('system').backgroundColor }
                  ]}
                  textStyle={{ color: getThemeChipColor('system').textColor }}
                  onPress={() => handleThemeSelection('system')}
                >
                  System
                </Chip>
              </View>
            </View>
          </Card>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Card contentPadding="md">
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Enable Notifications</Text>
                <Text style={{ ...styles.settingValue, fontSize: 12, marginTop: 2 }}>
                  Receive push notifications.
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                color={theme.colors.primary}
              />
            </View>
          </Card>
        </View>

        {/* Data Refresh Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Refresh</Text>
          <Card contentPadding="md">
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Refresh Interval</Text>
                <Text style={{ ...styles.settingValue, fontSize: 12, marginTop: 2 }}>
                  How often to refresh data.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.settingValue}>{refreshIntervalMinutes} minutes</Text>
                <IconButton
                  icon="chevron-right"
                  size={20}
                  iconColor={theme.colors.onSurfaceVariant}
                  onPress={handleRefreshIntervalPress}
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage</Text>
          <Card contentPadding="md">
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={styles.settingLabel}>Image Cache</Text>
                <Text style={{ ...styles.settingValue, fontSize: 12, marginTop: 2 }}>
                  Cached artwork for posters and backdrops.
                </Text>
                <Text style={{ ...styles.settingValue, fontSize: 12, marginTop: 6 }}>
                  {isFetchingCacheUsage
                    ? 'Calculating…'
                    : `${imageCacheUsage.formattedSize}${
                        imageCacheUsage.fileCount ? ` • ${imageCacheUsage.fileCount} files` : ''
                      }`}
                </Text>
              </View>
              <Button
                mode="contained-tonal"
                compact
                onPress={handleClearImageCache}
                loading={isClearingImageCache}
                disabled={
                  isClearingImageCache ||
                  isFetchingCacheUsage ||
                  imageCacheUsage.size === 0
                }
              >
                Clear
              </Button>
            </View>
          </Card>
        </View>

        {/* Services Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <Card contentPadding="md">
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Manage Services</Text>
              <IconButton
                icon="chevron-right"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => router.push('/(auth)/(tabs)/services')}
              />
            </View>
          </Card>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Card contentPadding="md">
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>App Version</Text>
              <Text style={styles.settingValue}>1.2.3</Text>
            </View>
          </Card>
        </View>

        {/* Sign Out Button */}
        <Button
          mode="outlined"
          onPress={confirmSignOut}
          style={styles.signOutButton}
          textColor={theme.colors.error}
          icon="logout"
        >
          Sign out
        </Button>

        <ConfirmDialog
          visible={confirmVisible}
          title="Sign out"
          message="Are you sure you want to sign out?"
          confirmLabel="Sign out"
          cancelLabel="Cancel"
          destructive
          onCancel={() => setConfirmVisible(false)}
          onConfirm={() => {
            setConfirmVisible(false);
            void handleSignOut();
          }}
        />

        {/* Refresh Interval Selection Dialog */}
        <Portal>
          <Dialog
            visible={refreshIntervalVisible}
            onDismiss={() => setRefreshIntervalVisible(false)}
            style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
          >
            <Dialog.Title style={styles.sectionTitle}>Refresh Interval</Dialog.Title>
            <Dialog.Content>
              <Text style={{ ...styles.settingValue, marginBottom: spacing.md }}>
                Select how often to refresh your data:
              </Text>
              <View style={{ gap: spacing.xs }}>
                {[5, 10, 15, 30, 60, 120].map((minutes) => (
                  <Button
                    key={minutes}
                    mode={refreshIntervalMinutes === minutes ? "contained" : "outlined"}
                    onPress={() => handleRefreshIntervalSelect(minutes)}
                    style={{ marginVertical: 0 }}
                  >
                    {minutes} minute{minutes !== 1 ? 's' : ''}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button mode="outlined" onPress={() => setRefreshIntervalVisible(false)}>
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const getReadableErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unexpected error occurred.';
  }
};