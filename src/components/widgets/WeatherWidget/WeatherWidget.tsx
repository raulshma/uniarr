import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import { Card } from "@/components/common/Card";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import WidgetConfigPlaceholder from "@/components/widgets/common/WidgetConfigPlaceholder";
import { getComponentElevation } from "@/constants/elevation";
import type { AppTheme } from "@/constants/theme";
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
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";

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
  const { onPress } = useHaptics();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState(false);

  const config = useMemo(() => normalizeConfig(widget.config), [widget.config]);
  const units: WeatherUnits = config.units ?? "metric";
  const unitsLabel = units === "imperial" ? "imperial" : "metric";

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

  const handleRefresh = () => {
    onPress();
    void loadWeather(true);
    onRefresh?.();
  };

  if (!apiKey) {
    return (
      <Card
        contentPadding="lg"
        style={StyleSheet.flatten([
          styles.card,
          getComponentElevation("widget", theme),
        ])}
      >
        <WidgetConfigPlaceholder
          title="Weather API key required"
          description="Add your WeatherAPI key to view the forecast."
          actionLabel="Add API key"
          onAction={onEdit}
        />
      </Card>
    );
  }

  if (permissionIssue) {
    return (
      <Card
        contentPadding="lg"
        style={StyleSheet.flatten([
          styles.card,
          getComponentElevation("widget", theme),
        ])}
      >
        <WidgetConfigPlaceholder
          title="Location needed"
          description="Allow location access or provide a manual city to load local weather."
          actionLabel="Update settings"
          onAction={onEdit}
        />
      </Card>
    );
  }

  return (
    <Card
      contentPadding="lg"
      style={StyleSheet.flatten([
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.xxl,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
        },
        getComponentElevation("widget", theme),
      ])}
    >
      <View style={styles.header}>
        <View>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {widget.title}
          </Text>
          {weather?.location?.name && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {weather.location.name}
            </Text>
          )}
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
            />
          )}
          <IconButton
            icon={refreshing ? "progress-clock" : "refresh"}
            size={20}
            onPress={handleRefresh}
            disabled={refreshing}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <SkeletonPlaceholder height={110} borderRadius={16} />
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
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Humidity {weather.current.humidity}% • Wind
                {units === "imperial"
                  ? ` ${Math.round(weather.current.windMph)} mph`
                  : ` ${Math.round(weather.current.windKph)} kph`}
              </Text>
            </View>
          </View>

          <View style={styles.forecastRow}>
            {weather.forecast.map((day) => (
              <View key={day.date} style={styles.forecastItem}>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {new Date(day.date).toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </Text>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurface }}
                >
                  {Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {day.condition.text}
                </Text>
              </View>
            ))}
          </View>

          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Updated {new Date(weather.current.updatedAt).toLocaleTimeString()} (
            {unitsLabel})
          </Text>
        </View>
      )}

      {error && (
        <Text variant="bodySmall" style={styles.error}>
          {error}
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    gap: 12,
  },
  emptyState: {
    alignItems: "flex-start",
  },
  content: {
    gap: 12,
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  currentMeta: {
    gap: 6,
  },
  forecastRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  forecastItem: {
    flex: 1,
    gap: 4,
  },
  error: {
    color: "#ff6b6b",
  },
});

export default WeatherWidget;
