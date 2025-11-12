import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "react-native-paper";
import { BlurView } from "expo-blur";

import type { AppTheme } from "@/constants/theme";
import type { WeatherBackdropCondition } from "@/services/weather/weatherMapping";

export interface WeatherBackdropProps {
  condition: WeatherBackdropCondition;
  isDaytime: boolean;
  intensity?: "low" | "medium" | "high";
  visible?: boolean;
}

const PARTICLE_COUNTS = {
  low: 40,
  medium: 80,
  high: 140,
};

const DURATION_BASE = {
  rain: 1600,
  drizzle: 2600,
  sleet: 2800,
  "freezing-rain": 2300,
  snow: 4800,
  clouds: 14000,
  fog: 0,
  clear: 7500,
  thunderstorm: 1400,
} as const;

// Define types for particles
type RainParticle = {
  id: number;
  x: number;
  length: number;
  width: number;
  speed: number;
  opacity: number;
  windEffect: number;
  splashDelay: number;
  layer: number; // 0-2 for parallax
};

type GlowParticle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  intensity: number;
};

export const WeatherBackdrop: React.FC<WeatherBackdropProps> = ({
  condition,
  isDaytime,
  intensity = "low",
  visible = true,
}) => {
  const theme = useTheme<AppTheme>();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // Cache the palette to prevent recalculating on every render
  const palette = React.useMemo(
    () => getPalette(theme, isDaytime),
    [theme, isDaytime],
  );

  const count = PARTICLE_COUNTS[intensity];

  // Generate more realistic rain particles with varied properties and layering for parallax
  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      // Create varied particles for more realistic effect
      const speedVariation = 0.3 + Math.random() * 0.7; // 0.3 to 1.0
      const lengthVariation = 0.7 + Math.random() * 0.8; // 0.7 to 1.5
      const widthVariation = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
      const opacityVariation = 0.4 + Math.random() * 0.6; // 0.4 to 1.0
      const windVariation = -0.2 + Math.random() * 0.4; // -0.2 to 0.2
      const layer = i % 3; // 0, 1, 2 for parallax layering

      return {
        id: i,
        x: (i * 97) % 100, // Spread particles across width
        length: 35 * lengthVariation,
        width: 2.5 * widthVariation,
        speed: speedVariation,
        opacity: opacityVariation,
        windEffect: windVariation,
        splashDelay: Math.random() * 250,
        layer, // Add parallax layer
      } as const;
    });
  }, [count]);

  // Generate glow particles for ambient effects
  const glowParticles = useMemo(() => {
    if (condition !== "thunderstorm" && condition !== "clear") {
      return [];
    }
    const glowCount = intensity === "high" ? 6 : intensity === "medium" ? 4 : 2;
    return new Array(glowCount).fill(0).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 50,
      size: 80 + Math.random() * 120,
      duration: 3000 + Math.random() * 2000,
      delay: Math.random() * 2000,
      intensity: 0.15 + Math.random() * 0.15,
    })) as GlowParticle[];
  }, [condition, intensity]);

  // Animated values pool
  const animations = useRef(
    particles.map(() => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
      rotate: new Animated.Value(0),
    })),
  ).current;

  // Glow animations
  const glowAnimations = useRef(
    glowParticles.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.8),
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;

    const loops: Animated.CompositeAnimation[] = [];

    if (
      condition === "rain" ||
      condition === "drizzle" ||
      condition === "sleet" ||
      condition === "freezing-rain" ||
      condition === "thunderstorm"
    ) {
      const baseDuration = DURATION_BASE[condition];
      const isHeavyRain =
        condition === "thunderstorm" || condition === "freezing-rain";
      const windEffect = condition === "thunderstorm" ? 0.35 : 0.18;

      animations.forEach((a, idx) => {
        const particle =
          particles[idx] ??
          ({
            id: 0,
            x: 0,
            length: 35,
            width: 2.5,
            speed: 1,
            opacity: 0.7,
            windEffect: 0,
            splashDelay: 0,
            layer: 0,
          } as RainParticle);

        // Adjust duration based on particle's speed and layer (parallax)
        const layerSpeedFactor = 0.8 + particle.layer * 0.15; // Front moves faster
        const duration = (baseDuration / particle.speed) * layerSpeedFactor;

        // Stagger with more natural variation
        const initialDelay = (idx % 12) * 100 + Math.random() * 250;

        // Calculate final X position with enhanced wind effect
        const baseWindX = particle.windEffect * 60;
        const environmentalWind = windEffect * (isHeavyRain ? 50 : 25);
        const endX = baseWindX + environmentalWind;

        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(initialDelay),
            // Fade in smoothly at the top
            Animated.timing(a.opacity, {
              toValue: particle.opacity,
              duration: 120,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            // Move down with wind and rotation for realism
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
              Animated.timing(a.rotate, {
                toValue: 360,
                duration: duration * 2,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
            // Fast fade out at bottom
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: 60,
              useNativeDriver: true,
            }),
            // Enhanced splash effect
            Animated.parallel([
              Animated.timing(a.scale, {
                toValue: 2.2,
                duration: 120,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(a.rotate, {
                toValue: 450,
                duration: 120,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(a.scale, {
              toValue: 0,
              duration: 180,
              easing: Easing.inOut(Easing.quad),
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
            Animated.timing(a.rotate, {
              toValue: 0,
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
        const startDelay = (idx % 12) * 130;
        const windWave = Math.sin((idx / count) * Math.PI * 2) * 0.5;

        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(startDelay),
            Animated.timing(a.opacity, {
              toValue: 0.9,
              duration: 300,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.parallel([
              // Gentle descent with wave motion
              Animated.timing(a.translateY, {
                toValue: 1,
                duration: duration + (idx % 8) * 500,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
              }),
              // Oscillating horizontal motion (sine wave)
              Animated.timing(a.translateX, {
                toValue: 0.6 + windWave,
                duration: (duration + (idx % 8) * 500) * 0.8,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              // Subtle rotation
              Animated.timing(a.rotate, {
                toValue: 720,
                duration: duration + (idx % 8) * 500,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: 250,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            // Reset position
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
            Animated.timing(a.rotate, {
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
      const cloudCount = Math.max(8, Math.floor(count / 6));

      animations.slice(0, cloudCount).forEach((a, idx) => {
        const startDelay = (idx % 8) * 1000;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(startDelay),
            // Fade in with subtle scale grow
            Animated.parallel([
              Animated.timing(a.opacity, {
                toValue: 0.5 + intensity === "high" ? 0.3 : 0.15,
                duration: 1000,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(a.scale, {
                toValue: 1,
                duration: 1000,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            // Drift across screen
            Animated.timing(a.translateX, {
              toValue: 1,
              duration: duration + (idx % 4) * 2500,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            // Fade out
            Animated.parallel([
              Animated.timing(a.opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(a.scale, {
                toValue: 0.9,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
            // Reset
            Animated.timing(a.translateX, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(a.scale, {
              toValue: 0.8,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );
        loops.push(loop);
        loop.start();
      });
    } else if (condition === "clear") {
      const duration = DURATION_BASE.clear;
      const rayCount = Math.max(4, Math.floor(count / 12));

      animations.slice(0, rayCount).forEach((a, idx) => {
        const startDelay = (idx % 4) * 2000;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(startDelay),
            // Glow in
            Animated.timing(a.opacity, {
              toValue: 0.35,
              duration: 1200,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            // Drift left (sun rays from right)
            Animated.timing(a.translateX, {
              toValue: -1,
              duration: duration,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            // Fade out
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            // Reset
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

    // Setup glow animations for thunderstorm and clear
    if (glowAnimations.length > 0) {
      glowAnimations.forEach((ga, idx) => {
        const glowParticle = glowParticles[idx];
        if (!glowParticle) return;

        const glowLoop = Animated.loop(
          Animated.sequence([
            Animated.delay(glowParticle.delay),
            Animated.parallel([
              Animated.timing(ga.opacity, {
                toValue: glowParticle.intensity,
                duration: glowParticle.duration * 0.4,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(ga.scale, {
                toValue: 1,
                duration: glowParticle.duration * 0.4,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(ga.opacity, {
                toValue: 0,
                duration: glowParticle.duration * 0.6,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(ga.scale, {
                toValue: 1.3,
                duration: glowParticle.duration * 0.6,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
        );
        loops.push(glowLoop);
        glowLoop.start();
      });
    }

    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [
    animations,
    condition,
    count,
    intensity,
    particles,
    visible,
    glowAnimations,
    glowParticles,
  ]);

  if (!visible) return null;

  // Get color based on rain intensity
  const getRainColor = (condition: WeatherBackdropCondition) => {
    if (condition === "thunderstorm") return palette.rainDropHeavy;
    if (condition === "freezing-rain" || condition === "sleet")
      return palette.rainDropLight;
    if (condition === "drizzle") return palette.rainDropLight;
    return palette.rainDrop;
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Enhanced base gradient overlay with blur support */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: palette.baseOverlay,
          },
        ]}
      >
        {/* Subtle blur layer for depth */}
        {(condition === "rain" || condition === "thunderstorm") && (
          <BlurView
            intensity={isDaytime ? 8 : 5}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity:
                  intensity === "high"
                    ? 0.3
                    : intensity === "medium"
                      ? 0.15
                      : 0.08,
              },
            ]}
          />
        )}
      </Animated.View>

      {/* Glow effects for thunderstorm and clear skies */}
      {glowParticles.length > 0 && (
        <View style={StyleSheet.absoluteFill}>
          {glowAnimations.map((ga, idx) => {
            const glowParticle = glowParticles[idx];
            if (!glowParticle) return null;

            return (
              <Animated.View
                key={`glow-${idx}`}
                style={{
                  position: "absolute",
                  left: `${glowParticle.x}%`,
                  top: `${glowParticle.y}%`,
                  width: glowParticle.size,
                  height: glowParticle.size,
                  borderRadius: glowParticle.size / 2,
                  backgroundColor:
                    condition === "thunderstorm"
                      ? palette.thunderGlow
                      : palette.sunGlow,
                  opacity: ga.opacity,
                  transform: [
                    {
                      translateX: -glowParticle.size / 2,
                    },
                    {
                      translateY: -glowParticle.size / 2,
                    },
                    {
                      scale: ga.scale,
                    },
                  ],
                  filter: "blur(40px)" as any,
                }}
              />
            );
          })}
        </View>
      )}

      {/* Rain, drizzle, sleet, freezing rain, and thunderstorm effects */}
      {(condition === "rain" ||
        condition === "drizzle" ||
        condition === "sleet" ||
        condition === "freezing-rain" ||
        condition === "thunderstorm") && (
        <View style={StyleSheet.absoluteFill}>
          {/* Layered rain for parallax depth effect */}
          {[0, 1, 2].map((layer) => (
            <View
              key={`rain-layer-${layer}`}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: 0.3 + layer * 0.25,
                  zIndex: layer,
                },
              ]}
            >
              {animations.map((a, idx) => {
                const particle =
                  particles[idx] ??
                  ({
                    id: 0,
                    x: 0,
                    length: 35,
                    width: 2.5,
                    speed: 1,
                    opacity: 0.7,
                    windEffect: 0,
                    splashDelay: 0,
                    layer: 0,
                  } as RainParticle);

                // Only render particles in this layer
                if (particle.layer !== layer) return null;

                return (
                  <React.Fragment key={`rain-${idx}`}>
                    {/* Enhanced rain drop with glow */}
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
                              outputRange: [0, screenHeight + 50],
                            }),
                          },
                          {
                            translateX: a.translateX.interpolate({
                              inputRange: [0, 100],
                              outputRange: [0, 100],
                            }),
                          },
                          {
                            rotate: a.rotate.interpolate({
                              inputRange: [0, 360],
                              outputRange: ["0deg", "360deg"],
                            }),
                          },
                          {
                            scale: a.scale.interpolate({
                              inputRange: [0, 2.2],
                              outputRange: [1, 2.2],
                              extrapolate: "clamp",
                            }),
                          },
                        ],
                        opacity: a.opacity,
                        backgroundColor: getRainColor(condition),
                        borderRadius: particle.width / 2,
                        shadowColor: getRainColor(condition),
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 3,
                        elevation: 2,
                      }}
                    />

                    {/* Enhanced splash effect with glow */}
                    <Animated.View
                      style={{
                        position: "absolute",
                        left: `${particle.x}%`,
                        bottom: 0,
                        width: particle.width * 4,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: getRainColor(condition),
                        transform: [
                          {
                            scale: a.scale.interpolate({
                              inputRange: [0, 2.2],
                              outputRange: [0, 1],
                              extrapolate: "clamp",
                            }),
                          },
                        ],
                        opacity: a.opacity.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 0.7],
                          extrapolate: "clamp",
                        }),
                        shadowColor: getRainColor(condition),
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </View>
          ))}

          {/* Thunder flash for thunderstorm */}
          {condition === "thunderstorm" && (
            <ThunderFlash color={palette.thunderFlash} />
          )}
        </View>
      )}

      {/* Snow effects with enhanced visuals */}
      {condition === "snow" && (
        <View style={StyleSheet.absoluteFill}>
          {animations.map((a, idx) => {
            const left = (idx * 73) % 100;
            const size = 2.5 + (idx % 5) * 0.8; // More size variation
            const flake = (
              <Animated.View
                key={`flake-${idx}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: -30,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: palette.snowFlake,
                  transform: [
                    {
                      translateY: a.translateY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, screenHeight + 50],
                      }),
                    },
                    {
                      translateX: a.translateX.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 50],
                      }),
                    },
                    {
                      rotate: a.rotate.interpolate({
                        inputRange: [0, 720],
                        outputRange: ["0deg", "720deg"],
                      }),
                    },
                  ],
                  opacity: a.opacity,
                  shadowColor: palette.snowFlake,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              />
            );
            return flake;
          })}
        </View>
      )}

      {/* Cloud effects */}
      {condition === "clouds" && (
        <View style={StyleSheet.absoluteFill}>
          {animations
            .slice(0, Math.max(8, Math.floor(count / 6)))
            .map((a, idx) => {
              const top = 5 + (idx % 5) * 18;
              const width = 180 + (idx % 3) * 80;
              const height = 70 + (idx % 2) * 30;
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
                          outputRange: [0, screenWidth + width],
                        }),
                      },
                      {
                        scale: a.scale,
                      },
                    ],
                    shadowColor: palette.cloud,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 5,
                    elevation: 1,
                  }}
                />
              );
            })}
        </View>
      )}

      {/* Fog effect with enhanced density visualization */}
      {condition === "fog" && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.fog,
              opacity:
                intensity === "high"
                  ? 0.45
                  : intensity === "medium"
                    ? 0.3
                    : 0.18,
            },
          ]}
        >
          {/* Subtle fog layers for depth */}
          <BlurView
            intensity={isDaytime ? 70 : 60}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Clear sky sun rays */}
      {condition === "clear" && (
        <View style={StyleSheet.absoluteFill}>
          {animations
            .slice(0, Math.max(4, Math.floor(count / 12)))
            .map((a, idx) => {
              const top = 8 + (idx % 4) * 22;
              const width = 100 + (idx % 2) * 60;
              const height = 12;
              return (
                <Animated.View
                  key={`sun-ray-${idx}`}
                  style={{
                    position: "absolute",
                    right: -width,
                    top: `${top}%`,
                    width,
                    height,
                    borderRadius: height / 2,
                    backgroundColor: palette.sunRay,
                    opacity: a.opacity,
                    transform: [
                      {
                        translateX: a.translateX.interpolate({
                          inputRange: [-1, 0],
                          outputRange: [0, -(width + 250)],
                        }),
                      },
                    ],
                    shadowColor: palette.sunRay,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                  }}
                />
              );
            })}
        </View>
      )}
    </View>
  );
};

const ThunderFlash: React.FC<{ color: string }> = ({ color }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400 + Math.random() * 2600),
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.0,
          duration: 200,
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
    ? theme.colors.surfaceVariant + "18"
    : theme.colors.surfaceVariant + "2a";
  return {
    baseOverlay,
    rainDrop: isDaytime ? "#8AB4F8" : "#5E81AC",
    rainDropLight: isDaytime ? "#A0C8FF" : "#7A96C7", // Lighter version for drizzle
    rainDropHeavy: isDaytime ? "#6290E5" : "#456B9B", // Darker for heavy rain
    snowFlake: isDaytime ? "#FFFFFF" : "#E5E9F0",
    cloud: isDaytime ? "#ECEFF4" : "#4C566A",
    fog: isDaytime ? "#CBD5E1" : "#2F3542",
    thunderFlash: "#FFFFFF",
    sunRay: isDaytime ? "rgba(255, 193, 7, 0.18)" : "rgba(70, 130, 180, 0.12)",
    // New glow colors
    thunderGlow: "rgba(100, 150, 255, 0.3)",
    sunGlow: "rgba(255, 200, 50, 0.25)",
  };
}
