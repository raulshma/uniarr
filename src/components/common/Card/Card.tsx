import React, { forwardRef, useMemo, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import {
  Card as PaperCard,
  type CardProps as PaperCardProps,
  useTheme,
} from "react-native-paper";

import type { AppTheme, FrostedEffectTokens } from "@/constants/theme";
import { borderRadius } from "@/constants/sizes";
import {
  ANIMATION_DURATIONS,
  Animated,
  COMPONENT_ANIMATIONS,
  FadeOut,
  PERFORMANCE_OPTIMIZATIONS,
} from "@/utils/animations.utils";
import { getComponentElevation } from "@/constants/elevation";

const DEFAULT_FROSTED_TOKENS: FrostedEffectTokens = {
  blurIntensity: 90,
  blurReductionFactor: 14,
  blurTint: "dark",
  surfaceOverlayColor: "rgba(104, 134, 198, 0.24)",
  surfaceBackgroundColor: "rgba(26, 34, 52, 0.36)",
  surfaceBorderColor: "rgba(255, 255, 255, 0.16)",
  surfaceBorderWidth: StyleSheet.hairlineWidth,
  pillBackgroundColor: "rgba(82, 108, 160, 0.28)",
  edgeHighlightColor: "rgba(255, 255, 255, 0.55)",
  edgeShadowColor: "rgba(12, 18, 30, 0.58)",
  glowColor: "rgba(88, 128, 214, 0.24)",
};

// Keep Pressable interactions consistent; entrance animations apply via wrapper.
const AnimatedPressable = Pressable;

const BASE_RADIUS = borderRadius.xl;
const CUSTOM_RADIUS = borderRadius.lg;

// Keep numeric values for PaperCard but map to logical levels
const elevationMap = {
  none: 0,
  low: 1,
  medium: 3,
  high: 5,
} as const;

type ElevationVariant = keyof typeof elevationMap;

type PaperCardRef = React.ComponentRef<typeof PaperCard>;

export type CardProps = Omit<
  PaperCardProps,
  "elevation" | "mode" | "contentStyle"
> & {
  elevation?: ElevationVariant;
  contentPadding?: keyof AppTheme["custom"]["spacing"] | number;
  contentStyle?: StyleProp<ViewStyle>;
  variant?: "default" | "outlined" | "custom" | "frosted";
  focusable?: boolean;
  animated?: boolean;
  animationDelay?: number;
  enteringAnimation?: any;
  exitingAnimation?: any;
  delayLongPress?: number;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
};

const Card = forwardRef<PaperCardRef, CardProps>(
  (
    {
      children,
      style,
      contentStyle,
      elevation = "medium",
      contentPadding = "md",
      variant = "default",
      onPress,
      onLongPress,
      onPressIn,
      onPressOut,
      delayLongPress,
      disabled,
      accessibilityLabel,
      accessibilityHint,
      focusable: focusableProp,
      accessibilityRole: accessibilityRoleProp,
      accessibilityState: accessibilityStateProp,
      animated = true,
      animationDelay = 0,
      enteringAnimation,
      exitingAnimation,
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme<AppTheme>();
    const frostedTokens =
      theme.custom.effects?.frosted ?? DEFAULT_FROSTED_TOKENS;
    const [isFocused, setIsFocused] = useState(false);

    const paddingValue = useMemo(() => {
      if (typeof contentPadding === "number") {
        return contentPadding;
      }

      return theme.custom.spacing[contentPadding];
    }, [contentPadding, theme.custom.spacing]);

    const innerStyle = useMemo<StyleProp<ViewStyle>>(
      () => [styles.inner, { padding: paddingValue }, contentStyle],
      [contentStyle, paddingValue],
    );

    const focusable = focusableProp ?? Boolean(onPress);
    const isDisabled = Boolean(disabled);
    const resolvedAccessibilityRole = onPress
      ? "button"
      : accessibilityRoleProp;

    const baseFocusRingStyle = useMemo<any>(
      () => ({
        borderColor: theme.colors.primary,
        borderWidth: 2,
        borderRadius: BASE_RADIUS,
      }),
      [theme.colors.primary],
    );

    const customFocusRingStyle = useMemo<any>(
      () => ({
        borderColor: theme.colors.primary,
        borderWidth: 2,
        borderRadius: CUSTOM_RADIUS,
      }),
      [theme.colors.primary],
    );

    const handleFocus = () => {
      if (focusable) {
        setIsFocused(true);
      }
    };

    const handleBlur = () => {
      if (focusable) {
        setIsFocused(false);
      }
    };

    const combinedAccessibilityState = {
      ...(accessibilityStateProp ?? {}),
      ...(focusable ? { disabled: isDisabled } : {}),
    };

    const accessibilityState =
      Object.keys(combinedAccessibilityState).length > 0
        ? combinedAccessibilityState
        : undefined;
    const resolvedEntering = enteringAnimation
      ? enteringAnimation
      : COMPONENT_ANIMATIONS.CARD_ENTRANCE(animationDelay);
    const resolvedExiting = exitingAnimation
      ? exitingAnimation
      : FadeOut.duration(ANIMATION_DURATIONS.QUICK);

    const frostedElevationStyle = useMemo(
      () => getComponentElevation("widgetCard", theme),
      [theme],
    );

    const blurViewProps = useMemo(
      () => ({
        intensity: frostedTokens.blurIntensity,
        tint: frostedTokens.blurTint,
        blurReductionFactor: frostedTokens.blurReductionFactor,
        reducedTransparencyFallbackColor: frostedTokens.surfaceBackgroundColor,
      }),
      [frostedTokens],
    );

    const content =
      variant === "custom" ? (
        <AnimatedPressable
          style={[
            styles.customBase,
            {
              backgroundColor: theme.colors.surface,
            },
            style,
            focusable && isFocused ? customFocusRingStyle : undefined,
          ]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          delayLongPress={delayLongPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole={resolvedAccessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={accessibilityState}
          focusable={focusable}
          disabled={isDisabled}
          pointerEvents="box-none"
          {...rest}
        >
          {React.Children.count(children) > 0 ? (
            <View style={innerStyle}>{children}</View>
          ) : null}
        </AnimatedPressable>
      ) : variant === "frosted" ? (
        <AnimatedPressable
          style={[
            styles.frostedBase,
            frostedElevationStyle,
            {
              backgroundColor: frostedTokens.surfaceBackgroundColor,
            },
            style,
            focusable && isFocused ? customFocusRingStyle : undefined,
          ]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          delayLongPress={delayLongPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole={resolvedAccessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={accessibilityState}
          focusable={focusable}
          disabled={isDisabled}
          pointerEvents="box-none"
          {...rest}
        >
          <BlurView
            {...blurViewProps}
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: frostedTokens.surfaceOverlayColor },
            ]}
          />
          {React.Children.count(children) > 0 ? (
            <View style={innerStyle}>{children}</View>
          ) : null}
        </AnimatedPressable>
      ) : (
        <PaperCard
          ref={ref}
          mode="elevated"
          elevation={elevationMap[elevation]}
          style={[
            styles.base,
            style,
            focusable && isFocused ? baseFocusRingStyle : undefined,
          ]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          delayLongPress={delayLongPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole={resolvedAccessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={accessibilityState}
          focusable={focusable}
          disabled={isDisabled}
          pointerEvents="box-none"
          {...rest}
        >
          {React.Children.count(children) > 0 ? (
            <View style={innerStyle}>{children}</View>
          ) : null}
        </PaperCard>
      );

    if (!animated) {
      return content;
    }

    return (
      <Animated.View
        entering={resolvedEntering}
        exiting={resolvedExiting}
        {...PERFORMANCE_OPTIMIZATIONS}
      >
        {content}
      </Animated.View>
    );
  },
);

Card.displayName = "Card";

export default Card;

const styles = StyleSheet.create({
  base: {
    borderRadius: BASE_RADIUS,
    overflow: "hidden",
  },
  customBase: {
    borderRadius: CUSTOM_RADIUS,
    overflow: "hidden",
  },
  frostedBase: {
    borderRadius: CUSTOM_RADIUS,
    overflow: "hidden",
    position: "relative",
  },
  frostedEdge: {
    borderRadius: CUSTOM_RADIUS,
  },
  inner: {
    width: "100%",
  },
});
