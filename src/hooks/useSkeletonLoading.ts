import { useState, useEffect, useCallback, useRef } from "react";

export interface UseSkeletonLoadingOptions {
  /**
   * Minimum time to show skeleton in ms
   * @default 500
   */
  minLoadingTime?: number;
  /**
   * Maximum time to show skeleton in ms (0 for no limit)
   * @default 0
   */
  maxLoadingTime?: number;
  /**
   * Initial loading state
   * @default true
   */
  initialLoading?: boolean;
}

/**
 * Hook for managing skeleton loading states with timing constraints
 * Ensures skeletons show for at least a minimum time to avoid flashing
 */
export const useSkeletonLoading = ({
  minLoadingTime = 500,
  maxLoadingTime = 0,
  initialLoading = true,
}: UseSkeletonLoadingOptions = {}) => {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [showSkeleton, setShowSkeleton] = useState(initialLoading);
  const startTimeRef = useRef<number>(Date.now());
  const maxLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Start loading
  const startLoading = useCallback(() => {
    if (!isLoading) {
      setIsLoading(true);
      setShowSkeleton(true);
      startTimeRef.current = Date.now();

      if (minLoadingTimeoutRef.current) {
        clearTimeout(minLoadingTimeoutRef.current);
        minLoadingTimeoutRef.current = null;
      }

      // Set maximum loading time if specified
      if (maxLoadingTime > 0) {
        maxLoadingTimeoutRef.current = setTimeout(() => {
          setShowSkeleton(false);
          setIsLoading(false);
          maxLoadingTimeoutRef.current = null;
        }, maxLoadingTime);
      }
    }
  }, [isLoading, maxLoadingTime]);

  // Stop loading
  const stopLoading = useCallback(() => {
    if (isLoading) {
      setIsLoading(false);

      // Clear max loading timeout if it exists
      if (maxLoadingTimeoutRef.current) {
        clearTimeout(maxLoadingTimeoutRef.current);
        maxLoadingTimeoutRef.current = null;
      }

      if (minLoadingTimeoutRef.current) {
        clearTimeout(minLoadingTimeoutRef.current);
        minLoadingTimeoutRef.current = null;
      }

      // Ensure minimum loading time
      const elapsed = Date.now() - startTimeRef.current;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);

      if (remainingTime > 0) {
        minLoadingTimeoutRef.current = setTimeout(() => {
          setShowSkeleton(false);
          minLoadingTimeoutRef.current = null;
        }, remainingTime);
      } else {
        setShowSkeleton(false);
      }
    }
  }, [isLoading, minLoadingTime]);

  // Force stop loading immediately (ignores minimum time)
  const forceStopLoading = useCallback(() => {
    if (maxLoadingTimeoutRef.current) {
      clearTimeout(maxLoadingTimeoutRef.current);
      maxLoadingTimeoutRef.current = null;
    }
    if (minLoadingTimeoutRef.current) {
      clearTimeout(minLoadingTimeoutRef.current);
      minLoadingTimeoutRef.current = null;
    }
    setIsLoading(false);
    setShowSkeleton(false);
  }, []);

  // Toggle loading state
  const toggle = useCallback(() => {
    if (isLoading) {
      stopLoading();
    } else {
      startLoading();
    }
  }, [isLoading, startLoading, stopLoading]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (maxLoadingTimeoutRef.current) {
        clearTimeout(maxLoadingTimeoutRef.current);
      }
      if (minLoadingTimeoutRef.current) {
        clearTimeout(minLoadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    showSkeleton,
    startLoading,
    stopLoading,
    forceStopLoading,
    toggle,
  };
};
