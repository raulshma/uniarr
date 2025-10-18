import { useState, useCallback, useEffect, useRef } from "react";
import type {
  FormValidationConfig,
  ValidationResult,
} from "@/utils/formValidation.utils";
import {
  validateFormData,
  createDebouncedValidator,
  getServiceValidationConfig,
  COMMON_VALIDATION_SCHEMAS,
} from "@/utils/formValidation.utils";

/**
 * Hook for consistent form validation timing and patterns
 */
export interface UseFormValidationOptions<T> {
  config: FormValidationConfig;
  initialValues?: T;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  onSubmit?: (data: T) => void;
}

export interface FormValidationState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
}

export interface FormValidationActions<T> {
  setValue: (field: keyof T, value: unknown) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  clearErrors: () => void;
  setTouched: (field: keyof T, touched?: boolean) => void;
  validateField: (field: keyof T) => Promise<ValidationResult>;
  validateForm: () => Promise<ValidationResult>;
  handleSubmit: () => Promise<void>;
  reset: (values?: T) => void;
}

export function useFormValidation<T extends Record<string, unknown>>(
  options: UseFormValidationOptions<T>,
): [FormValidationState<T>, FormValidationActions<T>] {
  const {
    config,
    initialValues = {} as T,
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    onSubmit,
  } = options;

  // State
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for debounced validation
  const debouncedValidatorsRef = useRef<
    Map<string, (value: unknown) => Promise<ValidationResult>>
  >(new Map());

  // Calculate form validity
  const isValid = Object.keys(errors).length === 0;

  // Create debounced validator for a field
  const getDebouncedValidator = useCallback(
    (field: string, rule: any) => {
      if (!debouncedValidatorsRef.current.has(field)) {
        const validator = createDebouncedValidator(
          (value: unknown) =>
            validateFormData({ [field]: value }, { [field]: rule }, "onChange"),
          rule.debounceMs || debounceMs,
        );
        debouncedValidatorsRef.current.set(field, validator);
      }
      return debouncedValidatorsRef.current.get(field)!;
    },
    [debounceMs],
  );

  // Validate a single field
  const validateField = useCallback(
    async (field: keyof T): Promise<ValidationResult> => {
      const rule = config[field as string];
      if (!rule) {
        return { isValid: true, errors: {}, warnings: {} };
      }

      setIsValidating(true);
      try {
        let result: ValidationResult;

        if (rule.timing.onChange && validateOnChange) {
          const debouncedValidator = getDebouncedValidator(
            field as string,
            rule,
          );
          result = await debouncedValidator(values[field]);
        } else {
          result = validateFormData(
            { [field]: values[field] },
            { [field]: rule },
            "onChange",
          );
        }

        // Update errors for this field
        setErrors((prev) => {
          const newErrors = { ...prev };
          if (result.isValid) {
            delete newErrors[field as string];
          } else {
            Object.assign(newErrors, result.errors);
          }
          return newErrors;
        });

        return result;
      } finally {
        setIsValidating(false);
      }
    },
    [config, values, validateOnChange, getDebouncedValidator],
  );

  // Validate entire form
  const validateForm = useCallback(async (): Promise<ValidationResult> => {
    setIsValidating(true);
    try {
      const result = validateFormData(values, config, "onSubmit");
      setErrors(result.errors);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [values, config]);

  // Set field value
  const setValue = useCallback(
    (field: keyof T, value: unknown) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Clear error when value changes
      if (errors[field as string]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
      }

      // Validate on change if configured
      if (validateOnChange) {
        const rule = config[field as string];
        if (rule?.timing.onChange) {
          // Trigger validation (will be debounced if configured)
          void validateField(field);
        }
      }
    },
    [errors, validateOnChange, config, validateField],
  );

  // Set field error
  const setError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  // Clear field error
  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Set field touched status
  const setFieldTouched = useCallback(
    (field: keyof T, isTouched = true) => {
      setTouched((prev) => ({ ...prev, [field]: isTouched }));

      // Validate on blur if configured
      if (isTouched && validateOnBlur) {
        const rule = config[field as string];
        if (rule?.timing.onBlur) {
          void validateField(field);
        }
      }
    },
    [validateOnBlur, config, validateField],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || isValidating) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await validateForm();
      if (result.isValid && onSubmit) {
        onSubmit(values);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isValidating, validateForm, onSubmit, values]);

  // Reset form
  const reset = useCallback(
    (newValues?: T) => {
      const resetValues = newValues || initialValues;
      setValues(resetValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setIsValidating(false);
    },
    [initialValues],
  );

  // Clean up debounced validators on unmount
  useEffect(() => {
    const validatorsRef = debouncedValidatorsRef.current;
    return () => {
      validatorsRef.clear();
    };
  }, []);

  const state: FormValidationState<T> = {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    isValidating,
  };

  const actions: FormValidationActions<T> = {
    setValue,
    setError,
    clearError,
    clearErrors,
    setTouched: setFieldTouched,
    validateField,
    validateForm,
    handleSubmit,
    reset,
  };

  return [state, actions];
}

/**
 * Hook for service form validation
 */
export function useServiceFormValidation<T extends Record<string, unknown>>(
  serviceType: string,
  options: Omit<UseFormValidationOptions<T>, "config"> & {
    customConfig?: FormValidationConfig;
  } = {},
) {
  const baseConfig = getServiceValidationConfig(serviceType);
  const config = { ...baseConfig, ...options.customConfig };

  return useFormValidation({
    ...options,
    config,
  });
}

/**
 * Hook for search form validation
 */
export function useSearchFormValidation(
  options: Omit<UseFormValidationOptions<{ query: string }>, "config"> = {},
) {
  const searchConfig: FormValidationConfig = {
    query: {
      schema: COMMON_VALIDATION_SCHEMAS.SEARCH_QUERY,
      timing: { onChange: true, onSubmit: true },
      debounceMs: 300,
    },
  };

  return useFormValidation({
    ...options,
    config: searchConfig,
  });
}
