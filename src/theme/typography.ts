export type TypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  letterSpacing: number;
  lineHeight: number;
};

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

const fontFamily = 'System';

export const typography: TypographyScale = {
  displayLarge: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 64,
    fontWeight: '400',
    fontSize: 57,
  },
  displayMedium: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 52,
    fontWeight: '400',
    fontSize: 45,
  },
  displaySmall: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 44,
    fontWeight: '400',
    fontSize: 36,
  },
  headlineLarge: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 40,
    fontWeight: '400',
    fontSize: 32,
  },
  headlineMedium: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 36,
    fontWeight: '400',
    fontSize: 28,
  },
  headlineSmall: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 32,
    fontWeight: '400',
    fontSize: 24,
  },
  titleLarge: {
    fontFamily,
    letterSpacing: 0,
    lineHeight: 28,
    fontWeight: '400',
    fontSize: 22,
  },
  titleMedium: {
    fontFamily,
    letterSpacing: 0.15,
    lineHeight: 24,
    fontWeight: '500',
    fontSize: 16,
  },
  titleSmall: {
    fontFamily,
    letterSpacing: 0.1,
    lineHeight: 20,
    fontWeight: '500',
    fontSize: 14,
  },
  labelLarge: {
    fontFamily,
    letterSpacing: 0.1,
    lineHeight: 20,
    fontWeight: '500',
    fontSize: 14,
  },
  labelMedium: {
    fontFamily,
    letterSpacing: 0.5,
    lineHeight: 16,
    fontWeight: '500',
    fontSize: 12,
  },
  labelSmall: {
    fontFamily,
    letterSpacing: 0.5,
    lineHeight: 16,
    fontWeight: '500',
    fontSize: 11,
  },
  bodyLarge: {
    fontFamily,
    letterSpacing: 0.5,
    lineHeight: 24,
    fontWeight: '400',
    fontSize: 16,
  },
  bodyMedium: {
    fontFamily,
    letterSpacing: 0.25,
    lineHeight: 20,
    fontWeight: '400',
    fontSize: 14,
  },
  bodySmall: {
    fontFamily,
    letterSpacing: 0.4,
    lineHeight: 16,
    fontWeight: '400',
    fontSize: 12,
  },
};

