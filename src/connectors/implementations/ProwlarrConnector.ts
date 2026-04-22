import { BaseConnector } from "@/connectors/base/BaseConnector";
import type {
  SearchOptions,
  SystemHealth,
  ConnectorRequestOptions,
} from "@/connectors/base/IConnector";
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

type ProwlarrIndexerResource = components["schemas"]["IndexerResource"];
type ProwlarrConnectedApplication =
  components["schemas"]["ApplicationResource"];
type ProwlarrApplicationBulkResource =
  components["schemas"]["ApplicationBulkResource"];
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

export class ProwlarrConnector extends BaseConnector<
  ProwlarrIndexerResource,
  ProwlarrIndexerResource,
  Partial<ProwlarrIndexerResource>
> {
  async initialize(): Promise<void> {
    await this.ensureAuthenticated();
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get("/api");
      return response.data.version || "Unknown";
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
      });
    }
  }

  override async getHealth(): Promise<SystemHealth> {
    try {
      const response =
        await this.client.get<components["schemas"]["HealthResource"][]>(
          "/api/v1/health",
        );

      const healthResources = response.data ?? [];

      const messages: HealthMessage[] = healthResources.map((resource) => {
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

  async getIndexers(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrIndexerResource[]> {
    try {
      const response = await this.client.get(
        "/api/v1/indexer",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexers",
      });
    }
  }

  async getIndexerById(
    id: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrIndexerResource> {
    try {
      const response = await this.client.get(
        `/api/v1/indexer/${id}`,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexerById",
      });
    }
  }

  async addIndexer(
    application: ProwlarrIndexerResource,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrIndexerResource> {
    try {
      const response = await this.client.post(
        "/api/v1/indexer",
        application,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "addIndexer",
      });
    }
  }

  async updateIndexer(
    id: number,
    data: Partial<ProwlarrIndexerResource>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrIndexerResource> {
    try {
      const response = await this.client.put(
        `/api/v1/indexer/${id}`,
        data,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateIndexer",
      });
    }
  }

  async deleteIndexer(
    id: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<boolean> {
    try {
      await this.client.delete(
        `/api/v1/indexer/${id}`,
        this.toAxiosConfig(options),
      );
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteIndexer",
      });
    }
  }

  async testIndexerConfig(
    application: ProwlarrIndexerResource,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrTestResult> {
    const payload: Partial<components["schemas"]["IndexerResource"]> = {
      name: application.name,
      implementation: application.implementation,
      implementationName: application.implementationName,
      configContract: application.configContract,
      infoLink: application.infoLink,
      enable: application.enable,
      priority: application.priority,
      ...("syncLevel" in application &&
      (application as unknown as Record<string, unknown>).syncLevel
        ? {
            syncLevel: (application as unknown as Record<string, unknown>)
              .syncLevel as unknown as string,
          }
        : {}),
      tags: application.tags ?? [],
      fields: Array.isArray(application.fields)
        ? application.fields.map((f) => ({
            name: f.name ?? "",
            value: f.value,
          }))
        : [],
    };

    try {
      const response = await this.client.post(
        "/api/v1/indexer/test",
        payload,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      const resp = (error as { response?: unknown })?.response as
        | { status?: number; data?: unknown }
        | undefined;
      if (resp && resp.status === 400 && resp.data) {
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

        throw handleApiError(error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: "testIndexerConfig",
        });
      }

      try {
        const fallbackResp = await this.client.post(
          "/api/v1/applications/test",
          payload,
          this.toAxiosConfig(options),
        );
        return fallbackResp.data;
      } catch (fallbackErr) {
        throw handleApiError(fallbackErr ?? error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: "testIndexerConfig",
        });
      }
    }
  }

  async testAllIndexers(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrTestResult[]> {
    try {
      const response = await this.client.post(
        "/api/v1/indexer/testall",
        undefined,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "testAllIndexers",
      });
    }
  }

  async bulkUpdateIndexers(
    bulkData: ProwlarrApplicationBulkResource,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrIndexerResource[]> {
    try {
      const response = await this.client.put(
        "/api/v1/indexer/bulk",
        bulkData,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateIndexers",
      });
    }
  }

  async bulkDeleteIndexers(
    ids: number[],
    options?: { readonly signal?: AbortSignal },
  ): Promise<boolean> {
    try {
      await this.client.delete("/api/v1/indexer/bulk", {
        data: { ids },
        ...this.toAxiosConfig(options),
      });
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkDeleteIndexers",
      });
    }
  }

  async getIndexerSchema(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrIndexerResource[]> {
    try {
      const response = await this.client.get(
        "/api/v1/indexer/schema",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexerSchema",
      });
    }
  }

  async executeCommand(
    commandName: string,
    payload?: Record<string, unknown>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    try {
      await this.client.post(
        "/api/v1/command",
        {
          name: commandName,
          ...(payload ?? {}),
        },
        this.toAxiosConfig(options),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "executeCommand",
      });
    }
  }

  async searchReleases(
    searchOptions?: {
      query?: string;
      tmdbId?: number;
      imdbId?: string;
      title?: string;
      year?: number;
      indexerIds?: number[];
      minSeeders?: number;
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<NormalizedRelease[]> {
    try {
      const params: Record<string, unknown> = {};

      if (searchOptions?.query) {
        params.query = searchOptions.query;
      } else if (searchOptions?.tmdbId) {
        params.tmdbId = searchOptions.tmdbId;
      } else if (searchOptions?.imdbId) {
        params.imdbId = searchOptions.imdbId;
      } else if (searchOptions?.title) {
        params.query = searchOptions.year
          ? `${searchOptions.title} ${searchOptions.year}`
          : searchOptions.title;
      }

      if (searchOptions?.indexerIds && searchOptions.indexerIds.length > 0) {
        params.indexerIds = searchOptions.indexerIds.join(",");
      }

      const response = await this.client.get("/api/v1/search", {
        params,
        ...this.toAxiosConfig(options),
      });

      if (!Array.isArray(response.data)) {
        logger.warn("[ProwlarrConnector] Invalid search response format", {
          serviceId: this.config.id,
          dataType: typeof response.data,
        });
        return [];
      }

      return response.data
        .filter((r: any) => {
          if (searchOptions?.minSeeders !== undefined && r.seeders !== null) {
            return (r.seeders ?? 0) >= searchOptions.minSeeders;
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

      return [];
    }
  }

  async getIndexerStatistics(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrStatistics[]> {
    try {
      const response = await this.client.get(
        "/api/v1/indexerstats",
        this.toAxiosConfig(options),
      );
      const statsResource: IndexerStatsResource = response.data;

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
            lastQueryTime: undefined,
            lastGrabTime: undefined,
          },
        }));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getIndexerStatistics",
      });
    }
  }

  async syncIndexersToApps(options?: {
    readonly signal?: AbortSignal;
  }): Promise<void> {
    try {
      await this.executeCommand("ApplicationIndexerSync", undefined, options);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "syncIndexersToApps",
      });
    }
  }

  async rescanIndexers(options?: {
    readonly signal?: AbortSignal;
  }): Promise<void> {
    try {
      await this.executeCommand("IndexerRss", undefined, options);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "rescanIndexers",
      });
    }
  }

  async getSyncStatus(options?: { readonly signal?: AbortSignal }): Promise<{
    connectedApps: string[];
    lastSyncTime?: string;
    syncInProgress: boolean;
  }> {
    try {
      const appsResp = await this.client.get(
        "/api/v1/applications",
        this.toAxiosConfig(options),
      );
      const applications: ProwlarrConnectedApplication[] = appsResp.data ?? [];

      let commands: components["schemas"]["CommandResource"][] = [];
      try {
        const cmdResp = await this.client.get(
          "/api/v1/command",
          this.toAxiosConfig(options),
        );
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
        commands = [];
      }

      let connectedApps = applications
        .map((a) => a.name)
        .filter(Boolean) as string[];

      if (connectedApps.length === 0) {
        try {
          const profilesResp = await this.client.get(
            "/api/v1/appprofile",
            this.toAxiosConfig(options),
          );
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

      const syncCommands = commands.filter(
        (c) => c.commandName === "ApplicationIndexerSync",
      );
      const syncInProgress = syncCommands.some((c) =>
        ["queued", "started"].includes(String(c.status ?? "")),
      );

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
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getSyncStatus",
      });
    }
  }

  async getApplications(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrConnectedApplication[]> {
    try {
      const response = await this.client.get(
        "/api/v1/applications",
        this.toAxiosConfig(options),
      );
      return response.data ?? [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getApplications",
      });
    }
  }

  async getApplicationById(
    id: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrConnectedApplication> {
    try {
      const response = await this.client.get(
        `/api/v1/applications/${id}`,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getApplicationById",
      });
    }
  }

  async add(
    application: ProwlarrConnectedApplication,
    options?: ConnectorRequestOptions,
  ): Promise<ProwlarrConnectedApplication> {
    try {
      const response = await this.client.post(
        "/api/v1/applications",
        application,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "addApplication",
      });
    }
  }

  async update(
    id: number,
    data: Partial<ProwlarrConnectedApplication>,
    options?: ConnectorRequestOptions,
  ): Promise<ProwlarrConnectedApplication> {
    try {
      const response = await this.client.put(
        `/api/v1/applications/${id}`,
        data,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "updateApplication",
      });
    }
  }

  async delete(
    id: number,
    options?: ConnectorRequestOptions,
  ): Promise<boolean> {
    try {
      await this.client.delete(
        `/api/v1/applications/${id}`,
        this.toAxiosConfig(options),
      );
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteApplication",
      });
    }
  }

  async testApplication(
    application: ProwlarrConnectedApplication,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrTestResult> {
    try {
      const response = await this.client.post(
        "/api/v1/applications/test",
        application,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "testApplication",
      });
    }
  }

  async testAllApplications(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrTestResult[]> {
    try {
      const response = await this.client.post(
        "/api/v1/applications/testall",
        undefined,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "testAllApplications",
      });
    }
  }

  async bulkUpdateApplications(
    bulkData: ProwlarrApplicationBulkResource,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ProwlarrConnectedApplication[]> {
    try {
      const response = await this.client.put(
        "/api/v1/applications/bulk",
        bulkData,
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkUpdateApplications",
      });
    }
  }

  async bulkDeleteApplications(
    ids: number[],
    options?: { readonly signal?: AbortSignal },
  ): Promise<boolean> {
    try {
      await this.client.delete("/api/v1/applications/bulk", {
        data: { ids },
        ...this.toAxiosConfig(options),
      });
      return true;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "bulkDeleteApplications",
      });
    }
  }

  async getApplicationSchema(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrConnectedApplication[]> {
    try {
      const response = await this.client.get(
        "/api/v1/applications/schema",
        this.toAxiosConfig(options),
      );
      return response.data || [];
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getApplicationSchema",
      });
    }
  }

  async getApplicationStatistics(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ProwlarrStatistics[]> {
    return this.getIndexerStatistics(options);
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<ProwlarrIndexerResource[]> {
    return [];
  }

  override async getLogs(
    options?: LogQueryOptions,
    requestOptions?: { readonly signal?: AbortSignal },
  ): Promise<ServiceLog[]> {
    try {
      const params: Record<string, unknown> = {
        pageSize: options?.limit ?? 50,
        page: options?.startIndex
          ? Math.floor(options.startIndex / (options.limit ?? 50)) + 1
          : 1,
        sortKey: "time",
        sortDirection: "descending",
      };

      if (options?.level && options.level.length > 0) {
        params.level = options.level.map((l) => l.toUpperCase()).join(",");
      }

      const response = await this.client.get<
        components["schemas"]["LogResourcePagingResource"]
      >("/api/v1/log", { params, ...this.toAxiosConfig(requestOptions) });

      const logs = (response.data.records ?? []).map((log) =>
        this.normalizeLogEntry(log),
      );

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
