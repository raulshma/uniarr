import { useRouter } from "expo-router";
import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  RefreshControl,
  ScrollView,
  Animated,
} from "react-native";
import { AppState, type AppStateStatus } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Text, IconButton, Portal } from "react-native-paper";
import { useHaptics } from "@/hooks/useHaptics";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import { AnimatedSection } from "@/components/common/AnimatedComponents";
import WidgetContainer from "@/components/widgets/WidgetContainer/WidgetContainer";
import { easeOutCubic } from "@/utils/animations.utils";
import { widgetService } from "@/services/widgets/WidgetService";
import LottieWeatherIcon from "@/components/widgets/WeatherWidget/LottieWeatherIcon";
import { WeatherBackdrop } from "@/components/weather/WeatherBackdrop";
import { mapWeatherToBackdrop } from "@/services/weather/weatherMapping";
import { useIsFocused } from "@react-navigation/native";

const headerMinHeight = 80; // Minimum collapsed height

// Helper function to calculate progress percentage

interface AnimatedValues {
  headerHeight: Animated.AnimatedInterpolation<string | number>;
  titleOpacity: Animated.AnimatedInterpolation<string | number>;
  titleTranslateY: Animated.AnimatedInterpolation<string | number>;
  buttonsTranslateY: Animated.AnimatedInterpolation<string | number>;
  buttonsPosition: Animated.AnimatedInterpolation<string | number>;
  stickyTitleOpacity: Animated.AnimatedInterpolation<string | number>;
  headerBackgroundOpacity: Animated.AnimatedInterpolation<string | number>;
}

interface DashboardHeaderProps {
  animatedValues: AnimatedValues;
  weatherSummary: { condition: string; temperature: string } | null;
  theme: ReturnType<typeof useTheme>;
  frostedEnabled: boolean;
  gradientEnabled: boolean;
}

const DashboardHeader = React.memo(
  ({
    animatedValues,
    weatherSummary,
    theme,
    frostedEnabled,
    gradientEnabled,
  }: DashboardHeaderProps) => {
    const insets = useSafeAreaInsets();

    const weatherHeaderRowStyle = useMemo(
      () => ({
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        marginTop: theme.custom.spacing.xxxs,
        gap: theme.custom.spacing.none,
      }),
      [theme.custom.spacing.xxxs, theme.custom.spacing.none],
    );

    const stickyWeatherHeaderRowStyle = useMemo(
      () => ({
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: theme.custom.spacing.none,
        opacity: animatedValues.stickyTitleOpacity,
      }),
      [theme.custom.spacing.none, animatedValues.stickyTitleOpacity],
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
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
            paddingTop: insets.top,
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
          title: {
            fontSize: theme.custom.typography.titleLarge.fontSize,
            fontWeight: "800",
            color: theme.colors.onBackground,
            letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
          },
          stickyTitle: {
            fontSize: theme.custom.typography.titleMedium.fontSize,
            fontWeight: "600",
            color: theme.colors.onBackground,
            letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          },
        }),
      [theme, insets.top],
    );

    const router = useRouter();

    return (
      <>
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
          >
            {frostedEnabled && gradientEnabled && (
              <BlurView
                intensity={25}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: theme.dark
                      ? "rgba(15, 15, 35, 0.3)"
                      : "rgba(255, 255, 255, 0.2)",
                  },
                ]}
              />
            )}
          </Animated.View>
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
                  transform: [{ translateY: animatedValues.titleTranslateY }],
                },
              ]}
            >
              <Text style={styles.title}>Dashboard</Text>
              {weatherSummary && (
                <View style={weatherHeaderRowStyle}>
                  <LottieWeatherIcon
                    condition={weatherSummary.condition}
                    size={40}
                    autoPlay
                    loop
                  />
                  <Text
                    style={{
                      fontSize: theme.custom.typography.labelSmall.fontSize,
                      color: theme.colors.onBackground,
                    }}
                  >
                    {weatherSummary.temperature}
                  </Text>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.stickyButtonsContainer,
            {
              transform: [{ translateY: animatedValues.buttonsTranslateY }],
            },
          ]}
        >
          <View style={styles.stickyHeader}>
            <Animated.View
              style={[
                styles.stickyTitleContainer,
                {
                  opacity: animatedValues.stickyTitleOpacity,
                },
              ]}
            >
              <Text style={styles.stickyTitle}>Dashboard</Text>
              {weatherSummary && (
                <Animated.View style={stickyWeatherHeaderRowStyle}>
                  <LottieWeatherIcon
                    condition={weatherSummary.condition}
                    size={34}
                    autoPlay
                    loop
                  />
                  <Text
                    style={{
                      fontSize: theme.custom.typography.titleSmall.fontSize,
                      color: theme.colors.onBackground,
                    }}
                    numberOfLines={1}
                  >
                    {weatherSummary.temperature}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
            <Animated.View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.custom.spacing.sm,
                opacity: animatedValues.buttonsPosition,
              }}
            >
              <IconButton
                icon="download"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                style={{ backgroundColor: theme.colors.surfaceVariant }}
                onPress={() => router.push("/(auth)/jellyfin-downloads")}
              />
              <IconButton
                icon="cog"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                style={{ backgroundColor: theme.colors.surfaceVariant }}
                onPress={() => router.push("/(auth)/settings")}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </>
    );
  },
);

