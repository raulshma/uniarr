import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Optional import - react-native-network-info may not be available on all platforms
let NetworkInfo: any = null;
try {
  const networkInfoModule = require('react-native-network-info');
  NetworkInfo = networkInfoModule.NetworkInfo;
} catch (error) {
  // react-native-network-info not available, will use NetInfo fallback
}

import { logger } from '@/services/logger/LoggerService';
import type { ServiceType } from '@/models/service.types';
import { secureStorage } from '@/services/storage/SecureStorage';
import type { NetworkScanHistory, RecentIP } from '@/services/storage/SecureStorage';

export interface DiscoveredService {
  id: string;
  type: ServiceType;
  name: string;
  url: string;
  port: number;
  version?: string;
  detectedAt: Date;
  requiresAuth?: boolean;
  authError?: string;
}

export interface NetworkScanResult {
  services: DiscoveredService[];
  scanDuration: number;
  scannedHosts: number;
}

export interface ScanProgress {
  currentHost: number;
  totalHosts: number;
  currentService: string;
  servicesFound: DiscoveredService[];
}

export type ProgressCallback = (progress: ScanProgress) => void;

export interface ServiceDetectionConfig {
  type: ServiceType;
  commonPorts: number[];
  detectionEndpoint: string;
  expectedResponsePattern?: string;
}

const SERVICE_DETECTION_CONFIGS: Partial<Record<ServiceType, ServiceDetectionConfig>> = {
  sonarr: {
    type: 'sonarr',
    commonPorts: [8989],
    detectionEndpoint: '/api/v3/system/status',
  },
  radarr: {
    type: 'radarr',
    commonPorts: [7878],
    detectionEndpoint: '/api/v3/system/status',
  },
  jellyseerr: {
    type: 'jellyseerr',
    commonPorts: [5055],
    detectionEndpoint: '/api/v1/status',
  },
  qbittorrent: {
    type: 'qbittorrent',
    commonPorts: [8080, 8091],
    detectionEndpoint: '/api/v2/app/version',
  },
  transmission: {
    type: 'transmission',
    commonPorts: [9091, 51413],
    detectionEndpoint: '/transmission/rpc',
  },
  deluge: {
    type: 'deluge',
    commonPorts: [58846],
    detectionEndpoint: '/json',
  },
  sabnzbd: {
    type: 'sabnzbd',
    commonPorts: [8080],
    detectionEndpoint: '/api',
  },
  prowlarr: {
    type: 'prowlarr',
    commonPorts: [9696],
    detectionEndpoint: '/api/v1/system/status',
  },
  bazarr: {
    type: 'bazarr',
    commonPorts: [6767],
    detectionEndpoint: '/api/system/status',
  },
};

export class NetworkScannerService {
  private isScanning = false;
  private abortController: AbortController | null = null;
  private fastScanMode = true; // Default to fast scan for better UX

