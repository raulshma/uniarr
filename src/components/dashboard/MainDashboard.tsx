import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Chip, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { useServicesHealth } from "@/hooks/useServicesHealth";
import { useDownloadIndicator } from "@/providers/DownloadPortalProvider";
import { useCalendar } from "@/hooks/useCalendar";
import LottieWeatherIcon from "@/components/widgets/WeatherWidget/LottieWeatherIcon";
import { widgetService } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";

const MainDashboard = () => {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { onPress } = useHaptics();

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
        header: {
          paddingHorizontal: theme.custom.spacing.lg,
          paddingBottom: theme.custom.spacing.sm,
          paddingTop: insets.top + theme.custom.spacing.sm,
        },
        greeting: {
          fontSize: 26,
          fontWeight: "bold",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        date: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginTop: 2,
        },
        section: {
          paddingHorizontal: theme.custom.spacing.lg,
          marginBottom: theme.custom.spacing.md,
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: "700",
          marginBottom: theme.custom.spacing.xs,
          color: theme.colors.onSurfaceVariant,
          marginLeft: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          opacity: 0.8,
        },
        headerTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: theme.custom.spacing.xs,
        },
        greetingBlock: {
          flex: 1,
          marginRight: theme.custom.spacing.sm,
        },
        weatherTouch: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.colors.elevation.level2,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          gap: 6,
        },
        weatherTemp: {
          fontSize: 15,
          color: theme.colors.onSurface,
          fontWeight: "700",
        },
        quickActions: {
          flexDirection: "row",
          gap: theme.custom.spacing.sm,
          marginBottom: theme.custom.spacing.md,
        },
        quickActionChip: {
          marginRight: theme.custom.spacing.sm,
          borderRadius: 20,
          height: 36,
        },
        card: {
          marginBottom: theme.custom.spacing.sm,
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 26,
          overflow: "hidden",
        },
        cardContent: {
          flexDirection: "row",
          alignItems: "center",
          padding: 16,
          paddingVertical: 18,
        },
        cardIcon: {
          width: 44,
          height: 44,
          borderRadius: 16,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        },
        cardText: {
          flex: 1,
        },
        cardTitle: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: 2,
        },
        cardSubtitle: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
        },
        statusDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginLeft: 8,
        },
      }),
    [theme, insets.top],
  );

  React.useEffect(() => {
    void loadWeatherSummary();
  }, [loadWeatherSummary]);

  return (
    <View style={styles.container}>
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
                style={styles.weatherTouch}
                onPress={() => router.push("/(auth)/settings/widgets")}
              >
                <LottieWeatherIcon
                  condition={weatherSummary.condition}
                  size={24}
                  autoPlay
                  loop
                />
                <Text style={styles.weatherTemp}>
                  {weatherSummary.temperature}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Compact Weather Inline (moved into header) */}

        {/* Quick Actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.section,
            { paddingRight: theme.custom.spacing.lg },
          ]}
        >
          <Chip
            icon="magnify"
            onPress={() => router.push("/(auth)/(tabs)/services")}
            style={styles.quickActionChip}
          >
            Search
          </Chip>
          <Chip
            icon="calendar"
            onPress={() => router.push("/(auth)/(tabs)/calendar")}
            style={styles.quickActionChip}
          >
            Calendar
          </Chip>
          <Chip
            icon="download"
            onPress={() => router.push("/(auth)/(tabs)/downloads")}
            style={styles.quickActionChip}
          >
            {activeDownloadsCount > 0
              ? `Downloads (${activeDownloadsCount})`
              : "Downloads"}
          </Chip>
          <Chip
            icon="cog"
            onPress={() => router.push("/(auth)/(tabs)/settings")}
            style={styles.quickActionChip}
          >
            Settings
          </Chip>
        </ScrollView>

        {/* Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/(tabs)/services")}
          >
            <Surface style={styles.card} elevation={0}>
              <View style={styles.cardContent}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="server-network"
                    size={24}
                    color={theme.colors.onPrimaryContainer}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>
                    {healthOverview.online} / {healthOverview.total} Services
                    Online
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {healthOverview.offline > 0
                      ? `${healthOverview.offline} services offline`
                      : "All systems operational"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        healthOverview.offline > 0
                          ? theme.colors.error
                          : theme.colors.primary,
                    },
                  ]}
                />
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity onPress={showDownloads}>
            <Surface style={styles.card} elevation={0}>
              <View style={styles.cardContent}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="download"
                    size={24}
                    color={theme.colors.onSecondaryContainer}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>
                    {activeDownloadsCount > 0
                      ? `${activeDownloadsCount} Active Downloads`
                      : "No Active Downloads"}
                  </Text>
                  <Text style={styles.cardSubtitle}>Tap to view details</Text>
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
            onPress={() => {
              if (!nextRelease) {
                router.push("/(auth)/(tabs)/calendar");
                return;
              }

              // Navigate to series details page for episodes
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
                // For movies, series, or other types, go to calendar
                router.push("/(auth)/(tabs)/calendar");
              }
            }}
          >
            <Surface style={styles.card} elevation={0}>
              <View style={styles.cardContent}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: theme.colors.tertiaryContainer },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={24}
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
        </View>
      </ScrollView>
    </View>
  );
};

export default MainDashboard;
