import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/queryKeys";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import {
  useLibraryFilterStore,
  type FilterMetadata,
} from "@/store/libraryFilterStore";

interface UseSonarrFilterMetadataOptions {
  serviceId: string;
}

interface UseRadarrFilterMetadataOptions {
  serviceId: string;
}

/**
 * Hook to fetch and store filter metadata for Sonarr
 */
export const useSonarrFilterMetadata = ({
  serviceId,
}: UseSonarrFilterMetadataOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const setMetadata = useLibraryFilterStore((state) => state.setMetadata);

  const connector = getConnector(serviceId) as SonarrConnector | undefined;
  const isValidConnector = connector?.config.type === "sonarr";

  const tagsQuery = useQuery({
    queryKey: queryKeys.sonarr.tags(serviceId),
    queryFn: async () => {
      if (!connector) throw new Error("Connector not available");
      return connector.getTags();
    },
    enabled: isValidConnector,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const qualityProfilesQuery = useQuery({
    queryKey: queryKeys.sonarr.qualityProfiles(serviceId),
    queryFn: async () => {
      if (!connector) throw new Error("Connector not available");
      return connector.getQualityProfiles();
    },
    enabled: isValidConnector,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Update store when data is loaded
  useEffect(() => {
    if (tagsQuery.data && qualityProfilesQuery.data) {
      const metadata: FilterMetadata = {
        tags: tagsQuery.data.map((tag) => ({
          id: tag.id as number,
          label: tag.label as string,
        })),
        qualityProfiles: qualityProfilesQuery.data.map((profile) => ({
          id: profile.id,
          name: profile.name,
        })),
      };
      setMetadata(serviceId, metadata);
    }
  }, [tagsQuery.data, qualityProfilesQuery.data, serviceId, setMetadata]);

  return {
    tags: tagsQuery.data,
    qualityProfiles: qualityProfilesQuery.data,
    isLoading: tagsQuery.isLoading || qualityProfilesQuery.isLoading,
    isError: tagsQuery.isError || qualityProfilesQuery.isError,
    error: tagsQuery.error || qualityProfilesQuery.error,
  };
};

/**
 * Hook to fetch and store filter metadata for Radarr
 */
export const useRadarrFilterMetadata = ({
  serviceId,
}: UseRadarrFilterMetadataOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const setMetadata = useLibraryFilterStore((state) => state.setMetadata);

  const connector = getConnector(serviceId) as RadarrConnector | undefined;
  const isValidConnector = connector?.config.type === "radarr";

  const tagsQuery = useQuery({
    queryKey: queryKeys.radarr.tags(serviceId),
    queryFn: async () => {
      if (!connector) throw new Error("Connector not available");
      return connector.getTags();
    },
    enabled: isValidConnector,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const qualityProfilesQuery = useQuery({
    queryKey: queryKeys.radarr.qualityProfiles(serviceId),
    queryFn: async () => {
      if (!connector) throw new Error("Connector not available");
      return connector.getQualityProfiles();
    },
    enabled: isValidConnector,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Update store when data is loaded
  useEffect(() => {
    if (tagsQuery.data && qualityProfilesQuery.data) {
      const metadata: FilterMetadata = {
        tags: tagsQuery.data.map((tag) => ({
          id: tag.id as number,
          label: tag.label as string,
        })),
        qualityProfiles: qualityProfilesQuery.data.map((profile) => ({
          id: profile.id,
          name: profile.name,
        })),
      };
      setMetadata(serviceId, metadata);
    }
  }, [tagsQuery.data, qualityProfilesQuery.data, serviceId, setMetadata]);

  return {
    tags: tagsQuery.data,
    qualityProfiles: qualityProfilesQuery.data,
    isLoading: tagsQuery.isLoading || qualityProfilesQuery.isLoading,
    isError: tagsQuery.isError || qualityProfilesQuery.isError,
    error: tagsQuery.error || qualityProfilesQuery.error,
  };
};
