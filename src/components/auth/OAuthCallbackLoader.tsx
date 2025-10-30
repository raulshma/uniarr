import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useMemo } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  useDerivedValue,
} from "react-native-reanimated";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  useClock,
} from "@shopify/react-native-skia";
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

// Enhanced Skia Animated Loader Component with sophisticated animations
const SkiaLoader = ({ size = 80, theme }: { size: number; theme: any }) => {
  const clock = useClock();
  const center = size / 2;
  const radius = size / 2 - 8;

  // Use clock for time-based animation (more performant)
  const rotation = useDerivedValue(() => {
    // 360 degrees per 1200ms = 0.3 degrees per ms
    return (clock.value / 1200) * 360;
  });

  // Create multiple arcs for a more sophisticated loader effect
  const arcPaths = useMemo(() => {
    const paths: (ReturnType<typeof Skia.Path.Make> | null)[] = [];
    const arcCount = 3;

    for (let i = 0; i < arcCount; i++) {
      const path = Skia.Path.Make();
      if (!path) {
        paths.push(null);
        continue;
      }

      const startAngle = i * (360 / arcCount) * (Math.PI / 180);

      // Create arc using addArc method
      path.addArc(
        {
          x: center - radius,
          y: center - radius,
          width: radius * 2,
          height: radius * 2,
        },
        (startAngle * 180) / Math.PI,
        120, // 120-degree arc
      );

      paths.push(path);
    }

    return paths;
  }, [size, center, radius]);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Static background circle */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        color={theme.colors.surfaceVariant}
        style="stroke"
        strokeWidth={3}
        opacity={0.12}
      />

      {/* Animated rotating arc group */}
      <Group
        transform={[{ rotate: rotation.value }]}
        origin={{ x: center, y: center }}
      >
        {/* Primary rotating arc */}
        {arcPaths[0] && (
          <Path
            path={arcPaths[0]}
            color={theme.colors.primary}
            style="stroke"
            strokeWidth={4}
            strokeCap="round"
            opacity={0.95}
          />
        )}

        {/* Secondary arc for depth effect */}
        {arcPaths[1] && (
          <Path
            path={arcPaths[1]}
            color={theme.colors.primary}
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
            opacity={0.5}
          />
        )}

        {/* Tertiary arc for trailing effect */}
        {arcPaths[2] && (
          <Path
            path={arcPaths[2]}
            color={theme.colors.primary}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
            opacity={0.25}
          />
        )}
      </Group>

      {/* Center dot with subtle breathing animation */}
      <Circle
        cx={center}
        cy={center}
        r={3}
        color={theme.colors.primary}
        opacity={0.7}
      />
    </Canvas>
  );
};

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
      width: 120,
      height: 120,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 60,
      backgroundColor: theme.colors.surfaceVariant,
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
            <SkiaLoader size={80} theme={theme} />
          </Animated.View>
        ) : (
          <View style={styles.logoContainer}>
            <SkiaLoader size={80} theme={theme} />
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
