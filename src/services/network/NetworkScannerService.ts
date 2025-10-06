import axios from 'axios';
import { NetworkInfo } from 'react-native-network-info';

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
    commonPorts: [8080],
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

  async scanNetwork(): Promise<NetworkScanResult> {
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
      const localIp = await NetworkInfo.getIPV4Address();
      const subnet = this.getSubnetFromIp(localIp);

      void logger.debug('Network info retrieved', {
        location: 'NetworkScannerService.scanNetwork',
        localIp,
        subnet,
      });

      // Scan common ports for each service type
      const discoveredServices: DiscoveredService[] = [];
      let scannedHosts = 0;

      for (const [serviceType, config] of Object.entries(SERVICE_DETECTION_CONFIGS)) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        const serviceTypeKey = serviceType as ServiceType;
        const services = await this.scanServiceType(serviceTypeKey, config, subnet, scannedHosts);
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
  ): Promise<DiscoveredService[]> {
    const discoveredServices: DiscoveredService[] = [];

    for (const port of config.commonPorts) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      // Scan all hosts in subnet for this port
      const hostPromises = this.generateHostIps(subnet).map(async (host) => {
        if (this.abortController?.signal.aborted) {
          return null;
        }

        try {
          const url = `http://${host}:${port}`;
          const service = await this.detectServiceAtUrl(serviceType, url, config);

          if (service) {
            void logger.debug('Service detected', {
              location: 'NetworkScannerService.scanServiceType',
              serviceType,
              url,
              port,
            });

            return service;
          }

          return null;
        } catch (error) {
          // Connection failed, continue scanning
          return null;
        }
      });

      const results = await Promise.allSettled(hostPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          discoveredServices.push(result.value);
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
        timeout: 3000,
        signal: this.abortController?.signal,
      });

      let response;
      let version: string | undefined;

      switch (serviceType) {
        case 'sonarr':
        case 'radarr':
          response = await client.get(config.detectionEndpoint);
          version = response.data?.version;
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

      // If we got a successful response, this looks like the expected service
      if (response && typeof response.status === 'number' && response.status >= 200 && response.status < 300) {
        const url = new URL(baseUrl);
        const port = parseInt(url.port, 10);

        return {
          id: `discovered_${serviceType}_${url.hostname}_${port}_${Date.now()}`,
          type: serviceType,
          name: `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} (${url.hostname}:${port})`,
          url: baseUrl,
          port,
          version,
          detectedAt: new Date(),
        };
      }

      return null;
    } catch (error) {
      // Service detection failed, not the expected service or not accessible
      return null;
    }
  }

  private getSubnetFromIp(ip: string): string {
    // Extract subnet from IP (e.g., "192.168.1.100" -> "192.168.1")
    const parts = ip.split('.');
    if (parts.length === 4) {
      return parts.slice(0, 3).join('.');
    }
    return ip;
  }

  private generateHostIps(subnet: string): string[] {
    const hosts: string[] = [];

    // Scan a reasonable range (typically 1-254 for local networks)
    // This could be optimized to scan only likely ranges
    for (let i = 1; i <= 254; i++) {
      hosts.push(`${subnet}.${i}`);
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
}