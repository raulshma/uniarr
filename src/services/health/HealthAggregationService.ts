import type { SystemHealth } from "@/connectors/base/IConnector";
import type { ServiceType } from "@/models/service.types";
import type { HealthMessage } from "@/models/logger.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";

/**
 * Health status for a service or aggregated system
 */
export type HealthStatus = "healthy" | "degraded" | "offline" | "unknown";

/**
 * Summary of health status for a single service
 */
export interface ServiceHealthSummary {
  serviceId: string;
  serviceName: string;
  serviceType: ServiceType;
  status: HealthStatus;
  messages: HealthMessage[];
  uptime?: number;
  lastChecked: Date;
}

/**
 * Detailed health information for a single service
 */
export interface ServiceHealthDetail extends ServiceHealthSummary {
  rawHealth?: SystemHealth;
}

/**
 * Aggregated health status across all services
 */
export interface AggregatedHealth {
  overall: HealthStatus;
  services: ServiceHealthSummary[];
  criticalIssues: HealthMessage[];
  warnings: HealthMessage[];
  lastUpdated: Date;
}

/**
 * Callback function for health update subscriptions
 */
export type HealthUpdateCallback = (health: AggregatedHealth) => void;

/**
 * Service for aggregating health status from multiple services
 */
export class HealthAggregationService {
  private static instance: HealthAggregationService | null = null;
  private subscribers: Set<HealthUpdateCallback> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
  private lastAggregatedHealth: AggregatedHealth | null = null;

  private constructor() {}

  /**
   * Get singleton instance of HealthAggregationService
   */
  static getInstance(): HealthAggregationService {
    if (!HealthAggregationService.instance) {
      HealthAggregationService.instance = new HealthAggregationService();
    }
    return HealthAggregationService.instance;
  }

  /**
   * Aggregate health status from multiple services
   * @param serviceIds - Array of service IDs to query. If empty, queries all services.
   * @returns Aggregated health information
   */
  async aggregateHealth(serviceIds?: string[]): Promise<AggregatedHealth> {
    const manager = ConnectorManager.getInstance();
    const connectors = serviceIds
      ? serviceIds
          .map((id) => manager.getConnector(id))
          .filter((c) => c !== undefined)
      : manager.getAllConnectors();

    void logger.debug("Aggregating health from services", {
      serviceCount: connectors.length,
      serviceIds: connectors.map((c) => c.config.id),
    });

    // Query all services in parallel
    const healthResults = await Promise.allSettled(
      connectors.map(async (connector) => {
        try {
          const health = await connector.getHealth();
          return {
            connector,
            health,
          };
        } catch (error) {
          void logger.error("Failed to get health for service", {
            serviceId: connector.config.id,
            serviceType: connector.config.type,
            error: error instanceof Error ? error.message : String(error),
          });
          // Return degraded status for failed health checks
          return {
            connector,
            health: {
              status: "offline" as const,
              message:
                error instanceof Error ? error.message : "Health check failed",
              lastChecked: new Date(),
              messages: [],
            },
          };
        }
      }),
    );

    // Process results and build service summaries
    const services: ServiceHealthSummary[] = [];
    const allMessages: HealthMessage[] = [];

    for (const result of healthResults) {
      if (result.status === "fulfilled") {
        const { connector, health } = result.value;
        const messages = health.messages || [];

        // Add serviceId to each message if not present
        const messagesWithServiceId = messages.map((msg) => ({
          ...msg,
          serviceId: msg.serviceId || connector.config.id,
        }));

        services.push({
          serviceId: connector.config.id,
          serviceName: connector.config.name,
          serviceType: connector.config.type,
          status: health.status === "healthy" ? "healthy" : health.status,
          messages: messagesWithServiceId,
          lastChecked: health.lastChecked,
        });

        allMessages.push(...messagesWithServiceId);
      }
    }

    // Categorize messages by severity
    const criticalIssues = allMessages.filter(
      (msg) => msg.severity === "critical" || msg.severity === "error",
    );
    const warnings = allMessages.filter((msg) => msg.severity === "warning");

    // Determine overall health status
    const overall = this.calculateOverallHealth(services);

    const aggregatedHealth: AggregatedHealth = {
      overall,
      services,
      criticalIssues,
      warnings,
      lastUpdated: new Date(),
    };

    this.lastAggregatedHealth = aggregatedHealth;

    void logger.debug("Health aggregation complete", {
      overall,
      serviceCount: services.length,
      criticalCount: criticalIssues.length,
      warningCount: warnings.length,
    });

    return aggregatedHealth;
  }

