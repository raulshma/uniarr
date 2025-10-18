import type { components } from "@/connectors/client-schemas/prowlarr-openapi";

// Re-export common Prowlarr types from the generated OpenAPI schemas so the
// rest of the app can switch to the generated types without changing import
// paths across the codebase.
export type ProwlarrIndexerResource = components["schemas"]["IndexerResource"];
export type ProwlarrField = components["schemas"]["Field"];
export type ProwlarrSelectOption = components["schemas"]["SelectOption"];
export type ProwlarrApplicationBulkResource =
  components["schemas"]["ApplicationBulkResource"];
export type ProwlarrConnectedApplication =
  components["schemas"]["ApplicationResource"];

// Test endpoints vary between Prowlarr versions; keep a lightweight shape for
// callers while avoiding `any`.
export type ProwlarrTestResult = void | {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
};

// App-level statistics shape used by the UI; keep this shape stable and map
// to generated types inside connectors.
export type ProwlarrStatistics = {
  applicationId: number;
  applicationName: string;
  statistics: {
    queries: number;
    grabs: number;
    averageResponseTime?: number;
    lastQueryTime?: string;
    lastGrabTime?: string;
  };
};

export type IndexerStatistics = components["schemas"]["IndexerStatistics"];
export type IndexerStatsResource =
  components["schemas"]["IndexerStatsResource"];
