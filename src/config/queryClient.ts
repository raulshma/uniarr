import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { isApiError } from '@/utils/error.utils';

const shouldRetryRequest = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 3) {
    return false;
  }

  if (isApiError(error) && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }

  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  return true;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryRequest,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      // Defaults tuned for a mobile app: be conservative with refetches and
      // prefer cached data to improve perceived latency and reduce network
      // traffic. Individual hooks can override these for real-time screens.
      staleTime: 5 * 60 * 1000, // 5 minutes - treat most data as fresh for short periods
      gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep cached data longer for offline use
      refetchOnWindowFocus: false, // mobile apps don't need aggressive window-focus refetching
      refetchOnReconnect: true, // when device comes back online, attempt to refresh
      refetchInterval: false, // don't poll by default
      // Use offline-first network mode so cached data is used and network is
      // attempted when available. Hooks that need real-time updates should
      // opt into a different networkMode.
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: shouldRetryRequest,
      networkMode: 'offlineFirst', // Queue mutations when offline
    },
  },
});
