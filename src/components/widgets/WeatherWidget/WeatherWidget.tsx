import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";

import { Card } from "@/components/common/Card";
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import AnimatedWeatherIcon from "./AnimatedWeatherIcon";
import WeatherGradientBackground from "./WeatherGradientBackground";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { borderRadius } from "@/constants/sizes";
import { useHaptics } from "@/hooks/useHaptics";
import { logger } from "@/services/logger/LoggerService";
import { deviceLocationService } from "@/services/location/DeviceLocationService";
import {
  fetchWeatherForecast,
  type WeatherPayload,
  type WeatherUnits,
} from "@/services/widgets/dataProviders";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { mapConditionToIcon } from "./weatherIcons";
import { WeatherDetailsDrawerContent } from "./WeatherDetailsDrawerContent";
import { useWidgetDrawer } from "@/services/widgetDrawerService";
import { useSettingsStore } from "@/store/settingsStore";
import { createWidgetConfigSignature } from "@/utils/widget.utils";
import { parseColor } from "@/utils/color.utils";

const CACHE_TTL_MS = 45 * 60 * 1000;

interface WeatherWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface WeatherWidgetConfig {
  mode?: "device" | "manual";
  locations?: string[];
  units?: WeatherUnits;
  forecastDays?: number;
  showInDashboardHeader?: boolean;
}

interface WeatherCacheEntry {
  payload: Record<string, WeatherPayload | null>;
  queries: string[];
}

