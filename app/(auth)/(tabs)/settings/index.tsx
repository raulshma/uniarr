import { useRouter } from "expo-router";
import { StyleSheet, View, useColorScheme } from "react-native";
import { alert } from "@/services/dialogService";
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
import { CustomConfirm } from "@/components/common";
import { Card } from "@/components/common/Card";
import {
  AnimatedListItem,
  AnimatedScrollView,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";
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
    useNativeTabs,
    setUseNativeTabs,
    jellyseerrRetryAttempts,
    setJellyseerrRetryAttempts,
    tmdbEnabled,
    maxImageCacheSize,
    setMaxImageCacheSize,
    logLevel,
    setLogLevel,
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
    () => (isCurrentThemeDark ? 4 : 3),
    [isCurrentThemeDark],
  );

  const notificationItemsCount = useMemo(
    () => (notificationsEnabled ? 6 : 2),
    [notificationsEnabled],
  );

  const settingsSummary = useMemo(
    () => [
      {
        label: "Theme",
        value:
          themePreference === "system"
            ? `System (${colorScheme ?? "auto"})`
            : themePreference.charAt(0).toUpperCase() +
              themePreference.slice(1),
      },
      {
        label: "Notifications",
        value: notificationsEnabled ? "Enabled" : "Disabled",
      },
      {
        label: "Cache usage",
        value: isFetchingCacheUsage
          ? "Calculating…"
          : imageCacheUsage.formattedSize,
      },
    ],
    [
      themePreference,
      colorScheme,
      notificationsEnabled,
      isFetchingCacheUsage,
      imageCacheUsage.formattedSize,
    ],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xxxxl,
    },
    summarySection: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xs,
      gap: spacing.sm,
    },
    summaryTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    summaryCard: {
      flexBasis: "48%",
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    summaryLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      marginBottom: spacing.xxs,
    },
    summaryValue: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontWeight: "600",
    },
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

        <AnimatedSection
          style={styles.summarySection}
          delay={25}
          animated={animationsEnabled}
        >
          <Text style={styles.summaryTitle}>Overview</Text>
          <View style={styles.summaryGrid}>
            {settingsSummary.map((metric, index) => (
              <AnimatedListItem
                key={metric.label}
                index={index}
                totalItems={settingsSummary.length}
                style={styles.summaryCard}
                animated={animationsEnabled}
              >
                <Text style={styles.summaryLabel}>{metric.label}</Text>
                <Text style={styles.summaryValue}>{metric.value}</Text>
              </AnimatedListItem>
            ))}
          </View>
        </AnimatedSection>

        {/* Appearance Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Appearance</Text>
          <AnimatedListItem
            index={0}
            totalItems={appearanceItemsCount}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="palette"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Theme</Text>
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
                </View>
              </View>
            </Card>
          </AnimatedListItem>
          {/* OLED Mode Toggle - Only show when dark theme is active */}
          {isCurrentThemeDark && (
            <AnimatedListItem
              index={1}
              totalItems={appearanceItemsCount}
              animated={animationsEnabled}
            >
              <Card variant="custom" style={styles.settingCard}>
                <View style={styles.settingContent}>
                  <View style={styles.settingIcon}>
                    <IconButton
                      icon="monitor-star"
                      size={20}
                      iconColor={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>OLED Mode</Text>
                    <Text style={styles.settingValue}>
                      Pure black for OLED displays
                    </Text>
                  </View>
                  <Switch
                    value={oledEnabled}
                    onValueChange={setOledEnabled}
                    color={theme.colors.primary}
                  />
                </View>
              </Card>
            </AnimatedListItem>
          )}
          <AnimatedListItem
            index={isCurrentThemeDark ? 2 : 1}
            totalItems={appearanceItemsCount}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push("/(auth)/settings/theme-editor")}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="palette-swatch"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Customize Theme</Text>
                  <Text style={styles.settingValue}>Colors, fonts & more</Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={18}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={isCurrentThemeDark ? 3 : 2}
            totalItems={appearanceItemsCount}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="tab"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Navigation Style</Text>
                  <Text style={styles.settingValue}>
                    {useNativeTabs ? "Native Tabs" : "Curved Bar"}
                  </Text>
                </View>
                <Switch
                  value={useNativeTabs}
                  onValueChange={setUseNativeTabs}
                  color={theme.colors.primary}
                />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Notifications Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Notifications</Text>
          <AnimatedListItem
            index={0}
            totalItems={notificationItemsCount}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.notificationGroup}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="bell"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Enable Notifications</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  color={theme.colors.primary}
                />
              </View>

              {notificationsEnabled && (
                <>
                  <AnimatedListItem
                    style={styles.notificationItem}
                    index={1}
                    totalItems={notificationItemsCount}
                    animated={animationsEnabled}
                  >
                    <View style={styles.notificationIcon}>
                      <IconButton
                        icon="check-circle"
                        size={16}
                        iconColor={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingValue}>
                        Completed Downloads
                      </Text>
                    </View>
                    <Switch
                      value={downloadNotificationsEnabled}
                      onValueChange={setDownloadNotificationsEnabled}
                      color={theme.colors.primary}
                    />
                  </AnimatedListItem>

                  <AnimatedListItem
                    style={styles.notificationItem}
                    index={2}
                    totalItems={notificationItemsCount}
                    animated={animationsEnabled}
                  >
                    <View style={styles.notificationIcon}>
                      <IconButton
                        icon="alert-circle"
                        size={16}
                        iconColor={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingValue}>Failed Downloads</Text>
                    </View>
                    <Switch
                      value={failedDownloadNotificationsEnabled}
                      onValueChange={setFailedDownloadNotificationsEnabled}
                      color={theme.colors.primary}
                    />
                  </AnimatedListItem>

                  <AnimatedListItem
                    style={styles.notificationItem}
                    index={3}
                    totalItems={notificationItemsCount}
                    animated={animationsEnabled}
                  >
                    <View style={styles.notificationIcon}>
                      <IconButton
                        icon="account-plus"
                        size={16}
                        iconColor={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingValue}>New Requests</Text>
                    </View>
                    <Switch
                      value={requestNotificationsEnabled}
                      onValueChange={setRequestNotificationsEnabled}
                      color={theme.colors.primary}
                    />
                  </AnimatedListItem>

                  <AnimatedListItem
                    style={styles.notificationItem}
                    index={4}
                    totalItems={notificationItemsCount}
                    animated={animationsEnabled}
                  >
                    <View style={styles.notificationIcon}>
                      <IconButton
                        icon="server-network"
                        size={16}
                        iconColor={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingValue}>Service Health</Text>
                    </View>
                    <Switch
                      value={serviceHealthNotificationsEnabled}
                      onValueChange={setServiceHealthNotificationsEnabled}
                      color={theme.colors.primary}
                    />
                  </AnimatedListItem>
                </>
              )}

              <AnimatedListItem
                style={[styles.notificationItem, { marginTop: spacing.xs }]}
                index={notificationsEnabled ? 5 : 1}
                totalItems={notificationItemsCount}
                animated={animationsEnabled}
              >
                <View style={styles.notificationIcon}>
                  <IconButton
                    icon="moon-waning-crescent"
                    size={16}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingValue}>
                    Quiet Hours: {quietHoursValue}
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                  onPress={() => router.push("/(auth)/settings/quiet-hours")}
                />
              </AnimatedListItem>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Quick Actions Section */}
        <AnimatedSection
          style={styles.section}
          delay={150}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <AnimatedListItem
            index={0}
            totalItems={2}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={handleRefreshIntervalPress}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="refresh"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Refresh Interval</Text>
                  <Text style={styles.settingValue}>
                    {refreshIntervalMinutes} minutes
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={1}
            totalItems={2}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push("/(auth)/settings/voice-assistant")}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="microphone"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Voice Assistant</Text>
                  <Text style={styles.settingValue}>
                    Siri & Google Assistant
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Storage Section */}
        <AnimatedSection
          style={styles.section}
          delay={200}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Storage</Text>
          <AnimatedListItem
            index={0}
            totalItems={2}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="folder"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Image Cache</Text>
                  <Text style={styles.settingValue}>
                    {isFetchingCacheUsage
                      ? "Calculating…"
                      : `${imageCacheUsage.formattedSize}${
                          imageCacheUsage.fileCount
                            ? ` • ${imageCacheUsage.fileCount} files`
                            : ""
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
                  style={{ height: 32 }}
                >
                  Clear
                </Button>
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={1}
            totalItems={2}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={handleCacheLimitPress}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="database-cog"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Cache Limit</Text>
                  <Text style={styles.settingValue}>
                    {formatBytes(maxImageCacheSize)}
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* Services Section */}
        <AnimatedSection
          style={styles.section}
          delay={250}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Services</Text>
          <AnimatedListItem
            index={0}
            totalItems={4}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push("/(auth)/(tabs)/services")}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="server"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Manage Services</Text>
                  <Text style={styles.settingValue}>
                    Configure connected services
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={1}
            totalItems={4}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push("/(auth)/settings/tmdb")}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="movie-open"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>TMDB Integration</Text>
                  <Text style={styles.settingValue}>
                    {tmdbEnabled ? "Enabled" : "Disabled"}
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={2}
            totalItems={4}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push("/(auth)/settings/widgets")}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="widgets"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Widget Settings</Text>
                  <Text style={styles.settingValue}>
                    Configure dashboard widgets
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={3}
            totalItems={4}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="repeat-variant"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Jellyseerr Retries</Text>
                  <Text style={styles.settingValue}>
                    {jellyseerrRetryAttempts}{" "}
                    {jellyseerrRetryAttempts !== 1 ? "retries" : "retry"}
                  </Text>
                </View>
                <Button
                  mode="contained-tonal"
                  compact
                  onPress={() => setJellyseerrRetriesVisible(true)}
                  style={{ height: 32 }}
                >
                  Set
                </Button>
              </View>
            </Card>
          </AnimatedListItem>
        </AnimatedSection>

        {/* System Section */}
        <AnimatedSection
          style={styles.section}
          delay={300}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>System</Text>
          <AnimatedListItem
            index={0}
            totalItems={3}
            animated={animationsEnabled}
          >
            <Card
              variant="custom"
              style={styles.settingCard}
              onPress={() => router.push("/(auth)/settings/backup-restore")}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="backup-restore"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Backup & Restore</Text>
                  <Text style={styles.settingValue}>
                    Export, import & cloud backups
                  </Text>
                </View>
                <IconButton
                  icon="chevron-right"
                  size={16}
                  iconColor={theme.colors.outline}
                />
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={1}
            totalItems={3}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="information"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>App Version</Text>
                  <Text style={styles.settingValue}>{appVersionString}</Text>
                </View>
              </View>
            </Card>
          </AnimatedListItem>
          <AnimatedListItem
            index={2}
            totalItems={3}
            animated={animationsEnabled}
          >
            <Card variant="custom" style={styles.settingCard}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <IconButton
                    icon="console"
                    size={20}
                    iconColor={theme.colors.primary}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Log Level</Text>
                  <Text style={styles.settingValue}>{logLevel}</Text>
                </View>
                <Button
                  mode="contained-tonal"
                  compact
                  onPress={() => setLogLevelVisible(true)}
                  style={{ height: 32 }}
                >
                  Set
                </Button>
              </View>
            </Card>
          </AnimatedListItem>
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
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <Card
                variant="custom"
                style={styles.settingCard}
                onPress={() => router.push("/(auth)/dev")}
              >
                <View style={styles.settingContent}>
                  <View style={styles.settingIcon}>
                    <IconButton
                      icon="bug"
                      size={20}
                      iconColor={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Developer Tools</Text>
                    <Text style={styles.settingValue}>
                      Dev tools & playground
                    </Text>
                  </View>
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                </View>
              </Card>
            </AnimatedListItem>
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
