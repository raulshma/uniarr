import { useCallback, useEffect, useState } from "react";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { components } from "@/connectors/client-schemas/prowlarr-openapi";
import { logger } from "@/services/logger/LoggerService";

type ProwlarrIndexerResource = components["schemas"]["IndexerResource"];
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

interface UseProwlarrIndexersResult {
  indexers: ProwlarrIndexerResource[];
  statistics: ProwlarrStatistics[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  testIndexer: (
    indexer: ProwlarrIndexerResource,
  ) => Promise<{ ok: boolean; message?: string }>;
  toggleIndexer: (indexer: ProwlarrIndexerResource) => Promise<boolean>;
  deleteIndexer: (indexerId: number) => Promise<boolean>;
  syncIndexersToApps: () => Promise<boolean>;
  rescanIndexers: () => Promise<boolean>;
  getSyncStatus: () => Promise<{
    connectedApps: string[];
    lastSyncTime?: string;
    syncInProgress: boolean;
  }>;
  getIndexerSchema: () => Promise<ProwlarrIndexerResource[]>;
  addIndexer: (application: ProwlarrIndexerResource) => Promise<boolean>;
  updateIndexer: (
    indexerId: number,
    data: Partial<ProwlarrIndexerResource>,
  ) => Promise<boolean>;
  bulkEnableDisable: (ids: number[], enable: boolean) => Promise<boolean>;
  bulkDelete: (ids: number[]) => Promise<boolean>;
  // Last API call made by this hook (for UI debugging / feedback)
  lastApiEvent?: ApiEvent | null;
  clearApiEvent: () => void;
}

export interface ApiEvent {
  action: string;
  method?: string;
  endpoint?: string;
  payload?: unknown;
  status: "pending" | "success" | "error";
  message?: string;
  details?: Record<string, unknown> | string;
}

export const useProwlarrIndexers = (
  serviceId: string,
): UseProwlarrIndexersResult => {
  const [indexers, setIndexers] = useState<ProwlarrIndexerResource[]>([]);
  const [statistics, setStatistics] = useState<ProwlarrStatistics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastApiEvent, setLastApiEvent] = useState<ApiEvent | null>(null);

  // Get connector instance
  const getConnector = useConnectorsStore(selectGetConnector);
  const connector = getConnector(serviceId);

  const formatDetails = (maybe: unknown): Record<string, unknown> | string => {
    if (maybe && typeof maybe === "object")
      return maybe as Record<string, unknown>;
    return String(maybe ?? "");
  };