  async scanNetwork(progressCallback?: ProgressCallback, fastScan: boolean = true, customIpAddress?: string): Promise<NetworkScanResult> {
    if (this.isScanning) {
      throw new Error('Network scan is already in progress');
    }

    this.isScanning = true;
    this.abortController = new AbortController();

    try {
      const startTime = Date.now();

      void logger.info('Starting network scan for services', {
        location: 'NetworkScannerService.scanNetwork',
      });

      // Get local IP and subnet
      let localIp: string;
      let subnet: string;
      
      if (customIpAddress) {
        // Validate custom IP address
        if (!this.isValidIpAddress(customIpAddress)) {
          throw new Error('Invalid IP address format. Please enter a valid IP address (e.g., 192.168.1.100)');
        }
        localIp = customIpAddress;
        subnet = this.getSubnetFromIp(customIpAddress);
      } else {
        localIp = await this.getLocalIpAddress();
        subnet = this.getSubnetFromIp(localIp);
      }

      void logger.debug('Network info retrieved', {
        location: 'NetworkScannerService.scanNetwork',
        localIp,
        subnet,
      });

      // Calculate total hosts to scan
      let allHosts: string[];
      let totalHosts: number;
      
      if (customIpAddress) {
        // For custom IP, only scan that specific IP
        allHosts = [customIpAddress];
        totalHosts = allHosts.length * Object.keys(SERVICE_DETECTION_CONFIGS).length;
      } else {
        // For network scan, scan all IPs in subnet
        allHosts = this.generateHostIps(subnet);
        totalHosts = allHosts.length * Object.keys(SERVICE_DETECTION_CONFIGS).length;
      }

      void logger.info('Starting service scan', {
        location: 'NetworkScannerService.scanNetwork',
        subnet,
        totalHosts,
        servicesToScan: Object.keys(SERVICE_DETECTION_CONFIGS),
        customIpAddress: !!customIpAddress,
        scanType: customIpAddress ? 'custom-ip' : 'network-subnet',
      });

      // Scan common ports for each service type with early termination
      const discoveredServices: DiscoveredService[] = [];
      let cumulativeScannedHosts = 0;

      // Scan priority hosts first for quick results
      let priorityHosts: string[];
      if (customIpAddress) {
        // For custom IP, the priority host is just that IP
        priorityHosts = [customIpAddress];
      } else {
        // For network scan, use priority hosts
        priorityHosts = this.generatePriorityHosts(subnet);
      }
      
      const priorityServices = await this.scanPriorityHosts(priorityHosts, progressCallback, totalHosts, discoveredServices, cumulativeScannedHosts);
      discoveredServices.push(...priorityServices);
      cumulativeScannedHosts += priorityHosts.length * Object.keys(SERVICE_DETECTION_CONFIGS).length;

      // If fast scan is disabled and not using custom IP, continue with comprehensive scan
      if (!fastScan && !customIpAddress && !this.abortController?.signal.aborted) {
        for (const [serviceType, config] of Object.entries(SERVICE_DETECTION_CONFIGS)) {
          if (this.abortController?.signal.aborted) {
            break;
          }

          const serviceTypeKey = serviceType as ServiceType;
          const services = await this.scanServiceType(serviceTypeKey, config, subnet, cumulativeScannedHosts, progressCallback, totalHosts, discoveredServices);
          discoveredServices.push(...services);
          cumulativeScannedHosts += allHosts.length;
        }
      }

      const scanDuration = Date.now() - startTime;

      const result: NetworkScanResult = {
        services: discoveredServices,
        scanDuration,
        scannedHosts: cumulativeScannedHosts,
      };

      void logger.info('Network scan completed', {
        location: 'NetworkScannerService.scanNetwork',
        discoveredServices: discoveredServices.length,
        scanDuration,
        scannedHosts: cumulativeScannedHosts,
        subnet,
        servicesFound: discoveredServices.map(s => ({ type: s.type, url: s.url, name: s.name })),
      });

      // Save scan history and recent IPs
      void this.saveScanHistory(result, subnet, customIpAddress);

      return result;
    } finally {
      this.isScanning = false;
      this.abortController = null;
    }
  }

  private async scanServiceType(
    serviceType: ServiceType,
    config: ServiceDetectionConfig,
    subnet: string,
    startScannedHosts: number,
    progressCallback?: ProgressCallback,
    totalHosts?: number,
    allDiscoveredServices?: DiscoveredService[],
  ): Promise<DiscoveredService[]> {
    const discoveredServices: DiscoveredService[] = [];
    const hosts = this.generateHostIps(subnet);
    const CONCURRENT_REQUESTS = 30; // Increased concurrency for faster scanning

    for (const port of config.commonPorts) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      // Scan hosts in batches to avoid overwhelming the network
      for (let i = 0; i < hosts.length; i += CONCURRENT_REQUESTS) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        const batch = hosts.slice(i, i + CONCURRENT_REQUESTS);
        const batchPromises = batch.map(async (host, batchIndex) => {
          if (this.abortController?.signal.aborted) {
            return null;
          }

          const hostIndex = i + batchIndex;

          try {
            const url = `http://${host}:${port}`;
            void logger.debug('Scanning host', {
              location: 'NetworkScannerService.scanServiceType',
              serviceType,
              url,
              port,
            });

            const service = await this.detectServiceAtUrl(serviceType, url, config);

            if (service) {
              void logger.info('Service detected', {
                location: 'NetworkScannerService.scanServiceType',
                serviceType,
                url,
                port,
              });

              discoveredServices.push(service);

              // Emit progress update when service is found
              if (progressCallback && totalHosts && allDiscoveredServices) {
                const currentHostIndex = startScannedHosts + hostIndex + 1;
                progressCallback({
                  currentHost: currentHostIndex,
                  totalHosts,
                  currentService: serviceType,
                  servicesFound: [...allDiscoveredServices, ...discoveredServices],
                });
              }

              return service;
            }

            return null;
          } catch (error) {
            // Connection failed, continue scanning
            void logger.debug('Connection failed', {
              location: 'NetworkScannerService.scanServiceType',
              serviceType,
              host,
              port,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
          }
        });

        await Promise.allSettled(batchPromises);

        // Emit progress update after each batch
        if (progressCallback && totalHosts && allDiscoveredServices) {
          const currentHostIndex = startScannedHosts + Math.min(i + CONCURRENT_REQUESTS, hosts.length);
          progressCallback({
            currentHost: currentHostIndex,
            totalHosts,
            currentService: serviceType,
            servicesFound: [...allDiscoveredServices, ...discoveredServices],
          });
        }
      }
    }

    return discoveredServices;
  }

