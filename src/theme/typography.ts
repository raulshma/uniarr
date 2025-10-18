export type TypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  letterSpacing: number;
  lineHeight: number;
};

export type FontScale = "small" | "medium" | "large" | "extra-large";

export type TypographyScale = {
  displayLarge: TypographyStyle;
  displayMedium: TypographyStyle;
  displaySmall: TypographyStyle;
  headlineLarge: TypographyStyle;
  headlineMedium: TypographyStyle;
  headlineSmall: TypographyStyle;
  titleLarge: TypographyStyle;
  titleMedium: TypographyStyle;
  titleSmall: TypographyStyle;
  labelLarge: TypographyStyle;
  labelMedium: TypographyStyle;
  labelSmall: TypographyStyle;
  bodyLarge: TypographyStyle;
  bodyMedium: TypographyStyle;
  bodySmall: TypographyStyle;
};

/**
 * Generate typography scale with font scaling
 */
export const generateTypographyScale = (
  fontScale: FontScale = "medium",
): TypographyScale => {
  const scaleFactors = {
    small: 0.85,
    medium: 1.0,
    large: 1.15,
    "extra-large": 1.3,
  };

  const scale = scaleFactors[fontScale];

  return {
    displayLarge: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(64 * scale),
      fontWeight: "400",
      fontSize: Math.round(57 * scale),
    },
    displayMedium: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(52 * scale),
      fontWeight: "400",
      fontSize: Math.round(45 * scale),
    },
    displaySmall: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(44 * scale),
      fontWeight: "400",
      fontSize: Math.round(36 * scale),
    },
    headlineLarge: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(40 * scale),
      fontWeight: "400",
      fontSize: Math.round(32 * scale),
    },
    headlineMedium: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(36 * scale),
      fontWeight: "400",
      fontSize: Math.round(28 * scale),
    },
    headlineSmall: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(32 * scale),
      fontWeight: "400",
      fontSize: Math.round(24 * scale),
    },
    titleLarge: {
      fontFamily,
      letterSpacing: 0,
      lineHeight: Math.round(28 * scale),
      fontWeight: "400",
      fontSize: Math.round(22 * scale),
    },
    titleMedium: {
      fontFamily,
      letterSpacing: 0.15,
      lineHeight: Math.round(24 * scale),
      fontWeight: "500",
      fontSize: Math.round(16 * scale),
    },
    titleSmall: {
      fontFamily,
      letterSpacing: 0.1,
      lineHeight: Math.round(20 * scale),
      fontWeight: "500",
      fontSize: Math.round(14 * scale),
    },
    labelLarge: {
      fontFamily,
      letterSpacing: 0.1,
      lineHeight: Math.round(20 * scale),
      fontWeight: "500",
      fontSize: Math.round(14 * scale),
    },
    labelMedium: {
      fontFamily,
      letterSpacing: 0.5,
      lineHeight: Math.round(16 * scale),
      fontWeight: "500",
      fontSize: Math.round(12 * scale),
    },
    labelSmall: {
      fontFamily,
      letterSpacing: 0.5,
      lineHeight: Math.round(16 * scale),
      fontWeight: "500",
      fontSize: Math.round(11 * scale),
    },
    bodyLarge: {
      fontFamily,
      letterSpacing: 0.5,
      lineHeight: Math.round(24 * scale),
      fontWeight: "400",
      fontSize: Math.round(16 * scale),
    },
    bodyMedium: {
      fontFamily,
      letterSpacing: 0.25,
      lineHeight: Math.round(20 * scale),
      fontWeight: "400",
      fontSize: Math.round(14 * scale),
    },
    bodySmall: {
      fontFamily,
      letterSpacing: 0.4,
      lineHeight: Math.round(16 * scale),
      fontWeight: "400",
      fontSize: Math.round(12 * scale),
    },
  };
};

const fontFamily = "System";

export const typography: TypographyScale = {
  displayLarge: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 64,
    fontWeight: "400",
    fontSize: 57,
  },
  displayMedium: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 52,
    fontWeight: "400",
    fontSize: 45,
  },
  displaySmall: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 44,
    fontWeight: "400",
    fontSize: 36,
  },
  headlineLarge: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 40,
    fontWeight: "400",
    fontSize: 32,
  },
  headlineMedium: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 36,
    fontWeight: "400",
    fontSize: 28,
  },
  headlineSmall: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 32,
    fontWeight: "400",
    fontSize: 24,
  },
  titleLarge: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 28,
    fontWeight: "400",
    fontSize: 22,
  },
  titleMedium: {
    fontFamily,
    letterSpacing: 0.15,
    lineHeight: 24,
    fontWeight: "500",
    fontSize: 16,
  },
  titleSmall: {
    fontFamily,
    letterSpacing: 0.1,
    lineHeight: 20,
    fontWeight: "500",
    fontSize: 14,
  },
  labelLarge: {
    fontFamily,
    letterSpacing: 0.1,
    lineHeight: 20,
    fontWeight: "500",
    fontSize: 14,
  },
  labelMedium: {
    fontFamily,
    letterSpacing: 0.5,
    lineHeight: 16,
    fontWeight: "500",
    fontSize: 12,
  },
  labelSmall: {
    fontFamily,
    letterSpacing: 0.5,
    lineHeight: 16,
    fontWeight: "500",
    fontSize: 11,
  },
  bodyLarge: {
    fontFamily,
    letterSpacing: 0.5,
    lineHeight: 24,
    fontWeight: "400",
    fontSize: 16,
  },
  bodyMedium: {
    fontFamily,
    letterSpacing: 0.25,
    lineHeight: 20,
    fontWeight: "400",
    fontSize: 14,
  },
  bodySmall: {
    fontFamily,
    letterSpacing: 0.4,
    lineHeight: 16,
    fontWeight: "400",
    fontSize: 12,
  },
};
