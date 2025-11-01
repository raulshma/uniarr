import { useMemo } from "react";
import type { ServiceType, ServiceConfig } from "@/models/service.types";
import { connectorRegistry } from "@/connectors/factory/ConnectorFactory";

export interface AvailableService {
  type: ServiceType;
  name: string;
  description: string;
  capabilities: string[];
  isConfigured: boolean;
  configuredCount: number;
  icon: string;
}

export interface UseAvailableServicesResult {
  availableServices: AvailableService[];
  configuredServices: ServiceType[];
  unconfiguredServices: AvailableService[];
}

// Service descriptions and capabilities
const SERVICE_INFO = {
  sonarr: {
    name: "Sonarr",
    description: "TV series management and PVR client for Usenet and torrents",
    capabilities: [
      "TV Series",
      "Auto-download",
      "Quality control",
      "Season management",
    ],
    icon: "television-classic",
  },
  radarr: {
    name: "Radarr",
    description: "Movie collection manager for Usenet and torrents",
    capabilities: [
      "Movies",
      "Auto-download",
      "Quality control",
      "Collection management",
    ],
    icon: "movie-open",
  },
  jellyseerr: {
    name: "Jellyseerr",
    description: "Request management for media and books",
    capabilities: [
      "Media requests",
      "User management",
      "Notifications",
      "Approval workflow",
    ],
    icon: "application-variable",
  },
  qbittorrent: {
    name: "qBittorrent",
    description: "BitTorrent client with web interface",
    capabilities: [
      "Torrent management",
      "Download control",
      "Speed limits",
      "Web UI",
    ],
    icon: "download",
  },
  transmission: {
    name: "Transmission",
    description: "Lightweight BitTorrent client",
    capabilities: ["Torrent management", "Remote control", "Bandwidth control"],
    icon: "download-network",
  },
  lidarr: {
    name: "Lidarr",
    description: "Music collection manager for Usenet and torrents",
    capabilities: ["Music", "Albums", "Artists", "Auto-download"],
    icon: "music-note",
  },
  readarr: {
    name: "Readarr",
    description: "Book and eBook collection manager",
    capabilities: ["Books", "eBooks", "Audiobooks", "Auto-download"],
    icon: "book-open-variant",
  },
  whisparr: {
    name: "Whisparr",
    description: "Adult movie collection manager",
    capabilities: ["Adult movies", "Auto-download", "Quality control"],
    icon: "filmstrip",
  },
  prowlarr: {
    name: "Prowlarr",
    description: "Indexer manager and proxy for various services",
    capabilities: ["Indexer management", "API proxy", "Search aggregation"],
    icon: "magnify-scan",
  },
  deluge: {
    name: "Deluge",
    description: "Feature-rich BitTorrent client",
    capabilities: ["Torrent management", "Plugins", "Web UI", "Remote control"],
    icon: "download-box",
  },
  jackett: {
    name: "Jackett",
    description: "API support for various torrent trackers",
    capabilities: ["Tracker API", "Search proxy", "Indexer management"],
    icon: "magnify-expand",
  },
  nzbhydra: {
    name: "NZBHydra",
    description: "Usenet indexer search and meta-search",
    capabilities: ["Usenet search", "Indexer aggregation", "NZB management"],
    icon: "magnify",
  },
  homarr: {
    name: "Homarr",
    description: "Customizable dashboard for services",
    capabilities: ["Dashboard", "Service organization", "Custom widgets"],
    icon: "view-dashboard",
  },
  overseerr: {
    name: "Overseerr",
    description: "Request management and discovery for Plex/Jellyfin",
    capabilities: ["Media requests", "User management", "Notifications"],
    icon: "application-variable-outline",
  },
  sabnzbd: {
    name: "SABnzbd",
    description: "Usenet binary newsreader",
    capabilities: [
      "NZB downloading",
      "Par repair",
      "Extracting",
      "Web interface",
    ],
    icon: "download-lock",
  },
} as const;

export const useAvailableServices = (
  configuredServices?: ServiceConfig[],
): UseAvailableServicesResult => {
  const availableServices = useMemo(() => {
    const configuredTypes = new Set(
      configuredServices?.map((s) => s.type) || [],
    );
    const configuredCounts = (configuredServices || []).reduce(
      (acc, service) => {
        acc[service.type] = (acc[service.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(connectorRegistry)
      .map(([type, info]) => {
        const serviceType = type as ServiceType;
        const serviceInfo = SERVICE_INFO[
          serviceType as keyof typeof SERVICE_INFO
        ] || {
          name: type.charAt(0).toUpperCase() + type.slice(1),
          description: `${type} service integration`,
          capabilities: [],
          icon: "server",
        };

        const isConfigured = configuredTypes.has(serviceType);
        const configuredCount = configuredCounts[type] || 0;

        return {
          type: serviceType,
          name: serviceInfo.name,
          description: serviceInfo.description,
          capabilities: [...serviceInfo.capabilities],
          isConfigured,
          configuredCount,
          icon: serviceInfo.icon,
        } as AvailableService;
      })
      .sort((a, b) => {
        // Sort by: configured first, then by name
        if (a.isConfigured && !b.isConfigured) return -1;
        if (!a.isConfigured && b.isConfigured) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [configuredServices]);

  const configuredServiceTypes = useMemo(() => {
    return configuredServices?.map((s) => s.type) || [];
  }, [configuredServices]);

  const unconfiguredServices = useMemo(() => {
    return availableServices.filter((service) => !service.isConfigured);
  }, [availableServices]);

  return {
    availableServices,
    configuredServices: configuredServiceTypes,
    unconfiguredServices,
  };
};
