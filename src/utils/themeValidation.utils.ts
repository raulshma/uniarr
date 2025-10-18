import type { AppTheme } from "@/constants/theme";

/**
 * Theme validation utilities to ensure consistent usage across components
 */

export interface ThemeValidationRule {
  required?: boolean;
  type?: "color" | "spacing" | "typography" | "number" | "string";
  deprecated?: boolean;
  alternative?: string;
  description?: string;
}

export interface ThemeValidationSchema {
  [key: string]: ThemeValidationRule;
}

/**
 * Standard theme validation rules
 */
export const THEME_VALIDATION_RULES: ThemeValidationSchema = {
  // Colors
  primary: {
    type: "color",
    required: true,
    description: "Primary brand color",
  },
  secondary: {
    type: "color",
    required: true,
    description: "Secondary brand color",
  },
  background: {
    type: "color",
    required: true,
    description: "Main background color",
  },
  surface: {
    type: "color",
    required: true,
    description: "Surface color for cards and modals",
  },
  onSurface: {
    type: "color",
    required: true,
    description: "Text/icon color on surfaces",
  },
  onSurfaceVariant: {
    type: "color",
    required: true,
    description: "Secondary text/icon color",
  },
  outline: {
    type: "color",
    required: true,
    description: "Border and divider color",
  },
  error: { type: "color", required: true, description: "Error state color" },
  warning: {
    type: "color",
    required: true,
    description: "Warning state color",
  },
  success: {
    type: "color",
    required: true,
    description: "Success state color",
  },

  // Custom spacing
  spacing: {
    type: "spacing",
    required: true,
    description: "Custom spacing scale object with xs, sm, md, lg, xl",
  },

  // Custom typography
  typography: {
    type: "typography",
    required: true,
    description: "Custom typography scale object",
  },

  // Dark mode flag
  dark: { type: "string", required: true, description: "Theme mode flag" },
};

/**
 * Validate that a color exists in the theme
 */
export function validateThemeColor(theme: AppTheme, colorKey: string): boolean {
  const color = getColorFromTheme(theme, colorKey);
  return color !== undefined && color !== null && color !== "";
}

/**
 * Validate that spacing exists in the theme
 */
export function validateThemeSpacing(
  theme: AppTheme,
  spacingKey: string,
): boolean {
  const spacing = getSpacingFromTheme(theme, spacingKey);
  return typeof spacing === "number" && spacing >= 0;
}

/**
 * Get color from theme with validation
 */
export function getColorFromTheme(
  theme: AppTheme,
  colorKey: string,
): string | undefined {
  if (!theme.colors) {
    console.warn("Theme colors object is missing");
    return undefined;
  }

  const color = theme.colors[colorKey as keyof typeof theme.colors];
  if (color === undefined) {
    console.warn(`Color key "${colorKey}" not found in theme`);
    return undefined;
  }

  // Convert to string if it's a theme object
  return typeof color === "string" ? color : String(color);
}

/**
 * Get spacing from theme with validation
 */
export function getSpacingFromTheme(
  theme: AppTheme,
  spacingKey: string,
): number | undefined {
  if (!theme.custom?.spacing) {
    console.warn("Theme custom spacing object is missing");
    return undefined;
  }

  const spacing =
    theme.custom.spacing[spacingKey as keyof typeof theme.custom.spacing];
  if (spacing === undefined) {
    console.warn(`Spacing key "${spacingKey}" not found in theme`);
    return undefined;
  }

  return spacing;
}

/**
 * Validate theme structure
 */
