import { BaseConnector } from "@/connectors/base/BaseConnector";
import type { SearchOptions, SystemHealth } from "@/connectors/base/IConnector";
import type { components } from "@/connectors/client-schemas/prowlarr-openapi";
import { handleApiError } from "@/utils/error.utils";
import type { NormalizedRelease } from "@/models/discover.types";
import { normalizeProwlarrRelease } from "@/services/ReleaseService";
import { logger } from "@/services/logger/LoggerService";
import type {
  LogQueryOptions,
  ServiceLog,
  ServiceLogLevel,
  HealthMessage,
  HealthMessageSeverity,
} from "@/models/logger.types";

// Map the project's previous manual types to the generated OpenAPI types
type ProwlarrIndexerResource = components["schemas"]["IndexerResource"];
type ProwlarrConnectedApplication =
  components["schemas"]["ApplicationResource"];
type ProwlarrApplicationBulkResource =
  components["schemas"]["ApplicationBulkResource"];
// Test endpoints in the generated spec don't return a typed body, so keep a
// small runtime-friendly shape for callers while avoiding references to
// non-existent generated schemas.
type ProwlarrTestResult = void | {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
};
type ProwlarrStatistics = {
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
type IndexerStatsResource = components["schemas"]["IndexerStatsResource"];
type IndexerStatistics = components["schemas"]["IndexerStatistics"];

/**
 * Prowlarr connector for managing indexers and applications
 */
export class ProwlarrConnector extends BaseConnector<
  ProwlarrIndexerResource,
  ProwlarrIndexerResource,
  Partial<ProwlarrIndexerResource>
> {
  async initialize(): Promise<void> {
    // Prowlarr initialization - mainly authentication check
    await this.ensureAuthenticated();
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get("/api");
      return response.data.version || "Unknown";
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
      });

      throw new Error(`Failed to get Prowlarr version: ${diagnostic.message}`);
    }
  }

  /**
   * Retrieve health status and messages from Prowlarr
   */
  override async getHealth(): Promise<SystemHealth> {
    try {
      const response =
        await this.client.get<components["schemas"]["HealthResource"][]>(
          "/api/v1/health",
        );

      const healthResources = response.data ?? [];

      // Map Prowlarr health resources to our HealthMessage format
      const messages: HealthMessage[] = healthResources.map((resource) => {
        // Map Prowlarr's HealthCheckResult to our severity levels
        const severityMap: Record<string, HealthMessageSeverity> = {
          ok: "info",
          notice: "info",
          warning: "warning",
          error: "error",
        };

        return {
          id: resource.id?.toString() ?? `health-${Date.now()}`,
          serviceId: this.config.id,
          severity: severityMap[resource.type ?? "notice"] ?? "info",
          message: resource.message ?? "Unknown health issue",
          timestamp: new Date(),
          source: resource.source ?? undefined,
          wikiUrl: resource.wikiUrl?.toString() ?? undefined,
        };
      });

      // Determine overall status based on health messages
      const hasErrors = messages.some((m) => m.severity === "error");
      const hasWarnings = messages.some((m) => m.severity === "warning");

      let status: "healthy" | "degraded" | "offline" = "healthy";
      let message = "Service is healthy";

      if (hasErrors) {
        status = "degraded";
        message = `Service has ${messages.filter((m) => m.severity === "error").length} error(s)`;
      } else if (hasWarnings) {
        status = "degraded";
        message = `Service has ${messages.filter((m) => m.severity === "warning").length} warning(s)`;
      }

      return {
        status,
        message,
        lastChecked: new Date(),
        messages,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHealth",
        endpoint: "/api/v1/health",
      });

      return {
        status: diagnostic.isNetworkError ? "offline" : "degraded",
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  // Indexer Management Methods (use /api/v1/indexer)

  /**
   * Get all applications (indexers)
   */
  async getIndexers(): Promise<ProwlarrIndexerResource[]> {
    try {
      const response = await this.client.get("/api/v1/indexer");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexers",
      });

      throw new Error(`Failed to get indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Get a specific application (indexer) by ID
   */
  async getIndexerById(id: number): Promise<ProwlarrIndexerResource> {
    try {
      const response = await this.client.get(`/api/v1/indexer/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexerById",
      });

      throw new Error(`Failed to get indexer ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Create a new application (indexer)
   */
  async addIndexer(
    application: ProwlarrIndexerResource,
  ): Promise<ProwlarrIndexerResource> {
    try {
      const response = await this.client.post("/api/v1/indexer", application);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "addIndexer",
      });

      throw new Error(`Failed to add indexer: ${diagnostic.message}`);
    }
  }

  /**
   * Update an existing application (indexer)
   */
  async updateIndexer(
    id: number,
    data: Partial<ProwlarrIndexerResource>,
  ): Promise<ProwlarrIndexerResource> {
    try {
      const response = await this.client.put(`/api/v1/indexer/${id}`, data);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateIndexer",
      });

      throw new Error(`Failed to update indexer ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Delete an application (indexer)
   */
  async deleteIndexer(id: number): Promise<boolean> {
    try {
      await this.client.delete(`/api/v1/indexer/${id}`);
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteIndexer",
      });

      throw new Error(`Failed to delete indexer ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Test a specific application (indexer)
   */
  async testIndexerConfig(
    application: ProwlarrIndexerResource,
  ): Promise<ProwlarrTestResult> {
    // Prepare a minimal payload that matches the API contract; some Prowlarr builds
    // are strict about the request body and will return 400 if extraneous or malformed
    // values are provided.
    const payload: Partial<components["schemas"]["IndexerResource"]> = {
      // Basic identity
      name: application.name,
      implementation: application.implementation,
      implementationName: application.implementationName,
      configContract: application.configContract,
      infoLink: application.infoLink,
      // Key flags
      enable: application.enable,
      priority: application.priority,
      // include syncLevel only when present on the source object (some payloads use application shape)
      ...("syncLevel" in application &&
      (application as unknown as Record<string, unknown>).syncLevel
        ? {
            syncLevel: (application as unknown as Record<string, unknown>)
              .syncLevel as unknown as string,
          }
        : {}),
      // Tags and fields (fields must be name/value pairs)
      tags: application.tags ?? [],
      fields: Array.isArray(application.fields)
        ? application.fields.map((f) => ({
            name: f.name ?? "",
            value: f.value,
          }))
        : [],
    };

    try {
      const response = await this.client.post("/api/v1/indexer/test", payload);
      return response.data;
    } catch (error) {
      // If API responds with 400, try to extract validation messages and include
      // them in the thrown error to make debugging easier in the client.
      const resp = (error as { response?: unknown })?.response as
        | { status?: number; data?: unknown }
        | undefined;
      if (resp && resp.status === 400 && resp.data) {
        // Prowlarr may return a body with message, errors, or model state
        const body = resp.data as unknown;
        let details = "";
        if (typeof body === "string") {
          details = body;
        } else if (body && typeof body === "object") {
          const b = body as Record<string, unknown>;
          if (typeof b.message === "string") details = b.message;

          if (b.errors && typeof b.errors === "object") {
            try {
              details += "\n" + JSON.stringify(b.errors, null, 2);
            } catch {
              details += "\n" + String(b.errors);
            }
          }

          if (b.modelState) {
            try {
              details += "\n" + JSON.stringify(b.modelState, null, 2);
            } catch {
              details += "\n" + String(b.modelState);
            }
          }
        }

        const diagnostic = handleApiError(error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: "testIndexerConfig",
        });

        throw new Error(
          `Failed to test indexer config: ${diagnostic.message}${
            details ? ` - Details: ${details}` : ""
          }`,
        );
      }

      // For other failures, attempt the applications/test endpoint as a fallback
      try {
        const fallbackResp = await this.client.post(
          "/api/v1/applications/test",
          payload,
        );
        return fallbackResp.data;
      } catch (fallbackErr) {
        const diagnostic = handleApiError(fallbackErr ?? error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: "testIndexerConfig",
        });

        throw new Error(`Failed to test indexer config: ${diagnostic.message}`);
      }
    }
  }

  /**
   * Test all applications (indexers)
   */
  async testAllIndexers(): Promise<ProwlarrTestResult[]> {
    try {
      const response = await this.client.post("/api/v1/indexer/testall");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "testAllIndexers",
      });

      throw new Error(`Failed to test all indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Enable or disable applications (indexers)
   */
  async bulkUpdateIndexers(
    bulkData: ProwlarrApplicationBulkResource,
  ): Promise<ProwlarrIndexerResource[]> {
    try {
      const response = await this.client.put("/api/v1/indexer/bulk", bulkData);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateIndexers",
      });

      throw new Error(`Failed to bulk update indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Delete multiple applications (indexers)
   */
  async bulkDeleteIndexers(ids: number[]): Promise<boolean> {
    try {
      await this.client.delete("/api/v1/indexer/bulk", {
        data: { ids },
      });
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkDeleteIndexers",
      });

      throw new Error(`Failed to bulk delete indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Get application schema (for creating/editing forms)
   */
  async getIndexerSchema(): Promise<ProwlarrIndexerResource[]> {
    try {
      const response = await this.client.get("/api/v1/indexer/schema");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexerSchema",
      });

      throw new Error(`Failed to get indexer schema: ${diagnostic.message}`);
    }
  }

  /**
   * Execute action on applications (e.g., sync, rescan)
   */
  async executeCommand(
    commandName: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.client.post("/api/v1/command", {
        name: commandName,
        ...(payload ?? {}),
      });
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "executeCommand",
      });

      throw new Error(
        `Failed to execute command ${commandName}: ${diagnostic.message}`,
      );
    }
  }

  /**
   * Search for releases across configured indexers.
   * Supports search via query string, TMDB ID, IMDB ID, or title+year.
   */
  async searchReleases(options?: {
    query?: string;
    tmdbId?: number;
    imdbId?: string;
    title?: string;
    year?: number;
    indexerIds?: number[];
    minSeeders?: number;
  }): Promise<NormalizedRelease[]> {
    try {
      const params: Record<string, unknown> = {};

      // Build search parameters from provided options
      if (options?.query) {
        params.query = options.query;
      } else if (options?.tmdbId) {
        params.tmdbId = options.tmdbId;
      } else if (options?.imdbId) {
        params.imdbId = options.imdbId;
      } else if (options?.title) {
        params.query = options.year
          ? `${options.title} ${options.year}`
          : options.title;
      }

      if (options?.indexerIds && options.indexerIds.length > 0) {
        params.indexerIds = options.indexerIds.join(",");
      }

      // Use /api/v1/search endpoint to query all or specified indexers
      const response = await this.client.get("/api/v1/search", { params });

      if (!Array.isArray(response.data)) {
        logger.warn("[ProwlarrConnector] Invalid search response format", {
          serviceId: this.config.id,
          dataType: typeof response.data,
        });
        return [];
      }

      return response.data
        .filter((r: any) => {
          if (options?.minSeeders !== undefined && r.seeders !== null) {
            return (r.seeders ?? 0) >= options.minSeeders;
          }
          return true;
        })
        .map((r: any) => normalizeProwlarrRelease(r, this.config.id));
    } catch (error) {
      logger.warn("[ProwlarrConnector] Release search failed", {
        serviceId: this.config.id,
        operation: "searchReleases",
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty array on error instead of throwing
      // so discover detail page doesn't break if indexer search fails
      return [];
    }
  }

  /**
   * Get application statistics (indexer performance)
   */
  async getIndexerStatistics(): Promise<ProwlarrStatistics[]> {
    try {
      const response = await this.client.get("/api/v1/indexerstats");
      const statsResource: IndexerStatsResource = response.data;

      // Transform to the expected ProwlarrStatistics format. The generated
      // types mark many numeric fields as optional; normalize them to safe
      // values and skip entries that lack an indexer id.
      const indexers = statsResource.indexers ?? [];
      return indexers
        .filter((s) => s.indexerId != null)
        .map((s: IndexerStatistics) => ({
          applicationId: s.indexerId as number,
          applicationName: s.indexerName ?? "",
          statistics: {
            queries: s.numberOfQueries ?? 0,
            grabs: s.numberOfGrabs ?? 0,
            averageResponseTime: s.averageResponseTime ?? undefined,
            lastQueryTime: undefined, // Not available in this endpoint
            lastGrabTime: undefined, // Not available in this endpoint
          },
        }));
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexerStatistics",
      });

      throw new Error(
        `Failed to get application statistics: ${diagnostic.message}`,
      );
    }
  }

  /**
   * Sync indexers to connected applications (Sonarr, Radarr, etc.)
   */
  async syncIndexersToApps(): Promise<void> {
    try {
      await this.executeCommand("ApplicationIndexerSync");
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "syncIndexersToApps",
      });

      throw new Error(`Failed to sync indexers to apps: ${diagnostic.message}`);
    }
  }

  /**
   * Rescan all indexers for new content
   */
  async rescanIndexers(): Promise<void> {
    try {
      await this.executeCommand("IndexerRss");
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanIndexers",
      });

      throw new Error(`Failed to rescan indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Get indexer sync status and connected applications
   */
  async getSyncStatus(): Promise<{
    connectedApps: string[];
    lastSyncTime?: string;
    syncInProgress: boolean;
  }> {
    try {
      // Fetch configured applications (these represent connected apps like Sonarr/Radarr)
      const appsResp = await this.client.get("/api/v1/applications");
      const applications: ProwlarrConnectedApplication[] = appsResp.data ?? [];

      // Fetch recent commands to determine whether a sync is currently queued/started
      // and to derive the last sync time. The /api/v1/command endpoint returns command
      // records that include commandName and timestamp fields.
      let commands: components["schemas"]["CommandResource"][] = [];
      try {
        const cmdResp = await this.client.get("/api/v1/command");
        if (Array.isArray(cmdResp.data)) {
          commands = cmdResp.data as components["schemas"]["CommandResource"][];
        } else if (cmdResp.data) {
          const maybePaging = cmdResp.data as { records?: unknown };
          if (Array.isArray(maybePaging.records)) {
            commands =
              maybePaging.records as components["schemas"]["CommandResource"][];
          }
        }
      } catch {
        // Non-fatal - commands may not be available on all Prowlarr builds
        commands = [];
      }

      let connectedApps = applications
        .map((a) => a.name)
        .filter(Boolean) as string[];

      // Some Prowlarr variants expose application profiles separately; try to fetch those
      if (connectedApps.length === 0) {
        try {
          const profilesResp = await this.client.get("/api/v1/appprofile");
          const profiles = (profilesResp.data ??
            []) as components["schemas"]["AppProfileResource"][];
          const profileNames = (Array.isArray(profiles) ? profiles : [])
            .map((p) => p.name)
            .filter(Boolean) as string[];
          if (profileNames.length > 0) connectedApps = profileNames;
        } catch {
          // ignore - appprofile endpoint may not be present on all versions
        }
      }

      // Look for ApplicationIndexerSync command entries to determine status and last run
      const syncCommands = commands.filter(
        (c) => c.commandName === "ApplicationIndexerSync",
      );
      const syncInProgress = syncCommands.some((c) =>
        ["queued", "started"].includes(String(c.status ?? "")),
      );

      // Derive last sync time from the most recent completed/started command if available
      let lastSyncTime: string | undefined;
      if (syncCommands.length > 0) {
        const timestamps = syncCommands
          .map((c) => c.ended ?? c.started ?? c.queued)
          .filter((t): t is string => !!t)
          .map((t) => new Date(t).getTime())
          .filter((n) => !Number.isNaN(n));
        if (timestamps.length > 0) {
          lastSyncTime = new Date(Math.max(...timestamps)).toISOString();
        }
      }

      return {
        connectedApps,
        lastSyncTime,
        syncInProgress,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSyncStatus",
      });

      throw new Error(`Failed to get sync status: ${diagnostic.message}`);
    }
  }

  // Backward-compatible method names to avoid breaking existing callers
  async getApplications(): Promise<ProwlarrConnectedApplication[]> {
    try {
      const response = await this.client.get("/api/v1/applications");
      return response.data ?? [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getApplications",
      });
      throw new Error(`Failed to get applications: ${diagnostic.message}`);
    }
  }

  async getApplicationById(id: number): Promise<ProwlarrConnectedApplication> {
    try {
      const response = await this.client.get(`/api/v1/applications/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getApplicationById",
      });
      throw new Error(`Failed to get application ${id}: ${diagnostic.message}`);
    }
  }

  async add(
    application: ProwlarrConnectedApplication,
  ): Promise<ProwlarrConnectedApplication> {
    try {
      const response = await this.client.post(
        "/api/v1/applications",
        application,
      );
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "addApplication",
      });
      throw new Error(`Failed to add application: ${diagnostic.message}`);
    }
  }

  async update(
    id: number,
    data: Partial<ProwlarrConnectedApplication>,
  ): Promise<ProwlarrConnectedApplication> {
    try {
      const response = await this.client.put(
        `/api/v1/applications/${id}`,
        data,
      );
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateApplication",
      });
      throw new Error(
        `Failed to update application ${id}: ${diagnostic.message}`,
      );
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.client.delete(`/api/v1/applications/${id}`);
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteApplication",
      });
      throw new Error(
        `Failed to delete application ${id}: ${diagnostic.message}`,
      );
    }
  }

  async testApplication(
    application: ProwlarrConnectedApplication,
  ): Promise<ProwlarrTestResult> {
    try {
      const response = await this.client.post(
        "/api/v1/applications/test",
        application,
      );
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "testApplication",
      });
      throw new Error(`Failed to test application: ${diagnostic.message}`);
    }
  }

  async testAllApplications(): Promise<ProwlarrTestResult[]> {
    try {
      const response = await this.client.post("/api/v1/applications/testall");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "testAllApplications",
      });
      throw new Error(`Failed to test all applications: ${diagnostic.message}`);
    }
  }

  async bulkUpdateApplications(
    bulkData: ProwlarrApplicationBulkResource,
  ): Promise<ProwlarrConnectedApplication[]> {
    try {
      const response = await this.client.put(
        "/api/v1/applications/bulk",
        bulkData,
      );
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateApplications",
      });
      throw new Error(
        `Failed to bulk update applications: ${diagnostic.message}`,
      );
    }
  }

  async bulkDeleteApplications(ids: number[]): Promise<boolean> {
    try {
      await this.client.delete("/api/v1/applications/bulk", { data: { ids } });
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkDeleteApplications",
      });
      throw new Error(
        `Failed to bulk delete applications: ${diagnostic.message}`,
      );
    }
  }

  async getApplicationSchema(): Promise<ProwlarrConnectedApplication[]> {
    try {
      const response = await this.client.get("/api/v1/applications/schema");
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getApplicationSchema",
      });
      throw new Error(
        `Failed to get application schema: ${diagnostic.message}`,
      );
    }
  }

  async getApplicationStatistics(): Promise<ProwlarrStatistics[]> {
    // No dedicated application statistics endpoint; fall back to indexer statistics
    return this.getIndexerStatistics();
  }

  // Search functionality for unified search integration
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<ProwlarrIndexerResource[]> {
    // Prowlarr doesn't have a traditional search API like Sonarr/Radarr
    // This would typically be used for searching available indexers or configurations
    // For now, return empty array as Prowlarr search is different from media search
    return [];
  }

  /**
   * Retrieve logs from Prowlarr using the /api/v1/log endpoint.
   * Supports pagination, level filtering, and time range filtering.
   * Handles Prowlarr v1 API differences.
   */
  override async getLogs(options?: LogQueryOptions): Promise<ServiceLog[]> {
    try {
      const params: Record<string, unknown> = {
        pageSize: options?.limit ?? 50,
        page: options?.startIndex
          ? Math.floor(options.startIndex / (options.limit ?? 50)) + 1
          : 1,
        sortKey: "time",
        sortDirection: "descending",
      };

      // Add level filter if specified
      if (options?.level && options.level.length > 0) {
        // Prowlarr uses uppercase level names (same as Sonarr/Radarr)
        params.level = options.level.map((l) => l.toUpperCase()).join(",");
      }

      // Note: Prowlarr's /api/v1/log endpoint doesn't support time range filtering via query params
      // We'll filter by time after fetching if needed
      const response = await this.client.get<
        components["schemas"]["LogResourcePagingResource"]
      >("/api/v1/log", { params });

      const logs = (response.data.records ?? []).map((log) =>
        this.normalizeLogEntry(log),
      );

      // Apply time range filtering if specified
      let filteredLogs = logs;
      if (options?.since || options?.until) {
        filteredLogs = logs.filter((log) => {
          if (options.since && log.timestamp < options.since) {
            return false;
          }
          if (options.until && log.timestamp > options.until) {
            return false;
          }
          return true;
        });
      }

      // Apply search term filtering if specified
      if (options?.searchTerm) {
        const searchLower = options.searchTerm.toLowerCase();
        filteredLogs = filteredLogs.filter(
          (log) =>
            log.message.toLowerCase().includes(searchLower) ||
            log.logger?.toLowerCase().includes(searchLower) ||
            log.exception?.toLowerCase().includes(searchLower),
        );
      }

      return filteredLogs;
    } catch (error) {
      logger.error("[ProwlarrConnector] Failed to retrieve logs", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getLogs",
        endpoint: "/api/v1/log",
      });
    }
  }

  /**
   * Normalize a Prowlarr log entry to the unified ServiceLog format.
   */
  private normalizeLogEntry(
    log: components["schemas"]["LogResource"],
  ): ServiceLog {
    return {
      id: `prowlarr-${this.config.id}-${log.id ?? Date.now()}`,
      serviceId: this.config.id,
      serviceName: this.config.name,
      serviceType: this.config.type,
      timestamp: log.time ? new Date(log.time) : new Date(),
      level: this.normalizeProwlarrLogLevel(log.level),
      message: log.message ?? "",
      exception: log.exception ?? undefined,
      logger: log.logger ?? undefined,
      method: log.method ?? undefined,
      raw: JSON.stringify(log),
      metadata: {
        exceptionType: log.exceptionType,
      },
    };
  }

  /**
   * Normalize Prowlarr log level to the unified ServiceLogLevel format.
   */
  private normalizeProwlarrLogLevel(level?: string | null): ServiceLogLevel {
    if (!level) {
      return "info";
    }

    const levelLower = level.toLowerCase();
    switch (levelLower) {
      case "trace":
        return "trace";
      case "debug":
        return "debug";
      case "info":
        return "info";
      case "warn":
      case "warning":
        return "warn";
      case "error":
        return "error";
      case "fatal":
        return "fatal";
      default:
        return "info";
    }
  }
}
