import { useCallback, useEffect, useState } from 'react';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { ProwlarrApplicationResource, ProwlarrStatistics } from '@/models/prowlarr.types';
import { logger } from '@/services/logger/LoggerService';

interface UseProwlarrIndexersResult {
  indexers: ProwlarrApplicationResource[];
  statistics: ProwlarrStatistics[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  testIndexer: (indexer: ProwlarrApplicationResource) => Promise<{ ok: boolean; message?: string }>;
  toggleIndexer: (indexer: ProwlarrApplicationResource) => Promise<boolean>;
  deleteIndexer: (indexerId: number) => Promise<boolean>;
  syncIndexersToApps: () => Promise<boolean>;
  rescanIndexers: () => Promise<boolean>;
  getSyncStatus: () => Promise<{ connectedApps: string[]; lastSyncTime?: string; syncInProgress: boolean }>;
  getIndexerSchema: () => Promise<ProwlarrApplicationResource[]>;
  addIndexer: (application: ProwlarrApplicationResource) => Promise<boolean>;
  updateIndexer: (indexerId: number, data: Partial<ProwlarrApplicationResource>) => Promise<boolean>;
  bulkEnableDisable: (ids: number[], enable: boolean) => Promise<boolean>;
  bulkDelete: (ids: number[]) => Promise<boolean>;
}

export const useProwlarrIndexers = (serviceId: string): UseProwlarrIndexersResult => {
  const [indexers, setIndexers] = useState<ProwlarrApplicationResource[]>([]);
  const [statistics, setStatistics] = useState<ProwlarrStatistics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get connector instance
  const connector = ConnectorManager.getInstance().getConnector(serviceId);

  const loadData = useCallback(async () => {
    if (!connector) {
      setError('Connector not found');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load indexers
      const indexersData = await (connector as any).getIndexers?.() ?? (connector as any).getApplications?.();
      setIndexers(indexersData || []);

      // Load statistics (stub for now)
      const stats = await (connector as any).getIndexerStatistics?.() ?? (connector as any).getApplicationStatistics?.();
      setStatistics(stats || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Prowlarr data';
      setError(errorMessage);
      void logger.error('Failed to load Prowlarr indexers', { error: err, serviceId });
    } finally {
      setIsLoading(false);
    }
  }, [connector, serviceId]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const testIndexer = useCallback(async (indexer: ProwlarrApplicationResource): Promise<{ ok: boolean; message?: string }> => {
    if (!connector) return { ok: false, message: 'Connector not available' };

    try {
      const result: any = (connector as any).testIndexerConfig
        ? await (connector as any).testIndexerConfig(indexer)
        : await (connector as any).testApplication(indexer);

      // If API returned a test result object, reflect its validation status
      if (result && typeof result === 'object') {
        if (result.isValid === false) {
          const details = Array.isArray(result.errors) ? result.errors.join('; ') : undefined;
          return { ok: false, message: details ?? result.message ?? 'Indexer test failed' };
        }
        return { ok: true };
      }

      // If no structured result, assume success
      return { ok: true };
    } catch (err: any) {
      void logger.error('Failed to test indexer', { error: err, serviceId, indexerId: indexer.id });
      const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
      return { ok: false, message };
    }
  }, [connector, serviceId]);

  const toggleIndexer = useCallback(async (indexer: ProwlarrApplicationResource): Promise<boolean> => {
    if (!connector) return false;

    try {
      const updatedIndexer = { ...indexer, enable: !indexer.enable };
      if ((connector as any).updateIndexer) {
        await (connector as any).updateIndexer(indexer.id, updatedIndexer);
      } else {
        await (connector as any).update(indexer.id, updatedIndexer);
      }
      await loadData(); // Refresh data after update
      return true;
    } catch (err) {
      void logger.error('Failed to toggle indexer', { error: err, serviceId, indexerId: indexer.id });
      return false;
    }
  }, [connector, serviceId, loadData]);

  const deleteIndexer = useCallback(async (indexerId: number): Promise<boolean> => {
    if (!connector) return false;

    try {
      if ((connector as any).deleteIndexer) {
        await (connector as any).deleteIndexer(indexerId);
      } else {
        await (connector as any).delete(indexerId);
      }
      await loadData(); // Refresh data after deletion
      return true;
    } catch (err) {
      void logger.error('Failed to delete indexer', { error: err, serviceId, indexerId });
      return false;
    }
  }, [connector, serviceId, loadData]);

  const syncIndexersToApps = useCallback(async (): Promise<boolean> => {
    if (!connector) return false;

    try {
      await (connector as any).syncIndexersToApps();
      return true;
    } catch (err) {
      void logger.error('Failed to sync indexers to apps', { error: err, serviceId });
      return false;
    }
  }, [connector, serviceId]);

  const rescanIndexers = useCallback(async (): Promise<boolean> => {
    if (!connector) return false;

    try {
      await (connector as any).rescanIndexers();
      return true;
    } catch (err) {
      void logger.error('Failed to rescan indexers', { error: err, serviceId });
      return false;
    }
  }, [connector, serviceId]);

  const getSyncStatus = useCallback(async () => {
    if (!connector) {
      return { connectedApps: [], lastSyncTime: undefined, syncInProgress: false };
    }

    try {
      return await (connector as any).getSyncStatus();
    } catch (err) {
      void logger.error('Failed to get sync status', { error: err, serviceId });
      return { connectedApps: [], lastSyncTime: undefined, syncInProgress: false };
    }
  }, [connector, serviceId]);

  const getIndexerSchema = useCallback(async (): Promise<ProwlarrApplicationResource[]> => {
    if (!connector) return [];
    try {
      if ((connector as any).getIndexerSchema) {
        return await (connector as any).getIndexerSchema();
      }
      return await (connector as any).getApplicationSchema?.() ?? [];
    } catch (err) {
      void logger.error('Failed to get indexer schema', { error: err, serviceId });
      return [];
    }
  }, [connector, serviceId]);

  const addIndexer = useCallback(async (application: ProwlarrApplicationResource): Promise<boolean> => {
    if (!connector) return false;
    try {
      if ((connector as any).addIndexer) {
        await (connector as any).addIndexer(application);
      } else {
        await (connector as any).add(application);
      }
      await loadData();
      return true;
    } catch (err) {
      void logger.error('Failed to add indexer', { error: err, serviceId });
      return false;
    }
  }, [connector, serviceId, loadData]);

  const updateIndexer = useCallback(async (indexerId: number, data: Partial<ProwlarrApplicationResource>): Promise<boolean> => {
    if (!connector) return false;
    try {
      if ((connector as any).updateIndexer) {
        await (connector as any).updateIndexer(indexerId, data);
      } else {
        await (connector as any).update(indexerId, data);
      }
      await loadData();
      return true;
    } catch (err) {
      void logger.error('Failed to update indexer', { error: err, serviceId, indexerId });
      return false;
    }
  }, [connector, serviceId, loadData]);

  const bulkEnableDisable = useCallback(async (ids: number[], enable: boolean): Promise<boolean> => {
    if (!connector) return false;
    try {
      if ((connector as any).bulkUpdateIndexers) {
        await (connector as any).bulkUpdateIndexers({ ids, enable });
      } else if ((connector as any).bulkUpdateApplications) {
        await (connector as any).bulkUpdateApplications({ ids, enable });
      } else {
        // Fallback: update one by one
        await Promise.all(ids.map((id) => (connector as any).update?.(id, { enable })));
      }
      await loadData();
      return true;
    } catch (err) {
      void logger.error('Failed to bulk enable/disable indexers', { error: err, serviceId, ids, enable });
      return false;
    }
  }, [connector, serviceId, loadData]);

  const bulkDelete = useCallback(async (ids: number[]): Promise<boolean> => {
    if (!connector) return false;
    try {
      if ((connector as any).bulkDeleteIndexers) {
        await (connector as any).bulkDeleteIndexers(ids);
      } else if ((connector as any).bulkDeleteApplications) {
        await (connector as any).bulkDeleteApplications(ids);
      } else {
        await Promise.all(ids.map((id) => (connector as any).delete?.(id)));
      }
      await loadData();
      return true;
    } catch (err) {
      void logger.error('Failed to bulk delete indexers', { error: err, serviceId, ids });
      return false;
    }
  }, [connector, serviceId, loadData]);

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
  };
};
