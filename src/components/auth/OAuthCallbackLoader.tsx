import { StyleSheet, View, Image, ActivityIndicator } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import {
  Animated,
  ANIMATION_DURATIONS,
  shouldAnimateLayout,
} from "@/utils/animations.utils";

interface OAuthCallbackLoaderProps {
  message?: string;
  title?: string;
  minShowTimeMs?: number;
  onComplete?: () => void;
  status?: "loading" | "success" | "failure";
}

export const OAuthCallbackLoader = ({
  message = "Processing authentication...",
  title = "Signing In",
  minShowTimeMs = 1500,
  onComplete,
  status = "loading",
}: OAuthCallbackLoaderProps) => {
  const theme = useTheme();
  const mountTimeRef = useRef(Date.now());
  const hasTriggeredExitRef = useRef(false);

  // Animated shared values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Breathing loop animation (subtle scale oscillation)
  useEffect(() => {
    if (!shouldAnimateLayout(false)) return;

    // Start breathing loop: 1.0 -> 1.08 -> 1.0 over 1.4s (700ms up, 700ms down)
    // Also add slight opacity pulse for more dramatic effect
    scale.value = withRepeat(
      withTiming(1.08, {
        duration: 700,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    // Slight opacity pulse alongside scale
    opacity.value = withRepeat(
      withTiming(0.9, {
        duration: 700,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [scale, opacity]);

  // Monitor status and trigger exit animation when success
  useEffect(() => {
    if (status !== "success" || hasTriggeredExitRef.current) return;

    const elapsedMs = Date.now() - mountTimeRef.current;
    const remainingMs = Math.max(0, minShowTimeMs - elapsedMs);

    const exitTimer = setTimeout(() => {
      hasTriggeredExitRef.current = true;

      if (shouldAnimateLayout(false)) {
        // Exit animation: fade out + scale down
        scale.value = withTiming(0.8, {
          duration: ANIMATION_DURATIONS.NORMAL,
          easing: Easing.out(Easing.ease),
        });
        opacity.value = withTiming(0, {
          duration: ANIMATION_DURATIONS.NORMAL,
          easing: Easing.out(Easing.ease),
        });
      }

      // Call onComplete after exit animation finishes
      setTimeout(() => {
        onComplete?.();
      }, ANIMATION_DURATIONS.NORMAL);
    }, remainingMs);

    return () => clearTimeout(exitTimer);
  }, [status, minShowTimeMs, scale, opacity, onComplete]);

  // Animated style for logo
  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    content: {
      alignItems: "center",
    },
    logoContainer: {
      marginBottom: 32,
      width: 140,
      height: 140,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 70,
      backgroundColor: theme.colors.surfaceVariant,
    },
    logo: {
      width: 100,
      height: 100,
      tintColor: theme.colors.primary,
      resizeMode: "contain",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.primary,
      marginBottom: 16,
      textAlign: "center",
    },
    message: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 32,
      maxWidth: 300,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {shouldAnimateLayout(false) ? (
          <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
            <Image
              source={require("../../../assets/icon.png")}
              style={styles.logo}
              accessibilityLabel="App logo"
            />
          </Animated.View>
        ) : (
          <View style={styles.logoContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        <Text variant="titleLarge" style={styles.title}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={styles.message}>
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
};
