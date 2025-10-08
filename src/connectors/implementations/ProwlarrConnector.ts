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

  // Indexer Management Methods

  /**
   * Get all applications (indexers)
   */
  async getApplications(): Promise<ProwlarrApplicationResource[]> {
    try {
      const response = await this.client.get('/api/v1/applications');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getApplications',
      });

      throw new Error(`Failed to get applications: ${diagnostic.message}`);
    }
  }

  /**
   * Get a specific application (indexer) by ID
   */
  async getApplicationById(id: number): Promise<ProwlarrApplicationResource> {
    try {
      const response = await this.client.get(`/api/v1/applications/${id}`);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getApplicationById',
      });

      throw new Error(`Failed to get application ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Create a new application (indexer)
   */
  async add(application: ProwlarrApplicationResource): Promise<ProwlarrApplicationResource> {
    try {
      const response = await this.client.post('/api/v1/applications', application);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'add',
      });

      throw new Error(`Failed to add application: ${diagnostic.message}`);
    }
  }

  /**
   * Update an existing application (indexer)
   */
  async update(id: number, data: Partial<ProwlarrApplicationResource>): Promise<ProwlarrApplicationResource> {
    try {
      const response = await this.client.put(`/api/v1/applications/${id}`, data);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'update',
      });

      throw new Error(`Failed to update application ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Delete an application (indexer)
   */
  async delete(id: number): Promise<boolean> {
    try {
      await this.client.delete(`/api/v1/applications/${id}`);
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'delete',
      });

      throw new Error(`Failed to delete application ${id}: ${diagnostic.message}`);
    }
  }

  /**
   * Test a specific application (indexer)
   */
  async testApplication(application: ProwlarrApplicationResource): Promise<ProwlarrTestResult> {
    try {
      const response = await this.client.post('/api/v1/applications/test', application);
      return response.data;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'testApplication',
      });

      throw new Error(`Failed to test application: ${diagnostic.message}`);
    }
  }

  /**
   * Test all applications (indexers)
   */
  async testAllApplications(): Promise<ProwlarrTestResult[]> {
    try {
      const response = await this.client.post('/api/v1/applications/testall');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'testAllApplications',
      });

      throw new Error(`Failed to test all applications: ${diagnostic.message}`);
    }
  }

  /**
   * Enable or disable applications (indexers)
   */
  async bulkUpdateApplications(bulkData: ProwlarrApplicationBulkResource): Promise<ProwlarrApplicationResource[]> {
    try {
      const response = await this.client.put('/api/v1/applications/bulk', bulkData);
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'bulkUpdateApplications',
      });

      throw new Error(`Failed to bulk update applications: ${diagnostic.message}`);
    }
  }

  /**
   * Delete multiple applications (indexers)
   */
  async bulkDeleteApplications(ids: number[]): Promise<boolean> {
    try {
      await this.client.delete('/api/v1/applications/bulk', {
        data: { ids }
      });
      return true;
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'bulkDeleteApplications',
      });

      throw new Error(`Failed to bulk delete applications: ${diagnostic.message}`);
    }
  }

  /**
   * Get application schema (for creating/editing forms)
   */
  async getApplicationSchema(): Promise<ProwlarrApplicationResource[]> {
    try {
      const response = await this.client.get('/api/v1/applications/schema');
      return response.data || [];
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getApplicationSchema',
      });

      throw new Error(`Failed to get application schema: ${diagnostic.message}`);
    }
  }

  /**
   * Execute action on applications (e.g., sync, rescan)
   */
  async executeApplicationAction(actionName: string, application?: ProwlarrApplicationResource): Promise<void> {
    try {
      await this.client.post(`/api/v1/applications/action/${actionName}`, application || {});
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'executeApplicationAction',
      });

      throw new Error(`Failed to execute action ${actionName}: ${diagnostic.message}`);
    }
  }

  /**
   * Get application statistics (indexer performance)
   */
  async getApplicationStatistics(): Promise<ProwlarrStatistics[]> {
    try {
      // This might not be a real endpoint, but based on the OpenAPI spec structure
      // We'll implement a basic version that could be extended
      const applications = await this.getApplications();

      // For now, return stub statistics - in a real implementation,
      // this would call an actual statistics endpoint
      return applications.map(app => ({
        applicationId: app.id,
        applicationName: app.name,
        statistics: {
          queries: 0,
          grabs: 0,
          averageResponseTime: 0,
          lastQueryTime: undefined,
          lastGrabTime: undefined,
        }
      }));
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getApplicationStatistics',
      });

      throw new Error(`Failed to get application statistics: ${diagnostic.message}`);
    }
  }

  /**
   * Sync indexers to connected applications (Sonarr, Radarr, etc.)
   */
  async syncIndexersToApps(): Promise<void> {
    try {
      await this.executeApplicationAction('sync');
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
      await this.executeApplicationAction('rescan');
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
        connectedApps: ['sonarr', 'radarr'], // This should be fetched from actual API
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

  // Search functionality for unified search integration
  async search(query: string, options?: SearchOptions): Promise<ProwlarrApplicationResource[]> {
    // Prowlarr doesn't have a traditional search API like Sonarr/Radarr
    // This would typically be used for searching available indexers or configurations
    // For now, return empty array as Prowlarr search is different from media search
    return [];
  }
}
