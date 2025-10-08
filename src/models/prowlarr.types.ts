/**
 * Prowlarr-specific types for indexer management
 */

export interface ProwlarrApplicationResource {
  id: number;
  name: string;
  implementationName: string;
  implementation: string;
  configContract: string;
  infoLink: string;
  tags: number[];
  fields: ProwlarrField[];
  enable: boolean;
  priority: number;
  syncLevel: string;
}

export interface ProwlarrField {
  name: string;
  value?: unknown;
  type?: string;
  label?: string;
  helpText?: string;
  helpLink?: string;
  order?: number;
  advanced?: boolean;
  privacy?: string;
  placeholder?: string;
  selectOptions?: ProwlarrSelectOption[];
}

export interface ProwlarrSelectOption {
  value: number;
  name?: string;
  order?: number;
  hint?: string;
  parentValue?: number;
}

export interface ProwlarrApplicationBulkResource {
  ids: number[];
  tags?: number[];
  applyTags?: string;
  enable?: boolean;
  priority?: number;
  syncLevel?: string;
}

export interface ProwlarrTestResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ProwlarrStatistics {
  applicationId: number;
  applicationName: string;
  statistics: {
    queries: number;
    grabs: number;
    averageResponseTime?: number;
    lastQueryTime?: string;
    lastGrabTime?: string;
  };
}
