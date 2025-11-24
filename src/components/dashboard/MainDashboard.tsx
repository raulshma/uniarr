import React, { useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { Text, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { useServicesHealth } from "@/hooks/useServicesHealth";
import { useDownloadIndicator } from "@/providers/DownloadPortalProvider";
import { useCalendar } from "@/hooks/useCalendar";
import LottieWeatherIcon from "@/components/widgets/WeatherWidget/LottieWeatherIcon";
import { widgetService } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";

import { useSettingsStore } from "@/store/settingsStore";
import { easeOutCubic } from "@/utils/animations.utils";
import type { WeatherPayload } from "@/services/widgets/dataProviders/weatherProvider";

import QuickActions from "./QuickActions";
import HeroStatsCard from "./HeroStatsCard";
import ActivitySection from "./ActivitySection";

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

      const cached = await widgetService.getWidgetData<{
        payload: Record<string, WeatherPayload>;
      }>(headerWidget.id);
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
        <HeroStatsCard healthOverview={healthOverview} />

        {/* Quick Actions */}
        <QuickActions activeDownloadsCount={activeDownloadsCount} />

        {/* Activity Section */}
        <ActivitySection
          activeDownloadsCount={activeDownloadsCount}
          showDownloads={showDownloads}
          nextRelease={nextRelease}
        />
      </ScrollView>
    </View>
  );
};

export default MainDashboard;
