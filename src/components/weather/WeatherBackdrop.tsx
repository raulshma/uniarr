import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { WeatherBackdropCondition } from "@/services/weather/weatherMapping";

export interface WeatherBackdropProps {
  condition: WeatherBackdropCondition;
  isDaytime: boolean;
  intensity?: "low" | "medium" | "high";
  visible?: boolean;
}

const PARTICLE_COUNTS = {
  low: 30,
  medium: 60,
  high: 100,
};

const DURATION_BASE = {
  rain: 1800,
  drizzle: 2800,
  snow: 5000,
  clouds: 16000,
  fog: 0,
  clear: 0,
  thunderstorm: 1600,
};

// Define type for rain particles
type RainParticle = {
  id: number;
  x: number;
  length: number;
  width: number;
  speed: number;
  opacity: number;
  windEffect: number;
  splashDelay: number;
};

export const WeatherBackdrop: React.FC<WeatherBackdropProps> = ({
  condition,
  isDaytime,
  intensity = "low",
  visible = true,
}) => {
  const theme = useTheme<AppTheme>();

  // Cache the palette to prevent recalculating on every render
  const palette = React.useMemo(
    () => getPalette(theme, isDaytime),
    [theme, isDaytime],
  );

  const count = PARTICLE_COUNTS[intensity];

  // Generate more realistic rain particles with varied properties
  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      // Create varied particles for more realistic effect
      const speedVariation = 0.4 + Math.random() * 0.6; // 0.4 to 1.0
      const lengthVariation = 0.8 + Math.random() * 0.6; // 0.8 to 1.4
      const widthVariation = 0.6 + Math.random() * 0.4; // 0.6 to 1.0
      const opacityVariation = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
      const windVariation = -0.15 + Math.random() * 0.3; // -0.15 to 0.15

      return {
        id: i,
        x: (i * 97) % 100, // Spread particles across width
        length: 40 * lengthVariation,
        width: 2 * widthVariation,
        speed: speedVariation,
        opacity: opacityVariation,
        windEffect: windVariation,
        splashDelay: Math.random() * 200, // Random splash delay
      } as const;
    });
  }, [count]);

  // Animated values pool
  const animations = useRef(
    particles.map(() => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;

    const loops: Animated.CompositeAnimation[] = [];

    if (
      condition === "rain" ||
      condition === "drizzle" ||
      condition === "thunderstorm"
    ) {
      const baseDuration = DURATION_BASE[condition];
      const isHeavyRain = condition === "thunderstorm";
      const windEffect = condition === "thunderstorm" ? 0.3 : 0.15;

      animations.forEach((a, idx) => {
        const particle =
          particles[idx] ??
          ({
            id: 0,
            x: 0,
            length: 40,
            width: 2,
            speed: 1,
            opacity: 0.7,
            windEffect: 0,
            splashDelay: 0,
          } as RainParticle);
        // Adjust duration based on particle's speed property
        const duration = baseDuration / particle.speed;

        // Stagger the animations more for natural effect
        const initialDelay = (idx % 10) * 120 + Math.random() * 200; // Calculate final X position based on wind effect
        const endX =
          particle.windEffect * 50 + windEffect * (isHeavyRain ? 40 : 20);

        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(initialDelay),
            // Fade in at the top
            Animated.timing(a.opacity, {
              toValue: particle.opacity,
              duration: 100,
              useNativeDriver: true,
            }),
            // Move down with wind effect
            Animated.parallel([
              Animated.timing(a.translateY, {
                toValue: 1,
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
              Animated.timing(a.translateX, {
                toValue: endX,
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
            // Fast fade out at bottom (simulates hitting the ground)
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: 50,
              useNativeDriver: true,
            }),
            // Create splash effect with scale animation
            Animated.timing(a.scale, {
              toValue: 1.8,
              duration: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(a.scale, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            // Reset
            Animated.timing(a.translateY, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(a.translateX, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(a.scale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );
        loops.push(loop);
        loop.start();
      });
    } else if (condition === "snow") {
      const duration = DURATION_BASE.snow;
      animations.forEach((a, idx) => {
        const startDelay = (idx % 10) * 150;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(startDelay),
            Animated.timing(a.opacity, {
              toValue: 1,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.parallel([
              Animated.timing(a.translateY, {
                toValue: 1,
                duration: duration + (idx % 7) * 400,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(a.translateX, {
                toValue: ((idx % 2) * 2 - 1) as any, // -1 or 1
                duration: duration * 0.6,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(a.translateY, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(a.translateX, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );
        loops.push(loop);
        loop.start();
      });
    } else if (condition === "clouds") {
      const duration = DURATION_BASE.clouds;
      animations
        .slice(0, Math.max(6, Math.floor(count / 5)))
        .forEach((a, idx) => {
          const startDelay = (idx % 6) * 800;
          const loop = Animated.loop(
            Animated.sequence([
              Animated.delay(startDelay),
              Animated.timing(a.opacity, {
                toValue: 0.6,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(a.translateX, {
                toValue: 1,
                duration: duration + (idx % 3) * 2000,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(a.opacity, {
                toValue: 0.0,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(a.translateX, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          );
          loops.push(loop);
          loop.start();
        });
    }

    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [animations, condition, count, particles, visible]);

  if (!visible) return null;

  // Get color based on rain intensity
  const getRainColor = (condition: WeatherBackdropCondition) => {
    if (condition === "thunderstorm") return palette.rainDropHeavy;
    if (condition === "drizzle") return palette.rainDropLight;
    return palette.rainDrop;
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Base gradient tint */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: palette.baseOverlay,
          },
        ]}
      />

      {/* Effects */}
      {condition === "rain" ||
      condition === "drizzle" ||
      condition === "thunderstorm" ? (
        <View style={StyleSheet.absoluteFill}>
          {animations.map((a, idx) => {
            const particle =
              particles[idx] ??
              ({
                id: 0,
                x: 0,
                length: 40,
                width: 2,
                speed: 1,
                opacity: 0.7,
                windEffect: 0,
                splashDelay: 0,
              } as RainParticle);
            return (
              <React.Fragment key={`rain-${idx}`}>
                {/* Rain drop */}
                <Animated.View
                  style={{
                    position: "absolute",
                    left: `${particle.x}%`,
                    top: -40,
                    width: particle.width,
                    height: particle.length,
                    transform: [
                      {
                        translateY: a.translateY.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1000],
                        }),
                      },
                      {
                        translateX: a.translateX.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 100],
                        }),
                      },
                      {
                        rotate: "12deg",
                      },
                      {
                        scale: a.scale.interpolate({
                          inputRange: [0, 1.8],
                          outputRange: [1, 1.8],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                    opacity: a.opacity,
                    backgroundColor: getRainColor(condition),
                    borderRadius: particle.width / 2,
                  }}
                />

                {/* Splash effect at bottom */}
                <Animated.View
                  style={{
                    position: "absolute",
                    left: `${particle.x}%`,
                    bottom: 0,
                    width: particle.width * 3,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: getRainColor(condition),
                    transform: [
                      {
                        scale: a.scale.interpolate({
                          inputRange: [0, 1.8],
                          outputRange: [0, 1],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                    opacity: a.opacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.6],
                      extrapolate: "clamp",
                    }),
                  }}
                />
              </React.Fragment>
            );
          })}

          {condition === "thunderstorm" ? (
            <ThunderFlash color={palette.thunderFlash} />
          ) : null}
        </View>
      ) : null}

      {condition === "snow" ? (
        <View style={StyleSheet.absoluteFill}>
          {animations.map((a, idx) => {
            const left = (idx * 73) % 100;
            const size = 2 + (idx % 4);
            return (
              <Animated.View
                key={`flake-${idx}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: -20,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: palette.snowFlake,
                  transform: [
                    {
                      translateY: a.translateY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1000],
                      }),
                    },
                    {
                      translateX: a.translateX.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 10],
                      }),
                    },
                  ],
                  opacity: a.opacity,
                }}
              />
            );
          })}
        </View>
      ) : null}

      {condition === "clouds" ? (
        <View style={StyleSheet.absoluteFill}>
          {animations
            .slice(0, Math.max(6, Math.floor(count / 5)))
            .map((a, idx) => {
              const top = 5 + (idx % 5) * 15;
              const width = 160 + (idx % 3) * 60;
              const height = 60 + (idx % 2) * 20;
              return (
                <Animated.View
                  key={`cloud-${idx}`}
                  style={{
                    position: "absolute",
                    left: -width,
                    top: `${top}%`,
                    width,
                    height,
                    borderRadius: height / 2,
                    backgroundColor: palette.cloud,
                    opacity: a.opacity,
                    transform: [
                      {
                        translateX: a.translateX.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, width + 400],
                        }),
                      },
                    ],
                  }}
                />
              );
            })}
        </View>
      ) : null}

      {condition === "fog" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.fog,
              opacity:
                intensity === "high"
                  ? 0.35
                  : intensity === "medium"
                    ? 0.25
                    : 0.15,
            },
          ]}
        />
      ) : null}
    </View>
  );
};

const ThunderFlash: React.FC<{ color: string }> = ({ color }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800 + Math.random() * 2200),
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]}
    />
  );
};

function getPalette(theme: AppTheme, isDaytime: boolean) {
  const baseOverlay = isDaytime
    ? theme.colors.surfaceVariant + "20"
    : theme.colors.surfaceVariant + "26";
  return {
    baseOverlay,
    rainDrop: isDaytime ? "#8AB4F8" : "#5E81AC",
    rainDropLight: isDaytime ? "#A0C8FF" : "#7A96C7", // Lighter version for variety
    rainDropHeavy: isDaytime ? "#6290E5" : "#456B9B", // Darker for heavy rain
    snowFlake: isDaytime ? "#FFFFFF" : "#E5E9F0",
    cloud: isDaytime ? "#ECEFF4" : "#4C566A",
    fog: isDaytime ? "#CBD5E1" : "#2F3542",
    thunderFlash: "#FFFFFF",
  };
}