const normalizeConfig = (config: Widget["config"]): WeatherWidgetConfig => {
  if (!config || typeof config !== "object") {
    return {};
  }

  const mode =
    config.mode === "device" || config.mode === "manual"
      ? (config.mode as "device" | "manual")
      : undefined;

  const locations = Array.isArray(config.locations)
    ? (config.locations as string[]).filter(
        (value) => typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const units =
    config.units === "imperial"
      ? "imperial"
      : config.units === "metric"
        ? "metric"
        : undefined;
  const forecastDays =
    typeof config.forecastDays === "number" ? config.forecastDays : undefined;

  const showInDashboardHeader =
    typeof config.showInDashboardHeader === "boolean"
      ? config.showInDashboardHeader
      : false;

  return {
    mode,
    locations,
    units,
    forecastDays,
    showInDashboardHeader,
  } satisfies WeatherWidgetConfig;
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const theme = useTheme();
  const { onLongPress: onWidgetLongPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [weatherData, setWeatherData] = useState<
    Record<string, WeatherPayload | null>
  >({});
  const [resolvedLocations, setResolvedLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState(false);

  const { openDrawer } = useWidgetDrawer();
  const { onLongPress: onHapticLongPress } = useHaptics();

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const units: WeatherUnits = config.units ?? "metric";
  const styles = useMemo(() => createStyles(theme), [theme]);
  const configSignature = useMemo(
    () => createWidgetConfigSignature(config),
    [config],
  );

  const overlayColor = useMemo(() => {
    const { r, g, b } = parseColor(theme.colors.onSurface);
    return `rgba(${r}, ${g}, ${b}, 0.08)`;
  }, [theme.colors.onSurface]);

  const loadCredentials = useCallback(async () => {
    const credentials = await widgetCredentialService.getCredentials(widget.id);
    const key = credentials?.apiKey ?? null;
    setApiKey(key);
  }, [widget.id]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const resolveQueries = useCallback(async (): Promise<string[]> => {
    const queries: string[] = [];

    // For manual mode, use configured locations
    if (
      config.mode === "manual" &&
      config.locations &&
      config.locations.length > 0
    ) {
      queries.push(
        ...config.locations.map((loc) => loc.trim().replace(/\s+/g, " ")),
      );
    }

    // For device mode, try to get device location first
    if (config.mode === "device" || !config.mode) {
      const coords = await deviceLocationService.getCurrentLocation();
      if (coords) {
        setPermissionIssue(false);
        queries.unshift(`${coords.latitude},${coords.longitude}`);
      } else if (config.locations && config.locations.length > 0) {
        queries.push(
          ...config.locations.map((loc) => loc.trim().replace(/\s+/g, " ")),
        );
      } else {
        setPermissionIssue(true);
      }
    }

    return queries.length > 0 ? queries : [];
  }, [config.locations, config.mode]);

  const loadWeather = useCallback(
    async (forceRefresh = false) => {
      if (!apiKey) {
        setWeather(null);
        setWeatherData({});
        setResolvedLocations([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<WeatherCacheEntry>(
            widget.id,
            configSignature,
          );
          if (
            cached &&
            cached.payload &&
            Object.keys(cached.payload).length > 0
          ) {
            setWeatherData(cached.payload);
            const firstLocation = Object.keys(cached.payload)[0]!;
            const firstPayload = cached.payload[firstLocation];
            if (firstPayload) {
              setWeather(firstPayload);
            }
            setResolvedLocations(cached.queries || []);
            setLoading(false);
            setError(null);
            return;
          } else {
            setLoading(true);
          }
        } else {
          setRefreshing(true);
        }

        const queries = await resolveQueries();
        if (queries.length === 0) {
          return;
        }

        // Fetch all locations in parallel
        const payloads = await Promise.all(
          queries.map((query) =>
            fetchWeatherForecast({
              apiKey,
              query,
              days: config.forecastDays ?? 3,
              units,
            }),
          ),
        );

        const weatherMap: Record<string, WeatherPayload | null> = {};
        queries.forEach((query, index) => {
          const payload = payloads[index] || null;
          const key = payload?.location?.name || query;
          weatherMap[key] = payload;
        });

        if (
          Object.keys(weatherMap).length === 0 ||
          !Object.values(weatherMap).some((w) => w)
        ) {
          setWeather(null);
          setError("Unable to load weather data");
          return;
        }

        // Set first location as primary display
        const firstValidPayload = Object.values(weatherMap).find(
          (w) => w !== null,
        );
        setWeather(firstValidPayload || null);
        setWeatherData(weatherMap);
        setResolvedLocations(Object.keys(weatherMap));
        setError(null);
        await widgetService.setWidgetData(
          widget.id,
          { payload: weatherMap, queries: Object.keys(weatherMap) },
          {
            ttlMs: CACHE_TTL_MS,
            configSignature,
          },
        );
      } catch (error) {
        void logger.warn("WeatherWidget: failed to load forecast", {
          widgetId: widget.id,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Unable to load weather data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      apiKey,
      configSignature,
      config.forecastDays,
      resolveQueries,
      units,
      widget.id,
    ],
  );

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    void loadWeather();
  }, [apiKey, loadWeather]);

  const handleOpenDetails = useCallback(() => {
    if (!weather || resolvedLocations.length === 0) {
      return;
    }
    void onWidgetLongPress();
    openDrawer({
      title: `${weather.location.name}${weather.location.region ? ", " + weather.location.region : ""}`,
      metadata: {},
      customContent: (
        <WeatherDetailsDrawerContent
          weatherData={weatherData}
          locations={resolvedLocations}
          units={units}
          onAddLocation={onEdit}
        />
      ),
      showMetadata: false,
      showActionButton: false,
      actionUrl: "https://www.weatherapi.com/",
      maxHeight: "92%",
    });
  }, [
    onWidgetLongPress,
    openDrawer,
    weather,
    weatherData,
    resolvedLocations,
    units,
    onEdit,
  ]);

  const handleLongPress = useCallback(async () => {
    await onHapticLongPress();
    handleOpenDetails();
  }, [handleOpenDetails, onHapticLongPress]);

  const handleRefresh = () => {
    void loadWeather(true);
    onRefresh?.();
  };

  if (!apiKey) {
    return (
      <Card
        contentPadding={0}
        variant={frostedEnabled ? "frosted" : "custom"}
        style={styles.card}
      >
        <View style={styles.cardContent}>
          <WidgetConfigPlaceholder
            title="Weather API key required"
            description="Add your WeatherAPI key to view the forecast."
            actionLabel="Add API key"
            onAction={onEdit}
          />
        </View>
      </Card>
    );
  }

  if (permissionIssue) {
    return (
      <Card
        contentPadding={0}
        variant={frostedEnabled ? "frosted" : "custom"}
        style={styles.card}
      >
        <View style={styles.cardContent}>
          <WidgetConfigPlaceholder
            title="Location needed"
            description="Allow location access or provide a manual city to load local weather."
            actionLabel="Update settings"
            onAction={onEdit}
          />
        </View>
      </Card>
    );
  }

  return (
    <Card
      contentPadding={0}
      variant="custom"
      style={[styles.card, { backgroundColor: "transparent" }]}
      onLongPress={handleLongPress}
      delayLongPress={500}
      accessibilityHint="Long press to view detailed weather information"
    >
      {weather && (
        <WeatherGradientBackground
          temperature={weather.current.temperature}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <View style={styles.cardContent}>
        <WidgetHeader
          title={widget.title}
          icon="weather-partly-cloudy"
          onEdit={onEdit}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <SkeletonPlaceholder height={110} borderRadius={borderRadius.lg} />
          </View>
        ) : !weather ? (
          <View style={styles.emptyState}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Weather data is unavailable right now.
            </Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Main Weather Display */}
            <View style={styles.mainSection}>
              <View style={styles.locationContainer}>
                <Text
                  variant="titleLarge"
                  style={styles.locationText}
                  numberOfLines={1}
                >
                  {weather.location.name}
                </Text>
                <Text variant="bodyMedium" style={styles.conditionText}>
                  {weather.current.condition.text}
                </Text>
              </View>

              <View style={styles.tempContainer}>
                <Text style={styles.tempText}>
                  {Math.round(weather.current.temperature)}°
                </Text>
                <View style={styles.iconWrapper}>
                  <AnimatedWeatherIcon
                    condition={weather.current.condition.text}
                    size={100}
                    useLottie={true}
                  />
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={[styles.statsRow, { backgroundColor: overlayColor }]}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="water-percent"
                  size={16}
                  color={theme.colors.onSurface}
                  style={{ opacity: 0.7 }}
                />
                <Text variant="labelMedium" style={styles.statText}>
                  {weather.current.humidity}%
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="weather-windy"
                  size={16}
                  color={theme.colors.onSurface}
                  style={{ opacity: 0.7 }}
                />
                <Text variant="labelMedium" style={styles.statText}>
                  {units === "imperial"
                    ? `${Math.round(weather.current.windMph)} mph`
                    : `${Math.round(weather.current.windKph)} km/h`}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="thermometer"
                  size={16}
                  color={theme.colors.onSurface}
                  style={{ opacity: 0.7 }}
                />
                <Text variant="labelMedium" style={styles.statText}>
                  Feels {Math.round(weather.current.feelsLike)}°
                </Text>
              </View>
            </View>

            {/* Minimal Forecast */}
            <View style={styles.forecastRow}>
              {weather.forecast.slice(0, 3).map((day, index) => {
                const forecastDate = new Date(day.date);
                const isToday = index === 0;
                return (
                  <View
                    key={day.date}
                    style={[
                      styles.forecastItem,
                      { backgroundColor: overlayColor },
                    ]}
                  >
                    <Text variant="labelSmall" style={styles.forecastDayText}>
                      {isToday
                        ? "Today"
                        : forecastDate.toLocaleDateString(undefined, {
                            weekday: "short",
                          })}
                    </Text>
                    <MaterialCommunityIcons
                      name={mapConditionToIcon(day.condition.text)}
                      size={24}
                      color={theme.colors.onSurface}
                    />
                    <View style={styles.forecastTemp}>
                      <Text variant="labelMedium" style={styles.forecastHigh}>
                        {Math.round(day.maxTemp)}°
                      </Text>
                      <Text variant="labelSmall" style={styles.forecastLow}>
                        {Math.round(day.minTemp)}°
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {error && (
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        )}
      </View>
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xxl,
      overflow: "hidden",
    },
    cardContent: {
      padding: theme.custom.spacing.md,
      gap: theme.custom.spacing.md,
    },
    loadingContainer: {
      gap: theme.custom.spacing.sm,
    },
    emptyState: {
      alignItems: "flex-start",
      paddingVertical: theme.custom.spacing.sm,
    },
    content: {
      gap: theme.custom.spacing.lg,
    },
    mainSection: {
      marginTop: theme.custom.spacing.xs,
    },
    locationContainer: {
      marginBottom: theme.custom.spacing.sm,
    },
    locationText: {
      fontWeight: "700",
      color: theme.colors.onSurface,
    },
    conditionText: {
      color: theme.colors.onSurface,
      opacity: 0.8,
    },
    tempContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.custom.spacing.xs,
    },
    tempText: {
      fontSize: 64,
      fontWeight: "200",
      color: theme.colors.onSurface,
      includeFontPadding: false,
      lineHeight: 70,
    },
    iconWrapper: {
      width: 100,
      height: 100,
      justifyContent: "center",
      alignItems: "center",
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: borderRadius.lg,
      padding: theme.custom.spacing.sm,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statDivider: {
      width: 1,
      height: 16,
      backgroundColor: theme.colors.onSurface,
      opacity: 0.2,
    },
    statText: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    forecastRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.custom.spacing.sm,
    },
    forecastItem: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      padding: theme.custom.spacing.sm,
      borderRadius: borderRadius.lg,
    },
    forecastDayText: {
      color: theme.colors.onSurface,
      opacity: 0.9,
      fontWeight: "600",
    },
    forecastTemp: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    forecastHigh: {
      color: theme.colors.onSurface,
      fontWeight: "700",
    },
    forecastLow: {
      color: theme.colors.onSurface,
      opacity: 0.7,
    },
  });

export default WeatherWidget;
