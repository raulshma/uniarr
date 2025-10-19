import React, { forwardRef, useMemo } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import {
  Button as PaperButton,
  type ButtonProps as PaperButtonProps,
  useTheme,
} from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { buttonSizes, borderRadius } from "@/constants/sizes";

type PaperButtonRef = React.ComponentRef<typeof PaperButton>;

export type ButtonProps = PaperButtonProps & {
  fullWidth?: boolean;
  align?: "left" | "center" | "right";
};

const Button = forwardRef<PaperButtonRef, ButtonProps>(
  (
    {
      children,
      style,
      contentStyle,
      labelStyle,
      fullWidth = false,
      align = "center",
      loading = false,
      disabled = false,
      mode = "contained",
      ...rest
    },
    ref,
  ) => {
    const theme = useTheme<AppTheme>();

    const combinedContentStyle = useMemo<StyleProp<ViewStyle>>(
      () => [
        {
          height: buttonSizes.height.md,
          borderRadius: borderRadius.round,
          justifyContent: "center",
        },
        { paddingHorizontal: theme.custom.spacing.lg },
        contentStyle,
      ],
      [contentStyle, theme.custom.spacing.lg],
    );

    const labelTypography = theme.custom.typography.labelLarge;

    const combinedLabelStyle = useMemo<StyleProp<TextStyle>>(
      () => [
        styles.baseLabel,
        {
          fontFamily: labelTypography.fontFamily,
          fontSize: labelTypography.fontSize,
          fontWeight: labelTypography.fontWeight as TextStyle["fontWeight"],
          letterSpacing: labelTypography.letterSpacing,
          lineHeight: labelTypography.lineHeight,
        },
        labelStyle,
      ],
      [labelStyle, labelTypography],
    );

    const isDisabled = disabled || loading;

    const getAlignmentStyle = () => {
      switch (align) {
        case "left":
          return styles.alignLeft;
        case "center":
          return styles.alignCenter;
        case "right":
          return styles.alignRight;
        default:
          return styles.alignCenter;
      }
    };

    return (
      <PaperButton
        ref={ref}
        mode={mode}
        loading={loading}
        disabled={isDisabled}
        style={[
          styles.base,
          fullWidth ? styles.fullWidth : getAlignmentStyle(),
          style,
        ]}
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

Button.displayName = "Button";

export default Button;

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.round,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  alignLeft: {
    alignSelf: "flex-start",
  },
  alignCenter: {
    alignSelf: "center",
  },
  alignRight: {
    alignSelf: "flex-end",
  },
  baseLabel: {
    textTransform: "none",
  },
});
