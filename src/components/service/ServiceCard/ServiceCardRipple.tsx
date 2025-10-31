import React, { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View, ViewStyle, LayoutChangeEvent } from "react-native";
import {
  Canvas,
  RuntimeShader,
  Skia,
  useClock,
  RoundedRect,
} from "@shopify/react-native-skia";
import type { SkRuntimeEffect } from "@shopify/react-native-skia";
import { useSharedValue, useDerivedValue } from "react-native-reanimated";

export type ServiceCardRippleProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  duration?: number; // seconds
  borderRadius?: number;
  color?: string;
  reduceMotion?: boolean;
};

export type RippleHandle = {
  trigger: (x: number, y: number) => void;
};

const DEFAULT_DURATION = 0.6; // seconds

// The SkSL runtime shader provided by the user (kept minimal formatting)
const shaderSource = `
uniform float2 u_origin;
uniform float u_time;
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_decay;
uniform float u_speed;
uniform shader image;

half4 main(float2 position) {
  float dist = distance(position, u_origin);
  float delay = dist / u_speed;
  float time = u_time - delay;
  time -= delay;
  time = max(0.0, time);
  float rippleAmount = u_amplitude * sin(u_frequency * time) * exp(-u_decay * time);
  float2 n = normalize(position - u_origin);
  float2 newPosition = position + rippleAmount * n;
  half4 color = image.eval(newPosition).rgba;
  color.rgb += 0.3 * (rippleAmount / u_amplitude) * color.a;
  return color;
}
`;

let runtimeEffect: SkRuntimeEffect | null = null;
try {
  runtimeEffect = Skia.RuntimeEffect.Make(
    shaderSource,
  ) as SkRuntimeEffect | null;
} catch (e) {
  console.error(e);
  runtimeEffect = null;
}

/**
 * ServiceCardRipple — a thin wrapper that renders a Skia RuntimeShader
 * overlay on top of its children. Call `ref.current.trigger(x,y)` with
 * coords relative to the card to start the ripple animation.
 */
const ServiceCardRipple = forwardRef<RippleHandle, ServiceCardRippleProps>(
  (
    {
      children,
      style,
      duration = DEFAULT_DURATION,
      borderRadius = 16,
      color = "rgba(0,0,0,0.0)",
      reduceMotion = false,
    },
    ref,
  ) => {
    const [layout, setLayout] = useState({ w: 0, h: 0 });

    const clock = useClock();

    const touchX = useSharedValue(-9999);
    const touchY = useSharedValue(-9999);
    const touchStart = useSharedValue(-9999);

    useImperativeHandle(ref, () => ({
      trigger: (x: number, y: number) => {
        touchX.value = x;
        touchY.value = y;
        touchStart.value = clock.value;
      },
    }));

    const touchPoint = useDerivedValue(
      () => ({ x: touchX.value, y: touchY.value }),
      [touchX, touchY],
    );

    const elapsedTime = useDerivedValue(
      () => (clock.value - touchStart.value) / 1000,
      [clock, touchStart],
    );

    const shaderEnabled = useDerivedValue(() => {
      return (
        runtimeEffect && 0 < elapsedTime.value && elapsedTime.value < duration
      );
    }, [elapsedTime]);

    const rippleUniforms = useDerivedValue(
      () => ({
        u_origin: touchPoint.value,
        u_time: elapsedTime.value,
        u_amplitude: 12,
        u_frequency: 15,
        u_decay: 10,
        u_speed: Math.max(600, Math.max(layout.w, layout.h)),
      }),
      [touchPoint, elapsedTime, layout],
    );

    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setLayout({ w: Math.round(width), h: Math.round(height) });
    };

    return (
      <View
        style={[styles.container, style]}
        onLayout={onLayout}
        pointerEvents="box-none"
      >
        {children}
        {layout.w > 0 && layout.h > 0 ? (
          <View style={styles.overlay} pointerEvents="none">
            <Canvas style={{ width: layout.w, height: layout.h }}>
              {shaderEnabled && runtimeEffect ? (
                <RuntimeShader
                  source={runtimeEffect}
                  uniforms={rippleUniforms}
                />
              ) : null}
              <RoundedRect
                x={0}
                y={0}
                r={borderRadius}
                width={layout.w}
                height={layout.h}
                color={color}
              />
            </Canvas>
          </View>
        ) : null}
      </View>
    );
  },
);

ServiceCardRipple.displayName = "ServiceCardRipple";

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  overlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
});

export default ServiceCardRipple;