  private async detectServiceAtUrl(
    serviceType: ServiceType,
    baseUrl: string,
    config: ServiceDetectionConfig,
  ): Promise<DiscoveredService | null> {
    try {
      const client = axios.create({
        baseURL: baseUrl,
        timeout: 1000, // Aggressive timeout for faster scanning
        signal: this.abortController?.signal,
      });

      let response;
      let version: string | undefined;
      let requiresAuth = false;
      let authError: string | undefined;

      switch (serviceType) {
        case 'sonarr':
        case 'radarr':
          try {
            response = await client.get(config.detectionEndpoint);
            // Only parse version for successful responses, not 401 auth errors
            if (response.status >= 200 && response.status < 300) {
              version = response.data?.version;
            }
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
              // 401 Unauthorized means the service is present but requires authentication
              requiresAuth = true;
              authError = 'Authentication required - API key needed';
              void logger.info('Service detected but requires authentication', {
                location: 'NetworkScannerService.detectServiceAtUrl',
                serviceType,
                url: baseUrl,
                status: 401,
              });
              // Create a mock response for 401 to continue processing
              response = { status: 401, data: {} };
            } else {
              throw error; // Re-throw other errors
            }
          }
          break;

        case 'jellyseerr':
          response = await client.get(config.detectionEndpoint);
          version = response.data?.version || response.data?.commitTag;
          break;

        case 'qbittorrent':
          response = await client.get(config.detectionEndpoint, {
            responseType: 'text',
          });
          // qBittorrent might return HTML error pages, try to extract version from response
          if (typeof response.data === 'string') {
            const versionMatch = response.data.match(/v?(\d+\.\d+\.\d+)/);
            if (versionMatch) {
              version = versionMatch[1];
            } else {
              // If it looks like HTML, don't set version
              version = response.data.includes('<') ? undefined : response.data.trim();
            }
          } else {
            version = response.data?.trim();
          }
          break;

        case 'prowlarr':
          try {
            response = await client.get(config.detectionEndpoint);
            // Only parse version for successful responses, not 401 auth errors
            if (response.status >= 200 && response.status < 300) {
              version = response.data?.version;
            }
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
              // 401 Unauthorized means the service is present but requires authentication
              requiresAuth = true;
              authError = 'Authentication required - API key needed';
              void logger.info('Service detected but requires authentication', {
                location: 'NetworkScannerService.detectServiceAtUrl',
                serviceType,
                url: baseUrl,
                status: 401,
              });
              // Create a mock response for 401 to continue processing
              response = { status: 401, data: {} };
            } else {
              throw error; // Re-throw other errors
            }
          }
          break;

        case 'bazarr':
          try {
            response = await client.get(config.detectionEndpoint);
            // Only parse version for successful responses, not 401 auth errors
            if (response.status >= 200 && response.status < 300) {
              version = response.data?.bazarrVersion || response.data?.version;
            }
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
              // 401 Unauthorized means the service is present but requires authentication
              requiresAuth = true;
              authError = 'Authentication required - API key needed';
              void logger.info('Service detected but requires authentication', {
                location: 'NetworkScannerService.detectServiceAtUrl',
                serviceType,
                url: baseUrl,
                status: 401,
              });
              // Create a mock response for 401 to continue processing
              response = { status: 401, data: {} };
            } else {
              throw error; // Re-throw other errors
            }
          }
          break;

