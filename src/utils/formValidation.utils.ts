import { z } from "zod";
import type { ServiceConfig } from "@/models/service.types";

/**
 * Form validation utilities for consistent validation timing and patterns
 */

export interface ValidationTiming {
  onChange?: boolean;
  onBlur?: boolean;
  onSubmit?: boolean;
}

export interface ValidationRule {
  schema: z.ZodSchema;
  timing: ValidationTiming;
  debounceMs?: number;
}

export interface FormValidationConfig {
  [field: string]: ValidationRule;
}

/**
 * Common validation schemas
 */
export const COMMON_VALIDATION_SCHEMAS = {
  // URL validation
  URL: z
    .string()
    .url("Please enter a valid URL")
    .min(1, "URL is required")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, "URL must use HTTP or HTTPS protocol"),

  // API Key validation
  API_KEY: z
    .string()
    .min(1, "API key is required")
    .refine((key) => !key.includes(" "), "API key cannot contain spaces"),

  // Username validation
  USERNAME: z
    .string()
    .min(1, "Username is required")
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .refine(
      (username) => !username.includes(" "),
      "Username cannot contain spaces",
    ),

  // Password validation
  PASSWORD: z
    .string()
    .min(1, "Password is required")
    .min(4, "Password must be at least 4 characters"),

  // Port validation
  PORT: z.coerce
    .number()
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),

  // Timeout validation
  TIMEOUT: z.coerce
    .number()
    .int("Timeout must be a whole number")
    .min(1000, "Timeout must be at least 1000ms (1 second)")
    .max(300000, "Timeout must be less than 300000ms (5 minutes)"),

  // Service name validation
  SERVICE_NAME: z
    .string()
    .min(1, "Service name is required")
    .min(2, "Service name must be at least 2 characters")
    .max(30, "Service name must be less than 30 characters")
    .refine(
      (name) => /^[a-zA-Z0-9_\-\s]+$/.test(name),
      "Service name can only contain letters, numbers, spaces, hyphens, and underscores",
    ),

  // Search query validation
  SEARCH_QUERY: z
    .string()
    .min(1, "Search query is required")
    .min(2, "Search query must be at least 2 characters")
    .max(100, "Search query must be less than 100 characters")
    .refine(
      (query) => !query.includes("<") && !query.includes(">"),
      "Search query contains invalid characters",
    ),

  // Email validation
  EMAIL: z.string().email("Please enter a valid email address").optional(),

  // Numeric validation
  NUMBER: z.coerce
    .number()
    .refine((num) => !isNaN(num), "Please enter a valid number"),

  // Integer validation
  INTEGER: z.coerce.number().int("Please enter a whole number"),

  // Positive number validation
  POSITIVE_NUMBER: z.coerce.number().positive("Number must be positive"),

  // Non-negative validation
  NON_NEGATIVE: z.coerce.number().min(0, "Number must be 0 or greater"),
} as const;

/**
 * Service-specific validation configurations
 */
