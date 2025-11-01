import {
  BlurMask,
  Canvas,
  Path,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSkiaLoaderConfig } from "@/hooks/useSkiaLoaderConfig";

export interface SkiaLoaderProps {
  size?: number;
  strokeWidth?: number;
  duration?: number;
  blur?: number;
  blurStyle?: "inner" | "outer" | "solid" | "normal";
  colors?: string[];
  // Positioning props
  centered?: boolean;
  containerStyle?: any;
}

export const SkiaLoader = (props: SkiaLoaderProps) => {
  const config = useSkiaLoaderConfig();

  // Merge props with config, props take precedence
  const {
    size = config.size,
    strokeWidth = config.strokeWidth,
    duration = config.duration,
    blur = config.blur,
    blurStyle = config.blurStyle,
    colors = config.colors,
    centered = false,
    containerStyle,
  } = props;
  const radius = (size - strokeWidth) / 2;
  const canvasSize = size + 30;

  const circle = useMemo(() => {
    const skPath = Skia.Path.Make();
    skPath.addCircle(canvasSize / 2, canvasSize / 2, radius);
    return skPath;
  }, [canvasSize, radius]);

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
      transform: [{ rotate: `${2 * Math.PI * progress.value}rad` }],
    };
  });

  const startPath = useDerivedValue(() => {
    return interpolate(progress.value, [0, 0.5, 1], [0.6, 0.3, 0.6]);
  }, []);

  const loaderElement = (
    <Animated.View style={rContainerStyle}>
      <Canvas
        style={{
          width: canvasSize,
          height: canvasSize,
        }}
      >
        <Path
          path={circle}
          style="stroke"
          strokeWidth={strokeWidth}
          start={startPath}
          end={1}
          strokeCap="round"
        >
          <SweepGradient
            c={vec(canvasSize / 2, canvasSize / 2)}
            colors={colors}
          />
          <BlurMask blur={blur} style={blurStyle} />
        </Path>
      </Canvas>
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
