import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';

export type SkeletonPlaceholderProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const toSixDigitHex = (input: string): string | undefined => {
  if (!input.startsWith('#')) {
    return undefined;
  }

  if (input.length === 7) {
    return input.slice(1);
  }

  if (input.length === 4) {
    const r = input[1];
    const g = input[2];
    const b = input[3];
    return `${r}${r}${g}${g}${b}${b}`;
  }

  return undefined;
};

const lightenHexColor = (color: string, ratio: number): string => {
  const hex = toSixDigitHex(color);
  if (!hex) {
    return color;
  }

  const normalized = clamp(ratio, 0, 1);
  const num = Number.parseInt(hex, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const mix = (channel: number) => Math.round(channel + (255 - channel) * normalized);

  const nextR = clamp(mix(r), 0, 255);
  const nextG = clamp(mix(g), 0, 255);
  const nextB = clamp(mix(b), 0, 255);

  const composed = (nextR << 16) | (nextG << 8) | nextB;
  return `#${composed.toString(16).padStart(6, '0')}`;
};

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();
  const baseColor = theme.colors.surfaceVariant;
  const animatedStyle = useMemo(() => ({ backgroundColor: baseColor }), [baseColor]);

  const dimensionStyle = useMemo(
    () => ({ width, height, borderRadius }),
    [borderRadius, height, width],
  );

  return (
    <View
      pointerEvents="none"
      style={[styles.base, dimensionStyle, animatedStyle, style]}
      accessibilityRole="progressbar"
      testID={testID}
    />
  );
};

export default SkeletonPlaceholder;

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#ccc',
  },
});