export function validateThemeStructure(theme: AppTheme): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required properties
  Object.entries(THEME_VALIDATION_RULES).forEach(([key, rule]) => {
    if (rule.required) {
      let exists = false;

      switch (rule.type) {
        case "color":
          exists = validateThemeColor(theme, key);
          break;
        case "spacing":
          exists = theme.custom?.spacing !== undefined;
          break;
        case "typography":
          exists = theme.custom?.typography !== undefined;
          break;
        default:
          exists = (theme as any)[key] !== undefined;
      }

      if (!exists) {
        errors.push(
          `Required theme property "${key}" (${rule.type}) is missing`,
        );
      }
    }

    if (rule.deprecated) {
      warnings.push(
        `Theme property "${key}" is deprecated. Use "${rule.alternative}" instead`,
      );
    }
  });

  // Validate custom spacing structure
  if (theme.custom?.spacing) {
    const requiredSpacingKeys = ["xs", "sm", "md", "lg", "xl"];
    requiredSpacingKeys.forEach((key) => {
      if (!(key in theme.custom.spacing)) {
        warnings.push(`Missing spacing key "${key}" in custom.spacing`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get safe color from theme with fallback
 */
export function getSafeColor(
  theme: AppTheme,
  colorKey: string,
  fallback: string,
): string {
  const color = getColorFromTheme(theme, colorKey);
  return color || fallback;
}

/**
 * Get safe spacing from theme with fallback
 */
export function getSafeSpacing(
  theme: AppTheme,
  spacingKey: string,
  fallback: number,
): number {
  const spacing = getSpacingFromTheme(theme, spacingKey);
  return spacing !== undefined ? spacing : fallback;
}

/**
 * Component theme validation utilities
 */
export const validateComponentTheme = {
  /**
   * Validate that a component uses theme colors properly
   */
  validateColors: (theme: AppTheme, usedColors: string[]): boolean => {
    return usedColors.every((color) => validateThemeColor(theme, color));
  },

  /**
   * Validate that a component uses theme spacing properly
   */
  validateSpacing: (theme: AppTheme, usedSpacing: string[]): boolean => {
    return usedSpacing.every((spacing) => validateThemeSpacing(theme, spacing));
  },

  /**
   * Get recommended color for a semantic purpose
   */
  getSemanticColor: (
    theme: AppTheme,
    purpose:
      | "primary"
      | "secondary"
      | "background"
      | "surface"
      | "error"
      | "warning"
      | "success",
  ): string => {
    switch (purpose) {
      case "primary":
        return getSafeColor(theme, "primary", "#1976D2");
      case "secondary":
        return getSafeColor(theme, "secondary", "#03DAC6");
      case "background":
        return getSafeColor(
          theme,
          "background",
          theme.dark ? "#121212" : "#FFFFFF",
        );
      case "surface":
        return getSafeColor(
          theme,
          "surface",
          theme.dark ? "#1E1E1E" : "#FFFFFF",
        );
      case "error":
        return getSafeColor(theme, "error", "#B00020");
      case "warning":
        return getSafeColor(theme, "warning", "#FF8C00");
      case "success":
        return getSafeColor(theme, "success", "#4CAF50");
      default:
        return getSafeColor(theme, "primary", "#1976D2");
    }
  },
};

/**
 * Theme-aware style creator
 */
export const createThemedStyle = <T extends Record<string, unknown>>(
  theme: AppTheme,
  styleFactory: (theme: AppTheme) => T,
): T => {
  const validation = validateThemeStructure(theme);
  if (!validation.valid) {
    console.error("Theme validation failed:", validation.errors);
  }

  if (validation.warnings.length > 0) {
    console.warn("Theme validation warnings:", validation.warnings);
  }

  return styleFactory(theme);
};

/**
 * Development theme validation hook
 */
export const useThemeValidation = (theme: AppTheme) => {
  if (__DEV__) {
    const validation = validateThemeStructure(theme);

    if (!validation.valid) {
      console.group("🎨 Theme Validation Errors");
      validation.errors.forEach((error) => console.error("❌", error));
      console.groupEnd();
    }

    if (validation.warnings.length > 0) {
      console.group("🎨 Theme Validation Warnings");
      validation.warnings.forEach((warning) => console.warn("⚠️", warning));
      console.groupEnd();
    }
  }
};
