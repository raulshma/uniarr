export interface SensitiveDataDetection {
  patterns: string[]; // Which patterns were detected (e.g., ["authorization", "x-api-key"])
  location: "headers" | "body" | "both"; // Where sensitive data was found
  timestamp: string; // ISO string of when detection occurred
}

export interface ApiErrorLogEntry {
  id: string;
  timestamp: string; // ISO string
  method: string; // GET, POST, etc.
  endpoint: string; // /api/series, /api/movies, etc.
  statusCode?: number; // HTTP status code (undefined for network errors)
  errorCode?: string; // Network error code (ENOTFOUND, ETIMEDOUT, etc.) or error string
  serviceId: string;
  serviceType?: string; // sonarr, radarr, etc.
  operation?: string; // getSeries, search, etc.
  message: string; // User-friendly message
  isNetworkError: boolean; // true if network connectivity issue
  retryCount: number; // Number of times this error was retried
  context?: Record<string, unknown>; // Additional context
  deletedAt?: string; // ISO string - set when soft-deleted; null if active. Used for audit trail preservation.
  sensitiveDataDetected?: SensitiveDataDetection; // Track if/when sensitive patterns were detected during capture
}

export interface ApiErrorLogFilter {
  serviceId?: string;
  statusCode?: number;
  errorCode?: string;
  isNetworkError?: boolean;
  startDate?: Date;
  endDate?: Date;
  operation?: string;
  endpoint?: string;
  search?: string; // Search in message or endpoint
  includeDeleted?: boolean; // Include soft-deleted entries (audit trail); default: false
}

export interface GroupedErrorStats {
  byService: Map<string, number>;
  byStatusCode: Map<number | string, number>;
  byEndpoint: Map<string, number>;
  byDate: Map<string, number>; // ISO date string
  byErrorType: {
    network: number;
    server: number; // 5xx
    client: number; // 4xx
    other: number;
  };
  total: number;
}

export interface HistogramData {
  label: string;
  value: number;
}

export interface ErrorCodePreset {
  name: string;
  description: string;
  codes: (number | string)[];
}

export const ERROR_CODE_PRESETS: Record<string, ErrorCodePreset> = {
  CRITICAL: {
    name: "Critical",
    description: "Server errors (5xx) and network issues",
    codes: [
      500,
      502,
      503,
      504,
      "ECONNABORTED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "ERR_NETWORK",
    ],
  },
  SERVER: {
    name: "Server Errors",
    description: "Only 5xx server errors",
    codes: [500, 502, 503, 504],
  },
  RATE_LIMIT: {
    name: "Rate Limit",
    description: "Too many requests (429)",
    codes: [429],
  },
  CLIENT_ERRORS: {
    name: "Client Errors",
    description: "Only 4xx client errors",
    codes: [400, 401, 403, 404, 408, 409, 422],
  },
  STRICT: {
    name: "All Errors",
    description: "Log all errors (5xx, 4xx, network)",
    codes: [
      400,
      401,
      403,
      404,
      408,
      409,
      422,
      429,
      500,
      502,
      503,
      504,
      "ECONNABORTED",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "ERR_NETWORK",
    ],
  },
  CUSTOM: {
    name: "Custom",
    description: "User-defined error codes",
    codes: [],
  },
};
