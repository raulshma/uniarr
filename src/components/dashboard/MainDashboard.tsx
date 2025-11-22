import React, { useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { Text, Surface, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { useServicesHealth } from "@/hooks/useServicesHealth";
import { useDownloadIndicator } from "@/providers/DownloadPortalProvider";
import { useCalendar } from "@/hooks/useCalendar";
import LottieWeatherIcon from "@/components/widgets/WeatherWidget/LottieWeatherIcon";
import { widgetService } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";
import { useAggregatedHealth } from "@/hooks/useAggregatedHealth";
import { useSettingsStore } from "@/store/settingsStore";
import { easeOutCubic } from "@/utils/animations.utils";

const headerMinHeight = 60;

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
  const scrollY = useRef(new Animated.Value(0)).current;

  // Header animation calculations
  const screenHeight = Dimensions.get("window").height;
  const headerMaxHeight = screenHeight * 0.35;
  const collapseRange = headerMaxHeight - headerMinHeight;

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

  // Animated header values
  const animatedValues = useMemo(
    () => ({
      headerHeight: easeOutCubic(
        scrollY,
        [0, collapseRange],
        [headerMaxHeight, headerMinHeight],
      ),
      titleOpacity: easeOutCubic(scrollY, [0, collapseRange * 0.6], [1, 0]),
      stickyTitleOpacity: easeOutCubic(
        scrollY,
        [collapseRange * 0.6, collapseRange],
        [0, 1],
      ),
      headerBackgroundOpacity: scrollY.interpolate({
        inputRange: [0, collapseRange - 10, collapseRange],
        outputRange: [0, 0, 1],
        extrapolate: "clamp",
      }),
    }),
    [scrollY, headerMaxHeight, collapseRange],
  );

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
        headerContainer: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        },
        headerBackground: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: "transparent",
        },
        headerContent: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: theme.custom.spacing.lg,
        },
        titleContainer: {
          alignItems: "center",
        },
        stickyButtonsContainer: {
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          zIndex: 15,
          paddingHorizontal: theme.custom.spacing.lg,
        },
        stickyHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: headerMinHeight,
        },
        stickyTitleContainer: {
          flex: 1,
          flexDirection: "row",
          gap: theme.custom.spacing.xs,
          alignItems: "center",
        },
        greeting: {
          fontSize: theme.custom.typography.displaySmall.fontSize,
          fontWeight: "800",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.displaySmall.letterSpacing,
          marginBottom: theme.custom.spacing.xxxs,
        },
        stickyTitle: {
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontWeight: "600",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
        },
        date: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "500",
          opacity: 0.8,
        },
        section: {
          paddingHorizontal: theme.custom.spacing.xs,
          marginBottom: theme.custom.spacing.md,
        },
        sectionTitle: {
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontWeight: "600",
          marginBottom: theme.custom.spacing.sm,
          color: theme.colors.onBackground,
          paddingHorizontal: theme.custom.spacing.xs,
        },
        scrollContent: {
          paddingBottom: 100,
          paddingTop: headerMaxHeight + insets.top,
        },
        weatherContainer: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.xs,
          marginTop: theme.custom.spacing.sm,
        },
        weatherTemp: {
          fontSize: theme.custom.typography.headlineMedium.fontSize,
          color: theme.colors.onBackground,
          fontWeight: "700",
        },
        quickActions: {
          flexDirection: "row",
          gap: theme.custom.spacing.sm,
          paddingHorizontal: theme.custom.spacing.xs,
        },
        quickActionCard: {
          minWidth: 85,
          borderRadius: theme.custom.sizes.borderRadius.xl,
          overflow: "hidden",
          backgroundColor: theme.colors.elevation.level1,
        },
        quickActionContent: {
          paddingVertical: theme.custom.spacing.md,
          paddingHorizontal: theme.custom.spacing.sm,
          alignItems: "center",
          gap: theme.custom.spacing.xs,
        },
        quickActionIcon: {
          width: 40,
          height: 40,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.primaryContainer,
        },
        quickActionLabel: {
          fontSize: theme.custom.typography.labelSmall.fontSize,
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
          marginHorizontal: theme.custom.spacing.xs,
          borderRadius: theme.custom.sizes.borderRadius.xxl,
          overflow: "hidden",
          elevation: 0,
          backgroundColor: theme.colors.elevation.level1,
        },
        cardContent: {
          flexDirection: "row",
          alignItems: "center",
          padding: theme.custom.spacing.md,
        },
        cardIcon: {
          width: 48,
          height: 48,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          justifyContent: "center",
          alignItems: "center",
          marginRight: theme.custom.spacing.md,
          backgroundColor: theme.colors.surfaceVariant,
        },
        cardText: {
          flex: 1,
        },
        cardTitle: {
          fontSize: theme.custom.typography.bodyLarge.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: 2,
        },
        cardSubtitle: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "400",
        },

        heroCard: {
          marginBottom: theme.custom.spacing.md,
          marginHorizontal: theme.custom.spacing.xs,
          borderRadius: theme.custom.sizes.borderRadius.xxl,
          overflow: "hidden",
          elevation: 0,
          backgroundColor: theme.colors.elevation.level1,
        },
        heroContent: {
          flexDirection: "row",
          alignItems: "center",
          padding: theme.custom.spacing.md,
        },
        heroIcon: {
          width: 48,
          height: 48,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          justifyContent: "center",
          alignItems: "center",
          marginRight: theme.custom.spacing.md,
          backgroundColor: theme.colors.primaryContainer,
        },
        heroTextContainer: {
          flex: 1,
        },
        heroTitle: {
          fontSize: theme.custom.typography.labelSmall.fontSize,
          fontWeight: "600",
          color: theme.colors.onSurfaceVariant,
          textTransform: "uppercase",
          letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
          marginBottom: 2,
        },
        heroValue: {
          fontSize: theme.custom.typography.headlineLarge.fontSize,
          fontWeight: "700",
          color: theme.colors.onSurface,
          letterSpacing: -0.5,
          marginBottom: 2,
        },
        heroSubtitle: {
          fontSize: theme.custom.typography.bodySmall.fontSize,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "400",
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.custom.spacing.sm,
          paddingHorizontal: theme.custom.spacing.xs,
        },
        editButton: {
          margin: 0,
        },
        actionButtonsContainer: {
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: theme.custom.spacing.sm,
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.md,
        },
        actionButton: {
          backgroundColor: theme.colors.surfaceVariant,
          margin: 0,
        },
      }),
    [theme, insets.top, headerMaxHeight],
  );

  React.useEffect(() => {
    void loadWeatherSummary();
  }, [loadWeatherSummary]);

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

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          { height: animatedValues.headerHeight },
        ]}
      >
        <Animated.View
          style={[
            styles.headerBackground,
            {
              height: animatedValues.headerHeight,
              opacity: animatedValues.headerBackgroundOpacity,
              backgroundColor: theme.colors.background,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.headerContent,
            { height: animatedValues.headerHeight },
          ]}
        >
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: animatedValues.titleOpacity,
              },
            ]}
          >
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.date}>{dateString}</Text>
            {weatherSummary && (
              <View style={styles.weatherContainer}>
                <LottieWeatherIcon
                  condition={weatherSummary.condition}
                  size={48}
                  autoPlay
                  loop
                />
                <Text style={styles.weatherTemp}>
                  {weatherSummary.temperature}
                </Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyButtonsContainer]}>
        <View
          style={[
            styles.stickyHeader,
            { paddingTop: insets.top, height: headerMinHeight },
          ]}
        >
          <Animated.View
            style={[
              styles.stickyTitleContainer,
              {
                opacity: animatedValues.stickyTitleOpacity,
              },
            ]}
          >
            <Text style={styles.stickyTitle}>Dashboard</Text>
          </Animated.View>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Action Buttons - Fade out when scrolling */}
        <Animated.View
          style={[
            styles.actionButtonsContainer,
            { opacity: animatedValues.titleOpacity },
          ]}
        >
          <IconButton
            icon="robot"
            size={22}
            iconColor={theme.colors.onSurfaceVariant}
            style={styles.actionButton}
            onPress={() => router.push("/(auth)/settings/conversational-ai")}
          />
          <IconButton
            icon="cog"
            size={22}
            iconColor={theme.colors.onSurfaceVariant}
            style={styles.actionButton}
            onPress={() => router.push("/(auth)/settings")}
          />
        </Animated.View>

        {/* Hero Stats Card */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/services")}
            activeOpacity={0.7}
          >
            <Surface style={styles.heroCard} elevation={0}>
              <View style={styles.heroContent}>
                <View style={styles.heroIcon}>
                  <MaterialCommunityIcons
                    name="server-network"
                    size={24}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>Services Status</Text>
                  <Text style={styles.heroValue}>
                    {healthOverview.online}/{healthOverview.total}
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    {healthOverview.offline > 0
                      ? `${healthOverview.offline} offline`
                      : "All operational"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Surface>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <IconButton
              icon="pencil"
              size={18}
              iconColor={theme.colors.onSurfaceVariant}
              style={styles.editButton}
              onPress={() => router.push("/(auth)/settings/quick-actions")}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActions}
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
        </View>

        {/* Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>

          <TouchableOpacity onPress={showDownloads} activeOpacity={0.7}>
            <Surface style={styles.card} elevation={0}>
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="download"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>
                    {activeDownloadsCount > 0
                      ? `${activeDownloadsCount} Active Downloads`
                      : "No Active Downloads"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {activeDownloadsCount > 0
                      ? "Tap to view progress"
                      : "All downloads complete"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
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
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={24}
                    color={theme.colors.tertiary}
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
                  size={20}
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
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="monitor-dashboard"
                    size={24}
                    color={
                      aggregatedHealth?.criticalIssues?.length
                        ? theme.colors.error
                        : theme.colors.primary
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
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
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
