import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import { STALE_TIME, CACHE_TIME } from "@/hooks/queryConfig";
import {
  AppUpdateService,
  type UpdateCheckResult,
} from "@/services/appUpdate/AppUpdateService";

export interface UseAppUpdateCheckOptions {
  /**
   * Whether to enable the query. Default: true
   */
  enabled?: boolean;
}

/**
 * Hook to check for app updates from GitHub with caching
 * Caches result for 12 hours (RARELY stale time)
 * Falls back to releases page if API fails
 *
 * @example
 * const { data, isLoading, error, refetch } = useAppUpdateCheck();
 *
 * if (data?.hasUpdate) {
 *   // Show update button
 * }
 */
export function useAppUpdateCheck(options?: UseAppUpdateCheckOptions) {
  return useQuery({
    queryKey: queryKeys.app.updateCheck,
    queryFn: async (): Promise<UpdateCheckResult> => {
      return AppUpdateService.fetchLatestRelease();
    },
    // Cache update checks for 12 hours (rarely changes)
    staleTime: STALE_TIME.RARELY,
    // Keep in cache for 24 hours
    gcTime: CACHE_TIME.RARELY,
    // Don't automatically refetch on window focus
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    // Manual trigger - disabled by default
    enabled: options?.enabled ?? false,
  });
}