        default:
          return null;
      }

      // Check if we got a response that indicates the service exists
      if (response && typeof response.status === 'number') {
        // For services that require API keys, 401 Unauthorized means the service is present
        const isAuthRequiredService = serviceType === 'sonarr' || serviceType === 'radarr' || serviceType === 'prowlarr' || serviceType === 'bazarr';
        const isValidResponse = (response.status >= 200 && response.status < 300) ||
          (isAuthRequiredService && response.status === 401);

        if (isValidResponse) {
          const url = new URL(baseUrl);
          const port = parseInt(url.port, 10);

          const serviceName = requiresAuth 
            ? `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} (${url.hostname}:${port}) - Auth Required`
            : `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} (${url.hostname}:${port})`;

          return {
            id: `discovered_${serviceType}_${url.hostname}_${port}_${Date.now()}`,
            type: serviceType,
            name: serviceName,
            url: baseUrl,
            port,
            version: requiresAuth ? undefined : version, // Don't set version for 401 responses
            detectedAt: new Date(),
            requiresAuth,
            authError,
          };
        }
      }

      return null;
    } catch (error) {
      // Service detection failed, not the expected service or not accessible
      return null;
    }
  }

  private async getLocalIpAddress(): Promise<string> {
    try {
      // Try NetInfo first (more reliable)
      const netInfo = await NetInfo.fetch();
      if (netInfo.details && 'ipAddress' in netInfo.details && netInfo.details.ipAddress && typeof netInfo.details.ipAddress === 'string') {
        void logger.debug('Got IP address from NetInfo', {
          location: 'NetworkScannerService.getLocalIpAddress',
          ipAddress: netInfo.details.ipAddress,
        });
        return netInfo.details.ipAddress;
      }

      // Fallback to react-native-network-info if available
      if (NetworkInfo && typeof NetworkInfo.getIPV4Address === 'function') {
        const ip = await NetworkInfo.getIPV4Address();
        if (ip) {
          void logger.debug('Got IP address from NetworkInfo', {
            location: 'NetworkScannerService.getLocalIpAddress',
            ipAddress: ip,
          });
          return ip;
        }
      }

      // If both fail, use default fallback
      void logger.warn('Unable to determine local IP address, using fallback', {
        location: 'NetworkScannerService.getLocalIpAddress',
        netInfoAvailable: !!netInfo.details,
        networkInfoAvailable: !!NetworkInfo,
      });

      return '192.168.1.1'; // Default fallback
    } catch (error) {
      void logger.warn('Failed to get local IP address', {
        location: 'NetworkScannerService.getLocalIpAddress',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return a default subnet for scanning common local ranges
      return '192.168.1.1'; // Default fallback
    }
  }

  private getSubnetFromIp(ip: string): string {
    // Extract subnet from IP (e.g., "192.168.1.100" -> "192.168.1")
    const parts = ip.split('.');
    if (parts.length === 4) {
      return parts.slice(0, 3).join('.');
    }
    // If IP format is invalid, return common local subnet
    return '192.168.1';
  }

  private generatePriorityHosts(subnet: string): string[] {
    // Scan most common device IPs first for quick results
    return [
      '127.0.0.1', // localhost
      `${subnet}.1`,   // Router/gateway
      `${subnet}.2`,   // Common device
      `${subnet}.100`, // Common device
      `${subnet}.101`, // Common device
      `${subnet}.102`, // Common device
      `${subnet}.200`, // Common device
      `${subnet}.254`, // Router backup
    ];
  }

  private async scanPriorityHosts(
    priorityHosts: string[],
    progressCallback?: ProgressCallback,
    totalHosts?: number,
    allDiscoveredServices?: DiscoveredService[],
    startScannedHosts: number = 0,
  ): Promise<DiscoveredService[]> {
    const discoveredServices: DiscoveredService[] = [];
    const CONCURRENT_REQUESTS = 30;

    // Scan all service types on priority hosts concurrently
    const allPromises: Promise<DiscoveredService | null>[] = [];

    for (const host of priorityHosts) {
      for (const [serviceType, config] of Object.entries(SERVICE_DETECTION_CONFIGS)) {
        for (const port of config.commonPorts) {
          const promise = this.detectServiceAtUrl(serviceType as ServiceType, `http://${host}:${port}`, config);
          allPromises.push(promise);
        }
      }
    }

    // Execute all priority scans concurrently
    const results = await Promise.allSettled(allPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        discoveredServices.push(result.value);
      }
    }

    // Update progress
    if (progressCallback && totalHosts && allDiscoveredServices) {
      progressCallback({
        currentHost: startScannedHosts + priorityHosts.length * Object.keys(SERVICE_DETECTION_CONFIGS).length,
        totalHosts,
        currentService: 'Priority Scan',
        servicesFound: [...allDiscoveredServices, ...discoveredServices],
      });
    }

    return discoveredServices;
  }

  private generateHostIps(subnet: string): string[] {
    const hosts: string[] = [];

    // Smart scanning: prioritize common router and device IPs first
    const priorityIps = [
      '127.0.0.1', // localhost
      `${subnet}.1`,   // Router/gateway
      `${subnet}.2`,   // Common device
      `${subnet}.100`, // Common device
      `${subnet}.101`, // Common device
      `${subnet}.102`, // Common device
      `${subnet}.200`, // Common device
      `${subnet}.254`, // Router backup
    ];

    // Add priority IPs first
    hosts.push(...priorityIps);

    // Scan ALL remaining IPs in the subnet (1-254) for comprehensive coverage
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      if (!priorityIps.includes(ip)) {
        hosts.push(ip);
      }
    }

    return hosts;
  }

  stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
    }

    void logger.info('Network scan stopped', {
      location: 'NetworkScannerService.stopScan',
    });
  }

  get isScanningInProgress(): boolean {
    return this.isScanning;
  }

  /**
   * Test a specific URL to see if it's a service
   * Useful for debugging and manual testing
   */
  async testServiceUrl(url: string): Promise<{ success: boolean; service?: DiscoveredService; error?: string }> {
    try {
      // Try to detect what service this might be
      for (const [serviceType, config] of Object.entries(SERVICE_DETECTION_CONFIGS)) {
        const serviceTypeKey = serviceType as ServiceType;
        const service = await this.detectServiceAtUrl(serviceTypeKey, url, config);
        if (service) {
          return { success: true, service };
        }
      }

      return { success: false, error: 'No supported service detected at this URL' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate IP address format
   */
  private isValidIpAddress(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Save scan history and recent IPs to storage
   */
  private async saveScanHistory(result: NetworkScanResult, subnet: string, customIpAddress?: string): Promise<void> {
    try {
      const scanHistory: NetworkScanHistory = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        duration: result.scanDuration,
        scannedHosts: result.scannedHosts,
        servicesFound: result.services.length,
        subnet,
        customIp: customIpAddress,
        services: result.services.map(s => ({
          type: s.type,
          name: s.name,
          url: s.url,
          port: s.port,
          version: s.version,
          requiresAuth: s.requiresAuth,
        })),
      };

      await secureStorage.saveNetworkScanHistory(scanHistory);

      // Add recent IPs (the subnet and any custom IP)
      if (customIpAddress) {
        await secureStorage.addRecentIP(customIpAddress, subnet, result.services.length);
      } else {
        // Add the subnet's gateway as a recent IP
        const gatewayIp = `${subnet}.1`;
        await secureStorage.addRecentIP(gatewayIp, subnet, result.services.length);
      }
    } catch (error) {
      void logger.warn('Failed to save scan history', {
        location: 'NetworkScannerService.saveScanHistory',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get scan history from storage
   */
  async getScanHistory(): Promise<NetworkScanHistory[]> {
    try {
      return await secureStorage.getNetworkScanHistory();
    } catch (error) {
      void logger.error('Failed to get scan history', {
        location: 'NetworkScannerService.getScanHistory',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get recent IPs from storage
   */
  async getRecentIPs(): Promise<RecentIP[]> {
    try {
      return await secureStorage.getRecentIPs();
    } catch (error) {
      void logger.error('Failed to get recent IPs', {
        location: 'NetworkScannerService.getRecentIPs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Clear scan history
   */
  async clearScanHistory(): Promise<void> {
    try {
      await secureStorage.clearNetworkScanHistory();
      await secureStorage.clearRecentIPs();
    } catch (error) {
      void logger.error('Failed to clear scan history', {
        location: 'NetworkScannerService.clearScanHistory',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}