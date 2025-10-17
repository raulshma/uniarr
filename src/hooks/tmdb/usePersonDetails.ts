import { useQuery } from "@tanstack/react-query";

import type {
  PersonDetailsResponse,
  PersonMovieCreditsResponse,
  PersonTvCreditsResponse,
  PersonCombinedCreditsResponse,
  PersonImagesResponse,
  PersonExternalIdsResponse,
} from "@/connectors/implementations/TmdbConnector";
import { getTmdbConnector } from "@/services/tmdb/TmdbConnectorProvider";
import { queryKeys } from "@/hooks/queryKeys";

export interface UsePersonDetailsOptions {
  enabled?: boolean;
  language?: string;
  includeCredits?: boolean;
  includeImages?: boolean;
  includeExternalIds?: boolean;
}

export interface PersonDetailsResult {
  details: PersonDetailsResponse;
  movieCredits?: PersonMovieCreditsResponse;
  tvCredits?: PersonTvCreditsResponse;
  combinedCredits?: PersonCombinedCreditsResponse;
  images?: PersonImagesResponse;
  externalIds?: PersonExternalIdsResponse;
}

export const usePersonDetails = (
  personId: number | null,
  options: UsePersonDetailsOptions = {},
) => {
  const {
    enabled = true,
    language,
    includeCredits = true,
    includeImages = false,
    includeExternalIds = false,
  } = options;

  return useQuery<PersonDetailsResult, Error>({
    enabled: enabled && Boolean(personId),
    queryKey: queryKeys.tmdb.person.details(personId ?? 0, language),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (!personId) {
        throw new Error("Person ID is required for details lookup.");
      }

      const connector = await getTmdbConnector();
      if (!connector) {
        throw new Error("TMDB API key is not configured.");
      }

      // Fetch basic person details
      const details = await connector.getPersonDetails(personId, language);

      const result: PersonDetailsResult = { details };

      // Fetch additional data if requested
      if (includeCredits) {
        const [movieCredits, tvCredits, combinedCredits] =
          await Promise.allSettled([
            connector.getPersonMovieCredits(personId, language),
            connector.getPersonTvCredits(personId, language),
            connector.getPersonCombinedCredits(personId, language),
          ]);

        if (movieCredits.status === "fulfilled") {
          result.movieCredits = movieCredits.value;
        }
        if (tvCredits.status === "fulfilled") {
          result.tvCredits = tvCredits.value;
        }
        if (combinedCredits.status === "fulfilled") {
          result.combinedCredits = combinedCredits.value;
        }
      }

      if (includeImages) {
        try {
          result.images = await connector.getPersonImages(personId);
        } catch {
          // Non-critical, continue without images
        }
      }

      if (includeExternalIds) {
        try {
          result.externalIds = await connector.getPersonExternalIds(personId);
        } catch {
          // Non-critical, continue without external IDs
        }
      }

      return result;
    },
  });
};

// Separate hooks for specific person data if needed
export const usePersonMovieCredits = (
  personId: number | null,
  language?: string,
) => {
  return useQuery<PersonMovieCreditsResponse, Error>({
    enabled: Boolean(personId),
    queryKey: queryKeys.tmdb.person.movieCredits(personId ?? 0, language),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (!personId) {
        throw new Error("Person ID is required for movie credits lookup.");
      }

      const connector = await getTmdbConnector();
      if (!connector) {
        throw new Error("TMDB API key is not configured.");
      }

      return await connector.getPersonMovieCredits(personId, language);
    },
  });
};

export const usePersonTvCredits = (
  personId: number | null,
  language?: string,
) => {
  return useQuery<PersonTvCreditsResponse, Error>({
    enabled: Boolean(personId),
    queryKey: queryKeys.tmdb.person.tvCredits(personId ?? 0, language),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (!personId) {
        throw new Error("Person ID is required for TV credits lookup.");
      }

      const connector = await getTmdbConnector();
      if (!connector) {
        throw new Error("TMDB API key is not configured.");
      }

      return await connector.getPersonTvCredits(personId, language);
    },
  });
};

export const usePersonCombinedCredits = (
  personId: number | null,
  language?: string,
) => {
  return useQuery<PersonCombinedCreditsResponse, Error>({
    enabled: Boolean(personId),
    queryKey: queryKeys.tmdb.person.combinedCredits(personId ?? 0, language),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (!personId) {
        throw new Error("Person ID is required for combined credits lookup.");
      }

      const connector = await getTmdbConnector();
      if (!connector) {
        throw new Error("TMDB API key is not configured.");
      }

      return await connector.getPersonCombinedCredits(personId, language);
    },
  });
};
