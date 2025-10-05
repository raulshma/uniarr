import React, { forwardRef, useMemo } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import {
  Button as PaperButton,
  type ButtonProps as PaperButtonProps,
  useTheme,
} from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';

type PaperButtonRef = React.ComponentRef<typeof PaperButton>;

export type ButtonProps = PaperButtonProps & {
  fullWidth?: boolean;
};

const Button = forwardRef<PaperButtonRef, ButtonProps>(
  (
    {
      children,
      style,
      contentStyle,
      labelStyle,
      fullWidth = false,
      loading = false,
      disabled = false,
      mode = 'contained',
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme<AppTheme>();

    const combinedContentStyle = useMemo<StyleProp<ViewStyle>>(
      () => [styles.baseContent, { paddingHorizontal: theme.custom.spacing.lg }, contentStyle],
      [contentStyle, theme.custom.spacing.lg],
    );

    const labelTypography = theme.custom.typography.labelLarge;

    const combinedLabelStyle = useMemo<StyleProp<TextStyle>>(
      () => [
        styles.baseLabel,
        {
          fontFamily: labelTypography.fontFamily,
          fontSize: labelTypography.fontSize,
          fontWeight: labelTypography.fontWeight as TextStyle['fontWeight'],
          letterSpacing: labelTypography.letterSpacing,
          lineHeight: labelTypography.lineHeight,
        },
        labelStyle,
      ],
      [labelStyle, labelTypography],
    );

    const isDisabled = disabled || loading;

    return (
      <PaperButton
        ref={ref}
        mode={mode}
        loading={loading}
        disabled={isDisabled}
        style={[styles.base, fullWidth ? styles.fullWidth : undefined, style]}
        contentStyle={combinedContentStyle}
        labelStyle={combinedLabelStyle}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        {...rest}
      >
        {children}
      </PaperButton>
    );
  },
);

Button.displayName = 'Button';

export default Button;

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  baseContent: {
    height: 48,
    borderRadius: 999,
    justifyContent: 'center',
  },
  baseLabel: {
    textTransform: 'none',
  },
});
