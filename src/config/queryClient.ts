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
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: shouldRetryRequest,
    },
  },
});
