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
    // Prepare a minimal payload that matches the API contract; some Prowlarr builds
    // are strict about the request body and will return 400 if extraneous or malformed
    // values are provided.
    const payload: any = {
      // Basic identity
      name: application.name,
      implementation: application.implementation,
      implementationName: application.implementationName,
      configContract: application.configContract,
      infoLink: application.infoLink,
      // Key flags
      enable: application.enable,
      priority: application.priority,
      syncLevel: application.syncLevel,
      // Tags and fields (fields must be name/value pairs)
      tags: application.tags ?? [],
      fields: Array.isArray(application.fields)
        ? application.fields.map((f) => ({ name: f.name, value: (f as any).value ?? f.value }))
        : [],
    };

    try {
      const response = await this.client.post('/api/v1/indexer/test', payload);
      return response.data;
    } catch (error) {
      // If API responds with 400, try to extract validation messages and include
      // them in the thrown error to make debugging easier in the client.
      const anyErr = error as any;
      const resp = anyErr?.response;
      if (resp && resp.status === 400 && resp.data) {
        // Prowlarr may return a body with message, errors, or model state
        const body = resp.data;
        let details = '';
        if (typeof body === 'string') {
          details = body;
        } else if (body.message) {
          details = String(body.message);
        }
        // Collect validation details if available
        if (body.errors && typeof body.errors === 'object') {
          try {
            details += '\n' + JSON.stringify(body.errors, null, 2);
          } catch (_) {
            details += '\n' + String(body.errors);
          }
        }
        if (body.modelState) {
          try {
            details += '\n' + JSON.stringify(body.modelState, null, 2);
          } catch (_) {
            details += '\n' + String(body.modelState);
          }
        }

        const diagnostic = handleApiError(error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: 'testIndexerConfig',
        });

        throw new Error(`Failed to test indexer config: ${diagnostic.message}${details ? ` - Details: ${details}` : ''}`);
      }

      // For other failures, attempt the applications/test endpoint as a fallback
      try {
        const fallbackResp = await this.client.post('/api/v1/applications/test', payload);
        return fallbackResp.data;
      } catch (fallbackErr) {
        const diagnostic = handleApiError(fallbackErr ?? error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: 'testIndexerConfig',
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
      // Fetch configured applications (these represent connected apps like Sonarr/Radarr)
      const appsResp = await this.client.get('/api/v1/applications');
      const applications: ProwlarrApplicationResource[] = appsResp.data ?? [];

      // Fetch recent commands to determine whether a sync is currently queued/started
      // and to derive the last sync time. The /api/v1/command endpoint returns command
      // records that include commandName and timestamp fields.
      let commands: any[] = [];
      try {
        const cmdResp = await this.client.get('/api/v1/command');
        commands = Array.isArray(cmdResp.data) ? cmdResp.data : (cmdResp.data?.records ?? []);
      } catch (cmdErr) {
        // Non-fatal - commands may not be available on all Prowlarr builds
        commands = [];
      }

      let connectedApps = applications.map((a) => a.name).filter(Boolean) as string[];

      // Some Prowlarr variants expose application profiles separately; try to fetch those
      if (connectedApps.length === 0) {
        try {
          const profilesResp = await this.client.get('/api/v1/appprofile');
          const profiles = profilesResp.data ?? [];
          const profileNames = (Array.isArray(profiles) ? profiles : []).map((p: any) => p.name).filter(Boolean);
          if (profileNames.length > 0) connectedApps = profileNames as string[];
        } catch (profileErr) {
          // ignore - appprofile endpoint may not be present on all versions
        }
      }

      // Look for ApplicationIndexerSync command entries to determine status and last run
      const syncCommands = commands.filter((c) => c.commandName === 'ApplicationIndexerSync');
      const syncInProgress = syncCommands.some((c) => ['queued', 'started'].includes(c.status));

      // Derive last sync time from the most recent completed/started command if available
      let lastSyncTime: string | undefined;
      if (syncCommands.length > 0) {
        const timestamps = syncCommands
          .map((c) => c.ended ?? c.started ?? c.queued)
          .filter(Boolean)
          .map((t: string) => new Date(t).getTime())
          .filter(Boolean);
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
