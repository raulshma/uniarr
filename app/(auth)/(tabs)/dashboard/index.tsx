import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  RefreshControl,
  ScrollView,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, IconButton, Portal } from "react-native-paper";
import { useHaptics } from "@/hooks/useHaptics";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import { AnimatedSection } from "@/components/common/AnimatedComponents";
import WidgetContainer from "@/components/widgets/WidgetContainer/WidgetContainer";
import { useWidgetServiceInitialization } from "@/hooks/useWidgetServiceInitialization";

// Helper function to calculate progress percentage

const DashboardScreen = () => {
  const router = useRouter();
  const theme = useTheme();
  const { onPress } = useHaptics();
  const insets = useSafeAreaInsets();
  const gradientEnabled = useSettingsStore((s) => s.gradientBackgroundEnabled);
  const [refreshing, setRefreshing] = React.useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Animated gradient colors
  const gradientAnim = useRef(new Animated.Value(0)).current;

  // Initialize gradient animation
  useEffect(() => {
    const animateGradient = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(gradientAnim, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: false,
          }),
          Animated.timing(gradientAnim, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    };
    animateGradient();
  }, [gradientAnim]);

  // Initialize WidgetService early to prevent loading issues
  useWidgetServiceInitialization();

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
  const headerMinHeight = 80; // Minimum collapsed height

  // Animated styles
  const headerHeight = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [headerMaxHeight, headerMinHeight],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [0, -20],
    extrapolate: "clamp",
  });

  const buttonsTranslateY = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [headerMaxHeight - 70, -20],
    extrapolate: "clamp",
  });

  const buttonsPosition = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [1, 1],
    extrapolate: "clamp",
  });

  const stickyTitleOpacity = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Gradient opacity animations (reduced for frosted glass effect)
  const gradient1Opacity = gradientAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.7, 0.21, 0.21, 0.7],
  });
  const gradient2Opacity = gradientAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.21, 0.7, 0.21, 0.21],
  });
  const gradient3Opacity = gradientAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.21, 0.21, 0.7, 0.21],
  });

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
        title: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontWeight: "800",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
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
          height: headerMinHeight,
        },
        stickyTitle: {
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontWeight: "600",
          color: theme.colors.onBackground,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
        },
        stickyButtons: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.sm,
        },
        floatingButtons: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.sm,
        },
        settingsButton: {
          backgroundColor: theme.colors.surfaceVariant,
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
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          ]}
        />

        {gradientEnabled && (
          <>
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: gradient1Opacity }]}
            >
              <LinearGradient
                colors={["#0f0f23", "#1a1a2e", "#16213e"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </Animated.View>
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: gradient2Opacity }]}
            >
              <LinearGradient
                colors={["#1a1a2e", "#16213e", "#0f0f23"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
            </Animated.View>
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: gradient3Opacity }]}
            >
              <LinearGradient
                colors={["#16213e", "#0f0f23", "#1a1a2e"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>
          </>
        )}
        {!gradientEnabled && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.background },
            ]}
          />
        )}
        {/* Animated Header */}
        <Animated.View
          style={[styles.headerContainer, { height: headerHeight }]}
        >
          <Animated.View
            style={[styles.headerBackground, { height: headerHeight }]}
          />
          <Animated.View
            style={[styles.headerContent, { height: headerHeight }]}
          >
            <Animated.View
              style={[
                styles.titleContainer,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              <Text style={styles.title}>Dashboard</Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* Sticky Header */}
        <Animated.View
          style={[
            styles.stickyButtonsContainer,
            {
              transform: [{ translateY: buttonsTranslateY }],
            },
          ]}
        >
          <View style={styles.stickyHeader}>
            <Animated.Text
              style={[
                styles.stickyTitle,
                {
                  opacity: stickyTitleOpacity,
                },
              ]}
            >
              Dashboard
            </Animated.Text>
            <Animated.View
              style={[
                styles.stickyButtons,
                {
                  opacity: buttonsPosition,
                },
              ]}
            >
              <IconButton
                icon="download"
                size={22}
                iconColor={theme.colors.onSurfaceVariant}
                style={styles.settingsButton}
                onPress={() => router.push("/(auth)/jellyfin-downloads")}
              />
              <IconButton
                icon="cog"
                size={22}
                iconColor={theme.colors.onSurfaceVariant}
                style={styles.settingsButton}
                onPress={() => router.push("/(auth)/settings")}
              />
            </Animated.View>
          </View>
        </Animated.View>

        {/* Content */}
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
          <AnimatedSection
            delay={100}
            style={{
              paddingHorizontal: theme.custom.spacing.sm,
              marginTop: theme.custom.spacing.sm,
            }}
          >
            <WidgetContainer editable={true} />
          </AnimatedSection>
        </ScrollView>
      </View>
    </Portal.Host>
  );
};

export default DashboardScreen;
