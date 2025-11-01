import React, { useMemo } from "react";
import { useTheme } from "react-native-paper";
import Svg, {
  Circle,
  Path,
  Rect,
  LinearGradient,
  Stop,
  Defs,
} from "react-native-svg";
import type { AppTheme } from "@/constants/theme";

export type WeatherIllustrationKey =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "night";

interface WeatherIllustrationProps {
  condition?: string;
  size?: number;
}

const mapConditionToIllustration = (
  condition?: string,
): WeatherIllustrationKey => {
  if (!condition) {
    return "partly-cloudy";
  }

  const text = condition.toLowerCase();

  if (text.includes("thunder")) {
    return "storm";
  }
  if (text.includes("snow") || text.includes("sleet")) {
    return "snow";
  }
  if (text.includes("rain") || text.includes("shower")) {
    return "rain";
  }
  if (text.includes("clear") || text.includes("sunny")) {
    return "clear";
  }
  if (text.includes("night")) {
    return "night";
  }
  if (text.includes("overcast")) {
    return "cloudy";
  }
  if (text.includes("cloud")) {
    return "partly-cloudy";
  }

  return "partly-cloudy";
};

const SunIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => {
  const radius = size * 0.32;
  const center = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <LinearGradient id="sunGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop
            offset="0%"
            stopColor={theme.colors.primary}
            stopOpacity={0.9}
          />
          <Stop
            offset="100%"
            stopColor={theme.colors.tertiary}
            stopOpacity={0.8}
          />
        </LinearGradient>
      </Defs>
      <Circle cx={center} cy={center} r={radius} fill="url(#sunGradient)" />
      {new Array(8).fill(null).map((_, index) => {
        const angle = (index * Math.PI) / 4;
        const x1 = center + Math.cos(angle) * (radius + size * 0.08);
        const y1 = center + Math.sin(angle) * (radius + size * 0.08);
        const x2 = center + Math.cos(angle) * (radius + size * 0.18);
        const y2 = center + Math.sin(angle) * (radius + size * 0.18);
        return (
          <Path
            key={`ray-${index}`}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            stroke={theme.colors.primary}
            strokeWidth={size * 0.03}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
};

const Cloud = ({
  size,
  opacity = 1,
  offsetX = 0,
  offsetY = 0,
  theme,
}: {
  size: number;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  theme: AppTheme;
}) => (
  <Path
    d={`M ${offsetX + size * 0.2} ${offsetY + size * 0.6}
       Q ${offsetX + size * 0.35} ${offsetY + size * 0.4}, ${offsetX + size * 0.5} ${offsetY + size * 0.55}
       Q ${offsetX + size * 0.65} ${offsetY + size * 0.35}, ${offsetX + size * 0.82} ${offsetY + size * 0.52}
       Q ${offsetX + size * 0.95} ${offsetY + size * 0.52}, ${offsetX + size * 0.98} ${offsetY + size * 0.68}
       Q ${offsetX + size * 0.98} ${offsetY + size * 0.9}, ${offsetX + size * 0.82} ${offsetY + size * 0.9}
       L ${offsetX + size * 0.22} ${offsetY + size * 0.9}
       Q ${offsetX + size * 0.05} ${offsetY + size * 0.9}, ${offsetX + size * 0.05} ${offsetY + size * 0.7}
       Q ${offsetX + size * 0.05} ${offsetY + size * 0.5}, ${offsetX + size * 0.2} ${offsetY + size * 0.6}
      `}
    fill={theme.colors.surface}
    opacity={opacity}
  />
);

const PartlyCloudyIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => (
  <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <SunIllustration size={size * 0.7} theme={theme} />
    <Cloud size={size} offsetY={size * 0.15} opacity={0.9} theme={theme} />
    <Cloud
      size={size * 0.8}
      offsetX={size * 0.1}
      offsetY={size * 0.25}
      opacity={0.8}
      theme={theme}
    />
  </Svg>
);

const CloudyIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => (
  <Svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`}>
    <Cloud size={size} opacity={0.8} theme={theme} />
    <Cloud
      size={size * 0.85}
      offsetX={size * 0.08}
      offsetY={size * 0.07}
      opacity={0.95}
      theme={theme}
    />
  </Svg>
);

const RainIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => (
  <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Cloud
      size={size * 0.95}
      offsetX={size * 0.02}
      offsetY={size * 0.1}
      opacity={0.95}
      theme={theme}
    />
    {new Array(6).fill(null).map((_, index) => {
      const startX = size * (0.2 + index * 0.12);
      const startY = size * 0.65;
      const endY = startY + size * 0.18;
      return (
        <Path
          key={`rain-${index}`}
          d={`M ${startX} ${startY} L ${startX - size * 0.04} ${endY}`}
          stroke={theme.colors.primary}
          strokeWidth={size * 0.025}
          strokeLinecap="round"
          opacity={0.85}
        />
      );
    })}
  </Svg>
);

const StormIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => (
  <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Cloud
      size={size * 0.95}
      offsetX={size * 0.02}
      offsetY={size * 0.1}
      opacity={0.95}
      theme={theme}
    />
    <Path
      d={`M ${size * 0.45} ${size * 0.7} L ${size * 0.6} ${size * 0.7} L ${size * 0.5} ${size * 0.95} L ${size * 0.56} ${size * 0.95} L ${size * 0.42} ${size * 1.2} L ${size * 0.44} ${size * 0.9} L ${size * 0.36} ${size * 0.9} Z`}
      fill={theme.colors.error}
      opacity={0.9}
    />
  </Svg>
);

const SnowIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => (
  <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Cloud
      size={size * 0.95}
      offsetX={size * 0.02}
      offsetY={size * 0.1}
      opacity={0.95}
      theme={theme}
    />
    {new Array(5).fill(null).map((_, index) => {
      const cx = size * (0.25 + index * 0.12);
      const cy = size * (0.75 + (index % 2 === 0 ? 0.06 : -0.02));
      return (
        <Path
          key={`snow-${index}`}
          d={`M ${cx} ${cy - size * 0.04} L ${cx} ${cy + size * 0.04} M ${cx - size * 0.03} ${cy} L ${cx + size * 0.03} ${cy} M ${cx - size * 0.025} ${cy - size * 0.025} L ${cx + size * 0.025} ${cy + size * 0.025} M ${cx - size * 0.025} ${cy + size * 0.025} L ${cx + size * 0.025} ${cy - size * 0.025}`}
          stroke={theme.colors.primary}
          strokeWidth={size * 0.015}
          strokeLinecap="round"
        />
      );
    })}
  </Svg>
);

const NightIllustration = ({
  size,
  theme,
}: {
  size: number;
  theme: AppTheme;
}) => (
  <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Defs>
      <LinearGradient id="moonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop
          offset="0%"
          stopColor={theme.colors.secondary}
          stopOpacity={0.9}
        />
        <Stop
          offset="100%"
          stopColor={theme.colors.secondaryContainer}
          stopOpacity={0.8}
        />
      </LinearGradient>
    </Defs>
    <Circle
      cx={size * 0.35}
      cy={size * 0.35}
      r={size * 0.22}
      fill="url(#moonGradient)"
    />
    <Circle
      cx={size * 0.42}
      cy={size * 0.35}
      r={size * 0.14}
      fill={theme.colors.surface}
      opacity={0.8}
    />
    <Cloud
      size={size * 0.9}
      offsetX={size * 0.05}
      offsetY={size * 0.2}
      opacity={0.9}
      theme={theme}
    />
    {new Array(4).fill(null).map((_, index) => {
      const cx = size * (0.15 + index * 0.2);
      const cy = size * 0.15;
      return (
        <Rect
          key={`star-${index}`}
          x={cx}
          y={cy}
          width={size * 0.04}
          height={size * 0.04}
          fill={theme.colors.primary}
          transform={`rotate(45 ${cx + size * 0.02} ${cy + size * 0.02})`}
          opacity={0.75}
        />
      );
    })}
  </Svg>
);

const illustrationRenderers: Record<
  WeatherIllustrationKey,
  React.FC<{ size: number; theme: AppTheme }>
> = {
  clear: SunIllustration,
  "partly-cloudy": PartlyCloudyIllustration,
  cloudy: CloudyIllustration,
  rain: RainIllustration,
  storm: StormIllustration,
  snow: SnowIllustration,
  night: NightIllustration,
};

export const WeatherIllustration: React.FC<WeatherIllustrationProps> = ({
  condition,
  size = 160,
}) => {
  const theme = useTheme<AppTheme>();
  const key = useMemo(() => mapConditionToIllustration(condition), [condition]);

  const Illustration = illustrationRenderers[key] ?? PartlyCloudyIllustration;

  return <Illustration size={size} theme={theme} />;
};

export const getIllustrationKey = mapConditionToIllustration;
