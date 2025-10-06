import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View, ScrollView } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, useTheme, Button, Switch, IconButton, Chip, Portal, Dialog } from 'react-native-paper';
import ConfirmDialog from '@/components/common/ConfirmDialog/ConfirmDialog';
import { Card } from '@/components/common/Card';
import { AnimatedListItem, AnimatedScrollView, AnimatedSection } from '@/components/common/AnimatedComponents';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabHeader } from '@/components/common/TabHeader';

import type { AppTheme } from '@/constants/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { imageCacheService, type ImageCacheUsage } from '@/services/image/ImageCacheService';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';
import { useSettingsStore } from '@/store/settingsStore';
import type { NotificationCategory } from '@/models/notification.types';
import { getCategoryFriendlyName } from '@/utils/quietHours.utils';

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
    downloadNotificationsEnabled,
    failedDownloadNotificationsEnabled,
    requestNotificationsEnabled,
    serviceHealthNotificationsEnabled,
    refreshIntervalMinutes,
  quietHours,
    setTheme,
    setNotificationsEnabled,
    setDownloadNotificationsEnabled,
    setFailedDownloadNotificationsEnabled,
    setRequestNotificationsEnabled,
    setServiceHealthNotificationsEnabled,
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
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxxxl
    },
    listSpacer: {
      height: spacing.sm,
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
      paddingHorizontal: spacing.md,
    },
    themeOptions: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    themeChip: {
      borderRadius: 16,
    },
    settingCard: {
      backgroundColor: theme.colors.elevation.level1,
      marginHorizontal: spacing.md,
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
    signOutButton: {
      marginHorizontal: spacing.md,
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
        backgroundColor: theme.colors.primaryContainer,
        textColor: theme.colors.onPrimaryContainer,
      };
    }
    return {
      backgroundColor: theme.colors.surfaceVariant,
      textColor: theme.colors.onSurfaceVariant,
    };
  };

  const quietHoursValue = useMemo(() => {
    const enabled = Object.entries(quietHours).filter(([, config]) => config.enabled);
    if (enabled.length === 0) {
      return 'Disabled';
    }

    const labels = enabled
      .map(([category]) => getCategoryFriendlyName(category as NotificationCategory))
      .join(', ');

    return `Active: ${labels}`;
  }, [quietHours]);

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedScrollView
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Header */}
        <TabHeader
          rightAction={{
            icon: "cog",
            onPress: () => {},
            accessibilityLabel: "Settings",
          }}
        />

        {/* Appearance Section */}
        <AnimatedSection style={styles.section} delay={50}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <AnimatedListItem index={0} totalItems={1}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="palette" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Theme</Text>
                  <Text style={styles.settingSubtitle}>Choose your preferred theme</Text>
                  <View style={styles.themeOptions}>
                    <Chip
                      mode={themePreference === 'light' ? 'flat' : 'outlined'}
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
                      mode={themePreference === 'dark' ? 'flat' : 'outlined'}
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
                      mode={themePreference === 'system' ? 'flat' : 'outlined'}
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
                <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Notifications Section */}
        <AnimatedSection style={styles.section} delay={100}>
          <AnimatedListItem index={0} totalItems={6}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="bell" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Enable Notifications</Text>
                  <Text style={styles.settingSubtitle}>Receive push notifications</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  color={theme.colors.primary}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem index={1} totalItems={6}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="check-circle" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Completed Downloads</Text>
                  <Text style={styles.settingSubtitle}>Notify when downloads finish</Text>
                </View>
                <Switch
                  value={downloadNotificationsEnabled && notificationsEnabled}
                  onValueChange={setDownloadNotificationsEnabled}
                  disabled={!notificationsEnabled}
                  color={theme.colors.primary}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem index={2} totalItems={6}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="alert-circle" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Failed Downloads</Text>
                  <Text style={styles.settingSubtitle}>Notify when downloads fail</Text>
                </View>
                <Switch
                  value={failedDownloadNotificationsEnabled && notificationsEnabled}
                  onValueChange={setFailedDownloadNotificationsEnabled}
                  disabled={!notificationsEnabled}
                  color={theme.colors.primary}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem index={3} totalItems={6}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="account-plus" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>New Requests</Text>
                  <Text style={styles.settingSubtitle}>Notify when requests come in</Text>
                </View>
                <Switch
                  value={requestNotificationsEnabled && notificationsEnabled}
                  onValueChange={setRequestNotificationsEnabled}
                  disabled={!notificationsEnabled}
                  color={theme.colors.primary}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem index={4} totalItems={6}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="server-network" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Service Health</Text>
                  <Text style={styles.settingSubtitle}>Notify on service outages</Text>
                </View>
                <Switch
                  value={serviceHealthNotificationsEnabled && notificationsEnabled}
                  onValueChange={setServiceHealthNotificationsEnabled}
                  disabled={!notificationsEnabled}
                  color={theme.colors.primary}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem index={5} totalItems={6}>
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push('/(auth)/(tabs)/settings/quiet-hours')}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="moon-waning-crescent" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Quiet Hours</Text>
                  <Text style={styles.settingSubtitle}>Silence notifications on a schedule</Text>
                  <Text style={styles.settingValue}>{quietHoursValue}</Text>
                </View>
                <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Data Refresh Section */}
        <AnimatedSection style={styles.section} delay={150}>
          <AnimatedListItem index={0} totalItems={1}>
            <Card variant="custom" style={styles.settingCard} onPress={handleRefreshIntervalPress}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="refresh" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Refresh Interval</Text>
                  <Text style={styles.settingSubtitle}>How often to refresh data</Text>
                  <Text style={styles.settingValue}>{refreshIntervalMinutes} minutes</Text>
                </View>
                <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Storage Section */}
        <AnimatedSection style={styles.section} delay={200}>
          <AnimatedListItem index={0} totalItems={1}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="folder" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Image Cache</Text>
                  <Text style={styles.settingSubtitle}>Cached artwork for posters and backdrops</Text>
                  <Text style={styles.settingValue}>
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
          </AnimatedListItem>
        </AnimatedSection>

        {/* Services Section */}
        <AnimatedSection style={styles.section} delay={250}>
          <AnimatedListItem index={0} totalItems={1}>
            <Card variant="custom" style={styles.settingCard} onPress={() => router.push('/(auth)/(tabs)/services')}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="server" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Manage Services</Text>
                  <Text style={styles.settingSubtitle}>Configure your connected services</Text>
                </View>
                <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* About Section */}
        <AnimatedSection style={styles.section} delay={300}>
          <AnimatedListItem index={0} totalItems={1}>
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton icon="information" size={24} iconColor={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>App Version</Text>
                  <Text style={styles.settingSubtitle}>Uniarr version 1.2.3</Text>
                </View>
                <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Sign Out Button */}
        <AnimatedListItem index={0} totalItems={1} style={{ marginTop: spacing.lg }}>
          <Button
            mode="outlined"
            onPress={confirmSignOut}
            style={styles.signOutButton}
            textColor={theme.colors.error}
            icon="logout"
          >
            Sign out
          </Button>
        </AnimatedListItem>

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
      </AnimatedScrollView>
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