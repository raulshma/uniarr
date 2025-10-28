import { useRouter } from "expo-router";
import { StyleSheet, View, useColorScheme } from "react-native";
import { alert, showCustomDialog } from "@/services/dialogService";
import { useCallback, useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";

import {
  Text,
  useTheme,
  Button,
  Switch,
  IconButton,
  Chip,
  Portal,
  Dialog,
} from "react-native-paper";
// Card removed for notifications group — using SettingsGroup instead
import {
  CustomConfirm,
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
} from "@/components/common";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabHeader } from "@/components/common/TabHeader";

import type { AppTheme } from "@/constants/theme";
import { useAuth } from "@/services/auth/AuthProvider";
import {
  imageCacheService,
  type ImageCacheUsage,
} from "@/services/image/ImageCacheService";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";
import { useSettingsStore } from "@/store/settingsStore";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import type { NotificationCategory } from "@/models/notification.types";
import { getCategoryFriendlyName } from "@/utils/quietHours.utils";
import { borderRadius } from "@/constants/sizes";
import { shouldAnimateLayout } from "@/utils/animations.utils";
// Backup & restore moved to its own settings screen

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;

  return `${
    value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)
  } ${units[index]}`;
};

const SettingsScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [refreshIntervalVisible, setRefreshIntervalVisible] = useState(false);
  const [cacheLimitVisible, setCacheLimitVisible] = useState(false);
  const theme = useTheme<AppTheme>();
  const isDev = typeof __DEV__ !== "undefined" && __DEV__;

  // Get dynamic app version from Expo Constants
  const appVersion =
    Constants.expoConfig?.version || Constants.manifest?.version || "Unknown";
  const appVersionString = `UniArr v${appVersion}`;

  // App update check hook
  const {
    data: updateData,
    isLoading: isCheckingUpdate,
    error: updateError,
    refetch: checkForUpdate,
  } = useAppUpdateCheck({ enabled: false }); // Manual trigger only

  // Settings store
  const {
    theme: themePreference,
    oledEnabled,
    notificationsEnabled,
    downloadNotificationsEnabled,
    failedDownloadNotificationsEnabled,
    requestNotificationsEnabled,
    serviceHealthNotificationsEnabled,
    refreshIntervalMinutes,
    quietHours,
    setTheme,
    setOledEnabled,
    setNotificationsEnabled,
    setDownloadNotificationsEnabled,
    setFailedDownloadNotificationsEnabled,
    setRequestNotificationsEnabled,
    setServiceHealthNotificationsEnabled,
    setRefreshIntervalMinutes,
    jellyseerrRetryAttempts,
    setJellyseerrRetryAttempts,
    tmdbEnabled,
    maxImageCacheSize,
    setMaxImageCacheSize,
    logLevel,
    setLogLevel,
    setLastReleaseNotesCheckedAt,
    // image thumbnailing controls removed
  } = useSettingsStore();
  const [logLevelVisible, setLogLevelVisible] = useState(false);
  const [jellyseerrRetriesVisible, setJellyseerrRetriesVisible] =
    useState(false);
  const [imageCacheUsage, setImageCacheUsage] = useState<ImageCacheUsage>({
    size: 0,
    fileCount: 0,
    formattedSize: "0 B",
  });
  const [isFetchingCacheUsage, setIsFetchingCacheUsage] = useState(false);
  const [isClearingImageCache, setIsClearingImageCache] = useState(false);

  const isBusy = isFetchingCacheUsage || isClearingImageCache;
  const animationsEnabled = shouldAnimateLayout(isBusy, false);

  const colorScheme = useColorScheme();
  const isCurrentThemeDark = useMemo(() => {
    if (themePreference === "dark") return true;
    if (themePreference === "light") return false;
    return colorScheme === "dark";
  }, [themePreference, colorScheme]);

  const appearanceItemsCount = useMemo(
    () => (isCurrentThemeDark ? 3 : 2),
    [isCurrentThemeDark],
  );

  const notificationItemsCount = useMemo(
    () => (notificationsEnabled ? 6 : 2),
    [notificationsEnabled],
  );

  // Overview removed — metrics moved or omitted

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xxxxl,
    },
    // Overview styles removed
    listSpacer: {
      height: spacing.xs,
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
    themeOptions: {
      flexDirection: "row",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    themeChip: {
      borderRadius: borderRadius.lg,
      height: 32,
    },
    settingCard: {
      backgroundColor: theme.colors.elevation.level1,
      marginHorizontal: spacing.xs,
      marginVertical: spacing.xs / 2,
      borderRadius: borderRadius.xxl,
      padding: spacing.sm,
    },
    settingContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.xl,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
      fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
      marginBottom: 1,
    },
    settingSubtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      marginBottom: 1,
    },
    settingValue: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
    },
    signOutButton: {
      marginHorizontal: spacing.xs,
      marginTop: spacing.md,
      marginBottom: spacing.xl,
    },
    notificationGroup: {
      backgroundColor: theme.colors.elevation.level1,
      marginHorizontal: spacing.xs,
      marginVertical: spacing.xs / 2,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
    },
    notificationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    notificationIcon: {
      width: 24,
      height: 24,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
  });

  const loadImageCacheUsage = useCallback(async () => {
    setIsFetchingCacheUsage(true);
    try {
      const usage = await imageCacheService.getCacheUsage();
      setImageCacheUsage(usage);
    } catch (error) {
      const message = getReadableErrorMessage(error);
      void logger.error("SettingsScreen: failed to load image cache usage.", {
        error: message,
      });
      alert("Unable to load cache usage", message);
    } finally {
      setIsFetchingCacheUsage(false);
    }
  }, []);

  useEffect(() => {
    void loadImageCacheUsage();
  }, [loadImageCacheUsage]);

  // Update dialog when update check completes
  useEffect(() => {
    if (!isCheckingUpdate && (updateData || updateError)) {
      showCustomDialog("updateCheck", {
        updateData,
        isLoading: false,
        error: updateError ? String(updateError) : null,
      });
    }
  }, [updateData, isCheckingUpdate, updateError]);

  const handleClearImageCache = async () => {
    setIsClearingImageCache(true);
    try {
      await imageCacheService.clearCache();
      await loadImageCacheUsage();
      alert(
        "Image cache cleared",
        "Poster images will be refreshed on next load.",
      );
    } catch (error) {
      const message = getReadableErrorMessage(error);
      void logger.error("SettingsScreen: failed to clear image cache.", {
        error: message,
      });
      alert("Unable to clear image cache", message);
    } finally {
      setIsClearingImageCache(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(public)/login");
    } catch (signOutError) {
      const message =
        signOutError instanceof Error
          ? signOutError.message
          : "Unable to sign out. Please try again.";

      alert("Sign out failed", message);
    }
  };

  const handleCheckForUpdate = useCallback(async () => {
    setLastReleaseNotesCheckedAt(new Date().toISOString());
    // Show update dialog with loading state
    showCustomDialog("updateCheck", {
      updateData: null,
      isLoading: true,
      error: null,
    });
    // Trigger the fetch by calling refetch
    void checkForUpdate();
  }, [checkForUpdate, setLastReleaseNotesCheckedAt]);

  const confirmSignOut = () => setConfirmVisible(true);

  const handleThemeSelection = (selectedTheme: "light" | "dark" | "system") => {
    setTheme(selectedTheme as any);
  };

  const handleRefreshIntervalPress = () => {
    setRefreshIntervalVisible(true);
  };

  const handleRefreshIntervalSelect = (minutes: number) => {
    setRefreshIntervalMinutes(minutes);
    setRefreshIntervalVisible(false);
  };

  const handleCacheLimitPress = () => {
    setCacheLimitVisible(true);
  };

  const handleCacheLimitSelect = (size: number) => {
    setMaxImageCacheSize(size);
    setCacheLimitVisible(false);

    // Enforce the new cache limit after setting it (fire-and-forget)
    void (async () => {
      try {
        await imageCacheService.enforceCacheLimit(size);
        await loadImageCacheUsage(); // Refresh the usage display
      } catch (error) {
        const message = getReadableErrorMessage(error);
        void logger.error(
          "SettingsScreen: failed to enforce new cache limit.",
          {
            error: message,
          },
        );
      }
    })();
  };

  const getThemeChipColor = (chipTheme: "light" | "dark" | "system") => {
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
    const enabled = Object.entries(quietHours).filter(
      ([, config]) => config.enabled,
    );
    if (enabled.length === 0) {
      return "Disabled";
    }

    const labels = enabled
      .map(([category]) =>
        getCategoryFriendlyName(category as NotificationCategory),
      )
      .join(", ");

    return `Active: ${labels}`;
  }, [quietHours]);

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedScrollView
        contentContainerStyle={styles.scrollContainer}
        animated={animationsEnabled}
      >
        {/* Header */}
        <TabHeader
          rightAction={{
            icon: "cog",
            onPress: () => {},
            accessibilityLabel: "Settings",
          }}
        />

        {/* Overview removed */}

        {/* Appearance Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Appearance</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={appearanceItemsCount}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Theme"
                subtitle="Choose your preferred theme"
                left={{ iconName: "palette" }}
                trailing={
                  <View style={styles.themeOptions}>
                    <Chip
                      mode={themePreference === "light" ? "flat" : "outlined"}
                      style={[
                        styles.themeChip,
                        {
                          backgroundColor:
                            getThemeChipColor("light").backgroundColor,
                        },
                      ]}
                      textStyle={{
                        color: getThemeChipColor("light").textColor,
                        fontSize: 12,
                      }}
                      onPress={() => handleThemeSelection("light")}
                    >
                      Light
                    </Chip>
                    <Chip
                      mode={themePreference === "dark" ? "flat" : "outlined"}
                      style={[
                        styles.themeChip,
                        {
                          backgroundColor:
                            getThemeChipColor("dark").backgroundColor,
                        },
                      ]}
                      textStyle={{
                        color: getThemeChipColor("dark").textColor,
                        fontSize: 12,
                      }}
                      onPress={() => handleThemeSelection("dark")}
                    >
                      Dark
                    </Chip>
                    <Chip
                      mode={themePreference === "system" ? "flat" : "outlined"}
                      style={[
                        styles.themeChip,
                        {
                          backgroundColor:
                            getThemeChipColor("system").backgroundColor,
                        },
                      ]}
                      textStyle={{
                        color: getThemeChipColor("system").textColor,
                        fontSize: 12,
                      }}
                      onPress={() => handleThemeSelection("system")}
                    >
                      System
                    </Chip>
                  </View>
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            {/* OLED Mode Toggle - Only show when dark theme is active */}
            {isCurrentThemeDark && (
              <AnimatedListItem
                index={1}
                totalItems={appearanceItemsCount}
                animated={animationsEnabled}
              >
                <SettingsListItem
                  title="OLED Mode"
                  subtitle="Pure black for OLED displays"
                  left={{ iconName: "monitor-star" }}
                  trailing={
                    <Switch
                      value={oledEnabled}
                      onValueChange={setOledEnabled}
                      color={theme.colors.primary}
                    />
                  }
                  groupPosition="middle"
                />
              </AnimatedListItem>
            )}
            <AnimatedListItem
              index={isCurrentThemeDark ? 2 : 1}
              totalItems={appearanceItemsCount}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Customize Theme"
                subtitle="Colors, fonts & more"
                left={{ iconName: "palette-swatch" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={18}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/settings/theme-editor")}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Notifications Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Notifications</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={notificationItemsCount}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Enable Notifications"
                left={{ iconName: "bell" }}
                trailing={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="top"
              />
            </AnimatedListItem>

            {notificationsEnabled && (
              <>
                <AnimatedListItem
                  index={1}
                  totalItems={notificationItemsCount}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Completed Downloads"
                    left={{
                      node: (
                        <IconButton
                          icon="check-circle"
                          size={16}
                          iconColor={theme.colors.primary}
                          style={{ margin: 0, width: 24, height: 24 }}
                        />
                      ),
                    }}
                    trailing={
                      <Switch
                        value={downloadNotificationsEnabled}
                        onValueChange={setDownloadNotificationsEnabled}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="middle"
                  />
                </AnimatedListItem>

                <AnimatedListItem
                  index={2}
                  totalItems={notificationItemsCount}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Failed Downloads"
                    left={{
                      node: (
                        <IconButton
                          icon="alert-circle"
                          size={16}
                          iconColor={theme.colors.primary}
                          style={{ margin: 0, width: 24, height: 24 }}
                        />
                      ),
                    }}
                    trailing={
                      <Switch
                        value={failedDownloadNotificationsEnabled}
                        onValueChange={setFailedDownloadNotificationsEnabled}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="middle"
                  />
                </AnimatedListItem>

                <AnimatedListItem
                  index={3}
                  totalItems={notificationItemsCount}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="New Requests"
                    left={{
                      node: (
                        <IconButton
                          icon="account-plus"
                          size={16}
                          iconColor={theme.colors.primary}
                          style={{ margin: 0, width: 24, height: 24 }}
                        />
                      ),
                    }}
                    trailing={
                      <Switch
                        value={requestNotificationsEnabled}
                        onValueChange={setRequestNotificationsEnabled}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="middle"
                  />
                </AnimatedListItem>

                <AnimatedListItem
                  index={4}
                  totalItems={notificationItemsCount}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Service Health"
                    left={{
                      node: (
                        <IconButton
                          icon="server-network"
                          size={16}
                          iconColor={theme.colors.primary}
                          style={{ margin: 0, width: 24, height: 24 }}
                        />
                      ),
                    }}
                    trailing={
                      <Switch
                        value={serviceHealthNotificationsEnabled}
                        onValueChange={setServiceHealthNotificationsEnabled}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="middle"
                  />
                </AnimatedListItem>
              </>
            )}

            <AnimatedListItem
              index={notificationsEnabled ? 5 : 1}
              totalItems={notificationItemsCount}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title={`Quiet Hours: ${quietHoursValue}`}
                left={{
                  node: (
                    <IconButton
                      icon="moon-waning-crescent"
                      size={16}
                      iconColor={theme.colors.primary}
                      style={{ margin: 0, width: 24, height: 24 }}
                    />
                  ),
                }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                    onPress={() => router.push("/(auth)/settings/quiet-hours")}
                  />
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Quick Actions Section */}
        <AnimatedSection
          style={styles.section}
          delay={150}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Refresh Interval"
                subtitle={`${refreshIntervalMinutes} minutes`}
                left={{ iconName: "refresh" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={handleRefreshIntervalPress}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Voice Assistant"
                subtitle="Siri & Google Assistant"
                left={{ iconName: "microphone" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/settings/voice-assistant")}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Storage Section */}
        <AnimatedSection
          style={styles.section}
          delay={200}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Storage</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Image Cache"
                subtitle={
                  isFetchingCacheUsage
                    ? "Calculating…"
                    : `${imageCacheUsage.formattedSize}${
                        imageCacheUsage.fileCount
                          ? ` • ${imageCacheUsage.fileCount} files`
                          : ""
                      }`
                }
                left={{ iconName: "folder" }}
                trailing={
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => router.push("/(auth)/settings/cache-view")}
                      disabled={isFetchingCacheUsage}
                      style={{ height: 32 }}
                    >
                      View
                    </Button>
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
                      style={{ height: 32 }}
                    >
                      Clear
                    </Button>
                  </View>
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={3}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Cache Limit"
                subtitle={formatBytes(maxImageCacheSize)}
                left={{ iconName: "database-cog" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={handleCacheLimitPress}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Services Section */}
        <AnimatedSection
          style={styles.section}
          delay={250}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Services</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Manage Services"
                subtitle="Configure connected services"
                left={{ iconName: "server" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/(tabs)/services")}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="TMDB Integration"
                subtitle={tmdbEnabled ? "Enabled" : "Disabled"}
                left={{ iconName: "movie-open" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/settings/tmdb")}
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={2}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Widget Settings"
                subtitle="Configure dashboard widgets"
                left={{ iconName: "widgets" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/settings/widgets")}
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={3}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Jellyseerr Retries"
                subtitle={`${jellyseerrRetryAttempts} ${
                  jellyseerrRetryAttempts !== 1 ? "retries" : "retry"
                }`}
                left={{ iconName: "repeat-variant" }}
                trailing={
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() => setJellyseerrRetriesVisible(true)}
                    style={{ height: 32 }}
                  >
                    Set
                  </Button>
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* System Section */}
        <AnimatedSection
          style={styles.section}
          delay={300}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>System</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Backup & Restore"
                subtitle="Export, import & cloud backups"
                left={{ iconName: "backup-restore" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/settings/backup-restore")}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="App Version"
                subtitle={appVersionString}
                left={{ iconName: "information" }}
                trailing={
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={handleCheckForUpdate}
                    loading={isCheckingUpdate}
                    disabled={isCheckingUpdate}
                    style={{ height: 32 }}
                  >
                    Check
                  </Button>
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={2}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Log Level"
                subtitle={logLevel}
                left={{ iconName: "console" }}
                trailing={
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() => setLogLevelVisible(true)}
                    style={{ height: 32 }}
                  >
                    Set
                  </Button>
                }
                groupPosition="middle"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={3}
              totalItems={4}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Debugging"
                subtitle="Logs & diagnostics"
                left={{ iconName: "bug-outline" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => router.push("/(auth)/dev")}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* Thumbnail concurrency dialog removed */}

        {/* Developer Tools (dev only) */}
        {isDev && (
          <AnimatedSection
            style={styles.section}
            delay={350}
            animated={animationsEnabled}
          >
            <Text style={styles.sectionTitle}>Development</Text>
            <SettingsGroup>
              <AnimatedListItem
                index={0}
                totalItems={1}
                animated={animationsEnabled}
              >
                <SettingsListItem
                  title="Developer Tools"
                  subtitle="Dev tools & playground"
                  left={{ iconName: "bug" }}
                  trailing={
                    <IconButton
                      icon="chevron-right"
                      size={16}
                      iconColor={theme.colors.outline}
                    />
                  }
                  onPress={() => router.push("/(auth)/dev")}
                  groupPosition="single"
                />
              </AnimatedListItem>
            </SettingsGroup>
          </AnimatedSection>
        )}

        {/* Sign Out Button */}
        <AnimatedListItem
          index={0}
          totalItems={1}
          style={{ marginTop: spacing.md }}
          animated={animationsEnabled}
        >
          <Button
            mode="outlined"
            onPress={confirmSignOut}
            style={[styles.signOutButton, { height: 40 }]}
            textColor={theme.colors.error}
            icon="logout"
          >
            Sign out
          </Button>
        </AnimatedListItem>

        <CustomConfirm
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
            style={{
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Dialog.Title style={styles.sectionTitle}>
              Refresh Interval
            </Dialog.Title>
            <Dialog.Content>
              <Text
                style={{ ...styles.settingValue, marginBottom: spacing.md }}
              >
                Select how often to refresh your data:
              </Text>
              <View style={{ gap: spacing.xs }}>
                {[5, 10, 15, 30, 60, 120].map((minutes) => (
                  <Button
                    key={minutes}
                    mode={
                      refreshIntervalMinutes === minutes
                        ? "contained"
                        : "outlined"
                    }
                    onPress={() => handleRefreshIntervalSelect(minutes)}
                    style={{ marginVertical: 0 }}
                  >
                    {minutes} minute{minutes !== 1 ? "s" : ""}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                mode="outlined"
                onPress={() => setRefreshIntervalVisible(false)}
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        {/* Jellyseerr Retries Selection Dialog */}
        <Portal>
          <Dialog
            visible={jellyseerrRetriesVisible}
            onDismiss={() => setJellyseerrRetriesVisible(false)}
            style={{
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Dialog.Title style={styles.sectionTitle}>
              Jellyseerr Retries
            </Dialog.Title>
            <Dialog.Content>
              <Text
                style={{ ...styles.settingValue, marginBottom: spacing.md }}
              >
                Choose how many retry attempts to perform when Jellyseerr
                returns a server error (5xx). Setting to 0 disables retries.
              </Text>
              <View style={{ gap: spacing.xs }}>
                {[0, 1, 2, 3, 4, 5].map((attempts) => (
                  <Button
                    key={attempts}
                    mode={
                      jellyseerrRetryAttempts === attempts
                        ? "contained"
                        : "outlined"
                    }
                    onPress={() => {
                      setJellyseerrRetryAttempts(attempts);
                      setJellyseerrRetriesVisible(false);
                    }}
                    style={{ marginVertical: 0 }}
                  >
                    {attempts} attempt{attempts !== 1 ? "s" : ""}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                mode="outlined"
                onPress={() => setJellyseerrRetriesVisible(false)}
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        {/* Log Level Selection Dialog */}
        <Portal>
          <Dialog
            visible={logLevelVisible}
            onDismiss={() => setLogLevelVisible(false)}
            style={{
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Dialog.Title style={styles.sectionTitle}>Log Level</Dialog.Title>
            <Dialog.Content>
              <Text
                style={{ ...styles.settingValue, marginBottom: spacing.md }}
              >
                Select minimum log level to record and show in developer
                consoles.
              </Text>
              <View style={{ gap: spacing.xs }}>
                {["DEBUG", "INFO", "WARN", "ERROR"].map((level) => (
                  <Button
                    key={level}
                    mode={logLevel === level ? "contained" : "outlined"}
                    onPress={() => {
                      // Update store and logger
                      // cast is safe because model uses same string enums
                      setLogLevel(level as any);
                      try {
                        logger.setMinimumLevel(level as any);
                      } catch {
                        // noop
                      }
                      setLogLevelVisible(false);
                    }}
                    style={{ marginVertical: 0 }}
                  >
                    {level}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button mode="outlined" onPress={() => setLogLevelVisible(false)}>
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Cache Limit Selection Dialog */}
        <Portal>
          <Dialog
            visible={cacheLimitVisible}
            onDismiss={() => setCacheLimitVisible(false)}
            style={{
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Dialog.Title style={styles.sectionTitle}>Cache Limit</Dialog.Title>
            <Dialog.Content>
              <Text
                style={{ ...styles.settingValue, marginBottom: spacing.md }}
              >
                Select maximum image cache size. Oldest images will be removed
                automatically when this limit is exceeded:
              </Text>
              <View style={{ gap: spacing.xs }}>
                {[
                  { size: 10 * 1024 * 1024, label: "10 MB" },
                  { size: 25 * 1024 * 1024, label: "25 MB" },
                  { size: 50 * 1024 * 1024, label: "50 MB" },
                  { size: 100 * 1024 * 1024, label: "100 MB" },
                  { size: 250 * 1024 * 1024, label: "250 MB" },
                  { size: 500 * 1024 * 1024, label: "500 MB" },
                  { size: 1024 * 1024 * 1024, label: "1 GB" },
                ].map((option) => (
                  <Button
                    key={option.size}
                    mode={
                      maxImageCacheSize === option.size
                        ? "contained"
                        : "outlined"
                    }
                    onPress={() => handleCacheLimitSelect(option.size)}
                    style={{ marginVertical: 0 }}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                mode="outlined"
                onPress={() => setCacheLimitVisible(false)}
              >
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

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unexpected error occurred.";
  }
};
