import React, { useMemo, useState, useCallback } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Chip, IconButton, Text, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import type {
  WeatherPayload,
  WeatherUnits,
  WeatherHourlyForecast,
} from "@/services/widgets/dataProviders";
import LottieWeatherIcon from "./LottieWeatherIcon";

interface WeatherDetailsDrawerContentProps {
  weatherData: Record<string, WeatherPayload | null>;
  locations: string[];
  units: WeatherUnits;
  onAddLocation?: () => void;
}

type ForecastMode = "hourly" | "daily";

const MAX_HOURLY_ITEMS = 12;

const formatHourLabel = (timeIso: string) => {
  try {
    return format(new Date(timeIso), "ha");
  } catch {
    return "--";
  }
};

const formatDayLabel = (dateIso: string) => {
  try {
    return format(new Date(dateIso), "EEE, MMM d");
  } catch {
    return dateIso;
  }
};

const ModeToggleButton = ({
  label,
  value,
  mode,
  onPress,
}: {
  label: string;
  value: ForecastMode;
  mode: ForecastMode;
  onPress: (value: ForecastMode) => void;
}) => {
  const theme = useTheme<AppTheme>();
  const isActive = mode === value;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(value)}
      style={[
        styles.modeButton,
        {
          backgroundColor: isActive
            ? theme.colors.primary
            : theme.colors.surfaceVariant,
          borderColor: isActive
            ? theme.colors.primary
            : theme.colors.outlineVariant,
        },
      ]}
    >
      <Text
        variant="labelLarge"
        style={{
          color: isActive ? theme.colors.onPrimary : theme.colors.onSurface,
          fontWeight: isActive ? "600" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const HourlyForecastRail = ({
  items,
  units,
}: {
  items: WeatherHourlyForecast[];
  units: WeatherUnits;
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={styles.hourlyScrollContent}
      scrollEventThrottle={16}
    >
      {items.map((hour) => (
        <View
          key={hour.time}
          style={[
            styles.hourCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurface, fontWeight: "600" }}
          >
            {formatHourLabel(hour.time)}
          </Text>
          <LottieWeatherIcon condition={hour.condition.text} size={72} />
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            {Math.round(hour.temperature)}°
          </Text>
          <View style={styles.hourMetaRow}>
            <LottieWeatherIcon
              condition="umbrella.json"
              size={18}
              autoPlay={true}
              loop={true}
            />
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
              {Math.round(hour.chanceOfRain)}%
            </Text>
          </View>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Feels like {Math.round(hour.feelsLike)}°
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {units === "imperial"
              ? `${Math.round(hour.windMph)} mph`
              : `${Math.round(hour.windKph)} km/h`}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

const DailyForecastList = ({
  forecast,
}: {
  forecast: WeatherPayload["forecast"];
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <View style={styles.dailyList}>
      {forecast.map((day) => (
        <View
          key={day.date}
          style={[
            styles.dailyItem,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.dailyLabelColumn}>
            <Text
              variant="bodyLarge"
              style={{ color: theme.colors.onSurface, fontWeight: "600" }}
            >
              {formatDayLabel(day.date)}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {day.condition.text}
            </Text>
          </View>
          <View style={styles.dailyIconColumn}>
            <LottieWeatherIcon condition={day.condition.text} size={68} />
          </View>
          <View style={styles.dailyMetaColumn}>
            <Text
              variant="titleMedium"
              style={{
                color: theme.colors.onSurface,
                fontWeight: "600",
              }}
            >
              {Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°
            </Text>
            <View style={styles.dailyRainRow}>
              <LottieWeatherIcon
                condition="umbrella.json"
                size={18}
                autoPlay={true}
                loop={true}
              />
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.primary }}
              >
                {Math.round(day.chanceOfRain)}% chance
              </Text>
            </View>
            {day.sunrise && day.sunset ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {day.sunrise} • {day.sunset}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
};

export const WeatherDetailsDrawerContent: React.FC<
  WeatherDetailsDrawerContentProps
> = ({ weatherData, locations, units, onAddLocation }) => {
  const theme = useTheme<AppTheme>();
  const [mode, setMode] = useState<ForecastMode>("hourly");
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);

  const locationKeys = useMemo(() => {
    if (!locations || locations.length === 0) {
      return Object.keys(weatherData ?? {});
    }
    return locations;
  }, [locations, weatherData]);

  const currentLocationKey =
    locationKeys[activeLocationIndex] ?? locationKeys[0];
  const activeWeather = currentLocationKey
    ? (weatherData[currentLocationKey] ??
      Object.values(weatherData).find((item) => item != null) ??
      null)
    : (Object.values(weatherData).find((item) => item != null) ?? null);

  const hourlyItems = useMemo(() => {
    if (!activeWeather?.hourly) {
      return [];
    }
    const now = Date.now();
    const futureHours = activeWeather.hourly.filter((hour) => {
      const time = new Date(hour.time).getTime();
      return !Number.isNaN(time) && time >= now - 60 * 60 * 1000;
    });
    return futureHours.slice(0, MAX_HOURLY_ITEMS);
  }, [activeWeather?.hourly]);

  const dailyItems = useMemo(() => {
    return activeWeather?.forecast ?? [];
  }, [activeWeather?.forecast]);

  const metrics = useMemo(() => {
    if (!activeWeather) {
      return [];
    }
    const uvIndex = Math.round(activeWeather.current.uvIndex);
    return [
      {
        lottieIcon: "wind.json",
        label: "Wind speed",
        value:
          units === "imperial"
            ? `${Math.round(activeWeather.current.windMph)} mph`
            : `${Math.round(activeWeather.current.windKph)} km/h`,
      },
      {
        lottieIcon: "umbrella.json",
        label: "Rain chance",
        value: `${Math.round(dailyItems[0]?.chanceOfRain ?? 0)}%`,
      },
      {
        lottieIcon: "umbrella-wind.json",
        label: "Humidity",
        value: `${Math.round(activeWeather.current.humidity)}%`,
      },
      {
        icon: "gauge" as const,
        label: "Pressure",
        value:
          units === "imperial"
            ? `${activeWeather.current.pressureIn.toFixed(2)} inHg`
            : `${Math.round(activeWeather.current.pressureMb)} hPa`,
      },
      {
        lottieIcon: `uv-index-${Math.min(uvIndex, 11)}.json`,
        label: "UV index",
        value: `${uvIndex}`,
      },
      {
        lottieIcon: "time-afternoon.json",
        label: "Cloud cover",
        value: `${Math.round(activeWeather.current.cloudCover)}%`,
      },
    ];
  }, [activeWeather, dailyItems, units]);

  const astronomy = activeWeather?.astronomy;

  const handleLocationChange = useCallback((index: number) => {
    setActiveLocationIndex(index);
  }, []);

  if (!activeWeather) {
    return (
      <View style={styles.emptyState}>
        <LottieWeatherIcon
          condition="time-afternoon.json"
          size={60}
          autoPlay={true}
          loop={true}
        />
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            marginTop: spacing.sm,
            textAlign: "center",
          }}
        >
          Weather details will appear here once data is available.
        </Text>
      </View>
    );
  }

  const locationName = activeWeather.location.name || "Weather";
  const locationRegion =
    activeWeather.location.region || activeWeather.location.country || "";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: spacing.md }}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.tertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroCard,
            {
              shadowColor: theme.colors.primary,
            },
          ]}
        >
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text
                variant="headlineMedium"
                style={{ color: theme.colors.onPrimary, fontWeight: "700" }}
              >
                {locationName}
              </Text>
              {locationRegion ? (
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onPrimary, opacity: 0.85 }}
                >
                  {locationRegion}
                </Text>
              ) : null}
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onPrimary, opacity: 0.7 }}
              >
                Updated {format(new Date(activeWeather.current.updatedAt), "p")}
              </Text>
            </View>
            {onAddLocation ? (
              <IconButton
                icon="plus"
                mode="contained-tonal"
                size={22}
                onPress={onAddLocation}
                accessibilityLabel="Add location"
              />
            ) : null}
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroTemperatureBlock}>
              <Text
                variant="displayLarge"
                style={{ color: theme.colors.onPrimary, fontWeight: "700" }}
              >
                {Math.round(activeWeather.current.temperature)}°
              </Text>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onPrimary, opacity: 0.9 }}
              >
                {activeWeather.current.condition.text}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onPrimary, opacity: 0.8 }}
              >
                Feels like {Math.round(activeWeather.current.feelsLike)}°
              </Text>
            </View>
            <LottieWeatherIcon
              condition={activeWeather.current.condition.text}
              size={180}
            />
          </View>

          {astronomy?.sunrise && astronomy?.sunset ? (
            <View style={styles.sunTimesRow}>
              <View style={styles.sunTimesItem}>
                <LottieWeatherIcon
                  condition="time-morning.json"
                  size={24}
                  autoPlay={true}
                  loop={true}
                />
                <View>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onPrimary }}
                  >
                    Sunrise
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onPrimary, fontWeight: "600" }}
                  >
                    {astronomy.sunrise}
                  </Text>
                </View>
              </View>
              <View style={styles.sunTimesItem}>
                <LottieWeatherIcon
                  condition="time-evening.json"
                  size={24}
                  autoPlay={true}
                  loop={true}
                />
                <View>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onPrimary }}
                  >
                    Sunset
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: theme.colors.onPrimary, fontWeight: "600" }}
                  >
                    {astronomy.sunset}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </LinearGradient>

        {locationKeys.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.locationChipsRow}
          >
            {locationKeys.map((location, index) => (
              <Chip
                key={`${location}-${index}`}
                selected={index === activeLocationIndex}
                onPress={() => handleLocationChange(index)}
                style={{ marginRight: spacing.sm }}
              >
                {location}
              </Chip>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.modeToggleRow}>
          <ModeToggleButton
            label="Hourly"
            value="hourly"
            mode={mode}
            onPress={setMode}
          />
          <ModeToggleButton
            label="Daily"
            value="daily"
            mode={mode}
            onPress={setMode}
          />
        </View>

        {mode === "hourly" ? (
          <HourlyForecastRail items={hourlyItems} units={units} />
        ) : (
          <DailyForecastList forecast={dailyItems} />
        )}

        <View style={styles.metricsGrid}>
          {metrics.map((metric) => (
            <View
              key={metric.label}
              style={[
                styles.metricCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.metricIconWrapper}>
                {"lottieIcon" in metric ? (
                  <LottieWeatherIcon
                    condition={metric.lottieIcon}
                    size={24}
                    autoPlay={true}
                    loop={true}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={metric.icon}
                    size={24}
                    color={theme.colors.primary}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {metric.label}
                </Text>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurface, fontWeight: "600" }}
                >
                  {metric.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  heroCard: {
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  heroTemperatureBlock: {
    gap: spacing.xs,
  },
  sunTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sunTimesItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  locationChipsRow: {
    paddingHorizontal: spacing.xs,
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  hourlyScrollContent: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  hourCard: {
    width: 140,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  hourMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dailyList: {
    gap: spacing.sm,
  },
  dailyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  dailyLabelColumn: {
    flex: 1.2,
    gap: spacing.xs,
  },
  dailyIconColumn: {
    flex: 0.8,
    alignItems: "center",
  },
  dailyMetaColumn: {
    flex: 1,
    gap: spacing.xs,
    alignItems: "flex-end",
  },
  dailyRainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  metricCard: {
    width: "47%",
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  metricIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});

export default WeatherDetailsDrawerContent;
