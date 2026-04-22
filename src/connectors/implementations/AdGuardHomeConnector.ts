import { BaseConnector } from "@/connectors/base/BaseConnector";
import type {
  AdGuardDashboardOverview,
  AdGuardDashboardStats,
  AdGuardQueryLogParams,
  AdGuardQueryLogResult,
  AdGuardStats,
  AdGuardTopArrayEntry,
  AdGuardTopEntry,
  AdGuardServerStatus,
} from "@/models/adguard.types";
import type { SystemHealth } from "@/connectors/base/IConnector";
import { handleApiError } from "@/utils/error.utils";

// All endpoints use the /control prefix as per AdGuard Home OpenAPI spec (server path: /control)
const STATUS_ENDPOINT = "/control/status";
const STATS_ENDPOINT = "/control/stats";
const PROTECTION_ENDPOINT = "/control/protection";
const FILTER_REFRESH_ENDPOINT = "/control/filtering/refresh";
const QUERY_LOG_ENDPOINT = "/control/querylog";
const QUERY_LOG_CLEAR_ENDPOINT = "/control/querylog_clear";

/**
 * Connector responsible for interacting with the AdGuard Home REST API.
 */
export class AdGuardHomeConnector extends BaseConnector {
  async initialize(): Promise<void> {
    await this.ensureAuthenticated();
    await this.getServerStatus();
  }

  /**
   * Override getHealth to use AdGuard Home's /control/status endpoint
   * instead of the generic /health endpoint which doesn't exist in AdGuard Home.
   */
  override async getHealth(): Promise<SystemHealth> {
    try {
      const response =
        await this.client.get<AdGuardServerStatus>(STATUS_ENDPOINT);

      return {
        status: response.data.running ? "healthy" : "degraded",
        message: response.data.running
          ? "AdGuard Home is running."
          : "AdGuard Home is not running.",
        lastChecked: new Date(),
        details: {
          running: response.data.running,
          version: response.data.version,
          protectionEnabled: response.data.protection_enabled,
          dnsPort: response.data.dns_port,
          httpPort: response.data.http_port,
        },
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHealth",
        endpoint: STATUS_ENDPOINT,
      });

      return {
        status: diagnostic.isNetworkError ? "offline" : "degraded",
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  async getVersion(): Promise<string> {
    const status = await this.getServerStatus();
    return status.version ?? "unknown";
  }

  async getServerStatus(options?: {
    readonly signal?: AbortSignal;
  }): Promise<AdGuardServerStatus> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get<AdGuardServerStatus>(
        STATUS_ENDPOINT,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getServerStatus",
        endpoint: STATUS_ENDPOINT,
      });
    }
  }

  async getStats(options?: {
    readonly signal?: AbortSignal;
  }): Promise<AdGuardStats> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get<AdGuardStats>(
        STATS_ENDPOINT,
        this.toAxiosConfig(options),
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getStats",
        endpoint: STATS_ENDPOINT,
      });
    }
  }

  async toggleProtection(
    enabled: boolean,
    duration?: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.client.post(
        PROTECTION_ENDPOINT,
        {
          enabled,
          duration,
        },
        { signal: options?.signal },
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "toggleProtection",
        endpoint: PROTECTION_ENDPOINT,
      });
    }
  }

  async refreshFilters(
    filterOptions?: { whitelist?: boolean },
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.client.post(
        FILTER_REFRESH_ENDPOINT,
        {
          whitelist: filterOptions?.whitelist ?? false,
        },
        { signal: options?.signal },
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "refreshFilters",
        endpoint: FILTER_REFRESH_ENDPOINT,
      });
    }
  }

  async getQueryLog(
    params?: AdGuardQueryLogParams,
    options?: { readonly signal?: AbortSignal },
  ): Promise<AdGuardQueryLogResult> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get(QUERY_LOG_ENDPOINT, {
        params: {
          limit: params?.limit,
          offset: params?.offset,
          older_than: params?.olderThan,
          search: params?.search,
          response_status: params?.responseStatus,
        },
        signal: options?.signal,
      });

      const data = response.data;
      const items = Array.isArray(data?.data) ? data.data : [];

      return {
        items,
        oldest: typeof data?.oldest === "string" ? data.oldest : undefined,
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getQueryLog",
        endpoint: QUERY_LOG_ENDPOINT,
      });
    }
  }

  async clearQueryLog(options?: {
    readonly signal?: AbortSignal;
  }): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.client.post(QUERY_LOG_CLEAR_ENDPOINT, undefined, {
        signal: options?.signal,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "clearQueryLog",
        endpoint: QUERY_LOG_CLEAR_ENDPOINT,
      });
    }
  }

  async getDashboardOverview(options?: {
    readonly signal?: AbortSignal;
  }): Promise<AdGuardDashboardOverview> {
    await this.ensureAuthenticated();

    const [status, stats] = await Promise.all([
      this.getServerStatus(options),
      this.getStats(options),
    ]);

    const dashboardStats: AdGuardDashboardStats = {
      dnsQueries: stats.num_dns_queries ?? 0,
      adsBlocked: stats.num_blocked_filtering ?? 0,
      trackersBlocked: stats.num_replaced_safebrowsing ?? 0,
      avgProcessingTimeSeconds: stats.avg_processing_time ?? undefined,
      blockedPercentage: this.calculateBlockedPercentage(
        stats.num_blocked_filtering,
        stats.num_dns_queries,
      ),
      topBlockedDomains: this.mapTopEntries(
        stats.top_blocked_domains,
        "Blocked Domain",
      ),
      topQueriedDomains: this.mapTopEntries(
        stats.top_queried_domains,
        "Domain",
      ),
      topClients: this.mapTopEntries(stats.top_clients, "Client"),
    };

    return {
      status,
      stats: dashboardStats,
      rawStats: stats,
      fetchedAt: new Date(),
    };
  }

  private mapTopEntries(
    entries: AdGuardTopArrayEntry[] | undefined,
    fallbackLabel: string,
  ): AdGuardTopEntry[] {
    if (!entries || entries.length === 0) {
      return [];
    }

    return entries
      .map((entry, index) => {
        const dynamicEntry = Object.entries(entry).find(
          ([key]) => key !== "domain_or_ip",
        );

        const [rawName, rawValue] = dynamicEntry ?? [];
        const fallbackName =
          this.extractDomainOrIp(entry) ?? `${fallbackLabel} ${index + 1}`;
        const name =
          typeof rawName === "string" && rawName.length > 0
            ? rawName
            : fallbackName;
        const count = this.parseCount(rawValue);

        return {
          name,
          count,
        };
      })
      .filter((item) => item.name && item.name.length > 0)
      .sort((a, b) => b.count - a.count);
  }

  private extractDomainOrIp(entry: AdGuardTopArrayEntry): string | undefined {
    const candidate = (entry as Record<string, unknown>).domain_or_ip;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }

    return undefined;
  }

  private parseCount(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  private calculateBlockedPercentage(blocked?: number, total?: number): number {
    if (!blocked || !total || total <= 0) {
      return 0;
    }

    return Number(((blocked / total) * 100).toFixed(1));
  }
}