export const SERVICE_VALIDATION_CONFIG: Record<string, FormValidationConfig> = {
  sonarr: {
    url: {
      schema: COMMON_VALIDATION_SCHEMAS.URL,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 500,
    },
    apiKey: {
      schema: COMMON_VALIDATION_SCHEMAS.API_KEY,
      timing: { onBlur: true, onSubmit: true },
    },
    name: {
      schema: COMMON_VALIDATION_SCHEMAS.SERVICE_NAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    timeout: {
      schema: COMMON_VALIDATION_SCHEMAS.TIMEOUT,
      timing: { onBlur: true, onSubmit: true },
    },
  },

  radarr: {
    url: {
      schema: COMMON_VALIDATION_SCHEMAS.URL,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 500,
    },
    apiKey: {
      schema: COMMON_VALIDATION_SCHEMAS.API_KEY,
      timing: { onBlur: true, onSubmit: true },
    },
    name: {
      schema: COMMON_VALIDATION_SCHEMAS.SERVICE_NAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    timeout: {
      schema: COMMON_VALIDATION_SCHEMAS.TIMEOUT,
      timing: { onBlur: true, onSubmit: true },
    },
  },

  qbittorrent: {
    url: {
      schema: COMMON_VALIDATION_SCHEMAS.URL,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 500,
    },
    username: {
      schema: COMMON_VALIDATION_SCHEMAS.USERNAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    password: {
      schema: COMMON_VALIDATION_SCHEMAS.PASSWORD,
      timing: { onBlur: true, onSubmit: true },
    },
    name: {
      schema: COMMON_VALIDATION_SCHEMAS.SERVICE_NAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    timeout: {
      schema: COMMON_VALIDATION_SCHEMAS.TIMEOUT,
      timing: { onBlur: true, onSubmit: true },
    },
  },

  jellyseerr: {
    url: {
      schema: COMMON_VALIDATION_SCHEMAS.URL,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 500,
    },
    apiKey: {
      schema: COMMON_VALIDATION_SCHEMAS.API_KEY,
      timing: { onBlur: true, onSubmit: true },
    },
    name: {
      schema: COMMON_VALIDATION_SCHEMAS.SERVICE_NAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    timeout: {
      schema: COMMON_VALIDATION_SCHEMAS.TIMEOUT,
      timing: { onBlur: true, onSubmit: true },
    },
  },

  jellyfin: {
    url: {
      schema: COMMON_VALIDATION_SCHEMAS.URL,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 500,
    },
    apiKey: {
      schema: COMMON_VALIDATION_SCHEMAS.API_KEY,
      timing: { onBlur: true, onSubmit: true },
    },
    username: {
      schema: COMMON_VALIDATION_SCHEMAS.USERNAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    password: {
      schema: COMMON_VALIDATION_SCHEMAS.PASSWORD,
      timing: { onBlur: true, onSubmit: true },
    },
    name: {
      schema: COMMON_VALIDATION_SCHEMAS.SERVICE_NAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    timeout: {
      schema: COMMON_VALIDATION_SCHEMAS.TIMEOUT,
      timing: { onBlur: true, onSubmit: true },
    },
  },

  adguard: {
    url: {
      schema: COMMON_VALIDATION_SCHEMAS.URL,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 500,
    },
    username: {
      schema: COMMON_VALIDATION_SCHEMAS.USERNAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    password: {
      schema: COMMON_VALIDATION_SCHEMAS.PASSWORD,
      timing: { onBlur: true, onSubmit: true },
    },
    name: {
      schema: COMMON_VALIDATION_SCHEMAS.SERVICE_NAME,
      timing: { onChange: true, onBlur: true, onSubmit: true },
      debounceMs: 300,
    },
    timeout: {
      schema: COMMON_VALIDATION_SCHEMAS.TIMEOUT,
      timing: { onBlur: true, onSubmit: true },
    },
  },
};

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * Validate a single field
 */
export function validateField(
  field: string,
  value: unknown,
  rule: ValidationRule,
): { isValid: boolean; error?: string } {
  try {
    rule.schema.parse(value);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldError = error.issues[0];
      return {
        isValid: false,
        error: fieldError?.message || "Invalid value",
      };
    }
    return {
      isValid: false,
      error: "Validation failed",
    };
  }
}

/**
 * Validate form data against a configuration
 */
export function validateFormData(
  data: Record<string, unknown>,
  config: FormValidationConfig,
  timing: keyof ValidationTiming = "onSubmit",
): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  Object.entries(config).forEach(([field, rule]) => {
    if (rule.timing[timing]) {
      const result = validateField(field, data[field], rule);
      if (!result.isValid && result.error) {
        errors[field] = result.error;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * Get validation configuration for a service type
 */
export function getServiceValidationConfig(
  serviceType: string,
): FormValidationConfig {
  return SERVICE_VALIDATION_CONFIG[serviceType] || {};
}

/**
 * Validate service configuration
 */
export function validateServiceConfig(
  config: Partial<ServiceConfig>,
  timing: keyof ValidationTiming = "onSubmit",
): ValidationResult {
  if (!config.type) {
    return {
      isValid: false,
      errors: { type: "Service type is required" },
      warnings: {},
    };
  }

  const validationConfig = getServiceValidationConfig(config.type);
  return validateFormData(config, validationConfig, timing);
}

/**
 * Debounced validation utility
 */
export function createDebouncedValidator<T>(
  validator: (data: T) => ValidationResult,
  delay: number = 300,
): (data: T) => Promise<ValidationResult> {
  let timeoutId: NodeJS.Timeout | null = null;

  return (data: T): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        resolve(validator(data));
        timeoutId = null;
      }, delay);
    });
  };
}

/**
 * Real-time validation hook creator
 */
export const createValidationConfig = (
  serviceType: string,
  options: {
    onChange?: boolean;
    onBlur?: boolean;
    customRules?: FormValidationConfig;
  } = {},
) => {
  const baseConfig = getServiceValidationConfig(serviceType);
  const customConfig = options.customRules || {};

  // Override timing based on options
  const config: FormValidationConfig = {};
  Object.entries({ ...baseConfig, ...customConfig }).forEach(
    ([field, rule]) => {
      config[field] = {
        ...rule,
        timing: {
          onChange: options.onChange ?? rule.timing.onChange,
          onBlur: options.onBlur ?? rule.timing.onBlur,
          onSubmit: rule.timing.onSubmit, // Always validate on submit
        },
      };
    },
  );

  return config;
};

/**
 * Search validation
 */
export const validateSearchQuery = (query: string): ValidationResult => {
  const result = validateField("query", query, {
    schema: COMMON_VALIDATION_SCHEMAS.SEARCH_QUERY,
    timing: { onChange: true, onSubmit: true },
    debounceMs: 300,
  });

  return {
    isValid: result.isValid,
    errors: result.isValid
      ? {}
      : { query: result.error || "Invalid search query" },
    warnings: {},
  };
};

/**
 * Pre-submit validation helper
 */
export const validateBeforeSubmit = (
  data: Record<string, unknown>,
  config: FormValidationConfig,
): ValidationResult => {
  // Always validate all required fields on submit
  const submitConfig: FormValidationConfig = {};
  Object.entries(config).forEach(([field, rule]) => {
    submitConfig[field] = {
      ...rule,
      timing: { onSubmit: true },
    };
  });

  return validateFormData(data, submitConfig, "onSubmit");
};
