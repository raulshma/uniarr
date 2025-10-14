import type { DiscoverMediaItem, DiscoverServiceSummary } from "@/models/discover.types";
import type { ServiceType } from "@/models/service.types";

export type AddDestinationKind = "sonarr" | "radarr" | "jellyseerr";

export type AddDestination = {
  key: string;
  kind: AddDestinationKind;
  serviceId: string;
  label: string;
};

export interface DestinationServices {
  sonarr: DiscoverServiceSummary[];
  radarr: DiscoverServiceSummary[];
  jellyseerr: DiscoverServiceSummary[];
}

export const mapServiceSummaries = (
  connectors: Array<{ config: { id: string; name: string; type: ServiceType } }>,
): DiscoverServiceSummary[] =>
  connectors.map((connector) => ({
    id: connector.config.id,
    name: connector.config.name,
    type: connector.config.type,
  } satisfies DiscoverServiceSummary));

export const buildDestinationOptions = (
  item: DiscoverMediaItem,
  services: DestinationServices,
): AddDestination[] => {
  const options: AddDestination[] = [];

  if (item.mediaType === "series") {
    options.push(
      ...services.sonarr.map((service) => ({
        key: `sonarr:${service.id}`,
        kind: "sonarr" as const,
        serviceId: service.id,
        label: `Send to Sonarr · ${service.name}`,
      })),
    );
  } else {
    options.push(
      ...services.radarr.map((service) => ({
        key: `radarr:${service.id}`,
        kind: "radarr" as const,
        serviceId: service.id,
        label: `Send to Radarr · ${service.name}`,
      })),
    );
  }

  const tmdbId = item.tmdbId ?? (typeof item.sourceId === "number" ? item.sourceId : undefined);
  if (tmdbId) {
    options.push(
      ...services.jellyseerr.map((service) => ({
        key: `jellyseerr:${service.id}`,
        kind: "jellyseerr" as const,
        serviceId: service.id,
        label: `Request via Jellyseerr · ${service.name}`,
      })),
    );
  }

  return options;
};