  /**
   * Get detailed health information for a single service
   * @param serviceId - ID of the service to query
   * @returns Detailed health information
   */
  async getServiceHealth(serviceId: string): Promise<ServiceHealthDetail> {
    const manager = ConnectorManager.getInstance();
    const connector = manager.getConnector(serviceId);

    if (!connector) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    void logger.debug("Getting health for service", {
      serviceId,
      serviceType: connector.config.type,
    });

    try {
      const health = await connector.getHealth();
      const messages = health.messages || [];

      // Add serviceId to each message if not present
      const messagesWithServiceId = messages.map((msg) => ({
        ...msg,
        serviceId: msg.serviceId || connector.config.id,
      }));

      return {
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        serviceType: connector.config.type,
        status: health.status === "healthy" ? "healthy" : health.status,
        messages: messagesWithServiceId,
        lastChecked: health.lastChecked,
        rawHealth: health,
      };
    } catch (error) {
      void logger.error("Failed to get health for service", {
        serviceId,
        serviceType: connector.config.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        serviceId: connector.config.id,
        serviceName: connector.config.name,
        serviceType: connector.config.type,
        status: "offline",
        messages: [
          {
            id: `error-${Date.now()}`,
            serviceId: connector.config.id,
            severity: "error",
            message:
              error instanceof Error ? error.message : "Health check failed",
            timestamp: new Date(),
          },
        ],
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Subscribe to real-time health updates
   * @param callback - Function to call when health status changes
   * @returns Unsubscribe function
   */
  subscribeToHealthUpdates(callback: HealthUpdateCallback): () => void {
    this.subscribers.add(callback);

    void logger.debug("Health update subscriber added", {
      subscriberCount: this.subscribers.size,
    });

    // If this is the first subscriber, start the update interval
    if (this.subscribers.size === 1) {
      this.startUpdateInterval();
    }

    // Send current health immediately if available
    if (this.lastAggregatedHealth) {
      callback(this.lastAggregatedHealth);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);

      void logger.debug("Health update subscriber removed", {
        subscriberCount: this.subscribers.size,
      });

      // If no more subscribers, stop the update interval
      if (this.subscribers.size === 0) {
        this.stopUpdateInterval();
      }
    };
  }

  /**
   * Calculate overall health status from individual service statuses
   */
  private calculateOverallHealth(
    services: ServiceHealthSummary[],
  ): HealthStatus {
    if (services.length === 0) {
      return "unknown";
    }

    // If any service is offline, overall is degraded
    const hasOffline = services.some((s) => s.status === "offline");
    if (hasOffline) {
      return "degraded";
    }

    // If any service is degraded, overall is degraded
    const hasDegraded = services.some((s) => s.status === "degraded");
    if (hasDegraded) {
      return "degraded";
    }

    // If all services are healthy, overall is healthy
    const allHealthy = services.every((s) => s.status === "healthy");
    if (allHealthy) {
      return "healthy";
    }

    // Default to unknown
    return "unknown";
  }

  /**
   * Start the automatic update interval
   */
  private startUpdateInterval(): void {
    if (this.updateInterval) {
      return;
    }

    void logger.debug("Starting health update interval");

    // Update every 60 seconds
    this.updateInterval = setInterval(() => {
      void this.updateSubscribers();
    }, 60000);

    // Trigger initial update
    void this.updateSubscribers();
  }

  /**
   * Stop the automatic update interval
   */
  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;

      void logger.debug("Stopped health update interval");
    }
  }

  /**
   * Update all subscribers with latest health data
   */
  private async updateSubscribers(): Promise<void> {
    try {
      const health = await this.aggregateHealth();

      // Notify all subscribers
      for (const callback of this.subscribers) {
        try {
          callback(health);
        } catch (error) {
          void logger.error("Error in health update callback", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      void logger.error("Failed to update health subscribers", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.stopUpdateInterval();
    this.subscribers.clear();
    this.lastAggregatedHealth = null;

    void logger.debug("HealthAggregationService disposed");
  }
}
