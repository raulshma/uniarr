import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, RefreshControl, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useHaptics } from "@/hooks/useHaptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";

import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import WidgetContainer from "@/components/widgets/WidgetContainer/WidgetContainer";
import { widgetService } from "@/services/widgets/WidgetService";
import { WeatherBackdrop } from "@/components/weather/WeatherBackdrop";
import { mapWeatherToBackdrop } from "@/services/weather/weatherMapping";
import type { WeatherPayload } from "@/services/widgets/dataProviders/weatherProvider";

const WidgetsDashboard = () => {
  const theme = useTheme();
  const { onPress } = useHaptics();
  const insets = useSafeAreaInsets();
  const gradientEnabled = useSettingsStore((s) => s.gradientBackgroundEnabled);
  const weatherEffectsEnabled = useSettingsStore(
    (s) => s.experimentalWeatherEffectsEnabled,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const isFocused = useIsFocused();

  const [weatherForBackdrop, setWeatherForBackdrop] =
    React.useState<WeatherPayload | null>(null);

  const loadWeatherSummary = useCallback(async () => {
    try {
      await widgetService.initialize();
      const widgets = await widgetService.getWeatherWidgets();
      const headerWidget = widgets.find((w) =>
        Boolean(w.config?.showInDashboardHeader),
      );

      if (!headerWidget) {
        setWeatherForBackdrop(null);
        return;
      }

      const cached = await widgetService.getWidgetData<{
        payload: Record<string, WeatherPayload>;
      }>(headerWidget.id);
      const payload = cached?.payload;
      if (!payload || typeof payload !== "object") {
        setWeatherForBackdrop(null);
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
        setWeatherForBackdrop(null);
        return;
      }

      setWeatherForBackdrop(weather);
    } catch (error) {
      console.log("[Dashboard] Failed to load weather summary", error);
      setWeatherForBackdrop(null);
    }
  }, []);

  useEffect(() => {
    void loadWeatherSummary();
  }, [loadWeatherSummary]);

  const handleRefresh = useCallback(async () => {
    onPress();
    setRefreshing(true);
    await loadWeatherSummary();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [onPress, loadWeatherSummary]);

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
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: theme.custom.spacing.xxs,
          paddingTop: insets.top + theme.custom.spacing.md,
          paddingBottom: 100,
        },
      }),
    [theme, insets.top],
  );

  return (
    <View style={styles.container}>
      {gradientEnabled && (
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

      {weatherEffectsEnabled && weatherForBackdrop && isFocused && (
        <WeatherBackdrop
          {...mapWeatherToBackdrop({ weather: weatherForBackdrop })}
          visible
        />
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <WidgetContainer editable={true} />
      </ScrollView>
    </View>
  );
};

export default WidgetsDashboard;
