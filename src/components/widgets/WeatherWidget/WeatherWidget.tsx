import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { IconButton, Text, useTheme } from "react-native-paper";

import { Card } from "@/components/common/Card";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import { getComponentElevation } from "@/constants/elevation";
import type { AppTheme } from "@/constants/theme";
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
import { useWidgetDrawer } from "@/services/widgetDrawerService";
import { mapConditionToIcon } from "./weatherIcons";

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
}

interface WeatherCacheEntry {
  payload: WeatherPayload | null;
  query: string;
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

  return {
    mode,
    locations,
    units,
    forecastDays,
  } satisfies WeatherWidgetConfig;
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  widget,
  onEdit,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress, onLongPress: onWidgetLongPress } = useHaptics();
  const { openDrawer } = useWidgetDrawer();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState(false);

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const units: WeatherUnits = config.units ?? "metric";
  const unitsLabel = units === "imperial" ? "imperial" : "metric";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadCredentials = useCallback(async () => {
    const credentials = await widgetCredentialService.getCredentials(widget.id);
    const key = credentials?.apiKey ?? null;
    setApiKey(key);
  }, [widget.id]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const resolveQuery = useCallback(async (): Promise<string | null> => {
    if (
      config.mode === "manual" &&
      config.locations &&
      config.locations.length > 0
    ) {
      return config.locations[0]!.trim().replace(/\s+/g, " ");
    }

    if (config.mode === "device" || !config.mode) {
      const coords = await deviceLocationService.getCurrentLocation();
      if (coords) {
        setPermissionIssue(false);
        return `${coords.latitude},${coords.longitude}`;
      }

      if (config.locations && config.locations.length > 0) {
        return config.locations[0]!.trim().replace(/\s+/g, " ");
      }

      setPermissionIssue(true);
      return null;
    }

    return null;
  }, [config.locations, config.mode]);

  const loadWeather = useCallback(
    async (forceRefresh = false) => {
      if (!apiKey) {
        setWeather(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        if (!forceRefresh) {
          const cached = await widgetService.getWidgetData<WeatherCacheEntry>(
            widget.id,
          );
          if (cached && cached.payload) {
            setWeather(cached.payload);
            setLoading(false);
            setError(null);
          } else {
            setLoading(true);
          }
        } else {
          setRefreshing(true);
        }

        const query = await resolveQuery();
        if (!query) {
          return;
        }

        const payload = await fetchWeatherForecast({
          apiKey,
          query,
          days: config.forecastDays ?? 3,
          units,
        });

        if (!payload) {
          setWeather(null);
          setError("Unable to load weather data");
          return;
        }

        setWeather(payload);
        setError(null);
        await widgetService.setWidgetData(
          widget.id,
          { payload, query },
          CACHE_TTL_MS,
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
    [apiKey, config.forecastDays, resolveQuery, units, widget.id],
  );

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    void loadWeather();
  }, [apiKey, loadWeather]);

  const handleOpenDetails = useCallback(() => {
    if (!weather) {
      return;
    }
    void onWidgetLongPress();

    const buildForecastContent = (): string => {
      const windSpeed =
        units === "imperial"
          ? `${Math.round(weather.current.windMph)} mph`
          : `${Math.round(weather.current.windKph)} kph`;

      const currentSection = `Current: ${Math.round(weather.current.temperature)}°\n${weather.current.condition.text}\nFeels like: ${Math.round(weather.current.feelsLike)}°\n\nHumidity: ${weather.current.humidity}%\nWind: ${windSpeed}`;

      const forecastSection = weather.forecast
        .map((day) => {
          const date = new Date(day.date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return `${date}: ${Math.round(day.maxTemp)}° / ${Math.round(day.minTemp)}° - ${day.condition.text}`;
        })
        .join("\n");

      return `${currentSection}\n\n3-Day Forecast:\n${forecastSection}`;
    };

    openDrawer({
      title: `${weather.location.name || "Weather"} - Detailed Forecast`,
      content: buildForecastContent(),
      metadata: {
        source: weather.location.name,
      },
      actionUrl: "",
      maxHeight: "65%",
    });
  }, [onWidgetLongPress, weather, units, openDrawer]);

  const handleRefresh = () => {
    onPress();
    void loadWeather(true);
    onRefresh?.();
  };

  if (!apiKey) {
    return (
      <Card
        contentPadding={0}
        style={[styles.card, getComponentElevation("widget", theme)]}
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
        style={[styles.card, getComponentElevation("widget", theme)]}
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
    <>
      <Card
        contentPadding="sm"
        style={[styles.card, getComponentElevation("widget", theme)]}
        onLongPress={handleOpenDetails}
        accessibilityHint="Long press to view detailed weather information"
      >
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrapper}>
                <MaterialCommunityIcons
                  name={mapConditionToIcon(weather?.current.condition.text)}
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.titleGroup}>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurface }}
                >
                  {widget.title}
                </Text>
                {weather?.location?.name ? (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                    numberOfLines={1}
                  >
                    {weather.location.name}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.actions}>
              {onEdit && (
                <IconButton
                  icon="cog"
                  size={20}
                  onPress={() => {
                    onPress();
                    onEdit();
                  }}
                  accessibilityLabel="Edit weather widget"
                />
              )}
              <IconButton
                icon={refreshing ? "progress-clock" : "refresh"}
                size={20}
                onPress={handleRefresh}
                disabled={refreshing}
                accessibilityLabel="Refresh weather"
              />
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <SkeletonPlaceholder
                height={110}
                borderRadius={borderRadius.lg}
              />
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
              <View style={styles.currentRow}>
                <Text
                  variant="displaySmall"
                  style={{ color: theme.colors.onSurface }}
                >
                  {Math.round(weather.current.temperature)}°
                </Text>
                <View style={styles.currentMeta}>
                  <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {weather.current.condition.text}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Feels like {Math.round(weather.current.feelsLike)}°
                  </Text>
                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons
                      name="water-percent"
                      size={16}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {weather.current.humidity}% humidity
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons
                      name="weather-windy"
                      size={16}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Wind
                      {units === "imperial"
                        ? ` ${Math.round(weather.current.windMph)} mph`
                        : ` ${Math.round(weather.current.windKph)} kph`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.forecastRow}>
                {weather.forecast.map((day) => {
                  const forecastDate = new Date(day.date);
                  return (
                    <View key={day.date} style={styles.forecastItem}>
                      <Text
                        variant="bodySmall"
                        style={{
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {forecastDate.toLocaleDateString(undefined, {
                          weekday: "short",
                        })}
                      </Text>
                      <MaterialCommunityIcons
                        name={mapConditionToIcon(day.condition.text)}
                        size={20}
                        color={theme.colors.primary}
                      />
                      <Text
                        variant="titleMedium"
                        style={{ color: theme.colors.onSurface }}
                      >
                        {Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                        numberOfLines={2}
                      >
                        {day.condition.text}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.updateRow}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Updated{" "}
                  {new Date(weather.current.updatedAt).toLocaleTimeString()} (
                  {unitsLabel})
                </Text>
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
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xxl,
      backgroundColor: theme.colors.surface,
    },
    cardContent: {
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.md,
      gap: theme.custom.spacing.md,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.custom.spacing.md,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.md,
      flex: 1,
    },
    titleGroup: {
      flex: 1,
      gap: theme.custom.spacing.xs,
    },
    iconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceVariant,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.xs,
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
    currentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.lg,
    },
    currentMeta: {
      flex: 1,
      gap: theme.custom.spacing.xs,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.xs,
    },
    forecastRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.custom.spacing.sm,
    },
    forecastItem: {
      flex: 1,
      gap: theme.custom.spacing.xs,
      padding: theme.custom.spacing.sm,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.lg,
    },
    updateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.xs,
    },
  });

export default WeatherWidget;
