import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleProp, ViewStyle, useWindowDimensions } from "react-native";
import type { AppTheme } from "@/constants/theme";

type Props = {
  enabled?: boolean;
  height: number;
  colors: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  start: { x: number; y: number };
  end: { x: number; y: number };
  theme: AppTheme;
};

const BlurEdge: React.FC<Props> = ({
  enabled,
  height,
  style,
  colors,
  start,
  end,
  theme,
}: Props) => {
  const { width } = useWindowDimensions();

  if (!enabled) {
    return null;
  }

  return (
    <LinearGradient
      style={[style, { height, width }]}
      colors={colors}
      start={start}
      end={end}
    />
  );
};

export default BlurEdge;
