export type DensityMode = "compact" | "comfortable" | "spacious";

export const spacing = {
  none: 0,
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
  xxxxl: 80,
} as const;

export type SpacingScale = typeof spacing;

/**
 * Generate spacing scale with density mode adjustments
 */
export const generateSpacingScale = (
  density: DensityMode = "comfortable",
): SpacingScale => {
  const densityFactors = {
    compact: 0.75,
    comfortable: 1.0,
    spacious: 1.25,
  };

  const factor = densityFactors[density];

  return {
    none: 0,
    xxxs: Math.round(2 * factor),
    xxs: Math.round(4 * factor),
    xs: Math.round(8 * factor),
    sm: Math.round(12 * factor),
    md: Math.round(16 * factor),
    lg: Math.round(24 * factor),
    xl: Math.round(32 * factor),
    xxl: Math.round(40 * factor),
    xxxl: Math.round(56 * factor),
    xxxxl: Math.round(80 * factor),
  } as SpacingScale;
};
