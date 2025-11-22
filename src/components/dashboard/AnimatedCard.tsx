import React, { useEffect, useRef, useMemo } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";
import { Surface } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  gradientColors?: string[];
  delay?: number;
  style?: any;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  onPress,
  gradientColors,
  delay = 0,
  style,
}) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: theme.custom.sizes.borderRadius.xl,
          overflow: "hidden",
          elevation: 0,
        },
        gradient: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
      }),
    [theme],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, delay]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const defaultGradientColors = theme.dark
    ? (["rgba(98, 126, 188, 0.08)", "rgba(76, 100, 148, 0.04)"] as const)
    : (["rgba(98, 126, 188, 0.04)", "rgba(76, 100, 148, 0.02)"] as const);

  const content = (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        style,
      ]}
    >
      <Surface style={styles.card} elevation={0}>
        {gradientColors && (
          <LinearGradient
            colors={(gradientColors as any) || defaultGradientColors}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        {children}
      </Surface>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};
