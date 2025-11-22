import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { useTheme } from "@/hooks/useTheme";
import { useServicesHealth } from "@/hooks/useServicesHealth";
import { useDownloadIndicator } from "@/providers/DownloadPortalProvider";
import { useCalendar } from "@/hooks/useCalendar";
import LottieWeatherIcon from "@/components/widgets/WeatherWidget/LottieWeatherIcon";
import { widgetService } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";
import { useAggregatedHealth } from "@/hooks/useAggregatedHealth";
import { useSettingsStore } from "@/store/settingsStore";

const MainDashboard = () => {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { onPress } = useHaptics();
  const gradientBackgroundEnabled = useSettingsStore(
    (state) => state.gradientBackgroundEnabled,
  );

  // Data Hooks
  const { overview: healthOverview, refetch: refetchHealth } =
    useServicesHealth();
  const { activeDownloadsCount, showDownloads } = useDownloadIndicator();
  const { releases, goToToday } = useCalendar();
  const { data: aggregatedHealth } = useAggregatedHealth();

  const [refreshing, setRefreshing] = React.useState(false);
  const [weatherSummary, setWeatherSummary] = React.useState<{
    condition: string;
    temperature: string;
    location?: string;
  } | null>(null);

  // Animation values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  // Pulse animation for status indicators
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim, glowAnim]);

  const loadWeatherSummary = React.useCallback(async () => {
    try {
      await widgetService.initialize();
      const widgets = await widgetService.getWeatherWidgets();
      const headerWidget = widgets.find((w) =>
        Boolean(w.config?.showInDashboardHeader),
      );

      if (!headerWidget) {
        setWeatherSummary(null);
        return;
      }

      const cached = await widgetService.getWidgetData<any>(headerWidget.id);
      const payload = cached?.payload;
      if (!payload || typeof payload !== "object") {
        setWeatherSummary(null);
        return;
      }

      const firstKey = Object.keys(payload)[0];
      const first = firstKey ? payload[firstKey] : null;
      const weather = first ?? null;

      if (
        !weather ||
        !weather.current ||
        typeof weather.current.temperature !== "number"
      ) {
        setWeatherSummary(null);
        return;
      }

      setWeatherSummary({
        condition: weather.current.condition.text,
        temperature: `${Math.round(weather.current.temperature)}°`,
        location: weather.location?.name,
      });
    } catch {
      setWeatherSummary(null);
    }
  }, []);

  const onRefresh = React.useCallback(async () => {
    onPress();
    setRefreshing(true);
    refetchHealth();
    goToToday(); // Refresh calendar to today
    await loadWeatherSummary();
    // Simulate a short delay for better UX
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [onPress, refetchHealth, goToToday, loadWeatherSummary]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const dateString = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const nextRelease = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";

    // Find the first release that is today or in the future
    return releases
      .filter((r) => r.releaseDate >= todayStr && r.status === "upcoming")
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))[0];
  }, [releases]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        gradientBackground: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: theme.dark ? 0.4 : 0.2,
        },
        header: {
          paddingHorizontal: theme.custom.spacing.lg,
          paddingBottom: theme.custom.spacing.sm,
          paddingTop: insets.top + theme.custom.spacing.md,
        },
        greeting: {
          fontSize: theme.custom.typography.displaySmall.fontSize,
          fontWeight: "800",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.displaySmall.letterSpacing,
          marginBottom: theme.custom.spacing.xxxs,
        },
        date: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "500",
          opacity: 0.8,
        },
        section: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.sm,
        },
        sectionTitle: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "800",
          marginBottom: theme.custom.spacing.xs,
          color: theme.colors.onSurfaceVariant,
          textTransform: "uppercase",
          letterSpacing: theme.custom.typography.labelMedium.letterSpacing,
          opacity: 0.6,
        },
        headerTop: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: theme.custom.spacing.md,
        },
        greetingBlock: {
          flex: 1,
          marginRight: theme.custom.spacing.sm,
        },
        weatherTouch: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.custom.spacing.md,
          paddingVertical: theme.custom.spacing.xs,
          borderRadius: theme.custom.sizes.borderRadius.xl,
          gap: theme.custom.spacing.xs,
          overflow: "hidden",
        },
        weatherTemp: {
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          color: theme.colors.onSurface,
          fontWeight: "700",
        },
        quickActions: {
          flexDirection: "row",
          gap: theme.custom.spacing.sm,
          marginBottom: theme.custom.spacing.lg,
        },
        quickActionCard: {
          minWidth: 85,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          overflow: "hidden",
          marginRight: theme.custom.spacing.xxs,
        },
        quickActionContent: {
          paddingVertical: theme.custom.spacing.xs,
          paddingHorizontal: theme.custom.spacing.sm,
          alignItems: "center",
          gap: theme.custom.spacing.xxs,
        },
        quickActionIcon: {
          width: 36,
          height: 36,
          borderRadius: theme.custom.sizes.borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.primaryContainer,
        },
        quickActionLabel: {
          fontSize: theme.custom.typography.labelMedium.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurface,
          textAlign: "center",
        },
        quickActionBadge: {
          position: "absolute",
          top: theme.custom.spacing.xs,
          right: theme.custom.spacing.xs,
          backgroundColor: theme.colors.error,
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: theme.custom.spacing.xxs,
        },
        quickActionBadgeText: {
          fontSize: 11,
          fontWeight: "700",
          color: theme.colors.onError,
        },
        card: {
          marginBottom: theme.custom.spacing.xs,
          borderRadius: theme.custom.sizes.borderRadius.xl,
          overflow: "hidden",
          elevation: 0,
        },
        cardGradient: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
        },
        cardContent: {
          flexDirection: "row",
          alignItems: "center",
          padding: theme.custom.spacing.md,
        },
        cardIcon: {
          width: theme.custom.sizes.iconSizes.xxl,
          height: theme.custom.sizes.iconSizes.xxl,
          borderRadius: theme.custom.sizes.borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          marginRight: theme.custom.spacing.sm,
        },
        cardIconGradient: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: theme.custom.sizes.borderRadius.md,
        },
        cardText: {
          flex: 1,
        },
        cardTitle: {
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontWeight: "700",
          color: theme.colors.onSurface,
          marginBottom: theme.custom.spacing.xxxs,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
        },
        cardSubtitle: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "500",
          opacity: 0.8,
        },
        statusDot: {
          width: theme.custom.spacing.xs + 2,
          height: theme.custom.spacing.xs + 2,
          borderRadius: (theme.custom.spacing.xs + 2) / 2,
          marginLeft: theme.custom.spacing.sm,
        },
        statusGlow: {
          position: "absolute",
          width: theme.custom.spacing.lg,
          height: theme.custom.spacing.lg,
          borderRadius: theme.custom.spacing.lg / 2,
        },
        heroCard: {
          marginBottom: theme.custom.spacing.sm,
          borderRadius: theme.custom.sizes.borderRadius.xxl,
          overflow: "hidden",
          elevation: 0,
        },
        heroContent: {
          padding: theme.custom.spacing.lg,
          minHeight: 120,
        },
        heroTitle: {
          fontSize: theme.custom.typography.labelLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onSurface,
          marginBottom: theme.custom.spacing.xs,
          textTransform: "uppercase",
          letterSpacing: theme.custom.typography.labelLarge.letterSpacing,
          opacity: 0.7,
        },
        heroValue: {
          fontSize: theme.custom.typography.displayMedium.fontSize,
          fontWeight: "900",
          color: theme.colors.onSurface,
          letterSpacing: -2,
          marginBottom: theme.custom.spacing.xs,
        },
        heroSubtitle: {
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "600",
        },
      }),
    [theme, insets.top],
  );

  React.useEffect(() => {
    void loadWeatherSummary();
  }, [loadWeatherSummary]);

  const renderStatusIndicator = (isHealthy: boolean) => {
    const color = isHealthy ? theme.colors.primary : theme.colors.error;
    return (
      <View style={{ position: "relative" }}>
        <Animated.View
          style={[
            styles.statusGlow,
            {
              backgroundColor: color,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.5],
              }),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <View style={[styles.statusDot, { backgroundColor: color }]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Animated gradient background */}
      {gradientBackgroundEnabled && (
        <LinearGradient
          colors={
            theme.dark
              ? ["#1a1a2e", "#16213e", "#0f0f23"]
              : ["#f0f4ff", "#e8f0fe", "#ffffff"]
          }
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.date}>{dateString}</Text>
            </View>
            {weatherSummary && (
              <TouchableOpacity
                onPress={() => router.push("/(auth)/settings/widgets")}
                activeOpacity={0.7}
              >
                <BlurView
                  intensity={theme.dark ? 40 : 20}
                  tint={theme.dark ? "dark" : "light"}
                  style={styles.weatherTouch}
                >
                  <LottieWeatherIcon
                    condition={weatherSummary.condition}
                    size={28}
                    autoPlay
                    loop
                  />
                  <Text style={styles.weatherTemp}>
                    {weatherSummary.temperature}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Hero Stats Card */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/services")}
            activeOpacity={0.8}
          >
            <Surface style={styles.heroCard} elevation={0}>
              <LinearGradient
                colors={
                  healthOverview.offline > 0
                    ? theme.dark
                      ? ["#3d1f1f", "#2d1515"]
                      : ["#ffe5e5", "#ffd5d5"]
                    : theme.dark
                      ? ["#1f2d3d", "#15202d"]
                      : ["#e5f2ff", "#d5e8ff"]
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Services Status</Text>
                <Text style={styles.heroValue}>
                  {healthOverview.online}/{healthOverview.total}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {healthOverview.offline > 0
                    ? `${healthOverview.offline} services need attention`
                    : "All systems operational"}
                </Text>
              </View>
            </Surface>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.section,
            { paddingRight: theme.custom.spacing.lg },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/services")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="magnify"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Search</Text>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/calendar")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Calendar</Text>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/downloads")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              {activeDownloadsCount > 0 && (
                <View style={styles.quickActionBadge}>
                  <Text style={styles.quickActionBadgeText}>
                    {activeDownloadsCount}
                  </Text>
                </View>
              )}
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="download"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Downloads</Text>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/monitoring")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="monitor-dashboard"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Monitor</Text>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/recently-added")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Recent</Text>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/discover")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="compass-outline"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Discover</Text>
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/settings")}
            activeOpacity={0.7}
          >
            <Surface style={styles.quickActionCard} elevation={0}>
              <View style={styles.quickActionContent}>
                <View style={styles.quickActionIcon}>
                  <MaterialCommunityIcons
                    name="cog"
                    size={22}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <Text style={styles.quickActionLabel}>Settings</Text>
              </View>
            </Surface>
          </TouchableOpacity>
        </ScrollView>

        {/* Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>

          <TouchableOpacity onPress={showDownloads} activeOpacity={0.7}>
            <Surface style={styles.card} elevation={0}>
              <LinearGradient
                colors={
                  theme.dark
                    ? ["rgba(98, 126, 188, 0.1)", "rgba(76, 100, 148, 0.05)"]
                    : ["rgba(98, 126, 188, 0.05)", "rgba(76, 100, 148, 0.02)"]
                }
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <LinearGradient
                    colors={[
                      theme.colors.secondaryContainer,
                      theme.colors.secondary,
                    ]}
                    style={styles.cardIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <MaterialCommunityIcons
                    name="download"
                    size={28}
                    color={theme.colors.onSecondaryContainer}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>
                    {activeDownloadsCount > 0
                      ? `${activeDownloadsCount} Active`
                      : "No Active Downloads"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {activeDownloadsCount > 0
                      ? "Tap to view progress"
                      : "All downloads complete"}
                  </Text>
                </View>
                {activeDownloadsCount > 0 && renderStatusIndicator(true)}
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (!nextRelease) {
                router.push("/(auth)/(tabs)/calendar");
                return;
              }

              if (
                nextRelease.type === "episode" &&
                nextRelease.seriesId &&
                nextRelease.serviceId &&
                nextRelease.serviceType === "sonarr"
              ) {
                try {
                  router.push(
                    `/(auth)/sonarr/${nextRelease.serviceId}/series/${nextRelease.seriesId}`,
                  );
                } catch (error) {
                  console.error("Navigation error:", error);
                  router.push("/(auth)/(tabs)/calendar");
                }
              } else {
                router.push("/(auth)/(tabs)/calendar");
              }
            }}
            activeOpacity={0.7}
          >
            <Surface style={styles.card} elevation={0}>
              <LinearGradient
                colors={
                  theme.dark
                    ? ["rgba(188, 98, 188, 0.1)", "rgba(148, 76, 148, 0.05)"]
                    : ["rgba(188, 98, 188, 0.05)", "rgba(148, 76, 148, 0.02)"]
                }
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <LinearGradient
                    colors={[
                      theme.colors.tertiaryContainer,
                      theme.colors.tertiary,
                    ]}
                    style={styles.cardIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={28}
                    color={theme.colors.onTertiaryContainer}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>
                    {nextRelease ? nextRelease.title : "Nothing upcoming"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {nextRelease
                      ? `${new Date(nextRelease.releaseDate).toLocaleDateString()} • ${nextRelease.type}`
                      : "Check back later"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/monitoring")}
            activeOpacity={0.7}
          >
            <Surface style={styles.card} elevation={0}>
              <LinearGradient
                colors={
                  aggregatedHealth?.criticalIssues?.length
                    ? theme.dark
                      ? ["rgba(188, 98, 98, 0.1)", "rgba(148, 76, 76, 0.05)"]
                      : ["rgba(188, 98, 98, 0.05)", "rgba(148, 76, 76, 0.02)"]
                    : theme.dark
                      ? ["rgba(98, 188, 98, 0.1)", "rgba(76, 148, 76, 0.05)"]
                      : ["rgba(98, 188, 98, 0.05)", "rgba(76, 148, 76, 0.02)"]
                }
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <LinearGradient
                    colors={
                      aggregatedHealth?.criticalIssues?.length
                        ? [theme.colors.errorContainer, theme.colors.error]
                        : [theme.colors.surfaceVariant, theme.colors.outline]
                    }
                    style={styles.cardIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <MaterialCommunityIcons
                    name="monitor-dashboard"
                    size={28}
                    color={
                      aggregatedHealth?.criticalIssues?.length
                        ? theme.colors.onErrorContainer
                        : theme.colors.onSurfaceVariant
                    }
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>System Monitoring</Text>
                  <Text style={styles.cardSubtitle}>
                    {aggregatedHealth?.criticalIssues?.length
                      ? `${aggregatedHealth.criticalIssues.length} critical issues`
                      : "View logs, health & metrics"}
                  </Text>
                </View>
                {aggregatedHealth?.criticalIssues?.length
                  ? renderStatusIndicator(false)
                  : null}
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Surface>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default MainDashboard;