  const loadData = useCallback(async () => {
    if (!connector) {
      setError("Connector not found");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load indexers
      const indexersData =
        (await (connector as any).getIndexers?.()) ??
        (connector as any).getApplications?.();
      setIndexers(indexersData || []);

      // Load statistics (stub for now)
      const stats =
        (await (connector as any).getIndexerStatistics?.()) ??
        (connector as any).getApplicationStatistics?.();
      setStatistics(stats || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load Prowlarr data";
      setError(errorMessage);
      void logger.error("Failed to load Prowlarr indexers", {
        error: err,
        serviceId,
      });
    } finally {
      setIsLoading(false);
    }
  }, [connector, serviceId]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const testIndexer = useCallback(
    async (
      indexer: ProwlarrIndexerResource,
    ): Promise<{ ok: boolean; message?: string }> => {
      if (!connector) return { ok: false, message: "Connector not available" };
      // Build a representative payload and endpoint for UI debugging
      const payload: Partial<components["schemas"]["IndexerResource"]> = {
        name: indexer.name,
        implementation: indexer.implementation,
        enable: indexer.enable,
      };
      const endpoint = "/api/v1/indexer/test";

      setLastApiEvent({
        action: "testIndexer",
        method: "POST",
        endpoint,
        payload,
        status: "pending",
      });

      try {
        const result: any = (connector as any).testIndexerConfig
          ? await (connector as any).testIndexerConfig(indexer)
          : await (connector as any).testApplication?.(indexer);

        // If API returned a test result object, reflect its validation status
        if (result && typeof result === "object") {
          if (result.isValid === false) {
            const details = Array.isArray(result.errors)
              ? result.errors.join("; ")
              : undefined;
            const message = details ?? result.message ?? "Indexer test failed";
            setLastApiEvent({
              action: "testIndexer",
              method: "POST",
              endpoint,
              payload,
              status: "error",
              message,
              details: result.errors ?? result,
            });
            return { ok: false, message };
          }
          setLastApiEvent({
            action: "testIndexer",
            method: "POST",
            endpoint,
            payload,
            status: "success",
          });
          return { ok: true };
        }

        // If no structured result, assume success
        setLastApiEvent({
          action: "testIndexer",
          method: "POST",
          endpoint,
          payload,
          status: "success",
        });
        return { ok: true };
      } catch (err: unknown) {
        void logger.error("Failed to test indexer", {
          error: err,
          serviceId,
          indexerId: indexer.id,
        });
        const message =
          err instanceof Error ? err.message : String(err ?? "Unknown error");
        const details = formatDetails(
          (err as { response?: { data?: unknown } })?.response?.data ?? err,
        );
        setLastApiEvent({
          action: "testIndexer",
          method: "POST",
          endpoint,
          payload,
          status: "error",
          message,
          details,
        });
        return { ok: false, message };
      }
    },
    [connector, serviceId],
  );

  const toggleIndexer = useCallback(
    async (indexer: ProwlarrIndexerResource): Promise<boolean> => {
      if (!connector) return false;
      const updatedIndexer = { ...indexer, enable: !indexer.enable };
      const endpoint = `/api/v1/indexer/${indexer.id}`;
      setLastApiEvent({
        action: "toggleIndexer",
        method: "PUT",
        endpoint,
        payload: updatedIndexer,
        status: "pending",
      });

      try {
        if ((connector as any).updateIndexer) {
          await (connector as any).updateIndexer(indexer.id, updatedIndexer);
        } else {
          await (connector as any).update?.(indexer.id, updatedIndexer);
        }
        await loadData(); // Refresh data after update
        setLastApiEvent({
          action: "toggleIndexer",
          method: "PUT",
          endpoint,
          payload: updatedIndexer,
          status: "success",
        });
        return true;
      } catch (err) {
        void logger.error("Failed to toggle indexer", {
          error: err,
          serviceId,
          indexerId: indexer.id,
        });
        const message =
          err instanceof Error ? err.message : String(err ?? "Unknown error");
        setLastApiEvent({
          action: "toggleIndexer",
          method: "PUT",
          endpoint,
          payload: updatedIndexer,
          status: "error",
          message,
          details: formatDetails(
            (err as { response?: { data?: unknown } })?.response?.data ?? err,
          ),
        });
        return false;
      }
    },
    [connector, serviceId, loadData],
  );

  const deleteIndexer = useCallback(
    async (indexerId: number): Promise<boolean> => {
      if (!connector) return false;
      const endpoint = `/api/v1/indexer/${indexerId}`;
      setLastApiEvent({
        action: "deleteIndexer",
        method: "DELETE",
        endpoint,
        status: "pending",
      });

      try {
        if ((connector as any).deleteIndexer) {
          await (connector as any).deleteIndexer(indexerId);
        } else {
          await (connector as any).delete?.(indexerId);
        }
        await loadData(); // Refresh data after deletion
        setLastApiEvent({
          action: "deleteIndexer",
          method: "DELETE",
          endpoint,
          status: "success",
        });
        return true;
      } catch (err) {
        void logger.error("Failed to delete indexer", {
          error: err,
          serviceId,
          indexerId,
        });
        const message =
          err instanceof Error ? err.message : String(err ?? "Unknown error");
        setLastApiEvent({
          action: "deleteIndexer",
          method: "DELETE",
          endpoint,
          status: "error",
          message,
          details: formatDetails(
            (err as { response?: { data?: unknown } })?.response?.data ?? err,
          ),
        });
        return false;
      }
    },
    [connector, serviceId, loadData],
  );

  const syncIndexersToApps = useCallback(async (): Promise<boolean> => {
    if (!connector) return false;

    try {
      await (connector as any).syncIndexersToApps();
      return true;
    } catch (err) {
      void logger.error("Failed to sync indexers to apps", {
        error: err,
        serviceId,
      });
      return false;
    }
  }, [connector, serviceId]);

  const rescanIndexers = useCallback(async (): Promise<boolean> => {
    if (!connector) return false;

    try {
      await (connector as any).rescanIndexers();
      return true;
    } catch (err) {
      void logger.error("Failed to rescan indexers", { error: err, serviceId });
      return false;
    }
  }, [connector, serviceId]);

  const getSyncStatus = useCallback(async () => {
    if (!connector) {
      return {
        connectedApps: [],
        lastSyncTime: undefined,
        syncInProgress: false,
      };
    }

    try {
      return await (connector as any).getSyncStatus();
    } catch (err) {
      void logger.error("Failed to get sync status", { error: err, serviceId });
      return {
        connectedApps: [],
        lastSyncTime: undefined,
        syncInProgress: false,
      };
    }
  }, [connector, serviceId]);

  const getIndexerSchema = useCallback(async (): Promise<
    ProwlarrIndexerResource[]
  > => {
    if (!connector) return [];
    try {
      if ((connector as any).getIndexerSchema) {
        return await (connector as any).getIndexerSchema();
      }
      return (await (connector as any).getApplicationSchema?.()) ?? [];
    } catch (err) {
      void logger.error("Failed to get indexer schema", {
        error: err,
        serviceId,
      });
      return [];
    }
  }, [connector, serviceId]);

  const addIndexer = useCallback(
    async (application: ProwlarrIndexerResource): Promise<boolean> => {
      if (!connector) return false;
      try {
        if ((connector as any).addIndexer) {
          await (connector as any).addIndexer(application);
        } else {
          await (connector as any).add?.(application);
        }
        await loadData();
        return true;
      } catch (err) {
        void logger.error("Failed to add indexer", { error: err, serviceId });
        return false;
      }
    },
    [connector, serviceId, loadData],
  );

  const updateIndexer = useCallback(
    async (
      indexerId: number,
      data: Partial<ProwlarrIndexerResource>,
    ): Promise<boolean> => {
      if (!connector) return false;
      try {
        if ((connector as any).updateIndexer) {
          await (connector as any).updateIndexer(indexerId, data);
        } else {
          await (connector as any).update?.(indexerId, data);
        }
        await loadData();
        return true;
      } catch (err) {
        void logger.error("Failed to update indexer", {
          error: err,
          serviceId,
          indexerId,
        });
        return false;
      }
    },
    [connector, serviceId, loadData],
  );

  const bulkEnableDisable = useCallback(
    async (ids: number[], enable: boolean): Promise<boolean> => {
      if (!connector) return false;
      const endpoint = "/api/v1/indexer/bulk";
      const payload = { ids, enable };
      setLastApiEvent({
        action: "bulkEnableDisable",
        method: "PUT",
        endpoint,
        payload,
        status: "pending",
      });

      try {
        if ((connector as any).bulkUpdateIndexers) {
          await (connector as any).bulkUpdateIndexers({ ids, enable });
        } else if ((connector as any).bulkUpdateApplications) {
          await (connector as any).bulkUpdateApplications({ ids, enable });
        } else {
          // Fallback: update one by one
          await Promise.all(
            ids.map((id) => (connector as any).update?.(id, { enable })),
          );
        }
        await loadData();
        setLastApiEvent({
          action: "bulkEnableDisable",
          method: "PUT",
          endpoint,
          payload,
          status: "success",
        });
        return true;
      } catch (err) {
        void logger.error("Failed to bulk enable/disable indexers", {
          error: err,
          serviceId,
          ids,
          enable,
        });
        const message =
          err instanceof Error ? err.message : String(err ?? "Unknown error");
        setLastApiEvent({
          action: "bulkEnableDisable",
          method: "PUT",
          endpoint,
          payload,
          status: "error",
          message,
          details: formatDetails(
            (err as { response?: { data?: unknown } })?.response?.data ?? err,
          ),
        });
        return false;
      }
    },
    [connector, serviceId, loadData],
  );

  const bulkDelete = useCallback(
    async (ids: number[]): Promise<boolean> => {
      if (!connector) return false;
      const endpoint = "/api/v1/indexer/bulk";
      const payload = { ids };
      setLastApiEvent({
        action: "bulkDelete",
        method: "DELETE",
        endpoint,
        payload,
        status: "pending",
      });

      try {
        if ((connector as any).bulkDeleteIndexers) {
          await (connector as any).bulkDeleteIndexers(ids);
        } else if ((connector as any).bulkDeleteApplications) {
          await (connector as any).bulkDeleteApplications(ids);
        } else {
          await Promise.all(ids.map((id) => (connector as any).delete?.(id)));
        }
        await loadData();
        setLastApiEvent({
          action: "bulkDelete",
          method: "DELETE",
          endpoint,
          payload,
          status: "success",
        });
        return true;
      } catch (err) {
        void logger.error("Failed to bulk delete indexers", {
          error: err,
          serviceId,
          ids,
        });
        const message =
          err instanceof Error ? err.message : String(err ?? "Unknown error");
        setLastApiEvent({
          action: "bulkDelete",
          method: "DELETE",
          endpoint,
          payload,
          status: "error",
          message,
          details: formatDetails(
            (err as { response?: { data?: unknown } })?.response?.data ?? err,
          ),
        });
        return false;
      }
    },
    [connector, serviceId, loadData],
  );

  const clearApiEvent = useCallback(() => {
    setLastApiEvent(null);
  }, []);

  // Load data on mount and when serviceId changes
  useEffect(() => {
    if (serviceId) {
      void loadData();
    }
  }, [loadData, serviceId]);

  return {
    indexers,
    statistics,
    isLoading,
    error,
    refresh,
    testIndexer,
    toggleIndexer,
    deleteIndexer,
    syncIndexersToApps,
    rescanIndexers,
    getSyncStatus,
    getIndexerSchema,
    addIndexer,
    updateIndexer,
    bulkEnableDisable,
    bulkDelete,
    lastApiEvent,
    clearApiEvent,
  };
};
