import { isAxiosError, type AxiosError } from "axios";

import { type ServiceType } from "@/models/service.types";
import { logger } from "@/services/logger/LoggerService";
import { apiErrorLogger } from "@/services/logger/ApiErrorLoggerService";
import { useSettingsStore } from "@/store/settingsStore";
import { ERROR_CODE_PRESETS } from "@/models/apiErrorLog.types";

export interface ErrorContext {
  serviceId?: string;
  serviceType?: ServiceType;
  operation?: string;
  endpoint?: string;
}

interface ApiErrorOptions {
  message: string;
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
  isNetworkError?: boolean;
  cause?: unknown;
}

const statusMessageMap: Record<number, string> = {
  400: "Bad request. Please verify your form data.",
  401: "Invalid API key or credentials.",
  403: "Access denied. Please check your permissions.",
  404: "Resource not found.",
  408: "Request timed out. Try again in a moment.",
  409: "Conflict detected. Please refresh and retry.",
  422: "Validation failed. Please check your inputs.",
  429: "Too many requests. Please try again later.",
  500: "Server error. Please check your service.",
  502: "Bad gateway from upstream service.",
  503: "Service unavailable. Please try again later.",
  504: "Gateway timeout. Try again shortly.",
};

const networkErrorCodes = new Set([
  "ECONNABORTED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ERR_NETWORK",
]);

export class ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
  isNetworkError: boolean;

  constructor({
    message,
    statusCode,
    code,
    details,
    isNetworkError = false,
    cause,
  }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;

    if (cause && typeof cause !== "undefined") {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const getStatusMessage = (
  statusCode: number | undefined,
  fallback: string,
): string => {
  if (!statusCode) {
    return fallback;
  }

  return statusMessageMap[statusCode] ?? fallback;
};

const isAxiosNetworkError = (error: AxiosError): boolean => {
  if (!error.response) {
    return true;
  }

  if (error.code && networkErrorCodes.has(error.code)) {
    return true;
  }

  return false;
};

const extractAxiosDetails = (error: AxiosError): Record<string, unknown> => {
  const details: Record<string, unknown> = {
    status: error.response?.status,
    statusText: error.response?.statusText,
  };

  if (error.response?.data && typeof error.response.data === "object") {
    const data = error.response.data as Record<string, unknown>;
    const message = typeof data.message === "string" ? data.message : undefined;
    const code = typeof data.code === "string" ? data.code : undefined;
    if (message) {
      details.responseMessage = message;
    }
    if (code) {
      details.responseCode = code;
    }
  }

  if (error.code) {
    details.code = error.code;
  }

  return details;
};

const mergeContext = (
  details: Record<string, unknown> | undefined,
  context?: ErrorContext,
): Record<string, unknown> | undefined => {
  if (!context) {
    return details;
  }

  return {
    ...details,
    context: {
      ...(details?.context as Record<string, unknown> | undefined),
      ...context,
    },
  };
};

const shouldLogErrorCode = (
  statusCode: number | string | undefined,
  isNetwork: boolean,
): boolean => {
  try {
    const settings = useSettingsStore.getState();
    if (!settings.apiErrorLoggerEnabled) {
      return false;
    }

    const preset = ERROR_CODE_PRESETS[settings.apiErrorLoggerActivePreset];
    if (!preset) {
      return false;
    }

    let codesToLog = preset.codes;
    if (settings.apiErrorLoggerActivePreset === "CUSTOM") {
      codesToLog = settings.apiErrorLoggerCustomCodes;
    }

    // Check if error code matches
    if (statusCode !== undefined) {
      return codesToLog.includes(statusCode);
    }

    // For network errors
    if (isNetwork) {
      return codesToLog.some(
        (code) =>
          typeof code === "string" &&
          [
            "ECONNABORTED",
            "ECONNREFUSED",
            "ENOTFOUND",
            "ETIMEDOUT",
            "ERR_NETWORK",
          ].includes(code),
      );
    }

    return false;
  } catch {
    // If settings access fails, don't log to prevent errors
    return false;
  }
};

export const handleApiError = (
  error: unknown,
  context?: ErrorContext,
  fallbackMessage = "An unexpected error occurred.",
): ApiError => {
  if (error instanceof ApiError) {
    error.details = mergeContext(error.details, context);
    return error;
  }

  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status;
    const isNetwork = isAxiosNetworkError(axiosError);
    const message = isNetwork
      ? "Cannot connect to service. Check your URL and network connection."
      : getStatusMessage(statusCode, fallbackMessage);

    const details = mergeContext(extractAxiosDetails(axiosError), context);

    const apiError = new ApiError({
      message,
      statusCode,
      code: axiosError.code,
      isNetworkError: isNetwork,
      details,
      cause: axiosError,
    });

    // Use a less severe log level for client-side (4xx) errors which are
    // often caused by invalid user input and are expected in some flows
    // (e.g. short search queries). Network issues and server errors (5xx)
    // are logged as errors.
    const isServerOrNetworkError =
      isNetwork || (statusCode !== undefined && statusCode >= 500);
    const logContext = {
      message: apiError.message,
      statusCode: apiError.statusCode,
      code: apiError.code,
      context,
    } as Record<string, unknown>;

    if (isServerOrNetworkError) {
      void logger.error("API error captured.", logContext);
    } else {
      void logger.warn("API error captured.", logContext);
    }

    // Log to API error logger if enabled and code matches config
    if (shouldLogErrorCode(statusCode, isNetwork)) {
      void apiErrorLogger.addError(apiError, context);
    }

    return apiError;
  }

  if (error instanceof Error) {
    const details = mergeContext({ name: error.name }, context);
    return new ApiError({ message: error.message, details, cause: error });
  }

  return new ApiError({
    message: fallbackMessage,
    details: mergeContext(undefined, context),
  });
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return error.isNetworkError;
  }

  if (isAxiosError(error)) {
    return isAxiosNetworkError(error as AxiosError);
  }

  return false;
};

export const formatErrorMessage = (error: unknown): string =>
  handleApiError(error).message;
