import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Lightweight helper to prefetch queries before navigation. Call the returned
// function with a queryKey and fetcher; it will schedule a prefetch so the
// destination screen has data ready when mounted.
export const usePrefetchOnNavigate = () => {
  const qc = useQueryClient();

  const prefetch = useCallback(
    async <TData = unknown, TError = unknown>(
      queryKey: readonly unknown[],
      fetcher: () => Promise<TData>,
      options?: { staleTime?: number },
    ) => {
      try {
        // Use queryClient.prefetchQuery which will populate the cache if not
        // present. We intentionally don't await the data in UI code paths.
        await qc.prefetchQuery<TData, TError>({
          queryKey,
          queryFn: fetcher,
          staleTime: options?.staleTime ?? 5 * 60 * 1000,
        });
      } catch {
        // Prefetch failures are non-fatal; ignore them silently.
      }
    },
    [qc],
  );

  return { prefetch };
};
