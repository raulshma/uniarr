import React, { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View, ViewStyle, LayoutChangeEvent } from "react-native";
import {
  Canvas,
  RuntimeShader,
  Skia,
  RoundedRect,
} from "@shopify/react-native-skia";
import type { SkRuntimeEffect } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
} from "react-native-reanimated";

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

half4 main(float2 position) {
  float dist = distance(position, u_origin);
  float delay = dist / u_speed;
  float time = u_time - delay;
  time = max(0.0, time);
  float rippleAmount = u_amplitude * sin(u_frequency * time) * exp(-u_decay * time);
  float alpha = clamp(rippleAmount / u_amplitude, 0.0, 1.0);
  return half4(1.0, 1.0, 1.0, alpha * 0.3);
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

    // Use Reanimated shared values for touch state
    const touchX = useSharedValue(-9999);
    const touchY = useSharedValue(-9999);
    // Use a timestamp (ms) for touch start so we do not mix Skia clock
    const touchStart = useSharedValue(-999999999);

    useImperativeHandle(ref, () => ({
      trigger: (x: number, y: number) => {
        console.log("ServiceCardRipple trigger called with:", x, y);
        touchX.value = x;
        touchY.value = y;
        touchStart.value = Date.now();
      },
    }));

    // Local React state to hold plain JS uniforms for RuntimeShader
    const [shaderProps, setShaderProps] = useState<{
      enabled: boolean;
      uniforms: Record<string, any>;
    }>({
      enabled: false,
      uniforms: {
        u_origin: [-9999, -9999],
        u_time: 0,
        u_amplitude: 12,
        u_frequency: 15,
        u_decay: 10,
        u_speed: 600,
      },
    });

    // Use an animated reaction to derive enabled/uniforms and push to React state
    useAnimatedReaction(
      () => {
        const elapsed = (Date.now() - touchStart.value) / 1000;
        const enabled =
          runtimeEffect != null &&
          !reduceMotion &&
          elapsed > 0 &&
          elapsed < duration;
        const u_origin = [touchX.value, touchY.value];
        const u_time = elapsed;
        const u_speed = Math.max(600, Math.max(layout.w, layout.h));
        return {
          enabled,
          uniforms: {
            u_origin,
            u_time,
            u_amplitude: 12,
            u_frequency: 15,
            u_decay: 10,
            u_speed,
          },
        };
      },
      (res, prev) => {
        // Only call setState when something changed
        if (
          !prev ||
          res.enabled !== prev.enabled ||
          res.uniforms.u_time !== prev.uniforms.u_time ||
          res.uniforms.u_origin[0] !== prev.uniforms.u_origin[0] ||
          res.uniforms.u_origin[1] !== prev.uniforms.u_origin[1]
        ) {
          runOnJS(setShaderProps)(res as any);
        }
      },
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
              {shaderProps.enabled && runtimeEffect ? (
                <RuntimeShader
                  source={runtimeEffect}
                  uniforms={shaderProps.uniforms}
                >
                  <RoundedRect
                    x={0}
                    y={0}
                    r={borderRadius}
                    width={layout.w}
                    height={layout.h}
                    color={color}
                  />
                </RuntimeShader>
              ) : null}
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
