/**
 * Route parameter validation utilities
 */

export interface RouteValidationRule {
  required?: boolean;
  type?: "string" | "number" | "boolean";
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface RouteValidationSchema {
  [param: string]: RouteValidationRule;
}

/**
 * Common route validation schemas
 */
export const ROUTE_SCHEMAS = {
  // Service routes
  SERVICE_ID: {
    serviceId: {
      required: true,
      type: "string",
      minLength: 1,
      maxLength: 50,
    },
  },

  // Media routes
  MEDIA_ID: {
    serviceId: {
      required: true,
      type: "string",
      minLength: 1,
    },
    id: {
      required: true,
      type: "number",
      min: 1,
    },
  },

  // TMDB routes
  TMDB_MEDIA: {
    mediaType: {
      required: true,
      type: "string",
      pattern: /^(movie|tv)$/,
    },
    tmdbId: {
      required: true,
      type: "number",
      min: 1,
    },
  },

  // Jellyseerr routes
  JELLYSEERR_MEDIA: {
    serviceId: {
      required: true,
      type: "string",
      minLength: 1,
    },
    mediaType: {
      required: true,
      type: "string",
      pattern: /^(movie|tv)$/,
    },
    mediaId: {
      required: true,
      type: "number",
      min: 1,
    },
  },

  // Person routes
  PERSON_ID: {
    personId: {
      required: true,
      type: "number",
      min: 1,
    },
  },

  // Anime routes
  ANIME_ID: {
    malId: {
      required: true,
      type: "number",
      min: 1,
    },
  },

  // Section routes
  SECTION_ID: {
    sectionId: {
      required: true,
      type: "string",
      minLength: 1,
    },
  },

  // Query parameters
  SEARCH_QUERY: {
    q: {
      required: false,
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    page: {
      required: false,
      type: "number",
      min: 1,
      max: 100,
    },
  },
} as const;

/**
 * Validate a parameter against a rule
 */
function validateParam(
  value: unknown,
  rule: RouteValidationRule,
): { valid: boolean; error?: string } {
  // Check if required
  if (
    rule.required &&
    (value === undefined || value === null || value === "")
  ) {
    return { valid: false, error: "Parameter is required" };
  }

  // If not required and empty, it's valid
  if (
    !rule.required &&
    (value === undefined || value === null || value === "")
  ) {
    return { valid: true };
  }

  // Type validation
  if (rule.type) {
    switch (rule.type) {
      case "string": {
        if (typeof value !== "string") {
          return { valid: false, error: "Parameter must be a string" };
        }
        const strValue = value as string;

        if (rule.minLength && strValue.length < rule.minLength) {
          return {
            valid: false,
            error: `Parameter must be at least ${rule.minLength} characters`,
          };
        }

        if (rule.maxLength && strValue.length > rule.maxLength) {
          return {
            valid: false,
            error: `Parameter must be no more than ${rule.maxLength} characters`,
          };
        }

        if (rule.pattern && !rule.pattern.test(strValue)) {
          return { valid: false, error: "Parameter format is invalid" };
        }
        break;
      }

      case "number": {
        const numValue =
          typeof value === "string" ? parseInt(value, 10) : (value as number);
        if (isNaN(numValue)) {
          return { valid: false, error: "Parameter must be a number" };
        }

        if (rule.min !== undefined && numValue < rule.min) {
          return {
            valid: false,
            error: `Parameter must be at least ${rule.min}`,
          };
        }

        if (rule.max !== undefined && numValue > rule.max) {
          return {
            valid: false,
            error: `Parameter must be no more than ${rule.max}`,
          };
        }
        break;
      }

      case "boolean": {
        if (
          typeof value !== "boolean" &&
          value !== "true" &&
          value !== "false"
        ) {
          return { valid: false, error: "Parameter must be a boolean" };
        }
        break;
      }
    }
  }

  return { valid: true };
}

/**
 * Validate route parameters against a schema
 */
export function validateRouteParams(
  params: Record<string, unknown>,
  schema: RouteValidationSchema,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  let valid = true;

  Object.entries(schema).forEach(([param, rule]) => {
    const result = validateParam(params[param], rule);
    if (!result.valid) {
      errors[param] = result.error || "Invalid parameter";
      valid = false;
    }
  });

  return { valid, errors };
}

/**
 * Validate and sanitize route parameters
 */
export function sanitizeRouteParams<T extends Record<string, unknown>>(
  params: Record<string, unknown>,
  schema: RouteValidationSchema,
): { valid: boolean; sanitized: T; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const sanitized = {} as T;
  let valid = true;

  Object.entries(schema).forEach(([param, rule]) => {
    const value = params[param];
    const result = validateParam(value, rule);

    if (result.valid) {
      // Type conversion
      if (value !== undefined && value !== null) {
        switch (rule.type) {
          case "number":
            sanitized[param as keyof T] = (
              typeof value === "string" ? parseInt(value, 10) : value
            ) as T[keyof T];
            break;
          case "boolean":
            sanitized[param as keyof T] = (value === "true" ||
              value === true) as T[keyof T];
            break;
          default:
            sanitized[param as keyof T] = value as T[keyof T];
        }
      }
    } else {
      errors[param] = result.error || "Invalid parameter";
      valid = false;
    }
  });

  return { valid, sanitized, errors };
}

/**
 * Get validation schema for a route pattern
 */
export function getRouteSchema(route: string): RouteValidationSchema {
  if (route.includes("/sonarr/") || route.includes("/radarr/")) {
    return ROUTE_SCHEMAS.MEDIA_ID;
  }

  if (route.includes("/jellyseerr/")) {
    return ROUTE_SCHEMAS.JELLYSEERR_MEDIA;
  }

  if (route.includes("/jellyfin/")) {
    return ROUTE_SCHEMAS.SERVICE_ID;
  }

  if (route.includes("/person/")) {
    return ROUTE_SCHEMAS.PERSON_ID;
  }

  if (route.includes("/anime-hub/")) {
    return ROUTE_SCHEMAS.ANIME_ID;
  }

  if (route.includes("/section/")) {
    return ROUTE_SCHEMAS.SECTION_ID;
  }

  if (route.includes("/tmdb/")) {
    return ROUTE_SCHEMAS.TMDB_MEDIA;
  }

  // Default to service ID validation
  return ROUTE_SCHEMAS.SERVICE_ID;
}

/**
 * Check if a route has required parameters
 */
export function hasRequiredParams(
  route: string,
  params: Record<string, unknown>,
): boolean {
  const schema = getRouteSchema(route);
  const validation = validateRouteParams(params, schema);
  return validation.valid;
}
