import type { ServiceConfig, ServiceType } from "@/models/service.types";

/**
 * Options supported by connector-level search operations. Specific connectors can extend this shape.
 */
export interface SearchOptions {
  /** Optional filter map passed to the underlying service. */
  readonly filters?: Record<string, unknown>;
  /**
   * Optional pagination details for services that support paged responses.
   */
  readonly pagination?: {
    readonly page?: number;
    readonly pageSize?: number;
  };
  /** Optional flag to request cached results where the service supports it. */
  readonly skipCache?: boolean;
}

/**
 * Base payload for creating items within a connector. Implementations can extend this contract.
 */
export interface AddItemRequest {
  /** Identifier of the target library or root folder in the remote service. */
  readonly targetId?: string;
  /** Arbitrary payload forwarded to the remote service. */
  readonly payload?: Record<string, unknown>;
}

/**
 * Result of a connector connection test, including optional diagnostics data.
 */
export interface ConnectionResult {
  readonly success: boolean;
  readonly message?: string;
  readonly latency?: number;
  readonly version?: string;
}

/**
 * Represents the health state returned by a connector's health endpoint.
 */
export interface SystemHealth {
  readonly status: "healthy" | "degraded" | "offline";
  readonly message?: string;
  readonly lastChecked: Date;
  readonly details?: Record<string, unknown>;
}

/**
 * Generic contract that all service connectors must satisfy.
 */
export interface IConnector<
  TResource = unknown,
  TCreatePayload = AddItemRequest,
  TUpdatePayload = Partial<TResource>,
> {
  /** Persisted configuration for the connector instance. */
  readonly config: ServiceConfig;

  /** Perform any async initialization required before usage (e.g. auth checks). */
  initialize(): Promise<void>;

  /** Dispose of resources such as timers or subscriptions. */
  dispose(): void;

  /** Attempt to reach the remote service and provide diagnostic information. */
  testConnection(): Promise<ConnectionResult>;

  /** Retrieve the remote service health summary. */
  getHealth(): Promise<SystemHealth>;

  /** Retrieve the remote service version string when available. */
  getVersion(): Promise<string>;

  /** Optional search method used by services that expose search APIs. */
  search?(query: string, options?: SearchOptions): Promise<TResource[]>;

  /** Optional detail fetcher for retrieving a single resource by identifier. */
  getById?(id: string | number): Promise<TResource>;

  /** Optional create method for provisioning new resources. */
  add?(item: TCreatePayload): Promise<TResource>;

  /** Optional update method for modifying an existing resource. */
  update?(id: string | number, data: TUpdatePayload): Promise<TResource>;

  /** Optional delete method for removing a resource from the remote service. */
  delete?(id: string | number): Promise<boolean>;
}

export type { ServiceConfig, ServiceType };
