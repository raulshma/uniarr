import { BaseConnector } from '@/connectors/base/BaseConnector';
import type { SearchOptions } from '@/connectors/base/IConnector';
import type {
  ProwlarrApplicationResource,
  ProwlarrApplicationBulkResource,
  ProwlarrTestResult,
  ProwlarrStatistics
} from '@/models/prowlarr.types';
import { handleApiError } from '@/utils/error.utils';

/**
 * Prowlarr connector for managing indexers and applications
 */
export class ProwlarrConnector extends BaseConnector<
  ProwlarrApplicationResource,
  ProwlarrApplicationResource,
  Partial<ProwlarrApplicationResource>
> {
  async initialize(): Promise<void> {
    // Prowlarr initialization - mainly authentication check
    await this.ensureAuthenticated();
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get('/api');
      return response.data.version || 'Unknown';
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
      });

      throw new Error(`Failed to get Prowlarr version: ${diagnostic.message}`);
    }
  }

  // Indexer Management Methods (use /api/v1/indexer)

  /**
   * Get all applications (indexers)
   */
  async getIndexers(): Promise<ProwlarrApplicationResource[]> {
    try {
      const response = await this.client.get('/api/v1/indexer');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getIndexers',
      });

      throw new Error(`Failed to get indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Get a specific application (indexer) by ID
   */
  async getIndexerById(id: number): Promise<ProwlarrApplicationResource> {
    try {
      const response = await this.client.get(`/api/v1/indexer/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getIndexerById',
      });

      throw new Error(`Failed to get indexer ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Create a new application (indexer)
   */
  async addIndexer(application: ProwlarrApplicationResource): Promise<ProwlarrApplicationResource> {
    try {
      const response = await this.client.post('/api/v1/indexer', application);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'addIndexer',
      });

      throw new Error(`Failed to add indexer: ${diagnostic.message}`);
    }
  }

  /**
   * Update an existing application (indexer)
   */
  async updateIndexer(id: number, data: Partial<ProwlarrApplicationResource>): Promise<ProwlarrApplicationResource> {
    try {
      const response = await this.client.put(`/api/v1/indexer/${id}`, data);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'updateIndexer',
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
        operation: 'deleteIndexer',
      });

      throw new Error(`Failed to delete indexer ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Test a specific application (indexer)
   */
  async testIndexerConfig(application: ProwlarrApplicationResource): Promise<ProwlarrTestResult> {
    try {
      const response = await this.client.post('/api/v1/indexer/test', application);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'testIndexerConfig',
      });

      throw new Error(`Failed to test indexer config: ${diagnostic.message}`);
    }
  }

  /**
   * Test all applications (indexers)
   */
  async testAllIndexers(): Promise<ProwlarrTestResult[]> {
    try {
      const response = await this.client.post('/api/v1/indexer/testall');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'testAllIndexers',
      });

      throw new Error(`Failed to test all indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Enable or disable applications (indexers)
   */
  async bulkUpdateIndexers(bulkData: ProwlarrApplicationBulkResource): Promise<ProwlarrApplicationResource[]> {
    try {
      const response = await this.client.put('/api/v1/indexer/bulk', bulkData);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'bulkUpdateIndexers',
      });

      throw new Error(`Failed to bulk update indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Delete multiple applications (indexers)
   */
  async bulkDeleteIndexers(ids: number[]): Promise<boolean> {
    try {
      await this.client.delete('/api/v1/indexer/bulk', {
        data: { ids }
      });
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'bulkDeleteIndexers',
      });

      throw new Error(`Failed to bulk delete indexers: ${diagnostic.message}`);
    }
  }

  /**
   * Get application schema (for creating/editing forms)
   */
  async getIndexerSchema(): Promise<ProwlarrApplicationResource[]> {
    try {
      const response = await this.client.get('/api/v1/indexer/schema');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getIndexerSchema',
      });

      throw new Error(`Failed to get indexer schema: ${diagnostic.message}`);
    }
  }

  /**
   * Execute action on applications (e.g., sync, rescan)
   */
  async executeCommand(commandName: string, payload?: Record<string, unknown>): Promise<void> {
    try {
      await this.client.post('/api/v1/command', { name: commandName, ...(payload ?? {}) });
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'executeCommand',
      });

      throw new Error(`Failed to execute command ${commandName}: ${diagnostic.message}`);
    }
  }

  /**
   * Get application statistics (indexer performance)
   */
  async getIndexerStatistics(): Promise<ProwlarrStatistics[]> {
    try {
      // No public statistics endpoint currently; derive minimal shape
      const indexers = await this.getIndexers();
      return indexers.map((idx) => ({
        applicationId: idx.id,
        applicationName: idx.name,
        statistics: {
          queries: 0,
          grabs: 0,
          averageResponseTime: 0,
          lastQueryTime: undefined,
          lastGrabTime: undefined,
        },
      }));
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getIndexerStatistics',
      });

      throw new Error(`Failed to get application statistics: ${diagnostic.message}`);
    }
  }

  /**
   * Sync indexers to connected applications (Sonarr, Radarr, etc.)
   */
  async syncIndexersToApps(): Promise<void> {
    try {
      await this.executeCommand('ApplicationIndexerSync');
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'syncIndexersToApps',
      });

      throw new Error(`Failed to sync indexers to apps: ${diagnostic.message}`);
    }
  }

  /**
   * Rescan all indexers for new content
   */
  async rescanIndexers(): Promise<void> {
    try {
      await this.executeCommand('IndexerRss');
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'rescanIndexers',
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
      // This would typically call a sync status endpoint
      // For now, return stub data
      return {
        connectedApps: [],
        lastSyncTime: undefined,
        syncInProgress: false,
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getSyncStatus',
      });

      throw new Error(`Failed to get sync status: ${diagnostic.message}`);
    }
  }

  // Backward-compatible method names to avoid breaking existing callers
  async getApplications(): Promise<ProwlarrApplicationResource[]> {
    return this.getIndexers();
  }
  async getApplicationById(id: number): Promise<ProwlarrApplicationResource> {
    return this.getIndexerById(id);
  }
  async add(application: ProwlarrApplicationResource): Promise<ProwlarrApplicationResource> {
    return this.addIndexer(application);
  }
  async update(id: number, data: Partial<ProwlarrApplicationResource>): Promise<ProwlarrApplicationResource> {
    return this.updateIndexer(id, data);
  }
  async delete(id: number): Promise<boolean> {
    return this.deleteIndexer(id);
  }
  async testApplication(application: ProwlarrApplicationResource): Promise<ProwlarrTestResult> {
    return this.testIndexerConfig(application);
  }
  async testAllApplications(): Promise<ProwlarrTestResult[]> {
    return this.testAllIndexers();
  }
  async bulkUpdateApplications(bulkData: ProwlarrApplicationBulkResource): Promise<ProwlarrApplicationResource[]> {
    return this.bulkUpdateIndexers(bulkData);
  }
  async bulkDeleteApplications(ids: number[]): Promise<boolean> {
    return this.bulkDeleteIndexers(ids);
  }
  async getApplicationSchema(): Promise<ProwlarrApplicationResource[]> {
    return this.getIndexerSchema();
  }
  async getApplicationStatistics(): Promise<ProwlarrStatistics[]> {
    return this.getIndexerStatistics();
  }

  // Search functionality for unified search integration
  async search(query: string, options?: SearchOptions): Promise<ProwlarrApplicationResource[]> {
    // Prowlarr doesn't have a traditional search API like Sonarr/Radarr
    // This would typically be used for searching available indexers or configurations
    // For now, return empty array as Prowlarr search is different from media search
    return [];
  }
}
