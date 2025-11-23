import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";

interface ShimmerEffectProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const ShimmerEffect: React.FC<ShimmerEffectProps> = ({
  width = "100%",
  height,
  borderRadius,
  style,
}) => {
  const theme = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const defaultHeight = height ?? theme.custom.spacing.lg;
  const defaultBorderRadius =
    borderRadius ?? theme.custom.sizes.borderRadius.sm;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ).start();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  const shimmerColors = theme.dark
    ? ([
        "rgba(255, 255, 255, 0.02)",
        "rgba(255, 255, 255, 0.08)",
        "rgba(255, 255, 255, 0.02)",
      ] as const)
    : ([
        "rgba(0, 0, 0, 0.02)",
        "rgba(0, 0, 0, 0.08)",
        "rgba(0, 0, 0, 0.02)",
      ] as const);

  return (
    <View
      style={[
        {
          width,
          height: defaultHeight,
          borderRadius: defaultBorderRadius,
          backgroundColor: theme.dark
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};
