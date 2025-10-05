import React, { forwardRef, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Card as PaperCard, type CardProps as PaperCardProps, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';

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
};

const Card = forwardRef<PaperCardRef, CardProps>(
  (
    {
      children,
      style,
      contentStyle,
      elevation = 'medium',
      contentPadding = 'md',
      onPress,
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme<AppTheme>();

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

    const cardElevation = elevationMap[elevation];

    return (
      <PaperCard
        ref={ref}
        mode="elevated"
        elevation={cardElevation}
        style={[styles.base, style]}
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
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
    borderRadius: 16,
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
  },
});