interface DashboardWidgetsProps {
  theme: ReturnType<typeof useTheme>;
}

const DashboardWidgets = React.memo(({ theme }: DashboardWidgetsProps) => (
  <AnimatedSection
    delay={100}
    style={{
      paddingHorizontal: theme.custom.spacing.sm,
      marginTop: theme.custom.spacing.sm,
    }}
  >
    <WidgetContainer editable={true} />
  </AnimatedSection>
));

const DashboardScreen = () => {
  const router = useRouter();
  const theme = useTheme();
  const { onPress } = useHaptics();
  const insets = useSafeAreaInsets();
  const gradientEnabled = useSettingsStore((s) => s.gradientBackgroundEnabled);
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const weatherEffectsEnabled = useSettingsStore(
    (s) => s.experimentalWeatherEffectsEnabled,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  const [weatherSummary, setWeatherSummary] = React.useState<{
    condition: string;
    temperature: string;
  } | null>(null);
  const [weatherForBackdrop, setWeatherForBackdrop] = React.useState<
    any | null
  >(null);

  // Performance monitoring
  useEffect(() => {
    const mountTime = Date.now();

    const loadWeatherSummary = async () => {
      try {
        await widgetService.initialize();
        const widgets = await widgetService.getWeatherWidgets();
        const headerWidget = widgets.find((w) =>
          Boolean(w.config?.showInDashboardHeader),
        );

        if (!headerWidget) {
          setWeatherSummary(null);
          setWeatherForBackdrop(null);
          return;
        }

        const cached = await widgetService.getWidgetData<any>(headerWidget.id);
        const payload = cached?.payload;
        if (!payload || typeof payload !== "object") {
          setWeatherSummary(null);
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
          setWeatherSummary(null);
          setWeatherForBackdrop(null);
          return;
        }

        setWeatherSummary({
          condition: weather.current.condition.text,
          temperature: `${Math.round(weather.current.temperature)}°`,
        });
        setWeatherForBackdrop(weather);
      } catch (error) {
        console.log("[Dashboard] Failed to load weather summary", error);
        setWeatherSummary(null);
        setWeatherForBackdrop(null);
      }
    };

    void loadWeatherSummary();

    return () => {
      const unmountTime = Date.now();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", setAppState);
    return () => sub.remove();
  }, []);

  const handleRefresh = useCallback(async () => {
    onPress();
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [onPress]);

  const screenHeight = Dimensions.get("window").height;
  const headerMaxHeight = screenHeight * 0.4; // 40% screen height
  const collapseRange = headerMaxHeight - headerMinHeight;

  // Memoize animated styles to prevent recalculation on every render
  const animatedValues = useMemo(
    () => ({
      // Animated styles with ease-out-cubic Bezier curve for smooth deceleration
      headerHeight: easeOutCubic(
        scrollY,
        [0, collapseRange],
        [headerMaxHeight, headerMinHeight],
      ),

      // Title fades out as user scrolls up, then fades back in via sticky title
      // This creates a smooth fade out effect with the main title
      titleOpacity: easeOutCubic(scrollY, [0, collapseRange * 0.6], [1, 0]),

      titleTranslateY: easeOutCubic(scrollY, [0, collapseRange], [0, -20]),

      buttonsTranslateY: easeOutCubic(
        scrollY,
        [0, collapseRange],
        [headerMaxHeight - 70, -20],
      ),

      buttonsPosition: scrollY.interpolate({
        inputRange: [0, collapseRange],
        outputRange: [1, 1],
        extrapolate: "clamp",
      }),

      stickyTitleOpacity: easeOutCubic(
        scrollY,
        [collapseRange * 0.6, collapseRange],
        [0, 1],
      ),

      // Header background fades in only when reaching the top (fully collapsed)
      headerBackgroundOpacity: scrollY.interpolate({
        inputRange: [0, collapseRange - 10, collapseRange],
        outputRange: [0, 0, 1],
        extrapolate: "clamp",
      }),

      // Sync gradient animation to scroll position for responsive feel
      gradient1Opacity: scrollY.interpolate({
        inputRange: [0, collapseRange],
        outputRange: [0.7, 0.21],
        extrapolate: "clamp",
      }),
      gradient2Opacity: scrollY.interpolate({
        inputRange: [0, collapseRange],
        outputRange: [0.21, 0.7],
        extrapolate: "clamp",
      }),
      gradient3Opacity: scrollY.interpolate({
        inputRange: [0, collapseRange],
        outputRange: [0.21, 0.21],
        extrapolate: "clamp",
      }),
    }),
    [scrollY, headerMaxHeight, headerMinHeight, collapseRange],
  );

  // Memoize gradient background to prevent unnecessary re-renders
  const gradientBackground = useMemo(() => {
    if (!gradientEnabled) return null;

    return (
      <>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: animatedValues.gradient1Opacity },
          ]}
        >
          <LinearGradient
            colors={["#0f0f23", "#1a1a2e", "#16213e"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: animatedValues.gradient2Opacity },
          ]}
        >
          <LinearGradient
            colors={["#1a1a2e", "#16213e", "#0f0f23"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: animatedValues.gradient3Opacity },
          ]}
        >
          <LinearGradient
            colors={["#16213e", "#0f0f23", "#1a1a2e"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      </>
    );
  }, [gradientEnabled, animatedValues]);

  const weatherHeaderRowStyle = useMemo(
    () => ({
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: theme.custom.spacing.xxxs,
      gap: theme.custom.spacing.none,
    }),
    [theme.custom.spacing.xxxs, theme.custom.spacing.none],
  );

  const stickyWeatherHeaderRowStyle = useMemo(
    () => ({
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.custom.spacing.none,
    }),
    [theme.custom.spacing.none],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollView: {
          flex: 1,
          paddingHorizontal: theme.custom.spacing.none,
        },
        scrollContent: {
          paddingBottom: 100,
          paddingTop: headerMaxHeight + insets.top,
        },
      }),
    [theme, insets.top, headerMaxHeight],
  );

  // Summary metrics are currently unused in this component; keep calculation
  // in case they are needed later. If not required, we can remove this.

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  return (
    <Portal.Host>
      <View style={styles.container}>
        {/* Frosted Glass Overlay */}
        {frostedEnabled && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(255, 255, 255, 0.06)",
              },
            ]}
          />
        )}

        {gradientBackground}
        {!gradientEnabled && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.background },
            ]}
          />
        )}

        <DashboardHeader
          animatedValues={animatedValues}
          weatherSummary={weatherSummary}
          theme={theme}
          frostedEnabled={frostedEnabled}
          gradientEnabled={gradientEnabled}
        />

        {/* Content */}
        {weatherEffectsEnabled &&
          weatherForBackdrop &&
          isFocused &&
          appState === "active" && (
            <WeatherBackdrop
              {...mapWeatherToBackdrop({ weather: weatherForBackdrop })}
              visible
            />
          )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Widgets Section */}
          <DashboardWidgets theme={theme} />
        </ScrollView>
      </View>
    </Portal.Host>
  );
};

export default DashboardScreen;
