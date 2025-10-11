/**
 * Prowlarr-specific types for indexer management
 */

/**
 * Represents an indexer as returned by Prowlarr (/api/v1/indexer)
 * This mirrors the `IndexerResource` in the Prowlarr OpenAPI spec.
 */
export interface ProwlarrIndexerResource {
  id: number;
  name?: string | null;
  fields?: ProwlarrField[] | null;
  implementationName?: string | null;
  implementation?: string | null;
  configContract?: string | null;
  infoLink?: string | null;
  message?: unknown;
  tags?: number[] | null;
  presets?: ProwlarrIndexerResource[] | null;
  indexerUrls?: string[] | null;
  legacyUrls?: string[] | null;
  definitionName?: string | null;
  description?: string | null;
  language?: string | null;
  encoding?: string | null;
  enable?: boolean;
  redirect?: boolean;
  supportsRss?: boolean;
  supportsSearch?: boolean;
  supportsRedirect?: boolean;
  supportsPagination?: boolean;
  appProfileId?: number | null;
  protocol?: unknown;
  privacy?: unknown;
  capabilities?: unknown;
  priority?: number;
  downloadClientId?: number | null;
  added?: string;
  status?: unknown;
  sortName?: string | null;
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

/**
 * Represents a connected application/resource in Prowlarr (/api/v1/applications)
 * This is distinct from the indexer resource; applications typically represent
 * connected Sonarr/Radarr instances and include fields such as `syncLevel`.
 */
export interface ProwlarrConnectedApplication {
  id: number;
  name?: string | null;
  fields?: ProwlarrField[] | null;
  implementationName?: string | null;
  implementation?: string | null;
  configContract?: string | null;
  infoLink?: string | null;
  message?: unknown;
  tags?: number[] | null;
  presets?: ProwlarrConnectedApplication[] | null;
  syncLevel?: string;
  testCommand?: string | null;
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

/**
 * Statistics types aligned with Prowlarr OpenAPI spec
 */
export interface IndexerStatistics {
  indexerId: number;
  indexerName?: string | null;
  averageResponseTime: number;
  averageGrabResponseTime: number;
  numberOfQueries: number;
  numberOfGrabs: number;
  numberOfRssQueries: number;
  numberOfAuthQueries: number;
  numberOfFailedQueries: number;
  numberOfFailedGrabs: number;
  numberOfFailedRssQueries: number;
  numberOfFailedAuthQueries: number;
}

export interface UserAgentStatistics {
  userAgent?: string | null;
  numberOfQueries: number;
  numberOfGrabs: number;
}

export interface HostStatistics {
  host?: string | null;
  numberOfQueries: number;
  numberOfGrabs: number;
}

export interface IndexerStatsResource {
  id: number;
  indexers?: IndexerStatistics[] | null;
  userAgents?: UserAgentStatistics[] | null;
  hosts?: HostStatistics[] | null;
}