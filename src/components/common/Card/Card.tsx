import React, { forwardRef, useMemo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View, Pressable } from 'react-native';
import { Card as PaperCard, type CardProps as PaperCardProps, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';

// Use native Pressable rather than an animated wrapper — keep behavior
// but remove entrance/interaction animations for snappier UI.
const AnimatedPressable = Pressable;

const BASE_RADIUS = 16;
const CUSTOM_RADIUS = 12;

const elevationMap = {
  none: 0,
  low: 1,
  medium: 3,
  high: 5,
} as const;

type ElevationVariant = keyof typeof elevationMap;

type PaperCardRef = React.ComponentRef<typeof PaperCard>;

export type CardProps = Omit<PaperCardProps, 'elevation' | 'mode' | 'contentStyle'> & {
  elevation?: ElevationVariant;
  contentPadding?: keyof AppTheme['custom']['spacing'] | number;
  contentStyle?: StyleProp<ViewStyle>;
  variant?: 'default' | 'outlined' | 'custom';
  focusable?: boolean;
};

const Card = forwardRef<PaperCardRef, CardProps>(
  (
    {
      children,
      style,
      contentStyle,
      elevation = 'medium',
      contentPadding = 'md',
  variant = 'default',
  onPress,
  disabled,
      accessibilityLabel,
      accessibilityHint,
      focusable: focusableProp,
      accessibilityRole: accessibilityRoleProp,
      accessibilityState: accessibilityStateProp,
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme<AppTheme>();
    const [isFocused, setIsFocused] = useState(false);

    const paddingValue = useMemo(() => {
      if (typeof contentPadding === 'number') {
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
  const resolvedAccessibilityRole = onPress ? 'button' : accessibilityRoleProp;

    const baseFocusRingStyle = useMemo<ViewStyle>(
      () => ({
        borderColor: theme.colors.primary,
        borderWidth: 2,
        borderRadius: BASE_RADIUS,
      }),
      [theme.colors.primary],
    );

    const customFocusRingStyle = useMemo<ViewStyle>(
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

    const accessibilityState = Object.keys(combinedAccessibilityState).length > 0
      ? combinedAccessibilityState
      : undefined;
    if (variant === 'custom') {
      return (
        <AnimatedPressable
          style={[
            styles.customBase,
            style,
            focusable && isFocused ? customFocusRingStyle : undefined,
          ]}
          onPress={onPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole={resolvedAccessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={accessibilityState}
          focusable={focusable}
          disabled={isDisabled}
          {...rest}
        >
          {React.Children.count(children) > 0 ? <View style={innerStyle}>{children}</View> : null}
        </AnimatedPressable>
      );
    }

    const cardElevation = elevationMap[elevation];

    return (
      <PaperCard
        ref={ref}
        mode="elevated"
        elevation={cardElevation}
        style={[styles.base, style, focusable && isFocused ? baseFocusRingStyle : undefined]}
        onPress={onPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
  accessibilityRole={resolvedAccessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
        focusable={focusable}
  disabled={isDisabled}
        {...rest}
      >
        {React.Children.count(children) > 0 ? <View style={innerStyle}>{children}</View> : null}
      </PaperCard>
    );
  },
);

Card.displayName = 'Card';

export default Card;

const styles = StyleSheet.create({
  base: {
    borderRadius: BASE_RADIUS,
    overflow: 'hidden',
  },
  customBase: {
    borderRadius: CUSTOM_RADIUS,
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
  },
});
