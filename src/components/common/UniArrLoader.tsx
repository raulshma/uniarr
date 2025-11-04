import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "react-native-paper";
import { useLoaderConfig } from "@/hooks/useLoaderConfig";

export interface UniArrLoaderProps {
  size?: number;
  strokeWidth?: number;
  duration?: number;
  colors?: string[];
  // Positioning props
  centered?: boolean;
  containerStyle?: any;
}

export const UniArrLoader = (props: UniArrLoaderProps) => {
  const { loaderConfig } = useLoaderConfig();
  const theme = useTheme();
  const {
    size = loaderConfig.size,
    strokeWidth = loaderConfig.strokeWidth,
    duration = loaderConfig.duration,
    colors = loaderConfig.useThemeColors
      ? [theme.colors.primary, theme.colors.tertiary]
      : loaderConfig.colors,
    centered = false,
    containerStyle,
  } = props;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, duration]);

  const rContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${360 * progress.value}deg` }],
    };
  });

  const loaderElement = (
    <Animated.View style={rContainerStyle}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors[0]} />
            <Stop offset="100%" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={(size - strokeWidth) / 2}
          stroke="url(#grad)"
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );

  // If centered or containerStyle is provided, wrap in a container
  if (centered || containerStyle) {
    return (
      <View style={[centered && styles.centeredContainer, containerStyle]}>
        {loaderElement}
      </View>
    );
  }

  return loaderElement;
};

const styles = StyleSheet.create({
  centeredContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
