import React from "react";
import {
  Canvas,
  LinearGradient,
  Rect,
  SkPoint,
} from "@shopify/react-native-skia";
import { StyleProp, ViewStyle, useWindowDimensions } from "react-native";
import type { AppTheme } from "@/constants/theme";

type Props = {
  enabled?: boolean;
  height: number;
  colors: string[];
  style?: StyleProp<ViewStyle>;
  start: SkPoint;
  end: SkPoint;
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
    <Canvas style={[style, { height }]}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={start} end={end} colors={colors} />
      </Rect>
    </Canvas>
  );
};

export default BlurEdge;
