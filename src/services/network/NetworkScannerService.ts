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

export interface DiscoveredService {
  id: string;
  type: ServiceType;
  name: string;
  url: string;
  port: number;
  version?: string;
  detectedAt: Date;
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

const SERVICE_DETECTION_CONFIGS: Record<ServiceType, ServiceDetectionConfig> = {
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
  prowlarr: {
    type: 'prowlarr',
    commonPorts: [9696],
    detectionEndpoint: '/api/v1/system/status',
  },
};

export class NetworkScannerService {
  private isScanning = false;
  private abortController: AbortController | null = null;

  async scanNetwork(progressCallback?: ProgressCallback): Promise<NetworkScanResult> {
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
      const localIp = await this.getLocalIpAddress();
      const subnet = this.getSubnetFromIp(localIp);

      void logger.debug('Network info retrieved', {
        location: 'NetworkScannerService.scanNetwork',
        localIp,
        subnet,
      });

      // Calculate total hosts to scan
      const allHosts = this.generateHostIps(subnet);
      const totalServiceTypes = Object.keys(SERVICE_DETECTION_CONFIGS).length;
      const totalHosts = allHosts.length * totalServiceTypes;

      void logger.info('Starting service scan', {
        location: 'NetworkScannerService.scanNetwork',
        subnet,
        totalHosts,
        servicesToScan: Object.keys(SERVICE_DETECTION_CONFIGS),
      });

      // Scan common ports for each service type
      const discoveredServices: DiscoveredService[] = [];
      let scannedHosts = 0;

      for (const [serviceType, config] of Object.entries(SERVICE_DETECTION_CONFIGS)) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        const serviceTypeKey = serviceType as ServiceType;
        const services = await this.scanServiceType(serviceTypeKey, config, subnet, scannedHosts, progressCallback, totalHosts, discoveredServices);
        discoveredServices.push(...services);
        scannedHosts += services.length;
      }

      const scanDuration = Date.now() - startTime;

      const result: NetworkScanResult = {
        services: discoveredServices,
        scanDuration,
        scannedHosts,
      };

      void logger.info('Network scan completed', {
        location: 'NetworkScannerService.scanNetwork',
        discoveredServices: discoveredServices.length,
        scanDuration,
        scannedHosts,
        subnet,
        servicesFound: discoveredServices.map(s => ({ type: s.type, url: s.url, name: s.name })),
      });

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
    const CONCURRENT_REQUESTS = 15; // Limit concurrent requests to avoid overwhelming the network

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
        timeout: 2000, // Reduced timeout for faster scanning
        signal: this.abortController?.signal,
      });

      let response;
      let version: string | undefined;

      switch (serviceType) {
        case 'sonarr':
        case 'radarr':
          response = await client.get(config.detectionEndpoint);
          // Only parse version for successful responses, not 401 auth errors
          if (response.status >= 200 && response.status < 300) {
            version = response.data?.version;
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
          version = response.data?.trim();
          break;

        case 'prowlarr':
          response = await client.get(config.detectionEndpoint);
          version = response.data?.version;
          break;

        default:
          return null;
      }

      // Check if we got a response that indicates the service exists
      if (response && typeof response.status === 'number') {
        // For services that require API keys, 401 Unauthorized means the service is present
        const isAuthRequiredService = serviceType === 'sonarr' || serviceType === 'radarr';
        const isValidResponse = (response.status >= 200 && response.status < 300) ||
          (isAuthRequiredService && response.status === 401);

        if (isValidResponse) {
          const url = new URL(baseUrl);
          const port = parseInt(url.port, 10);

          return {
            id: `discovered_${serviceType}_${url.hostname}_${port}_${Date.now()}`,
            type: serviceType,
            name: `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} (${url.hostname}:${port})`,
            url: baseUrl,
            port,
            version: isAuthRequiredService && response.status === 401 ? undefined : version, // Don't set version for 401 responses
            detectedAt: new Date(),
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

  private generateHostIps(subnet: string): string[] {
    const hosts: string[] = [];

    // Scan all hosts in subnet (1-254) for comprehensive coverage
    for (let i = 1; i <= 254; i++) {
      hosts.push(`${subnet}.${i}`);
    }

    // Also add localhost for testing
    const additionalIps = [
      '127.0.0.1', // localhost
    ];

    // Add additional IPs if they're not already in the list
    for (const ip of additionalIps) {
      if (!hosts.includes(ip)) {
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
}